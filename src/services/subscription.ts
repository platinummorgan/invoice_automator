import { supabase } from './supabase';
import * as RNIap from 'react-native-iap';
import { Platform } from 'react-native';

const SUBSCRIPTION_SKUS = {
  PRO_MONTHLY: 'swift_invoice_pro_monthly',
};

// Initialize IAP connection
let iapInitialized = false;

const initIAP = async () => {
  if (iapInitialized) return;
  
  try {
    await RNIap.initConnection();
    iapInitialized = true;
    console.log('IAP connection initialized');
  } catch (error) {
    console.error('Error initializing IAP:', error);
  }
};

export const subscriptionService = {
  // Initialize IAP (call this on app start)
  async initialize() {
    await initIAP();
    
    // Set up purchase listener
    const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase) => {
      console.log('Purchase updated:', purchase);
      
      try {
        // Verify and activate subscription
        await subscriptionService.verifyPurchase(purchase);
        
        // Acknowledge purchase on Android
        if (Platform.OS === 'android' && purchase.purchaseToken) {
          await RNIap.acknowledgePurchaseAndroid(purchase.purchaseToken);
        }
        
        // Finish transaction
        await RNIap.finishTransaction({ purchase, isConsumable: false });
      } catch (error) {
        console.error('Error processing purchase:', error);
      }
    });
    
    const purchaseErrorSubscription = RNIap.purchaseErrorListener((error) => {
      console.warn('Purchase error:', error);
    });
    
    return { purchaseUpdateSubscription, purchaseErrorSubscription };
  },
  // Check if user can create invoice (under limit)
  async canCreateInvoice(): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, invoice_count, invoice_limit')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Pro users have unlimited
      if (profile.subscription_tier === 'pro') {
        return { allowed: true };
      }

      // Free users check limit
      if (profile.invoice_count >= profile.invoice_limit) {
        return {
          allowed: false,
          reason: `You've reached your free tier limit of ${profile.invoice_limit} invoices per month. Upgrade to Pro for unlimited invoices!`,
        };
      }

      return { allowed: true };
    } catch (error: any) {
      console.error('Error checking invoice limit:', error);
      return { allowed: true }; // Allow on error to not block users
    }
  },

  // Increment invoice count after creation
  async incrementInvoiceCount() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, invoice_count')
        .eq('id', user.id)
        .single();

      // Only increment for free tier users
      if (profile?.subscription_tier === 'free') {
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, invoice_count, invoice_limit, subscription_expires_at')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      return {
        tier: profile.subscription_tier || 'free',
        status: profile.subscription_status || 'free',
        invoiceCount: profile.invoice_count || 0,
        invoiceLimit: profile.invoice_limit || 2,
        expiresAt: profile.subscription_expires_at,
        isPro: profile.subscription_tier === 'pro',
        remainingInvoices: Math.max(0, (profile.invoice_limit || 2) - (profile.invoice_count || 0)),
      };
    } catch (error: any) {
      console.error('Error getting subscription status:', error);
      throw error;
    }
  },

  // Upgrade to Pro (Google Play Billing integration)
  async upgradeToPro() {
    try {
      await initIAP();
      
      // Get available subscriptions
      const subscriptions = await RNIap.fetchProducts({ 
        skus: [SUBSCRIPTION_SKUS.PRO_MONTHLY],
        type: 'subs' 
      });
      
      if (!subscriptions || subscriptions.length === 0) {
        throw new Error('Subscription product not found. Please ensure swift_invoice_pro_monthly is configured in Google Play Console.');
      }
      
      console.log('Available subscriptions:', subscriptions);
      
      // Request subscription purchase
      await RNIap.requestPurchase({
        type: 'subs',
        request: Platform.OS === 'android' ? {
          android: {
            skus: [SUBSCRIPTION_SKUS.PRO_MONTHLY],
          }
        } : {
          ios: {
            sku: SUBSCRIPTION_SKUS.PRO_MONTHLY,
          }
        },
      });
      
      // Purchase flow will be handled by the purchaseUpdatedListener
    } catch (error: any) {
      console.error('Error upgrading to Pro:', error);
      throw error;
    }
  },

  // Verify purchase and update database
  async verifyPurchase(purchase: RNIap.Purchase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate expiration date (monthly subscription)
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      // Update user's subscription in database
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_tier: 'pro',
          subscription_status: 'active',
          invoice_limit: 999999,
          subscription_expires_at: expiresAt.toISOString(),
          google_purchase_token: purchase.purchaseToken || purchase.transactionId,
        })
        .eq('id', user.id);

      if (error) throw error;

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
      await initIAP();
      
      const purchases = await RNIap.getAvailablePurchases();
      console.log('Available purchases:', purchases);

      if (purchases.length > 0) {
        // Find Pro subscription
        const proPurchase = purchases.find(p => 
          p.productId === SUBSCRIPTION_SKUS.PRO_MONTHLY
        );

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
      await initIAP();
      
      const purchases = await RNIap.getAvailablePurchases();
      const proPurchase = purchases.find(p => 
        p.productId === SUBSCRIPTION_SKUS.PRO_MONTHLY
      );

      if (!proPurchase) {
        // No active subscription found, downgrade to free if needed
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();

        if (profile?.subscription_tier === 'pro') {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: 'free',
              subscription_status: 'expired',
              invoice_limit: 2,
            })
            .eq('id', user.id);
        }
      } else {
        // Verify and update subscription
        await this.verifyPurchase(proPurchase);
      }
    } catch (error) {
      console.error('Error syncing subscription:', error);
    }
  },
};
