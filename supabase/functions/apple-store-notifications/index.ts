import { Buffer } from 'node:buffer';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  Environment,
  SignedDataVerifier,
} from 'npm:@apple/app-store-server-library@3.1.0';
import { APPLE_ROOT_CERTIFICATES_BASE64 } from '../_shared/appleRootCertificates.ts';
import { APPLE_APP_ID, APPLE_BUNDLE_ID } from '../verify-apple-purchase/entitlement.ts';
import { verifyAndApplyApple } from '../_shared/appleBilling.ts';

const roots = APPLE_ROOT_CERTIFICATES_BASE64.map(value => Buffer.from(value, 'base64'));
const verifiers: Record<string, SignedDataVerifier> = {
  Production: new SignedDataVerifier(roots, true, Environment.PRODUCTION, APPLE_BUNDLE_ID, APPLE_APP_ID),
  Sandbox: new SignedDataVerifier(roots, true, Environment.SANDBOX, APPLE_BUNDLE_ID),
};
const reply = (status = 200) => new Response(null, { status });
const hintedEnvironment = (jws: string) => {
  try { return JSON.parse(Buffer.from(jws.split('.')[1], 'base64url').toString('utf8')).data?.environment as string | undefined; }
  catch { return undefined; }
};

Deno.serve(async req => {
  if (req.method !== 'POST') return reply(405);
  try {
    const raw = await req.text();
    if (raw.length > 70000) return reply(413);
    const { signedPayload } = JSON.parse(raw);
    if (typeof signedPayload !== 'string') return reply(400);
    const verifier = verifiers[hintedEnvironment(signedPayload) || ''];
    if (!verifier) return reply(400);
    const notification = await verifier.verifyAndDecodeNotification(signedPayload);
    const signedTransaction = notification.data?.signedTransactionInfo;
    if (!signedTransaction) return reply();
    const transaction = await verifier.verifyAndDecodeTransaction(signedTransaction);
    if (!transaction.originalTransactionId) return reply(400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: existing, error } = await admin.from('apple_store_transactions')
      .select('user_id').eq('original_transaction_id', transaction.originalTransactionId).maybeSingle();
    if (error) throw error;
    // Apple can send a notification before the device's initial verification.
    // Return success and let the authenticated purchase request establish ownership.
    if (!existing?.user_id) return reply();
    await verifyAndApplyApple(admin, existing.user_id, signedTransaction);
    return reply();
  } catch {
    // Non-2xx responses ask Apple to retry the notification.
    return reply(500);
  }
});
