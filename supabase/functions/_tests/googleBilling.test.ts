import { verifyAndApply, GoogleVerificationError, sha256 } from '../_shared/googleBilling.ts';
const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
Deno.test('Google permission failures never write or acknowledge purchases', async () => {
  const original = globalThis.fetch;
  let writes = 0;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { user_id: 'user-a' }, error: null }) };
  const admin = { from: () => query, rpc: () => { writes++; throw new Error('Unexpected write'); } };
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  try {
    await verifyAndApply(admin as never, 'user-a', 'test-token', 'access');
    throw new Error('Verification unexpectedly succeeded');
  } catch (error) {
    assert(error instanceof GoogleVerificationError && error.code === 'google_http_401', 'Expected permission error');
    assert(writes === 0, 'Permission errors must not write entitlements');
  } finally { globalThis.fetch = original; }
});
Deno.test('Valid verification binds identity, passes linked token, persists before acknowledgement', async () => {
  const original = globalThis.fetch;
  const events: string[] = [];
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: null, error: null }) };
  const owner = await sha256('user-a');
  const linked = await sha256('old-token');
  const admin = { from: () => query, rpc: async (_name: string, payload: Record<string, unknown>) => {
    assert(payload.p_user === 'user-a' && payload.p_linked_hash === linked, 'Account/link must match');
    assert(payload.p_expires === '2099-01-01T00:00:00.000Z', 'Expiry must come from Google');
    events.push('persist'); return { data: { isPro: true, expiresAt: payload.p_expires }, error: null };
  } };
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'POST') { events.push('acknowledge'); return new Response('{}'); }
    return new Response(JSON.stringify({ subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE', acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING', externalAccountIdentifiers: { obfuscatedExternalAccountId: owner }, linkedPurchaseToken: 'old-token', lineItems: [{ productId: 'swift_invoice_pro_monthly', expiryTime: '2099-01-01T00:00:00Z' }] }));
  };
  try { const result = await verifyAndApply(admin as never, 'user-a', 'new-token', 'access'); assert(result.isPro, 'Expected Pro'); assert(events.join(',') === 'persist,acknowledge', 'Grant must be durable before acknowledgement'); }
  finally { globalThis.fetch = original; }
});

Deno.test('Permanently unavailable Google tokens are classified without changing access', async () => {
  const original = globalThis.fetch;
  let writes = 0;
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { user_id: 'user-a' }, error: null }) };
  const admin = { from: () => query, rpc: () => { writes++; throw new Error('Unexpected write'); } };
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { errors: [{ reason: 'subscriptionPurchaseNoLongerAvailable' }] } }), { status: 410 });
  try {
    await verifyAndApply(admin as never, 'user-a', 'old-token', 'access');
    throw new Error('Verification unexpectedly succeeded');
  } catch (error) {
    assert(error instanceof GoogleVerificationError && error.code === 'token_no_longer_available', 'Expected terminal token error');
    assert(writes === 0, 'Legacy access must not change from an unavailable token');
  } finally { globalThis.fetch = original; }
});
