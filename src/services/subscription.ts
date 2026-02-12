import { Platform } from 'react-native';
import { supabase } from './supabase';

type Purchase = {
  productId?: string;
  purchaseToken?: string;
  transactionId?: string;
};

const SUBSCRIPTION_SKUS = {
  PRO_MONTHLY: 'swift_invoice_pro_monthly',
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

const getProfileInvoiceCount = (profile: any) =>
  Number(profile?.invoice_count_current_month ?? profile?.invoice_count ?? 0);

const getProfileInvoiceLimit = (profile: any) => {
  const legacyLimit = Number(profile?.invoice_limit);
  if (Number.isFinite(legacyLimit) && legacyLimit > 0) return legacyLimit;
  return FREE_TIER_LIMIT;
};

const getProfileSubscriptionEndsAt = (profile: any) =>
  profile?.subscription_ends_at || profile?.subscription_expires_at || null;

const updateProfileWithFallback = async (userId: string, payloads: Array<Record<string, any>>) => {
  let lastError: any = null;

  for (const payload of payloads) {
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
    if (!error) return;
    lastError = error;
  }

  if (lastError) throw lastError;
};

export const subscriptionService = {
  isIapAvailable() {
    return !!getIapModule();
  },

  // Initialize IAP (call this on app start)
  async initialize() {
    const ready = await initIAP();
    if (!ready) {
      return { purchaseUpdateSubscription: null, purchaseErrorSubscription: null };
    }

    const iap = requireIapModule();

    if (!purchaseUpdateSubscription) {
      // Set up purchase listener once.
      purchaseUpdateSubscription = iap.purchaseUpdatedListener(async (purchase) => {
        console.log('Purchase updated:', purchase);

        try {
          // Verify and activate subscription
          await subscriptionService.verifyPurchase(purchase);

          // Acknowledge purchase on Android
          if (Platform.OS === 'android' && purchase.purchaseToken) {
            await iap.acknowledgePurchaseAndroid(purchase.purchaseToken);
          }

          // Finish transaction
          await iap.finishTransaction({ purchase, isConsumable: false });
        } catch (error) {
          console.error('Error processing purchase:', error);
        }
      });
    }

    if (!purchaseErrorSubscription) {
      purchaseErrorSubscription = iap.purchaseErrorListener((error) => {
        console.warn('Purchase error:', error);
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

      if (isPaidTier(profile.subscription_tier)) {
        return { allowed: true };
      }

      const invoiceCount = getProfileInvoiceCount(profile);
      const invoiceLimit = getProfileInvoiceLimit(profile);

      if (invoiceCount >= invoiceLimit) {
        return {
          allowed: false,
          reason: `You've reached your free tier limit of ${invoiceLimit} invoices this month. Upgrade to Pro for unlimited invoices.`,
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

      if (profile && !isPaidTier(profile.subscription_tier)) {
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

      if (error?.code === 'PGRST116' || !profile) {
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

      const invoiceCount = getProfileInvoiceCount(profile);
      const invoiceLimit = getProfileInvoiceLimit(profile);
      const paid = isPaidTier(profile.subscription_tier);

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
  },

  // Upgrade to Pro (Google Play Billing integration)
  async upgradeToPro() {
    try {
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

      console.log('Available subscriptions:', subscriptions);

      await iap.requestPurchase({
        type: 'subs',
        request:
          Platform.OS === 'android'
            ? {
                android: {
                  skus: [SUBSCRIPTION_SKUS.PRO_MONTHLY],
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

  // Verify purchase and update database
  async verifyPurchase(purchase: Purchase) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const expiresAtISO = expiresAt.toISOString();

      await updateProfileWithFallback(user.id, [
        {
          subscription_tier: 'monthly_basic',
          subscription_status: 'active',
          subscription_ends_at: expiresAtISO,
        },
        {
          subscription_tier: 'pro',
          subscription_status: 'active',
          subscription_expires_at: expiresAtISO,
          google_purchase_token: purchase.purchaseToken || purchase.transactionId,
        },
        {
          subscription_tier: 'monthly_basic',
          subscription_status: 'active',
        },
        {
          subscription_tier: 'pro',
          subscription_status: 'active',
        },
      ]);

      console.log('Subscription activated successfully');
      return true;
    } catch (error: any) {
      console.error('Error verifying purchase:', error);
      throw error;
    }
  },

  // Restore purchases (for users who already purchased)
  async restorePurchases() {
    try {
      const ready = await initIAP();
      if (!ready) {
        throw new Error(
          'Subscriptions are unavailable in Expo Go. Test restore purchases on a development build.'
        );
      }
      const iap = requireIapModule();

      const purchases = await iap.getAvailablePurchases();
      console.log('Available purchases:', purchases);

      if (purchases.length > 0) {
        const proPurchase = purchases.find((p) => p.productId === SUBSCRIPTION_SKUS.PRO_MONTHLY);

        if (proPurchase) {
          await this.verifyPurchase(proPurchase);
          return true;
        }
      }

      return false;
    } catch (error: any) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  },

  // Check subscription status from Google Play
  async syncSubscriptionStatus() {
    try {
      const ready = await initIAP();
      if (!ready) return;
      const iap = requireIapModule();

      const purchases = await iap.getAvailablePurchases();
      const proPurchase = purchases.find((p) => p.productId === SUBSCRIPTION_SKUS.PRO_MONTHLY);

      if (!proPurchase) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (profile && isPaidTier(profile.subscription_tier)) {
          await updateProfileWithFallback(user.id, [
            {
              subscription_tier: 'free',
              subscription_status: 'expired',
              subscription_ends_at: null,
            },
            {
              subscription_tier: 'free',
              subscription_status: 'expired',
              subscription_expires_at: null,
            },
            {
              subscription_tier: 'free',
              subscription_status: 'expired',
            },
          ]);
        }
      } else {
        await this.verifyPurchase(proPurchase);
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
    }
  },
};
