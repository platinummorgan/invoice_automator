-- Add customer_name field to invoices table to preserve customer info even if customer is deleted
-- This allows invoice history to display customer names regardless of customer table changes

ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS customer_name TEXT;

-- Backfill existing invoices with customer names from the customers table
UPDATE public.invoices
SET customer_name = customers.name
FROM public.customers
WHERE invoices.customer_id = customers.id
  AND invoices.customer_name IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.customer_name IS 'Denormalized customer name - preserved even if customer is deleted';
