import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';
import { assertPurchaseOwner, entitlementFromGoogle, PACKAGE_NAME, GoogleSubscription } from '../verify-google-purchase/entitlement.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const sha256 = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(b => b.toString(16).padStart(2, '0')).join('');

export async function googleAccessToken() {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new Error('Verification is not configured');
  const account = JSON.parse(raw);
  if (!account.client_email || !account.private_key) throw new Error('Invalid service account configuration');
  const key = await importPKCS8(account.private_key, 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/androidpublisher' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' }).setIssuer(account.client_email)
    .setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(key);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error('Google authorization failed');
  return result.access_token as string;
}


export class GoogleVerificationError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}

export async function verifyAndApply(admin: SupabaseClient, userId: string, token: string, accessToken: string) {
  const checkedAt = new Date().toISOString();
  const hash = await sha256(token);
  const { data: registration, error } = await admin.from('google_play_purchases').select('user_id').eq('token_hash', hash).maybeSingle();
  if (error) throw new GoogleVerificationError('storage_unavailable');
  const response = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    if (response.status === 410) {
      const body = await response.json().catch(() => ({}));
      const terminalReasons = ['subscriptionPurchaseNoLongerAvailable', 'subscriptionNoLongerAvailable', 'purchaseTokenNoLongerValid'];
      if (body.error?.errors?.some((entry: { reason?: string }) => terminalReasons.includes(entry.reason || ''))) {
        throw new GoogleVerificationError('token_no_longer_available', 422);
      }
    }
    throw new GoogleVerificationError(`google_http_${response.status}`, response.status === 401 || response.status === 403 || response.status >= 500 ? 503 : 422);
  }
  const purchase: GoogleSubscription = await response.json();
  try { assertPurchaseOwner(purchase, await sha256(userId), registration?.user_id || null, userId); }
  catch { throw new GoogleVerificationError('account_mismatch', 409); }
  let entitlement;
  try { entitlement = entitlementFromGoogle(purchase); }
  catch { throw new GoogleVerificationError('purchase_not_eligible', 422); }
  const linkedHash = purchase.linkedPurchaseToken ? await sha256(purchase.linkedPurchaseToken) : null;
  const { data, error: applyError } = await admin.rpc('apply_google_play_verification', {
    p_user: userId, p_token_hash: hash, p_purchase_token: token,
    p_product: entitlement.productId, p_state: entitlement.state,
    p_expires: entitlement.expiresAt, p_checked: checkedAt, p_linked_hash: linkedHash,
  });
  if (applyError) throw new GoogleVerificationError('verification_write_failed');
  if (entitlement.active && purchase.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    const ack = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(entitlement.productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000) });
    if (!ack.ok) throw new GoogleVerificationError('acknowledgement_retry_required');
  }
  return { verified: true, isPro: data.isPro, expiresAt: data.expiresAt };
}
