-- Run only after verification succeeds, the billing migration is applied, and the functions are deployed.
-- The vault entry and Edge Function secret must contain the same generated random value.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM vault.decrypted_secrets WHERE name='billing_reconcile_secret') THEN
    RAISE EXCEPTION 'Create the billing_reconcile_secret Vault entry first';
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.invoke_google_billing_reconciliation() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE secret text; request_id bigint;
BEGIN
  SELECT decrypted_secret INTO secret FROM vault.decrypted_secrets WHERE name='billing_reconcile_secret';
  IF secret IS NULL THEN RAISE EXCEPTION 'Billing scheduler credential unavailable'; END IF;
  SELECT net.http_post(
    url:='https://dfqjfbtizqrzqujkvalx.supabase.co/functions/v1/reconcile-google-purchases',
    headers:=jsonb_build_object('Content-Type','application/json','x-billing-secret',secret),
    body:='{}'::jsonb,timeout_milliseconds:=60000
  ) INTO request_id;
  RETURN request_id;
END;
$$;
REVOKE ALL ON FUNCTION public.invoke_google_billing_reconciliation() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_google_billing_reconciliation() TO service_role;
SELECT cron.schedule('google-play-reconciliation','*/5 * * * *','select public.invoke_google_billing_reconciliation();');
COMMIT;
