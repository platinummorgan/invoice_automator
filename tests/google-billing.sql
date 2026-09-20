\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(id,email) VALUES ('00000000-0000-0000-0000-000000000001','one@example.test'),('00000000-0000-0000-0000-000000000002','two@example.test');
DO $$
DECLARE u uuid := '00000000-0000-0000-0000-000000000001'; other_user uuid := '00000000-0000-0000-0000-000000000002';
 token text := 'test-purchase-token'; hash text := encode(sha256(convert_to(token,'UTF8')),'hex'); result jsonb; verified_time timestamptz := now();
BEGIN
 result := public.apply_google_play_verification(u,hash,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',verified_time);
 ASSERT (result->>'isPro')::boolean;
 ASSERT (SELECT subscription_ends_at FROM public.profiles WHERE id=u)=now()+interval '30 days';
 PERFORM public.apply_google_play_verification(u,hash,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',verified_time);
 ASSERT (SELECT count(*) FROM public.google_play_purchases)=1;
 BEGIN
   PERFORM public.apply_google_play_verification(other_user,hash,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '30 days',verified_time);
   RAISE EXCEPTION 'Token theft accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Purchase belongs to another account' THEN RAISE; END IF; END;
 PERFORM public.apply_google_play_verification(u,hash,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_EXPIRED',now()-interval '1 day',verified_time-interval '1 minute');
 ASSERT (SELECT subscription_tier FROM public.profiles WHERE id=u)='monthly_basic', 'Stale result must not overwrite later verification';
 PERFORM public.apply_google_play_verification(u,hash,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ON_HOLD',now()+interval '30 days',verified_time+interval '1 second');
 ASSERT (SELECT subscription_tier FROM public.profiles WHERE id=u)='free';
 ASSERT NOT has_function_privilege('authenticated','public.apply_google_play_verification(uuid,text,text,text,text,timestamptz,timestamptz,text)','EXECUTE');
 ASSERT NOT has_table_privilege('authenticated','public.google_play_purchases','SELECT');
 -- A replacement suppresses the old token even if an older Google snapshot later reports it active.
 PERFORM public.apply_google_play_verification(u,encode(sha256(convert_to('replacement-token','UTF8')),'hex'),'replacement-token','swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '60 days',verified_time,hash);
 PERFORM public.apply_google_play_verification(u,hash,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '100 days',verified_time+interval '2 seconds');
 ASSERT (SELECT subscription_ends_at FROM public.profiles WHERE id=u)=now()+interval '60 days';
 FOR i IN 1..20 LOOP ASSERT public.consume_google_billing_request(u); END LOOP;
 ASSERT NOT public.consume_google_billing_request(u);
 UPDATE public.google_play_purchases SET next_check_at=now()-interval '1 minute';
 ASSERT (SELECT count(*) FROM public.claim_google_billing_rechecks())=1, 'Superseded tokens must not be polled';
 ASSERT (SELECT count(*) FROM public.claim_google_billing_rechecks())=0, 'Leases prevent overlapping work';
 PERFORM public.complete_google_billing_recheck(encode(sha256(convert_to('replacement-token','UTF8')),'hex'),'google_http_401');
 ASSERT (SELECT subscription_tier FROM public.profiles WHERE id=u)='monthly_basic', 'Permission failures must not revoke access';
 ASSERT (SELECT failed_attempts FROM public.google_play_purchases WHERE purchase_token='replacement-token')=1;
 PERFORM public.complete_google_billing_recheck(encode(sha256(convert_to('replacement-token','UTF8')),'hex'),'token_no_longer_available');
 ASSERT (SELECT next_check_at FROM public.google_play_purchases WHERE purchase_token='replacement-token')='infinity'::timestamptz;
 ASSERT (SELECT subscription_tier FROM public.profiles WHERE id=u)='monthly_basic';

END;
$$;
-- Renewal extends the same token; a later revocation/expiry removes access.
DO $$
DECLARE u uuid := '00000000-0000-0000-0000-000000000002';
 token text := 'renewal-test-token'; h text := encode(sha256(convert_to(token,'UTF8')),'hex'); t timestamptz := now();
BEGIN
 PERFORM public.apply_google_play_verification(u,h,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '5 minutes',t);
 PERFORM public.apply_google_play_verification(u,h,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_ACTIVE',now()+interval '10 minutes',t+interval '1 second');
 ASSERT (SELECT subscription_ends_at FROM public.profiles WHERE id=u)=now()+interval '10 minutes', 'Renewal must extend access';
 PERFORM public.apply_google_play_verification(u,h,token,'swift_invoice_pro_monthly','SUBSCRIPTION_STATE_EXPIRED',now()-interval '1 second',t+interval '2 seconds');
 ASSERT (SELECT subscription_tier FROM public.profiles WHERE id=u)='free', 'Google expiry/revocation must remove access';
 ASSERT (SELECT subscription_tier FROM public.profiles WHERE id='00000000-0000-0000-0000-000000000001')='monthly_basic', 'Other account must retain access';
END;
$$;
GRANT USAGE ON SCHEMA public,auth TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.profiles TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$
BEGIN
 UPDATE public.profiles SET business_name='Permitted business edit' WHERE id=auth.uid();
 ASSERT (SELECT business_name FROM public.profiles WHERE id=auth.uid())='Permitted business edit';
 BEGIN
  UPDATE public.profiles SET subscription_tier='pro' WHERE id=auth.uid();
  RAISE EXCEPTION 'Client grant accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Subscription fields can only be changed by the billing server' THEN RAISE; END IF; END;
 BEGIN
  UPDATE public.profiles SET subscription_ends_at=now()+interval '10 years' WHERE id=auth.uid();
  RAISE EXCEPTION 'Client expiry accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'Subscription fields can only be changed by the billing server' THEN RAISE; END IF; END;
END;
$$;
ROLLBACK;
