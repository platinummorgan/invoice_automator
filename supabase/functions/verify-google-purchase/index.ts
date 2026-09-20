import { googleAccessToken, verifyAndApply, GoogleVerificationError } from '../_shared/googleBilling.ts';
import { PACKAGE_NAME } from './entitlement.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return reply({ error: 'Sign in required' }, 401);
  const url = Deno.env.get('SUPABASE_URL')!;
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return reply({ error: 'Sign in required' }, 401);
  if (!Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON')) return reply({ error: 'Subscription verification is temporarily unavailable. Please try again later.' }, 503);
  try {
    const body = await req.text();
    if (body.length > 12000) return reply({ error: 'Request too large' }, 413);
    const input = JSON.parse(body);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ error: 'Invalid request' }, 400);
    const billingEnabled = Deno.env.get('GOOGLE_PLAY_BILLING_ENABLED') === 'true';
    const testEmails = (Deno.env.get('GOOGLE_PLAY_BILLING_TEST_EMAILS') || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
    const isTester = !!user.email_confirmed_at && !!user.email && testEmails.includes(user.email.toLowerCase());
    if (!billingEnabled && !isTester) return reply({ error: 'Subscription verification is being configured. Please try again later.' }, 503);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    // Preflight blocks checkout until Google authentication and the storage migration are ready.
    const { data: allowed, error: limitError } = await admin.rpc('consume_google_billing_request', { p_user: user.id });
    if (limitError) throw new Error('Billing request limit unavailable');
    if (!allowed) return reply({ error: 'Too many attempts. Please wait a few minutes and try again.' }, 429);
    const accessToken = await googleAccessToken();
    if (input.action === 'ready') {
      const catalog = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/subscriptions?pageSize=1`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
      if (!catalog.ok) throw new Error('Google Play app access is not ready');
      const { error } = await admin.from('google_play_purchases').select('token_hash', { count: 'exact', head: true });
      if (error) throw new Error('Purchase storage is not ready');
      return reply({ ready: true });
    }
    const token = input.purchaseToken;
    if (typeof token !== 'string' || token.length < 10 || token.length > 8000) return reply({ error: 'A Google Play purchase token is required' }, 400);
    return reply(await verifyAndApply(admin, user.id, token, accessToken));
  } catch (error) {
    // Never log service-account keys, purchase tokens, or raw Google responses.
    const status = error instanceof GoogleVerificationError ? error.status : 503;
    return reply({ error: status === 503 ? 'Subscription verification is temporarily unavailable. Please try again later.' : 'Unable to verify this purchase for your account. Try restoring or contact support.' }, status);
  }
});
