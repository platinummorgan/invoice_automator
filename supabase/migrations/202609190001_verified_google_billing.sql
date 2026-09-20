-- Test rollout: guard the authorized test account and all server-verified accounts.
-- Legacy clients remain compatible until the production guard is activated.
BEGIN;
CREATE TABLE public.google_play_purchases (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purchase_token text NOT NULL,
  product_id text,
  subscription_state text,
  expires_at timestamptz,
  checked_at timestamptz NOT NULL DEFAULT '-infinity',
  next_check_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  last_error text,
  failed_attempts integer NOT NULL DEFAULT 0
);
ALTER TABLE public.google_play_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_play_purchases FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.google_play_purchases TO service_role;
CREATE INDEX google_play_purchases_user_idx ON public.google_play_purchases(user_id);
CREATE TABLE public.google_play_token_links (
  replaced_hash text PRIMARY KEY, successor_hash text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  CHECK (replaced_hash <> successor_hash)
);
ALTER TABLE public.google_play_token_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_play_token_links FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.google_play_token_links TO service_role;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_verified_at timestamptz;

-- Bind only tokens already saved against a legacy account. Never guess a token's owner.
INSERT INTO public.google_play_purchases(token_hash, user_id, purchase_token)
SELECT encode(sha256(convert_to(to_jsonb(p)->>'google_purchase_token', 'UTF8')), 'hex'),
  p.id, to_jsonb(p)->>'google_purchase_token'
FROM public.profiles p WHERE nullif(to_jsonb(p)->>'google_purchase_token', '') IS NOT NULL;
-- Duplicate legacy tokens intentionally fail this migration for manual review.

CREATE FUNCTION public.protect_subscription_fields() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE field text;
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN RETURN NEW; END IF;
  FOR field IN SELECT key FROM jsonb_object_keys(to_jsonb(NEW)) AS keys(key)
    WHERE key LIKE 'subscription_%' OR key IN ('google_purchase_token', 'invoice_limit')
  LOOP
    IF TG_OP = 'UPDATE' THEN
      IF (to_jsonb(NEW)->field) IS DISTINCT FROM (to_jsonb(OLD)->field) THEN
        RAISE EXCEPTION 'Subscription fields can only be changed by the billing server';
      END IF;
    ELSIF field = 'subscription_tier' THEN
      IF coalesce(to_jsonb(NEW)->>field, 'free') <> 'free' THEN RAISE EXCEPTION 'Invalid initial tier'; END IF;
    ELSIF field = 'subscription_status' THEN
      IF coalesce(to_jsonb(NEW)->>field, 'free') NOT IN ('free', 'active') THEN RAISE EXCEPTION 'Invalid initial status'; END IF;
    ELSIF field = 'invoice_limit' THEN
      IF coalesce((to_jsonb(NEW)->>field)::integer, 2) <> 2 THEN RAISE EXCEPTION 'Invalid initial invoice limit'; END IF;
    ELSIF nullif(to_jsonb(NEW)->>field, '') IS NOT NULL THEN
      RAISE EXCEPTION 'Subscription fields can only be set by the billing server';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_verified_subscription_updates BEFORE UPDATE ON public.profiles
FOR EACH ROW WHEN (OLD.subscription_verified_at IS NOT NULL OR OLD.id='dae69bb9-6bb1-4290-81a3-e2ae219568d7'::uuid)
EXECUTE FUNCTION public.protect_subscription_fields();
CREATE TRIGGER protect_test_subscription_inserts BEFORE INSERT ON public.profiles
FOR EACH ROW WHEN (NEW.id='dae69bb9-6bb1-4290-81a3-e2ae219568d7'::uuid)
EXECUTE FUNCTION public.protect_subscription_fields();

CREATE FUNCTION public.apply_google_play_verification(
  p_user uuid, p_token_hash text, p_purchase_token text, p_product text,
  p_state text, p_expires timestamptz, p_checked timestamptz, p_linked_hash text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.google_play_purchases; best public.google_play_purchases;
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
      expires_at=p_expires, checked_at=p_checked, next_check_at=now()+interval '5 minutes', last_error=NULL, failed_attempts=0 WHERE token_hash=p_token_hash;
  END IF;
  SELECT * INTO best FROM public.google_play_purchases WHERE user_id=p_user
    AND subscription_state IN ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_IN_GRACE_PERIOD')
    AND expires_at > now()
    AND NOT EXISTS(SELECT 1 FROM public.google_play_token_links WHERE replaced_hash=token_hash)
    ORDER BY expires_at DESC LIMIT 1;
  UPDATE public.profiles SET
    subscription_tier=CASE WHEN best.token_hash IS NULL THEN 'free' WHEN best.product_id='swift_invoice_pro_annual' THEN 'annual_basic' ELSE 'monthly_basic' END,
    subscription_status=CASE WHEN best.token_hash IS NULL THEN 'expired' WHEN best.subscription_state='SUBSCRIPTION_STATE_CANCELED' THEN 'cancelled' ELSE 'active' END,
    subscription_ends_at=coalesce(best.expires_at,p_expires), subscription_verified_at=now()
    WHERE id=p_user;
  RETURN jsonb_build_object('isPro',best.token_hash IS NOT NULL,'expiresAt',best.expires_at);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_google_play_verification(uuid,text,text,text,text,timestamptz,timestamptz,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_google_play_verification(uuid,text,text,text,text,timestamptz,timestamptz,text) TO service_role;
-- All billing RPCs are service-only; authenticated users cannot spoof an owner or result.
CREATE TABLE public.google_billing_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_started timestamptz NOT NULL, requests integer NOT NULL
);
ALTER TABLE public.google_billing_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.google_billing_rate_limits FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.google_billing_rate_limits TO service_role;
CREATE FUNCTION public.consume_google_billing_request(p_user uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE used integer;
BEGIN
  INSERT INTO public.google_billing_rate_limits(user_id,window_started,requests) VALUES(p_user,now(),1)
  ON CONFLICT(user_id) DO UPDATE SET
    requests=CASE WHEN google_billing_rate_limits.window_started < now()-interval '15 minutes' THEN 1 ELSE google_billing_rate_limits.requests+1 END,
    window_started=CASE WHEN google_billing_rate_limits.window_started < now()-interval '15 minutes' THEN now() ELSE google_billing_rate_limits.window_started END
  RETURNING requests INTO used;
  RETURN used <= 20;
END;
$$;
CREATE FUNCTION public.claim_google_billing_rechecks() RETURNS SETOF public.google_play_purchases
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
  WITH due AS (
    SELECT token_hash FROM public.google_play_purchases p WHERE next_check_at <= now()
      AND NOT EXISTS(SELECT 1 FROM public.google_play_token_links WHERE replaced_hash=p.token_hash)
      AND (checked_at='-infinity'::timestamptz OR expires_at > now()-interval '60 days')
    ORDER BY next_check_at LIMIT 10 FOR UPDATE SKIP LOCKED
  ) UPDATE public.google_play_purchases p SET next_check_at=now()+interval '2 minutes',last_attempt_at=now()
    FROM due WHERE p.token_hash=due.token_hash RETURNING p.*;
$$;
CREATE FUNCTION public.complete_google_billing_recheck(p_token_hash text,p_error text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.google_play_purchases SET
   failed_attempts=CASE WHEN p_error IS NULL THEN 0 ELSE least(failed_attempts+1,10) END,
   last_error=left(p_error,80),
   next_check_at=CASE WHEN p_error='token_no_longer_available' THEN 'infinity'::timestamptz
     ELSE now()+CASE WHEN p_error IS NULL THEN interval '5 minutes' ELSE interval '5 minutes'*least(failed_attempts+1,12) END END
 WHERE token_hash=p_token_hash;
$$;
CREATE FUNCTION public.expire_verified_google_access() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.profiles p SET subscription_tier='free',subscription_status='expired'
 WHERE subscription_verified_at IS NOT NULL AND subscription_ends_at <= now()
   AND subscription_tier IN ('pro','monthly_basic','annual_basic')
   AND NOT EXISTS(SELECT 1 FROM public.google_play_purchases g
     WHERE g.user_id=p.id AND g.expires_at>now()
     AND g.subscription_state IN ('SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_CANCELED','SUBSCRIPTION_STATE_IN_GRACE_PERIOD')
     AND NOT EXISTS(SELECT 1 FROM public.google_play_token_links l WHERE l.replaced_hash=g.token_hash));
$$;
REVOKE ALL ON FUNCTION public.consume_google_billing_request(uuid),public.claim_google_billing_rechecks(),public.complete_google_billing_recheck(text,text),public.expire_verified_google_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_google_billing_request(uuid),public.claim_google_billing_rechecks(),public.complete_google_billing_recheck(text,text),public.expire_verified_google_access() TO service_role;
COMMIT;
