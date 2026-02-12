-- Add structured payment methods to profiles.
-- Stores selected method type + label + value/link for invoice emails.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_methods JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.payment_methods IS
  'Structured payment methods selected by user (type, label, value)';
