BEGIN;

-- Owner checks belong inside privileged functions, not only in the UI.
CREATE OR REPLACE FUNCTION public.void_invoice(p_invoice_id uuid, p_void_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invoice public.invoices;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices
    WHERE id = p_invoice_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status = 'paid' THEN RAISE EXCEPTION 'Cannot void a paid invoice'; END IF;
  IF nullif(trim(p_void_reason), '') IS NULL THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.invoices SET status = 'void', voided_at = now(),
    void_reason = trim(p_void_reason), updated_at = now() WHERE id = p_invoice_id;
END;
$$;
REVOKE ALL ON FUNCTION public.void_invoice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_invoice(uuid, text) TO authenticated;

-- A row lock and one transaction prevent partial updates and duplicate retries.
CREATE OR REPLACE FUNCTION public.record_manual_payment(p_invoice_id uuid)
RETURNS public.payment_records LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invoice public.invoices; v_payment public.payment_records;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices
    WHERE id = p_invoice_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF v_invoice.status IN ('void', 'cancelled') THEN RAISE EXCEPTION 'Cannot pay a cancelled invoice'; END IF;
  SELECT * INTO v_payment FROM public.payment_records
    WHERE invoice_id = p_invoice_id AND status = 'succeeded' ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND v_invoice.status = 'paid' THEN RETURN v_payment; END IF;
  IF v_invoice.total <= 0 THEN RAISE EXCEPTION 'Invoice total must be positive'; END IF;
  INSERT INTO public.payment_records(invoice_id, amount, currency, status, paid_at)
    VALUES(p_invoice_id, v_invoice.total, 'usd', 'succeeded', coalesce(v_invoice.paid_at, now()))
    RETURNING * INTO v_payment;
  UPDATE public.invoices SET status = 'paid', paid_at = v_payment.paid_at WHERE id = p_invoice_id;
  RETURN v_payment;
END;
$$;
REVOKE ALL ON FUNCTION public.record_manual_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_payment(uuid) TO authenticated;
COMMIT;
