export const PACKAGE_NAME = 'com.invoiceautomator.app';
export const PRODUCTS: Record<string, string> = {
  swift_invoice_pro_monthly: 'monthly_basic',
  swift_invoice_pro_annual: 'annual_basic',
};
export interface GoogleSubscription {
  subscriptionState?: string;
  acknowledgementState?: string;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
  linkedPurchaseToken?: string;
  lineItems?: { productId?: string; expiryTime?: string }[];
}
export function entitlementFromGoogle(purchase: GoogleSubscription, now = Date.now()) {
  const state = purchase.subscriptionState || '';
  const validStates = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED', 'SUBSCRIPTION_STATE_ON_HOLD', 'SUBSCRIPTION_STATE_PAUSED', 'SUBSCRIPTION_STATE_EXPIRED', 'SUBSCRIPTION_STATE_PENDING', 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED'];
  if (!validStates.includes(state)) throw new Error('Unrecognized subscription state');
  if (state === 'SUBSCRIPTION_STATE_PENDING' || state === 'SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED') throw new Error('Purchase is not complete');
  const items = (purchase.lineItems || []).filter(item => item.productId && PRODUCTS[item.productId] && Number.isFinite(Date.parse(item.expiryTime || '')));
  if (!items.length) throw new Error('No supported subscription found');
  const item = items.reduce((latest, candidate) => Date.parse(candidate.expiryTime!) > Date.parse(latest.expiryTime!) ? candidate : latest);
  const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'].includes(state) && Date.parse(item.expiryTime!) > now;
  return { productId: item.productId!, tier: PRODUCTS[item.productId!], expiresAt: new Date(item.expiryTime!).toISOString(), state, active };
}
export function assertPurchaseOwner(purchase: GoogleSubscription, accountHash: string, registeredUser: string | null, userId: string) {
  if (registeredUser && registeredUser !== userId) throw new Error('Purchase belongs to another account');
  const owner = purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (owner ? owner !== accountHash : registeredUser !== userId) throw new Error('Purchase is not linked to this account');
}
