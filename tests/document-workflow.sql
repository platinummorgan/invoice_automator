\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000011'), ('00000000-0000-0000-0000-000000000012');
INSERT INTO public.profiles(id,email) VALUES
('00000000-0000-0000-0000-000000000011','workflow@example.test'),
('00000000-0000-0000-0000-000000000012','other@example.test');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
DO $$
DECLARE a public.invoices; b public.invoices; c public.invoices; p public.payment_records;
  payload jsonb := '{"document_type":"quote","customer_name":"Quote customer","customer_email":"customer@example.test","issue_date":"2026-09-21","due_date":"2026-10-21","tax_rate":8.5,"notes":"Keep my details","photos":[{"path":"00000000-0000-0000-0000-000000000011/before.jpg","stage":"before"}],"items":[{"description":"Labor","quantity":1.5,"unit_price":20.25}]}';
BEGIN
  a := public.save_invoice_draft(payload, gen_random_uuid());
  ASSERT a.document_type = 'quote' AND a.invoice_number LIKE 'QUO-%';
  BEGIN
    PERFORM public.record_manual_payment(a.id);
    RAISE EXCEPTION 'Quote payment accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  ASSERT (SELECT count(*) FROM public.payment_records WHERE invoice_id = a.id) = 0, 'Failed payment must roll back';
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', true);
  BEGIN
    PERFORM public.approve_quote(a.id);
    RAISE EXCEPTION 'Cross-owner approval accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Quote not found' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', true);
  UPDATE public.invoices SET status = 'sent' WHERE id = a.id;
  b := public.approve_quote(a.id); c := public.approve_quote(a.id);
  ASSERT b.id = a.id AND b.invoice_number = c.invoice_number AND b.document_type = 'invoice';
  ASSERT b.quote_number = a.invoice_number AND b.approved_at IS NOT NULL AND b.status = 'draft';
  ASSERT b.customer_id = a.customer_id AND b.customer_email = a.customer_email AND b.total = a.total AND b.notes = a.notes AND b.photos = a.photos;
  ASSERT (SELECT count(*) FROM public.invoice_items WHERE invoice_id = b.id) = 1;
  ASSERT (SELECT invoice_count_current_month FROM public.profiles WHERE id = b.user_id) = 1, 'Conversion must not count twice';
  PERFORM public.update_job(b.id, b.photos || '[{"path":"00000000-0000-0000-0000-000000000011/after.jpg","stage":"finished"}]', true);
  ASSERT (SELECT completed_at IS NOT NULL AND status = 'draft' FROM public.invoices WHERE id = b.id), 'Completion must not mark paid';
  BEGIN
    PERFORM public.update_job(b.id, '[{"path":"other-user/photo.jpg","stage":"before"}]', false);
    RAISE EXCEPTION 'Foreign photo accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Invalid photo' THEN RAISE; END IF;
  END;
  p := public.record_manual_payment(b.id);
  ASSERT (SELECT status = 'paid' AND jsonb_array_length(photos) = 2 FROM public.invoices WHERE id = b.id);
  ASSERT p.id = (public.record_manual_payment(b.id)).id;
  RAISE NOTICE 'Quote conversion, ownership, photos, completion and payment regressions passed';
END; $$;
ROLLBACK;
