BEGIN;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS request_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_phone text;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_request_unique ON public.invoices(user_id, request_id);

CREATE OR REPLACE FUNCTION public.save_invoice_draft(p_payload jsonb, p_request_id uuid, p_invoice_id uuid DEFAULT NULL)
RETURNS public.invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid(); v_invoice public.invoices; v_customer public.customers;
  v_item jsonb; v_subtotal numeric := 0; v_tax numeric; v_total numeric;
  v_number text; v_sequence integer; v_count integer; v_profile public.profiles;
  v_customer_id uuid; v_name text; v_email text; v_phone text;
  v_issue date; v_due date;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Request ID is required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  IF p_invoice_id IS NULL THEN
    SELECT * INTO v_invoice FROM public.invoices WHERE user_id = v_user AND request_id = p_request_id;
    IF FOUND THEN RETURN v_invoice; END IF;
  ELSE
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id AND user_id = v_user FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
    IF v_invoice.status <> 'draft' THEN RAISE EXCEPTION 'Only drafts can be edited'; END IF;
  END IF;
  v_issue := (p_payload->>'issue_date')::date; v_due := (p_payload->>'due_date')::date;
  v_tax := (p_payload->>'tax_rate')::numeric;
  IF v_issue IS NULL OR v_due IS NULL OR v_due < v_issue OR v_due > v_issue + 3650 THEN
    RAISE EXCEPTION 'Invalid invoice dates'; END IF;
  IF v_tax IS NULL OR v_tax NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid tax rate'; END IF;
  IF v_tax <> round(v_tax, 2) THEN RAISE EXCEPTION 'Tax rate must have at most two decimal places'; END IF;
  IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Items are required'; END IF;
  IF jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid item count'; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
    IF nullif(trim(v_item->>'description'), '') IS NULL
      OR coalesce((v_item->>'quantity')::numeric, 0) NOT BETWEEN 0.01 AND 999999
      OR coalesce((v_item->>'unit_price')::numeric, 0) NOT BETWEEN 0.01 AND 999999 THEN
      RAISE EXCEPTION 'Invalid item details'; END IF;
    IF (v_item->>'quantity')::numeric <> round((v_item->>'quantity')::numeric, 2)
      OR (v_item->>'unit_price')::numeric <> round((v_item->>'unit_price')::numeric, 2) THEN
      RAISE EXCEPTION 'Use at most two decimal places'; END IF;
    v_subtotal := v_subtotal + round((v_item->>'quantity')::numeric * (v_item->>'unit_price')::numeric, 2);
  END LOOP;
  v_total := v_subtotal + round(v_subtotal * v_tax / 100, 2);
  IF v_total > 99999999.99 THEN RAISE EXCEPTION 'Invoice total is too large'; END IF;
  v_customer_id := nullif(p_payload->>'customer_id', '')::uuid;
  IF v_customer_id IS NOT NULL THEN
    SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id AND user_id = v_user;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
    v_name := v_customer.name; v_email := v_customer.email; v_phone := v_customer.phone;
  ELSE
    v_name := trim(p_payload->>'customer_name'); v_email := nullif(trim(p_payload->>'customer_email'), '');
    v_phone := nullif(trim(p_payload->>'customer_phone'), '');
    IF nullif(v_name, '') IS NULL THEN RAISE EXCEPTION 'Customer name is required'; END IF;
    INSERT INTO public.customers(user_id, name, email, phone) VALUES(v_user, v_name, v_email, v_phone)
      RETURNING id INTO v_customer_id;
  END IF;
  IF p_invoice_id IS NULL THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user;
    SELECT count(*) INTO v_count FROM public.invoices WHERE user_id = v_user
      AND created_at >= (date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC');
    IF NOT coalesce((v_profile.subscription_tier IN ('pro', 'monthly_basic', 'annual_basic')
      AND v_profile.subscription_status IN ('active', 'cancelled')
      AND (v_profile.subscription_ends_at IS NULL OR v_profile.subscription_ends_at > now())), false) AND v_count >= 2 THEN
      RAISE EXCEPTION 'Monthly free invoice limit reached'; END IF;
    SELECT coalesce(max(substring(invoice_number FROM '[0-9]+$')::integer), 0) + 1 INTO v_sequence
      FROM public.invoices WHERE user_id = v_user AND invoice_number ~ ('^INV-' || to_char(now(), 'YYYY') || '-[0-9]+$');
    v_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(v_sequence::text, greatest(4, length(v_sequence::text)), '0');
    INSERT INTO public.invoices(user_id, customer_id, customer_name, customer_email, customer_phone,
      invoice_number, request_id, status, issue_date, due_date, subtotal, tax_rate, tax_amount, total, notes)
    VALUES(v_user, v_customer_id, v_name, v_email, v_phone, v_number, p_request_id, 'draft', v_issue, v_due,
      v_subtotal, v_tax, round(v_subtotal * v_tax / 100, 2), v_total, p_payload->>'notes') RETURNING * INTO v_invoice;
    UPDATE public.profiles SET invoice_count_current_month = v_count + 1 WHERE id = v_user;
  ELSE
    UPDATE public.invoices SET customer_id = v_customer_id, customer_name = v_name,
      customer_email = v_email, customer_phone = v_phone, issue_date = v_issue, due_date = v_due,
      subtotal = v_subtotal, tax_rate = v_tax, tax_amount = round(v_subtotal * v_tax / 100, 2),
      total = v_total, notes = p_payload->>'notes' WHERE id = p_invoice_id RETURNING * INTO v_invoice;
    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  END IF;
  INSERT INTO public.invoice_items(invoice_id, description, quantity, unit_price, amount, sort_order)
    SELECT v_invoice.id, trim(value->>'description'), (value->>'quantity')::numeric,
      (value->>'unit_price')::numeric, round((value->>'quantity')::numeric * (value->>'unit_price')::numeric, 2), ordinality - 1
    FROM jsonb_array_elements(p_payload->'items') WITH ORDINALITY;
  RETURN v_invoice;
END;
$$;
REVOKE ALL ON FUNCTION public.save_invoice_draft(jsonb, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_invoice_draft(jsonb, uuid, uuid) TO authenticated;
COMMIT;
