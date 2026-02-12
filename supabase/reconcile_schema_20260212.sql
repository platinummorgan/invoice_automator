-- Reconcile schema drift with current app behavior.
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT,
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Replace invalid/legacy status values before tightening constraints/default.
UPDATE public.invoices
SET status = 'draft'
WHERE status = 'unpaid';

ALTER TABLE public.invoices
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'monthly_basic', 'annual_basic', 'pro'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free', 'active', 'cancelled', 'expired'));

CREATE INDEX IF NOT EXISTS idx_invoices_sent_at
  ON public.invoices(sent_at)
  WHERE sent_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_void
  ON public.invoices(voided_at)
  WHERE voided_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.void_invoice(
  p_invoice_id UUID,
  p_void_reason TEXT
)
RETURNS void AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.invoices
    WHERE id = p_invoice_id
      AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Cannot void a paid invoice';
  END IF;

  UPDATE public.invoices
  SET
    status = 'void',
    voided_at = NOW(),
    void_reason = p_void_reason,
    updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('sent', 'paid', 'void') THEN
    IF (
      OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
      OLD.tax_amount IS DISTINCT FROM NEW.tax_amount OR
      OLD.total IS DISTINCT FROM NEW.total OR
      OLD.issue_date IS DISTINCT FROM NEW.issue_date OR
      OLD.due_date IS DISTINCT FROM NEW.due_date OR
      OLD.notes IS DISTINCT FROM NEW.notes
    ) THEN
      RAISE EXCEPTION 'Cannot modify % invoice. Void and create new invoice instead.', OLD.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_invoice_modification_trigger ON public.invoices;
CREATE TRIGGER prevent_invoice_modification_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoice_modification();

COMMENT ON COLUMN public.invoices.customer_name IS 'Denormalized customer name preserved for invoice history';
COMMENT ON COLUMN public.invoices.sent_at IS 'Timestamp when invoice was emailed to customer';
COMMENT ON COLUMN public.invoices.voided_at IS 'Timestamp when invoice was voided for audit trail';
COMMENT ON COLUMN public.invoices.void_reason IS 'Reason for voiding the invoice';
COMMENT ON COLUMN public.profiles.payment_methods IS 'Structured payment methods selected by user (type, label, value)';
