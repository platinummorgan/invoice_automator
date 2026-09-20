-- Apply when the verified-billing app is ready for production rollout.
BEGIN;
DROP TRIGGER protect_verified_subscription_updates ON public.profiles;
DROP TRIGGER protect_test_subscription_inserts ON public.profiles;
CREATE TRIGGER protect_subscription_fields BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_subscription_fields();
COMMIT;
