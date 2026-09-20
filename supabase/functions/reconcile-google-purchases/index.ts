import { createClient } from 'npm:@supabase/supabase-js@2';
import { googleAccessToken, verifyAndApply, GoogleVerificationError, sha256 } from '../_shared/googleBilling.ts';

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const expected = Deno.env.get('BILLING_RECONCILE_SECRET');
  const supplied = req.headers.get('x-billing-secret');
  if (!expected || !supplied || await sha256(expected) !== await sha256(supplied)) return reply({ error: 'Unauthorized' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    const access = await googleAccessToken();
    const { data: rows, error } = await admin.rpc('claim_google_billing_rechecks');
    if (error) throw error;
    let verified = 0, failed = 0;
    // A small leased batch bounds execution time and prevents overlapping cron work.
    await Promise.all((rows || []).map(async (row: { token_hash: string; user_id: string; purchase_token: string }) => {
      let failure: string | null = null;
      try { await verifyAndApply(admin, row.user_id, row.purchase_token, access); verified++; }
      catch (error) { failed++; failure = error instanceof GoogleVerificationError ? error.code : 'upstream_unavailable'; }
      const { error: recordError } = await admin.rpc('complete_google_billing_recheck', { p_token_hash: row.token_hash, p_error: failure });
      if (recordError) throw recordError;
    }));
    const { error: expiryError } = await admin.rpc('expire_verified_google_access');
    if (expiryError) throw expiryError;
    return reply({ checked: (rows || []).length, verified, failed }, failed > 0 ? 503 : 200);
  } catch {
    return reply({ error: 'Billing reconciliation unavailable; existing records retained.' }, 503);
  }
});
