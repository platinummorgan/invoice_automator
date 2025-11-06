-- Add void support to invoices table
-- This enables proper audit trail and prevents invoice manipulation

-- Update status constraint to include 'void'
ALTER TABLE public.invoices 
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices 
  ADD CONSTRAINT invoices_status_check 
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'));

-- Add void tracking columns
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- Create index for voided invoices
CREATE INDEX IF NOT EXISTS idx_invoices_void ON public.invoices(voided_at) 
  WHERE voided_at IS NOT NULL;

-- Function to void an invoice
CREATE OR REPLACE FUNCTION void_invoice(
  p_invoice_id UUID,
  p_void_reason TEXT
)
RETURNS void AS $$
BEGIN
  -- Only allow voiding if not already paid
  IF EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE id = p_invoice_id AND status = 'paid'
  ) THEN
    RAISE EXCEPTION 'Cannot void a paid invoice';
  END IF;

  -- Update invoice to void status
  UPDATE public.invoices
  SET 
    status = 'void',
    voided_at = NOW(),
    void_reason = p_void_reason,
    updated_at = NOW()
  WHERE id = p_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent editing sent/paid invoices
CREATE OR REPLACE FUNCTION prevent_invoice_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updates to status, paid_at, stripe fields, reminder fields
  IF OLD.status IN ('sent', 'paid', 'void') THEN
    -- Only allow updating specific fields
    IF (OLD.subtotal IS DISTINCT FROM NEW.subtotal OR
        OLD.tax_amount IS DISTINCT FROM NEW.tax_amount OR
        OLD.total IS DISTINCT FROM NEW.total OR
        OLD.issue_date IS DISTINCT FROM NEW.issue_date OR
        OLD.due_date IS DISTINCT FROM NEW.due_date OR
        OLD.notes IS DISTINCT FROM NEW.notes) THEN
      RAISE EXCEPTION 'Cannot modify % invoice. Void and create new invoice instead.', OLD.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent modifications
DROP TRIGGER IF EXISTS prevent_invoice_modification_trigger ON public.invoices;
CREATE TRIGGER prevent_invoice_modification_trigger
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_modification();

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.voided_at IS 'Timestamp when invoice was voided for audit trail';
COMMENT ON COLUMN public.invoices.void_reason IS 'Reason for voiding the invoice (e.g., pricing error, customer request)';
COMMENT ON FUNCTION void_invoice IS 'Safely void an invoice with reason, prevents voiding paid invoices';
