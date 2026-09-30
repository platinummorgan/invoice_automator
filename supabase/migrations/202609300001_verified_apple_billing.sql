BEGIN;

CREATE TABLE public.apple_store_transactions (
  original_transaction_id text PRIMARY KEY CHECK (original_transaction_id ~ '^[0-9]{5,30}$'),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latest_transaction_id text NOT NULL UNIQUE CHECK (latest_transaction_id ~ '^[0-9]{5,30}$'),
  product_id text NOT NULL CHECK (product_id IN ('swift_invoice_pro_monthly', 'swift_invoice_pro_annual')),
  subscription_state text NOT NULL CHECK (subscription_state IN ('active', 'expired', 'revoked', 'upgraded')),
  environment text NOT NULL CHECK (environment IN ('Production', 'Sandbox')),
  expires_at timestamptz NOT NULL,
  checked_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apple_store_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_store_transactions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.apple_store_transactions TO service_role;
CREATE INDEX apple_store_transactions_user_idx ON public.apple_store_transactions(user_id);

CREATE TABLE public.apple_billing_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_started timestamptz NOT NULL,
  requests integer NOT NULL
);
ALTER TABLE public.apple_billing_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apple_billing_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.apple_billing_rate_limits TO service_role;

CREATE FUNCTION public.consume_apple_billing_request(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE used integer;
BEGIN
  INSERT INTO public.apple_billing_rate_limits(user_id, window_started, requests)
    VALUES (p_user, now(), 1)
  ON CONFLICT(user_id) DO UPDATE SET
    requests = CASE WHEN apple_billing_rate_limits.window_started < now() - interval '15 minutes'
      THEN 1 ELSE apple_billing_rate_limits.requests + 1 END,
    window_started = CASE WHEN apple_billing_rate_limits.window_started < now() - interval '15 minutes'
      THEN now() ELSE apple_billing_rate_limits.window_started END
  RETURNING requests INTO used;
  RETURN used <= 20;
END;
$$;

CREATE FUNCTION public.refresh_verified_subscription(p_user uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE best record;
BEGIN
  SELECT entitlement.product_id, entitlement.expires_at, entitlement.state INTO best
  FROM (
    SELECT g.product_id, g.expires_at,
      CASE WHEN g.subscription_state = 'SUBSCRIPTION_STATE_CANCELED' THEN 'cancelled' ELSE 'active' END AS state
    FROM public.google_play_purchases g
    WHERE g.user_id = p_user
      AND g.subscription_state IN ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_CANCELED', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD')
      AND g.expires_at > now()
      AND NOT EXISTS (
        SELECT 1 FROM public.google_play_token_links l WHERE l.replaced_hash = g.token_hash
      )
    UNION ALL
    SELECT a.product_id, a.expires_at, 'active' AS state
    FROM public.apple_store_transactions a
    WHERE a.user_id = p_user AND a.subscription_state = 'active' AND a.expires_at > now()
  ) entitlement
  ORDER BY entitlement.expires_at DESC
  LIMIT 1;

  UPDATE public.profiles SET
    subscription_tier = CASE
      WHEN best.product_id IS NULL THEN 'free'
      WHEN best.product_id = 'swift_invoice_pro_annual' THEN 'annual_basic'
      ELSE 'monthly_basic'
    END,
    subscription_status = CASE WHEN best.product_id IS NULL THEN 'expired' ELSE best.state END,
    subscription_ends_at = CASE
      WHEN best.product_id IS NULL THEN coalesce(subscription_ends_at, now())
      ELSE best.expires_at
    END,
    subscription_verified_at = now()
  WHERE id = p_user;

  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  RETURN jsonb_build_object(
    'isPro', best.product_id IS NOT NULL,
    'expiresAt', best.expires_at,
    'productId', best.product_id
  );
END;
$$;

CREATE FUNCTION public.apply_apple_store_verification(
  p_user uuid,
  p_original_transaction_id text,
  p_transaction_id text,
  p_product text,
  p_state text,
  p_expires timestamptz,
  p_environment text,
  p_checked timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.apple_store_transactions;
BEGIN
  IF p_original_transaction_id !~ '^[0-9]{5,30}$'
    OR p_transaction_id !~ '^[0-9]{5,30}$'
    OR p_product NOT IN ('swift_invoice_pro_monthly', 'swift_invoice_pro_annual')
    OR p_state NOT IN ('active', 'expired', 'revoked', 'upgraded')
    OR p_environment NOT IN ('Production', 'Sandbox')
    OR p_expires IS NULL
    OR p_checked IS NULL
    OR p_checked > now() + interval '1 minute'
  THEN RAISE EXCEPTION 'Invalid Apple verification result'; END IF;

  PERFORM 1 FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;

  INSERT INTO public.apple_store_transactions(
    original_transaction_id, user_id, latest_transaction_id, product_id,
    subscription_state, environment, expires_at, checked_at
  ) VALUES (
    p_original_transaction_id, p_user, p_transaction_id, p_product,
    p_state, p_environment, p_expires, p_checked
  ) ON CONFLICT(original_transaction_id) DO NOTHING;

  SELECT * INTO existing FROM public.apple_store_transactions
    WHERE original_transaction_id = p_original_transaction_id FOR UPDATE;
  IF existing.user_id <> p_user THEN RAISE EXCEPTION 'Purchase belongs to another account'; END IF;

  IF existing.checked_at <= p_checked THEN
    UPDATE public.apple_store_transactions SET
      latest_transaction_id = p_transaction_id,
      product_id = p_product,
      subscription_state = p_state,
      environment = p_environment,
      expires_at = p_expires,
      checked_at = p_checked,
      updated_at = now()
    WHERE original_transaction_id = p_original_transaction_id;
  END IF;

  RETURN public.refresh_verified_subscription(p_user);
END;
$$;

-- Google and Apple can both provide the same cross-platform Pro service. Recompute
-- against both stores whenever Google verification changes an entitlement.
CREATE OR REPLACE FUNCTION public.apply_google_play_verification(
  p_user uuid, p_token_hash text, p_purchase_token text, p_product text,
  p_state text, p_expires timestamptz, p_checked timestamptz, p_linked_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.google_play_purchases;
BEGIN
  IF p_product NOT IN ('swift_invoice_pro_monthly','swift_invoice_pro_annual') OR p_product IS NULL
    OR p_expires IS NULL OR p_checked IS NULL OR p_checked > now() + interval '1 minute'
    OR p_state NOT IN ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_EXPIRED') OR p_state IS NULL
    OR p_token_hash IS DISTINCT FROM encode(sha256(convert_to(p_purchase_token,'UTF8')),'hex')
  THEN RAISE EXCEPTION 'Invalid Google verification result'; END IF;
  PERFORM 1 FROM public.profiles WHERE id=p_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
  INSERT INTO public.google_play_purchases(token_hash,user_id,purchase_token)
    VALUES(p_token_hash,p_user,p_purchase_token) ON CONFLICT DO NOTHING;
  SELECT * INTO existing FROM public.google_play_purchases WHERE token_hash=p_token_hash FOR UPDATE;
  IF existing.user_id <> p_user THEN RAISE EXCEPTION 'Purchase belongs to another account'; END IF;
  IF p_linked_hash IS NOT NULL THEN
    IF p_linked_hash !~ '^[a-f0-9]{64}$' OR p_linked_hash = p_token_hash THEN RAISE EXCEPTION 'Invalid linked token'; END IF;
    IF EXISTS(SELECT 1 FROM public.google_play_purchases WHERE token_hash=p_linked_hash AND user_id<>p_user)
      OR EXISTS(SELECT 1 FROM public.google_play_token_links WHERE replaced_hash=p_linked_hash AND (user_id<>p_user OR successor_hash<>p_token_hash))
      THEN RAISE EXCEPTION 'Linked purchase belongs to another subscription'; END IF;
    INSERT INTO public.google_play_token_links(replaced_hash,successor_hash,user_id)
      VALUES(p_linked_hash,p_token_hash,p_user) ON CONFLICT DO NOTHING;
  END IF;
  IF EXISTS(SELECT 1 FROM public.google_play_token_links WHERE replaced_hash=p_token_hash AND user_id<>p_user)
    THEN RAISE EXCEPTION 'Purchase belongs to another account'; END IF;
  IF existing.checked_at <= p_checked THEN
    UPDATE public.google_play_purchases SET product_id=p_product, subscription_state=p_state,
      expires_at=p_expires, checked_at=p_checked, next_check_at=now()+interval '5 minutes', last_error=NULL, failed_attempts=0
      WHERE token_hash=p_token_hash;
  END IF;
  RETURN public.refresh_verified_subscription(p_user);
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_verified_google_access() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.profiles p SET subscription_tier='free', subscription_status='expired'
  WHERE p.subscription_verified_at IS NOT NULL
    AND p.subscription_ends_at <= now()
    AND p.subscription_tier IN ('pro','monthly_basic','annual_basic')
    AND NOT EXISTS (
      SELECT 1 FROM public.google_play_purchases g
      WHERE g.user_id=p.id AND g.expires_at>now()
        AND g.subscription_state IN ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_IN_GRACE_PERIOD')
        AND NOT EXISTS(SELECT 1 FROM public.google_play_token_links l WHERE l.replaced_hash=g.token_hash)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.apple_store_transactions a
      WHERE a.user_id=p.id AND a.expires_at>now() AND a.subscription_state='active'
    );
$$;

REVOKE ALL ON FUNCTION public.consume_apple_billing_request(uuid),
  public.refresh_verified_subscription(uuid),
  public.apply_apple_store_verification(uuid,text,text,text,text,timestamptz,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_apple_billing_request(uuid),
  public.refresh_verified_subscription(uuid),
  public.apply_apple_store_verification(uuid,text,text,text,text,timestamptz,text,timestamptz)
  TO service_role;

COMMIT;
