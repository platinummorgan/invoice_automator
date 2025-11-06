-- Add payment_instructions field for users to specify their payment methods
-- Examples: Venmo @username, Zelle phone, Cash App $tag, PayPal email, etc.

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.payment_instructions IS 'Payment methods accepted by this business (e.g., Venmo @username, Zelle: 555-1234, Cash App: $username, PayPal: email@example.com)';
