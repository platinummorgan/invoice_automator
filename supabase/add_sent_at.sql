-- Add sent_at timestamp to track when invoices are emailed
-- This helps with automation tracking and customer communication history

ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for querying sent invoices
CREATE INDEX IF NOT EXISTS idx_invoices_sent_at ON public.invoices(sent_at) 
  WHERE sent_at IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.sent_at IS 'Timestamp when invoice was emailed to customer';
