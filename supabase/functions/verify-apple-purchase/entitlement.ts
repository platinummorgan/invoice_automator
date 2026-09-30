export const APPLE_BUNDLE_ID = 'com.invoiceautomator.app';
export const APPLE_APP_ID = 6788092733;
export const APPLE_PRODUCTS: Record<string, 'monthly_basic' | 'annual_basic'> = {
  swift_invoice_pro_monthly: 'monthly_basic',
  swift_invoice_pro_annual: 'annual_basic',
};

export interface AppleTransaction {
  appAccountToken?: string;
  bundleId?: string;
  environment?: string;
  expiresDate?: number;
  inAppOwnershipType?: string;
  isUpgraded?: boolean;
  originalTransactionId?: string;
  productId?: string;
  revocationDate?: number;
  signedDate?: number;
  transactionId?: string;
  type?: string;
}

const transactionIdPattern = /^\d{5,30}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function entitlementFromApple(transaction: AppleTransaction, now = Date.now()) {
  if (transaction.bundleId !== APPLE_BUNDLE_ID) throw new Error('Unexpected app identifier');
  if (!transaction.productId || !APPLE_PRODUCTS[transaction.productId]) throw new Error('Unsupported subscription product');
  if (transaction.type !== 'Auto-Renewable Subscription') throw new Error('Purchase is not an auto-renewable subscription');
  if (!transaction.transactionId || !transactionIdPattern.test(transaction.transactionId)) throw new Error('Invalid transaction identifier');
  if (!transaction.originalTransactionId || !transactionIdPattern.test(transaction.originalTransactionId)) throw new Error('Invalid original transaction identifier');
  if (!transaction.appAccountToken || !uuidPattern.test(transaction.appAccountToken)) throw new Error('Purchase is not linked to an app account');
  if (!Number.isFinite(transaction.expiresDate) || transaction.expiresDate! <= 0) throw new Error('Invalid subscription expiry');
  if (!Number.isFinite(transaction.signedDate) || transaction.signedDate! <= 0 || transaction.signedDate! > now + 5 * 60 * 1000) throw new Error('Invalid transaction signed date');
  if (!['Production', 'Sandbox'].includes(transaction.environment || '')) throw new Error('Unexpected store environment');

  const revoked = Number.isFinite(transaction.revocationDate);
  const active = !revoked && !transaction.isUpgraded && transaction.expiresDate! > now;
  const state = revoked ? 'revoked' : transaction.isUpgraded ? 'upgraded' : active ? 'active' : 'expired';
  return {
    active,
    appAccountToken: transaction.appAccountToken,
    checkedAt: new Date(transaction.signedDate!).toISOString(),
    environment: transaction.environment!,
    expiresAt: new Date(transaction.expiresDate!).toISOString(),
    originalTransactionId: transaction.originalTransactionId,
    productId: transaction.productId,
    state,
    tier: APPLE_PRODUCTS[transaction.productId],
    transactionId: transaction.transactionId,
  };
}
