import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from './supabase';

type Purchase = {
  productId?: string;
  purchaseToken?: string;
  transactionId?: string;
};

const SUBSCRIPTION_SKUS = {
  PRO_MONTHLY: 'swift_invoice_pro_monthly',
  PRO_ANNUAL: 'swift_invoice_pro_annual',
} as const;

const SUBSCRIPTION_PRODUCT_IDS = Object.values(SUBSCRIPTION_SKUS);

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

const billingListeners = new Set<(error?: string) => void>();
const notifyBilling = (error?: string) => billingListeners.forEach(listener => listener(error));

const findSubscriptionPurchase = (purchases: Purchase[]) =>
  purchases.find((purchase) =>
    purchase.productId ? SUBSCRIPTION_PRODUCT_IDS.includes(purchase.productId as any) : false
  );

export const subscriptionService = {
  onBillingChange(listener: (error?: string) => void) {
    billingListeners.add(listener);
    return () => { billingListeners.delete(listener); };
  },
  isIapAvailable() {
    return Platform.OS === 'android' && !!getIapModule();
  },

  // Initialize IAP (call this on app start)
  async initialize() {
    if (Platform.OS !== 'android') {
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
      purchaseErrorSubscription = iap.purchaseErrorListener((error) => {
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

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (!profile) return { allowed: true };

      if (isProfilePaid(profile)) {
        return { allowed: true };
      }

      const invoiceCount = await getCurrentMonthInvoiceCount(user.id);
      const invoiceLimit = getProfileInvoiceLimit(profile);

      if (invoiceCount >= invoiceLimit) {
        return {
          allowed: false,
          reason: Platform.OS === 'android'
            ? `You've reached your free tier limit of ${invoiceLimit} invoices this month. Upgrade to Pro for unlimited invoices.`
            : `You've reached your free tier limit of ${invoiceLimit} invoices this month. Pro subscriptions are not offered in this iPhone release.`,
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

      if (profile && !isProfilePaid(profile)) {
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

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
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

      if (error) throw error;

      const invoiceCount = await getCurrentMonthInvoiceCount(user.id);
      const invoiceLimit = getProfileInvoiceLimit(profile);
      const paid = isProfilePaid(profile);

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

  // Upgrade to Pro (Google Play Billing integration)
  async upgradeToPro() {
    try {
      if (Platform.OS !== 'android') throw new Error('Subscriptions are currently available through Google Play on Android.');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in before upgrading.');
      const { data: readiness, error: readinessError } = await supabase.functions.invoke('verify-google-purchase', { body: { action: 'ready' } });
      if (readinessError || !readiness?.ready) throw new Error('Subscription verification is temporarily unavailable. Please try again later.');
      const accountId = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, user.id);
      const ready = await initIAP();
      if (!ready) {
        throw new Error(
          'Subscriptions are unavailable in Expo Go. Please use email/password locally or test on a development build.'
        );
      }
      const iap = requireIapModule();

      const subscriptions = await iap.fetchProducts({
        skus: [SUBSCRIPTION_SKUS.PRO_MONTHLY],
        type: 'subs',
      });

      if (!subscriptions || subscriptions.length === 0) {
        throw new Error(
          'Subscription product not found. Please ensure swift_invoice_pro_monthly is configured in Google Play Console.'
        );
      }

      const product = subscriptions[0];
      const offers = product.subscriptionOfferDetailsAndroid || product.subscriptionOfferDetails || product.subscriptionOffers || [];
      const offer = offers.find((item: any) => !item.offerId && (item.offerToken || item.offerTokenAndroid)) || offers.find((item: any) => item.offerToken || item.offerTokenAndroid);
      const offerToken = offer?.offerToken || offer?.offerTokenAndroid;
      if (!offerToken) throw new Error('No eligible subscription offer is available for this Google Play account.');

      await iap.requestPurchase({
        type: 'subs',
        request:
          Platform.OS === 'android'
            ? {
                android: {
                  skus: [SUBSCRIPTION_SKUS.PRO_MONTHLY],
                  obfuscatedAccountId: accountId,
                  subscriptionOffers: [{ sku: SUBSCRIPTION_SKUS.PRO_MONTHLY, offerToken }],
                },
              }
            : {
                ios: {
                  sku: SUBSCRIPTION_SKUS.PRO_MONTHLY,
                },
              },
      });
    } catch (error: any) {
      console.error('Error upgrading to Pro:', error);
      throw error;
    }
  },

  // The server owns entitlement writes and expiry; the device only supplies a Play token.
  async verifyPurchase(purchase: Purchase) {
    if (Platform.OS !== 'android' || !purchase.purchaseToken) throw new Error('A Google Play purchase token is required.');
    const { data, error } = await supabase.functions.invoke('verify-google-purchase', {
      body: { purchaseToken: purchase.purchaseToken },
    });
    if (error || !data?.verified) throw new Error(data?.error || 'Your purchase could not be verified. Please try restoring it again.');
    return !!data.isPro;
  },

  // Restore purchases (for users who already purchased)
  async restorePurchases() {
    try {
      if (Platform.OS !== 'android') {
        throw new Error('Purchase restoration is currently available through Google Play on Android.');
      }

      const ready = await initIAP();
      if (!ready) {
        throw new Error(
          'Subscriptions are unavailable in Expo Go. Test restore purchases on a development build.'
        );
      }
      const iap = requireIapModule();

      const purchases = await iap.getAvailablePurchases();

      const subscriptions = purchases.filter(p => p.productId && SUBSCRIPTION_PRODUCT_IDS.includes(p.productId as any));
      let active = false;
      for (const purchase of subscriptions) active = (await this.verifyPurchase(purchase)) || active;
      notifyBilling();
      return active;
    } catch (error: any) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  },

  // Check subscription status from Google Play
  async syncSubscriptionStatus() {
    try {
      if (Platform.OS !== 'android') return;

      const ready = await initIAP();
      if (!ready) return;
      const iap = requireIapModule();

      const purchases = await iap.getAvailablePurchases();
      const proPurchase = findSubscriptionPurchase(purchases);

      if (!proPurchase) {
        return;
      } else {
        await this.verifyPurchase(proPurchase);
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
    }
  },
};
