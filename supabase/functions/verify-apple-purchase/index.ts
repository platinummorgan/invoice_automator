import { createClient } from 'npm:@supabase/supabase-js@2';
import { AppleVerificationError, verifyAndApplyApple } from '../_shared/appleBilling.ts';

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

  try {
    const raw = await req.text();
    if (raw.length > 35000) return reply({ error: 'Request too large' }, 413);
    const input = JSON.parse(raw);
    if (!input || typeof input !== 'object' || Array.isArray(input)) return reply({ error: 'Invalid request' }, 400);
    const enabled = Deno.env.get('APPLE_BILLING_ENABLED') === 'true';
    const testEmails = (Deno.env.get('APPLE_BILLING_TEST_EMAILS') || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
    const isTester = !!user.email_confirmed_at && !!user.email && testEmails.includes(user.email.toLowerCase());
    if (!enabled && !isTester) return reply({ error: 'Subscription verification is being configured. Please try again later.' }, 503);

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: allowed, error: limitError } = await admin.rpc('consume_apple_billing_request', { p_user: user.id });
    if (limitError) throw new Error('Billing request limit unavailable');
    if (!allowed) return reply({ error: 'Too many attempts. Please wait a few minutes and try again.' }, 429);
    if (input.action === 'ready') {
      const { error } = await admin.from('apple_store_transactions').select('original_transaction_id', { count: 'exact', head: true });
      if (error) throw new Error('Purchase storage is not ready');
      return reply({ ready: true });
    }
    if (typeof input.signedTransaction !== 'string') return reply({ error: 'A signed Apple transaction is required' }, 400);
    return reply(await verifyAndApplyApple(admin, user.id, input.signedTransaction));
  } catch (error) {
    const status = error instanceof AppleVerificationError ? error.status : 503;
    return reply({
      error: status === 503
        ? 'Subscription verification is temporarily unavailable. Please try again later.'
        : 'Unable to verify this purchase for your account. Try restoring or contact support.',
    }, status);
  }
});
