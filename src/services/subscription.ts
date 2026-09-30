import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type Purchase = {
  productId?: string;
  purchaseToken?: string;
  transactionId?: string;
  appAccountToken?: string | null;
  originalTransactionIdentifierIOS?: string | null;
  expirationDateIOS?: number | null;
  environmentIOS?: string | null;
};

const SUBSCRIPTION_SKUS = {
  PRO_MONTHLY: 'swift_invoice_pro_monthly',
  PRO_ANNUAL: 'swift_invoice_pro_annual',
} as const;

const SUBSCRIPTION_PRODUCT_IDS = Object.values(SUBSCRIPTION_SKUS);
export type SubscriptionProductId = typeof SUBSCRIPTION_PRODUCT_IDS[number];

export type SubscriptionProduct = {
  productId: SubscriptionProductId;
  displayPrice: string;
  period: 'month' | 'year';
};

const FREE_TIER_LIMIT = 2;

// Initialize IAP connection
let iapInitialized = false;
let purchaseUpdateSubscription: { remove: () => void } | null = null;
let purchaseErrorSubscription: { remove: () => void } | null = null;

type IapModule = {
  initConnection: () => Promise<void>;
  endConnection: () => Promise<void>;
  purchaseUpdatedListener: (listener: (purchase: Purchase) => void) => { remove: () => void };
  purchaseErrorListener: (listener: (error: any) => void) => { remove: () => void };
  acknowledgePurchaseAndroid: (purchaseToken: string) => Promise<void>;
  finishTransaction: (params: { purchase: Purchase; isConsumable: boolean }) => Promise<void>;
  fetchProducts: (params: { skus: string[]; type: 'subs' | 'in-app' }) => Promise<any[]>;
  requestPurchase: (params: any) => Promise<void>;
  getAvailablePurchases: () => Promise<Purchase[]>;
};

let cachedIapModule: IapModule | null = null;
let iapLoadAttempted = false;

const getIapModule = (): IapModule | null => {
  if (cachedIapModule) return cachedIapModule;
  if (iapLoadAttempted) return null;
  iapLoadAttempted = true;

  try {
    const moduleRef = require('react-native-iap') as IapModule;
    cachedIapModule = moduleRef;
    return cachedIapModule;
  } catch (error) {
    console.warn(
      'react-native-iap native module unavailable. IAP features disabled in this runtime.'
    );
    return null;
  }
};

const requireIapModule = (): IapModule => {
  const moduleRef = getIapModule();
  if (!moduleRef) {
    throw new Error(
      'In-app purchases are unavailable in Expo Go. Use a development build or store build for subscription purchases.'
    );
  }
  return moduleRef;
};

const initIAP = async () => {
  if (iapInitialized) return true;

  const iap = getIapModule();
  if (!iap) return false;

  try {
    await iap.initConnection();
    iapInitialized = true;
    console.log('IAP connection initialized');
  } catch (error) {
    console.error('Error initializing IAP:', error);
  }

  return iapInitialized;
};

const isPaidTier = (tier?: string | null) =>
  tier === 'pro' || tier === 'monthly_basic' || tier === 'annual_basic';

const getCurrentMonthInvoiceCount = async (userId: string) => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { count, error } = await supabase.from('invoices')
    .select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', start);
  if (error) throw error;
  return count || 0;
};

const getProfileInvoiceLimit = (profile: any) => {
  const legacyLimit = Number(profile?.invoice_limit);
  if (Number.isFinite(legacyLimit) && legacyLimit > 0) return legacyLimit;
  return FREE_TIER_LIMIT;
};

const getProfileSubscriptionEndsAt = (profile: any) =>
  profile?.subscription_ends_at || profile?.subscription_expires_at || null;

const isProfilePaid = (profile: any) => isPaidTier(profile.subscription_tier) &&
  (!profile.subscription_verified_at || (
    ['active', 'cancelled'].includes(profile.subscription_status) &&
    Date.parse(profile.subscription_ends_at || '') > Date.now()
  ));

const hasPaidAccessOnThisPlatform = (profile: any) =>
  (Platform.OS === 'android' || Platform.OS === 'ios') && isProfilePaid(profile);

const getInvoiceLimitOnThisPlatform = (profile: any) =>
  hasPaidAccessOnThisPlatform(profile) ? getProfileInvoiceLimit(profile) : FREE_TIER_LIMIT;

const billingListeners = new Set<(error?: string) => void>();
const notifyBilling = (error?: string) => billingListeners.forEach(listener => listener(error));
const pendingSyncs = new Map<string, Promise<boolean>>();
const isAlreadyOwnedError = (error: any) =>
  error?.code === 'already-owned' || error?.code === 'E_ALREADY_OWNED';

// A stored expiry can lag a Play renewal until the scheduled server recheck.
// Verify owned purchases before presenting a downgrade or enforcing the free limit.
const getCurrentProfile = async (userId: string) => {
  const read = async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) throw error;
    return data;
  };
  const profile = await read();
  if ((Platform.OS === 'android' || Platform.OS === 'ios') && profile && !isProfilePaid(profile) && getIapModule()) {
    await subscriptionService.syncSubscriptionStatus();
    return read();
  }
  return profile;
};

export const subscriptionService = {
  onBillingChange(listener: (error?: string) => void) {
    billingListeners.add(listener);
    return () => { billingListeners.delete(listener); };
  },
  isIapAvailable() {
    return (Platform.OS === 'android' || Platform.OS === 'ios') && !!getIapModule();
  },

  // Initialize IAP (call this on app start)
  async initialize() {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      return { purchaseUpdateSubscription: null, purchaseErrorSubscription: null };
    }

    const ready = await initIAP();
    if (!ready) {
      return { purchaseUpdateSubscription: null, purchaseErrorSubscription: null };
    }

    const iap = requireIapModule();

    if (!purchaseUpdateSubscription) {
      // Set up purchase listener once.
      purchaseUpdateSubscription = iap.purchaseUpdatedListener(async (purchase) => {


        try {
          // Verify and activate subscription
          await subscriptionService.verifyPurchase(purchase);

          // Finish transaction
          await iap.finishTransaction({ purchase, isConsumable: false });
          notifyBilling();
        } catch (error) {
          notifyBilling('Your purchase could not be verified yet. Use Restore purchases in Settings to try again.');
        }
      });
    }

    if (!purchaseErrorSubscription) {
      purchaseErrorSubscription = iap.purchaseErrorListener(async (error) => {
        if (isAlreadyOwnedError(error)) {
          try {
            if (await subscriptionService.restorePurchases()) return;
          } catch { /* Show a restore-specific message below. */ }
          notifyBilling(`${Platform.OS === 'ios' ? 'Apple' : 'Google Play'} already owns this subscription, but access could not be refreshed. Use Restore purchases in Settings to try again.`);
          return;
        }
        if (error?.code !== 'user-cancelled' && error?.code !== 'E_USER_CANCELLED') notifyBilling('The purchase did not finish. Please try again.');
      });
    }

    return { purchaseUpdateSubscription, purchaseErrorSubscription };
  },

  async cleanup() {
    purchaseUpdateSubscription?.remove();
    purchaseErrorSubscription?.remove();
    purchaseUpdateSubscription = null;
    purchaseErrorSubscription = null;

    if (iapInitialized) {
      try {
        const iap = getIapModule();
        if (iap) await iap.endConnection();
      } catch (error) {
        console.warn('Error ending IAP connection:', error);
      }
      iapInitialized = false;
    }
  },

  // Check if user can create invoice (under limit)
  async canCreateInvoice(): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const profile = await getCurrentProfile(user.id);
      if (!profile) return { allowed: true };

      if (hasPaidAccessOnThisPlatform(profile)) {
        return { allowed: true };
      }

      const invoiceCount = await getCurrentMonthInvoiceCount(user.id);
      const invoiceLimit = getInvoiceLimitOnThisPlatform(profile);

      if (invoiceCount >= invoiceLimit) {
        return {
          allowed: false,
          reason: `You've reached your free tier limit of ${invoiceLimit} documents this month. Upgrade to Pro for unlimited documents.`,
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('Error checking invoice limit:', error);
      return { allowed: true }; // Don't hard-block invoice creation if check fails
    }
  },

  // Legacy helper retained for compatibility; invoiceService.createInvoice already increments count.
  async incrementInvoiceCount() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error: rpcError } = await supabase.rpc('increment_invoice_count', {
        p_user_id: user.id,
      });

      if (!rpcError) return;

      // Fallback for legacy schema that still uses invoice_count.
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, invoice_count')
        .eq('id', user.id)
        .single();

      if (profile && !hasPaidAccessOnThisPlatform(profile)) {
        await supabase
          .from('profiles')
          .update({ invoice_count: (profile.invoice_count || 0) + 1 })
          .eq('id', user.id);
      }
    } catch (error) {
      console.error('Error incrementing invoice count:', error);
    }
  },

  // Get user subscription status
  async getSubscriptionStatus() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const profile = await getCurrentProfile(user.id);
      if (!profile) {
        return {
          tier: 'free',
          status: 'free',
          invoiceCount: 0,
          invoiceLimit: FREE_TIER_LIMIT,
          expiresAt: null,
          isPro: false,
          remainingInvoices: FREE_TIER_LIMIT,
        };
      }

      const invoiceCount = await getCurrentMonthInvoiceCount(user.id);
      const invoiceLimit = getInvoiceLimitOnThisPlatform(profile);
      const paid = hasPaidAccessOnThisPlatform(profile);

      return {
        tier: profile.subscription_tier || 'free',
        status: profile.subscription_status || 'free',
        invoiceCount,
        invoiceLimit,
        expiresAt: getProfileSubscriptionEndsAt(profile),
        isPro: paid,
        remainingInvoices: paid ? 999999 : Math.max(0, invoiceLimit - invoiceCount),
      };
    } catch (error: any) {
      if (error?.code !== 'PGRST116') {
        console.error('Error getting subscription status:', error);
      }
      throw error;
    }
  },

  async getSubscriptionProducts(): Promise<SubscriptionProduct[]> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return [];
    const ready = await initIAP();
    if (!ready) return [];
    const skus = Platform.OS === 'ios'
      ? [SUBSCRIPTION_SKUS.PRO_MONTHLY, SUBSCRIPTION_SKUS.PRO_ANNUAL]
      : [SUBSCRIPTION_SKUS.PRO_MONTHLY];
    const products = await requireIapModule().fetchProducts({ skus, type: 'subs' });
    return (products || []).flatMap((product: any) => {
      const productId = String(product.id || product.productId || '');
      if (!SUBSCRIPTION_PRODUCT_IDS.includes(productId as SubscriptionProductId)) return [];
      const displayPrice = String(product.displayPrice || product.localizedPrice || product.priceString || '').trim();
      if (!displayPrice) return [];
      return [{
        productId: productId as SubscriptionProductId,
        displayPrice,
        period: productId === SUBSCRIPTION_SKUS.PRO_ANNUAL ? 'year' as const : 'month' as const,
      }];
    });
  },

  // Upgrade to Pro through the device's store. The server verifies ownership
  // before the client finishes the transaction.
  async upgradeToPro(productId: SubscriptionProductId = SUBSCRIPTION_SKUS.PRO_MONTHLY) {
    try {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Subscriptions are unavailable on this device.');
      if (!SUBSCRIPTION_PRODUCT_IDS.includes(productId)) throw new Error('That subscription option is unavailable.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in before upgrading.');
      if (await this.syncSubscriptionStatus()) {
        notifyBilling();
        return;
      }
      const verificationFunction = Platform.OS === 'ios' ? 'verify-apple-purchase' : 'verify-google-purchase';
      const { data: readiness, error: readinessError } = await supabase.functions.invoke(verificationFunction, { body: { action: 'ready' } });
      if (readinessError || !readiness?.ready) throw new Error('Subscription verification is temporarily unavailable. Please try again later.');
      const accountId = Platform.OS === 'android'
        ? await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, user.id)
        : null;
      const ready = await initIAP();
      if (!ready) {
        throw new Error(
          'Subscriptions are unavailable in Expo Go. Please use email/password locally or test on a development build.'
        );
      }
      const iap = requireIapModule();

      const subscriptions = await iap.fetchProducts({
        skus: [productId],
        type: 'subs',
      });

      if (!subscriptions || subscriptions.length === 0) {
        throw new Error(
          `Subscription product not found. Please ensure ${productId} is configured in the ${Platform.OS === 'ios' ? 'App Store' : 'Google Play'} console.`
        );
      }

      const product = subscriptions[0];
      const offers = product.subscriptionOfferDetailsAndroid || product.subscriptionOfferDetails || product.subscriptionOffers || [];
      const offer = offers.find((item: any) => !item.offerId && (item.offerToken || item.offerTokenAndroid)) || offers.find((item: any) => item.offerToken || item.offerTokenAndroid);
      const offerToken = offer?.offerToken || offer?.offerTokenAndroid;
      if (Platform.OS === 'android' && !offerToken) throw new Error('No eligible subscription offer is available for this Google Play account.');

      await iap.requestPurchase({
        type: 'subs',
        request:
          Platform.OS === 'android'
            ? {
                android: {
                  skus: [productId],
                  obfuscatedAccountId: accountId!,
                  subscriptionOffers: [{ sku: productId, offerToken }],
                },
              }
            : {
                apple: {
                  sku: productId,
                  appAccountToken: user.id,
                },
              },
      });
    } catch (error: any) {
      if (isAlreadyOwnedError(error) && await this.restorePurchases()) return;
      console.error('Error upgrading to Pro:', error);
      throw error;
    }
  },

  // The server owns entitlement writes and expiry. Store tokens are never trusted
  // until the corresponding server verifier validates their signature/ownership.
  async verifyPurchase(purchase: Purchase) {
    if (!purchase.purchaseToken) throw new Error('A store purchase token is required.');
    const verificationFunction = Platform.OS === 'ios' ? 'verify-apple-purchase' : 'verify-google-purchase';
    const { data, error } = await supabase.functions.invoke(verificationFunction, {
      body: Platform.OS === 'ios'
        ? { signedTransaction: purchase.purchaseToken }
        : { purchaseToken: purchase.purchaseToken },
    });
    if (error || !data?.verified) throw new Error(data?.error || 'Your purchase could not be verified. Please try restoring it again.');
    return !!data.isPro;
  },

  // Restore purchases (for users who already purchased)
  async restorePurchases() {
    try {
      if (Platform.OS !== 'android' && Platform.OS !== 'ios') throw new Error('Purchase restoration is unavailable on this device.');

      const active = await this.syncSubscriptionStatus();
      notifyBilling();
      return active;
    } catch (error: any) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  },

  // Check subscription status from the current platform store.
  async syncSubscriptionStatus() {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return false;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in to restore purchases.');
    const pending = pendingSyncs.get(user.id);
    if (pending) return pending;
    const sync = (async () => {
      const ready = await initIAP();
      if (!ready) throw new Error(`${Platform.OS === 'ios' ? 'The App Store' : 'Google Play'} is unavailable. Please try again.`);
      const purchases = await requireIapModule().getAvailablePurchases();
      let active = false;
      let failure: unknown;
      for (const purchase of purchases.filter(p => p.productId && SUBSCRIPTION_PRODUCT_IDS.includes(p.productId as any))) {
        try { active = (await this.verifyPurchase(purchase)) || active; }
        catch (error) { failure = error; }
      }
      if (!active && failure) throw failure;
      return active;
    })();
    pendingSyncs.set(user.id, sync);
    try { return await sync; }
    finally { pendingSyncs.delete(user.id); }
  },
};
