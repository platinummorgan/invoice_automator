# Subscription/Monetization Implementation Summary

## What's Been Implemented

### 1. Database Schema (✅ Ready to Run)
**File:** `supabase/add_subscription_fields.sql`

Run this SQL in your Supabase SQL Editor to add subscription fields to the profiles table:
- `subscription_status`: free, active, expired, cancelled
- `subscription_tier`: free (2 invoices), pro (unlimited)
- `invoice_count`: Tracks how many invoices created this billing period
- `invoice_limit`: 2 for free, 999999 for pro
- `subscription_expires_at`: When subscription renews
- `google_purchase_token`: For Google Play verification

### 2. Subscription Service (✅ Complete)
**File:** `src/services/subscription.ts`

Functions:
- `canCreateInvoice()`: Checks if user can create invoice (under limit)
- `incrementInvoiceCount()`: Increments count after invoice creation
- `getSubscriptionStatus()`: Returns tier, count, limit, remaining invoices
- `upgradeToPro()`: Placeholder for Google Play Billing (shows "Coming Soon" alert)

### 3. Invoice Creation Limits (✅ Complete)
**File:** `src/screens/NewInvoiceScreen.tsx`

- Checks subscription limit BEFORE allowing invoice creation
- Shows upgrade prompt if limit reached (2 invoices for free tier)
- Increments invoice count after successful creation (free users only)
- Pro users have unlimited invoices

### 4. Settings Screen UI (✅ Complete)
**File:** `src/screens/SettingsScreen.tsx`

Shows subscription card at top:
- **Free Tier**: Shows "X of 2 free invoices remaining"
- **Upgrade Button**: "$3.99/month" for unlimited invoices
- **Pro Tier**: Shows "⭐ Pro" badge with "Active" status
- Currently shows "Coming Soon" alert when clicking upgrade

## User Flow

### Free Tier (Current Default)
1. User signs up → Automatically gets free tier (2 invoices/month)
2. Creates invoice #1 → Count: 1/2 remaining
3. Creates invoice #2 → Count: 0/2 remaining
4. Tries to create invoice #3 → Blocked with upgrade prompt
5. Clicks "Upgrade to Pro" → Navigated to Settings screen
6. Clicks upgrade button → "Coming Soon" alert (Google Play Billing not yet integrated)

### Pro Tier (After Google Play Billing Setup)
1. User clicks upgrade → Google Play billing flow
2. Confirms $3.99/month subscription
3. Profile updated to `subscription_tier: 'pro'`
4. `invoice_limit` set to 999999 (unlimited)
5. Can create unlimited invoices
6. Settings shows "⭐ Pro - Active" badge

## Next Steps (Google Play Billing Integration)

### Phase 1: Google Play Console Setup
1. Create subscription product in Google Play Console
   - Product ID: `swift_invoice_pro_monthly`
   - Price: $3.99/month
   - Billing period: 1 month
   - Free trial: 7 days (optional)

2. Configure your app for billing:
   - Add billing permissions to `android/app/src/main/AndroidManifest.xml`:
     ```xml
     <uses-permission android:name="com.android.vending.BILLING" />
     ```

### Phase 2: Code Integration
The `react-native-iap` package is already installed. You'll need to:

1. Update `src/services/subscription.ts`:
   - Replace `upgradeToPro()` placeholder with actual `react-native-iap` calls
   - Implement purchase flow
   - Verify purchases with Google Play
   - Update database on successful purchase

2. Add purchase listeners to handle:
   - Successful purchases
   - Failed purchases  
   - Subscription renewals
   - Subscription cancellations

### Phase 3: Testing
1. Test with Google Play's test accounts
2. Verify purchase flow end-to-end
3. Test subscription renewal/expiration
4. Test upgrade blocking (free tier limits)

## Current Status

✅ **Working Now:**
- Free tier with 2 invoice limit
- Invoice count tracking
- Upgrade prompts when limit reached
- Settings UI showing subscription status
- Database schema ready

⏳ **Pending:**
- Google Play Billing integration
- Actual payment processing
- Subscription renewal automation
- Purchase verification

## Monthly Invoice Reset

Free tier users need invoice count reset monthly. Options:

1. **Supabase Cron Job** (Recommended):
   - Schedule `reset_free_invoice_counts()` function to run monthly
   - Go to Supabase Dashboard → Database → Cron Jobs
   - Schedule: `0 0 1 * *` (first day of each month at midnight)

2. **Manual Reset** (For testing):
   ```sql
   UPDATE profiles SET invoice_count = 0 WHERE subscription_tier = 'free';
   ```

## Testing the Current Implementation

1. Run the SQL migration in Supabase
2. Rebuild the app: `npm run android`
3. Try creating 3 invoices
4. On the 3rd attempt, you'll see the upgrade prompt
5. Check Settings → See subscription card showing "0 of 2 remaining"

## Pricing Strategy

**Current Plan:**
- Free: 2 invoices/month
- Pro: $3.99/month unlimited

**Alternative Options:**
- Add annual plan: $39.99/year (save $8, 2 months free)
- Add free trial: 7 days of Pro features
- Add lifetime option: $49.99 one-time (no recurring revenue)

## Notes

- Google Play takes 15% (first $1M revenue) or 30% after
- $3.99/month = ~$3.39 to you (15% fee) = ~$40/year per user
- 2 invoice free limit encourages upgrade without being too restrictive
- Pro users never see upgrade prompts or invoice count
