\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(id,email) VALUES
('00000000-0000-0000-0000-000000000001','one@example.test'),
('00000000-0000-0000-0000-000000000002','two@example.test');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
CREATE FUNCTION public.test_item_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.description = 'Simulated failure' THEN RAISE EXCEPTION 'Simulated item insert failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_item_failure BEFORE INSERT ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.test_item_failure();
DO $$
DECLARE a public.invoices; b public.invoices; p public.payment_records; q public.payment_records;
  payload jsonb := '{"customer_name":"Test customer","issue_date":"2026-09-01","due_date":"2026-09-01","tax_rate":8.5,"items":[{"description":"Labor","quantity":1.5,"unit_price":20.25}]}';
  request uuid := '10000000-0000-0000-0000-000000000001'; count_before integer;
BEGIN
  a := public.save_invoice_draft(payload, request);
  b := public.save_invoice_draft(payload, request);
  ASSERT a.id = b.id, 'Retry must return same invoice';
  ASSERT a.total = 32.96, 'Money rounding must agree';
  ASSERT (SELECT count(*) FROM public.invoice_items WHERE invoice_id = a.id) = 1;
  SELECT count(*) INTO count_before FROM public.customers;
  BEGIN
    PERFORM public.save_invoice_draft(jsonb_set(payload, '{items,0,quantity}', '0'), gen_random_uuid());
    RAISE EXCEPTION 'Invalid quantity accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Invalid quantity accepted' THEN RAISE; END IF;
  END;
  ASSERT (SELECT count(*) FROM public.customers) = count_before, 'Failed save must roll back customer';
  BEGIN
    PERFORM public.save_invoice_draft(jsonb_set(payload, '{items,0,description}', '"Simulated failure"'), gen_random_uuid());
    RAISE EXCEPTION 'Failed item insert did not abort';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Simulated item insert failure' THEN RAISE; END IF;
  END;
  ASSERT (SELECT count(*) FROM public.customers) = count_before, 'Partial save must roll back customer';
  ASSERT (SELECT count(*) FROM public.invoices WHERE user_id = a.user_id) = 1, 'Partial save must roll back invoice';
  payload := jsonb_set(payload, '{customer_id}', to_jsonb(a.customer_id::text));
  b := public.save_invoice_draft(jsonb_set(payload, '{notes}', '"Updated"'), gen_random_uuid(), a.id);
  ASSERT b.id = a.id AND b.notes = 'Updated', 'Draft should update in place';
  ASSERT (SELECT invoice_count_current_month FROM public.profiles WHERE id = a.user_id) = 1, 'Edit must not consume quota';
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
  BEGIN
    PERFORM public.void_invoice(a.id, 'Unauthorized');
    RAISE EXCEPTION 'Cross-account void accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Cross-account void accepted' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.record_manual_payment(a.id);
    RAISE EXCEPTION 'Cross-account payment accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Cross-account payment accepted' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
  p := public.record_manual_payment(a.id); q := public.record_manual_payment(a.id);
  ASSERT p.id = q.id, 'Payment retry must not duplicate records';
  ASSERT (SELECT status FROM public.invoices WHERE id = a.id) = 'paid';
  BEGIN
    PERFORM public.save_invoice_draft(payload, gen_random_uuid(), a.id);
    RAISE EXCEPTION 'Paid invoice edit accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Paid invoice edit accepted' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'Invoice transaction regressions passed';
END;
$$;
ROLLBACK;
