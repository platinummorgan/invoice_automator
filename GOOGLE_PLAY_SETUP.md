# Google Play Console Setup Guide

## Overview
This guide walks you through setting up in-app subscriptions for Swift Invoice in Google Play Console.

## Prerequisites
- Google Play Console developer account ($25 one-time fee)
- App uploaded to Google Play Console (at least internal testing track)
- Google Play Billing Library integrated (already done via react-native-iap)

## Step-by-Step Setup

### 1. Create Your App in Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Click **Create app**
3. Fill in app details:
   - App name: **Swift Invoice**
   - Default language: English (United States)
   - App or game: **App**
   - Free or paid: **Free**
4. Accept Developer Program Policies and US export laws
5. Click **Create app**

### 2. Complete Store Listing

Before you can set up subscriptions, complete these required sections:
- **Main store listing**: Add app description, screenshots, icon
- **Content rating**: Complete questionnaire
- **Target audience**: Select age groups
- **Privacy policy**: Add privacy policy URL

### 3. Create Subscription Product

1. In your app dashboard, go to **Monetize** → **Subscriptions**
2. Click **Create subscription**
3. Fill in subscription details:

#### Product ID
```
swift_invoice_pro_monthly
```
**Important**: This MUST match the SKU in your code (`SUBSCRIPTION_SKUS.PRO_MONTHLY`)

#### Product Details
- **Name**: Swift Invoice Pro
- **Description**: Unlimited invoice creation and premium features

#### Pricing
1. Click **Set price**
2. Select pricing template or set custom:
   - **Base country**: United States
   - **Price**: $3.99
3. Google will auto-convert to other currencies
4. Click **Apply prices**

#### Subscription Options
- **Billing period**: 1 month (P1M)
- **Free trial**: (Optional) 7 days
- **Grace period**: 3 days (recommended)
- **Account hold**: 30 days (recommended)

5. Click **Activate** to publish the subscription

### 4. Set Up License Testing

For testing without real payments:

1. Go to **Setup** → **License testing**
2. Add test Gmail accounts under "License testers"
3. These accounts can make test purchases without being charged

#### Test Response Codes
You can add these test emails for specific behaviors:
- `android.test.purchased@gmail.com` - Always succeeds
- `android.test.canceled@gmail.com` - Purchase canceled
- `android.test.item_unavailable@gmail.com` - Item not available

### 5. Configure App Signing

1. Go to **Release** → **Setup** → **App integrity**
2. Enroll in **Play App Signing** (required for subscriptions)
3. Upload your signing key or let Google generate one
4. Download and use the upload key for future builds

### 6. Create Internal Testing Release

1. Go to **Release** → **Testing** → **Internal testing**
2. Click **Create new release**
3. Upload your APK/AAB file:
   ```bash
   # Build production APK
   eas build --platform android --profile production
   ```
4. Add release notes
5. Click **Save** and then **Review release**
6. Click **Start rollout to Internal testing**

### 7. Add Internal Testers

1. In **Internal testing** section
2. Click **Testers** tab
3. Create email list with tester Gmail addresses
4. Share the opt-in URL with testers

### 8. Verify Integration

After uploading your app build:

1. Testers install app via Play Store (internal testing link)
2. Test the subscription flow:
   - Create 2 free invoices
   - On 3rd attempt, upgrade prompt appears
   - Tap "Upgrade to Pro"
   - Google Play billing sheet appears
   - Complete test purchase (no charge for license testers)
   - Subscription activates, unlimited invoices available

## Build Configuration

### Update app.json

Make sure your `app.json` includes:

```json
{
  "expo": {
    "android": {
      "package": "com.yourcompany.swiftinvoice",
      "versionCode": 1,
      "permissions": [
        "com.android.vending.BILLING"
      ],
      "config": {
        "googleMobileAdsAppId": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy"
      }
    }
  }
}
```

### Build for Production

```bash
# Build production bundle
npx expo build:android -t app-bundle

# Or with EAS Build
eas build --platform android --profile production
```

## Testing Checklist

- [ ] License testers added to Google Play Console
- [ ] Subscription product created with ID: `swift_invoice_pro_monthly`
- [ ] Subscription is **Activated** in console
- [ ] Internal testing track created
- [ ] App uploaded to internal testing
- [ ] Testers can install via Play Store link
- [ ] Free tier works (2 invoice limit)
- [ ] Upgrade prompt appears on 3rd invoice
- [ ] Google Play billing sheet appears
- [ ] Test purchase completes successfully
- [ ] Subscription activates in app
- [ ] Unlimited invoices available after upgrade
- [ ] Subscription shows in Play Store → Subscriptions

## Common Issues

### "Product not found" error
- **Cause**: Subscription product not activated or wrong SKU
- **Fix**: Verify product ID matches code exactly, ensure product is "Active" in console

### Billing sheet doesn't appear
- **Cause**: App not signed with Play Store signing key
- **Fix**: Build with proper signing configuration, upload to Play Store

### Test purchases charging real money
- **Cause**: Test account not added to License Testing
- **Fix**: Add Gmail account to License Testing list in Play Console

### Subscription not activating after purchase
- **Cause**: Purchase listener not working or database not updating
- **Fix**: Check console logs, verify `verifyPurchase()` is called

## Production Launch

Before public release:

1. **Closed testing** (alpha): Test with larger group (100-1000 users)
2. **Open testing** (beta): Open to anyone with link
3. **Production**: Full public release

Each stage requires:
- New release with updated version code
- Review and approval (can take 1-7 days)
- Rollout percentage (start at 10%, increase gradually)

## Subscription Management

### View Active Subscriptions
1. Go to **Monetize** → **Subscriptions**
2. Click on your subscription
3. View metrics: Active subscriptions, revenue, churn rate

### Handle Cancellations
Users can cancel via:
- Play Store → Subscriptions → Swift Invoice Pro → Cancel
- Cancellation keeps access until period ends
- App should check subscription status on app startup

### Subscription Lifecycle
1. **Active**: User has paid, full access
2. **Grace period**: Payment failed, still has access (3 days)
3. **On hold**: Payment failed, access removed (30 days)
4. **Expired**: Subscription ended, back to free tier

## Support Resources

- [Google Play Billing Documentation](https://developer.android.com/google/play/billing)
- [Subscription Setup Guide](https://support.google.com/googleplay/android-developer/answer/140504)
- [react-native-iap Documentation](https://react-native-iap.dooboolab.com/)
- [Test Purchases Guide](https://developer.android.com/google/play/billing/test)

## Revenue Tracking

### View Earnings
1. Go to **Monetize** → **Overview**
2. View graphs for:
   - Total revenue
   - Active subscriptions
   - New subscribers
   - Churned subscribers
3. Filter by date range

### Payment Timeline
- Google pays monthly (around 15th of month)
- Payment is for previous month's earnings
- Google takes 15% commission (30% first year, then 15%)
- $3.99/month subscription = $3.39 to you (15% fee)

## Next Steps

After setup is complete:
1. Run SQL migration in Supabase (see `supabase/add_subscription_fields.sql`)
2. Test the complete flow end-to-end
3. Monitor subscription metrics in Google Play Console
4. Collect user feedback on pricing and features
5. Consider adding annual subscription option ($39.99/year = 2 months free)
