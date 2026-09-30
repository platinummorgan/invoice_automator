import { Buffer } from 'node:buffer';
import {
  Environment,
  SignedDataVerifier,
  VerificationException,
} from 'npm:@apple/app-store-server-library@3.1.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { APPLE_ROOT_CERTIFICATES_BASE64 } from './appleRootCertificates.ts';
import {
  APPLE_APP_ID,
  APPLE_BUNDLE_ID,
  entitlementFromApple,
  type AppleTransaction,
} from '../verify-apple-purchase/entitlement.ts';

const roots = APPLE_ROOT_CERTIFICATES_BASE64.map(value => Buffer.from(value, 'base64'));
const productionVerifier = new SignedDataVerifier(roots, true, Environment.PRODUCTION, APPLE_BUNDLE_ID, APPLE_APP_ID);
const sandboxVerifier = new SignedDataVerifier(roots, true, Environment.SANDBOX, APPLE_BUNDLE_ID);

const decodeUntrustedPayload = (jws: string): Record<string, unknown> => {
  const parts = jws.split('.');
  if (parts.length !== 3) throw new AppleVerificationError('invalid_signed_transaction', 422);
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new AppleVerificationError('invalid_signed_transaction', 422);
  }
};

export class AppleVerificationError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}

export async function verifyAppleSignedTransaction(signedTransaction: string) {
  if (signedTransaction.length < 100 || signedTransaction.length > 30000) {
    throw new AppleVerificationError('invalid_signed_transaction', 422);
  }
  const hintedEnvironment = decodeUntrustedPayload(signedTransaction).environment;
  const verifier = hintedEnvironment === Environment.SANDBOX
    ? sandboxVerifier
    : hintedEnvironment === Environment.PRODUCTION
      ? productionVerifier
      : null;
  if (!verifier) throw new AppleVerificationError('invalid_environment', 422);
  try {
    return await verifier.verifyAndDecodeTransaction(signedTransaction) as AppleTransaction;
  } catch (error) {
    throw new AppleVerificationError(
      error instanceof VerificationException ? 'signature_verification_failed' : 'verification_unavailable',
      error instanceof VerificationException ? 422 : 503,
    );
  }
}

export async function verifyAndApplyApple(admin: SupabaseClient, userId: string, signedTransaction: string) {
  let entitlement;
  try {
    entitlement = entitlementFromApple(await verifyAppleSignedTransaction(signedTransaction));
  } catch (error) {
    if (error instanceof AppleVerificationError) throw error;
    throw new AppleVerificationError('purchase_not_eligible', 422);
  }
  if (entitlement.appAccountToken.toLowerCase() !== userId.toLowerCase()) {
    throw new AppleVerificationError('account_mismatch', 409);
  }
  const { data, error } = await admin.rpc('apply_apple_store_verification', {
    p_user: userId,
    p_original_transaction_id: entitlement.originalTransactionId,
    p_transaction_id: entitlement.transactionId,
    p_product: entitlement.productId,
    p_state: entitlement.state,
    p_expires: entitlement.expiresAt,
    p_environment: entitlement.environment,
    p_checked: entitlement.checkedAt,
  });
  if (error) throw new AppleVerificationError('verification_write_failed');
  return { verified: true, isPro: !!data?.isPro, expiresAt: data?.expiresAt };
}
