-- Add subscription fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS invoice_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invoice_limit INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_purchase_token TEXT;

-- Add check constraint for subscription_status
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_subscription_status_check 
CHECK (subscription_status IN ('free', 'active', 'expired', 'cancelled'));

-- Add check constraint for subscription_tier
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_subscription_tier_check 
CHECK (subscription_tier IN ('free', 'pro'));

-- Comment on columns
COMMENT ON COLUMN public.profiles.subscription_status IS 'Current subscription status: free, active, expired, cancelled';
COMMENT ON COLUMN public.profiles.subscription_tier IS 'Subscription tier: free (2 invoices), pro (unlimited)';
COMMENT ON COLUMN public.profiles.invoice_count IS 'Number of invoices created this billing period';
COMMENT ON COLUMN public.profiles.invoice_limit IS 'Maximum invoices allowed (2 for free, unlimited for pro)';
COMMENT ON COLUMN public.profiles.subscription_expires_at IS 'When the current subscription period expires';
COMMENT ON COLUMN public.profiles.google_purchase_token IS 'Google Play purchase token for verification';

-- Create function to reset invoice count monthly for free users
CREATE OR REPLACE FUNCTION reset_free_invoice_counts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET invoice_count = 0
  WHERE subscription_tier = 'free'
  AND invoice_count > 0;
END;
$$;

COMMENT ON FUNCTION reset_free_invoice_counts() IS 'Resets invoice count for free tier users (run monthly via cron)';
