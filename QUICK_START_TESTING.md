# Quick Start - Google Play Subscription Testing

## 🚀 Get Testing in 30 Minutes

### Step 1: Database (5 minutes)
1. Open [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy ALL content from `supabase/add_subscription_fields.sql`
6. Paste and click **Run**
7. Verify success message

### Step 2: Google Play Console (15 minutes)

#### Create Subscription Product
1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (or create new app)
3. Navigate: **Monetize** → **Subscriptions**
4. Click **Create subscription**
5. Enter:
   - **Product ID**: `swift_invoice_pro_monthly` (exact match required!)
   - **Name**: Swift Invoice Pro
   - **Description**: Unlimited invoice creation
   - **Price**: $3.99 USD
   - **Billing period**: 1 month
6. Click **Activate**

#### Add Test Account
1. Go to **Setup** → **License testing**
2. Click **Add license testers**
3. Add your Gmail address
4. Click **Save**
5. ⏰ Wait 15-30 minutes for it to activate

### Step 3: Build & Upload (10 minutes)

```bash
# Build production bundle
npx expo prebuild
cd android
./gradlew bundleRelease

# Or use EAS Build (recommended)
eas build --platform android --profile production
```

1. Go to **Release** → **Testing** → **Internal testing**
2. Click **Create new release**
3. Upload your AAB file
4. Add release notes: "Testing subscription features"
5. Click **Review release** → **Start rollout**

### Step 4: Install & Test

1. **Get test link**: Internal testing page → **Testers** tab → Copy opt-in URL
2. **Open link on Android phone** with test Gmail account
3. **Accept invitation** to become tester
4. **Install from Play Store** (must use Play Store, not APK)
5. **Open app and test**:
   - ✅ Create 2 invoices (should work)
   - ✅ Try to create 3rd (should block with upgrade prompt)
   - ✅ Tap "Upgrade to Pro"
   - ✅ Google billing sheet appears
   - ✅ Complete purchase (you won't be charged)
   - ✅ Create unlimited invoices (should work)

---

## 🐛 Quick Troubleshooting

### "Product not found"
- Wait 2-4 hours after creating subscription product
- Verify product ID is exactly: `swift_invoice_pro_monthly`
- Check product is **Activated** (not draft)
- App must be installed from Play Store, not sideloaded APK

### Can't see upgrade prompt
- Run SQL migration in Supabase
- Reinstall app from Play Store
- Check you're logged in with correct account

### Billing sheet doesn't show
- Verify Gmail is added to License Testing
- Wait 30 minutes after adding test account
- Must install from Play Store internal testing link
- Clear Play Store cache: Settings → Apps → Play Store → Clear cache

### Still charging real money
- Double-check Gmail is in **License Testing** list
- Use this test account for instant testing: `android.test.purchased@gmail.com`
- Contact Google Play support if still being charged

---

## 📱 What Users Will See

### Dashboard (Free User)
```
┌─────────────────────────────────────┐
│  ⭐  Upgrade to Pro                 │
│  0 of 2 free invoices left          │
│  Unlimited for $3.99/mo          ›  │
└─────────────────────────────────────┘
```

### When Pressing + (At Limit)
```
┌──────────── Alert ────────────┐
│      Upgrade Required          │
│                                │
│  You've reached your free      │
│  tier limit of 2 invoices      │
│  per month. Upgrade to Pro     │
│  for unlimited invoices!       │
│                                │
│ [Maybe Later] [Upgrade to Pro] │
└────────────────────────────────┘
```

### Settings (Free)
```
┌─────────────────────────────────────┐
│  🆓 Free                            │
│  0 of 2 free invoices remaining     │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Upgrade to Pro - $3.99/month │ │
│  │  Unlimited invoices •         │ │
│  │  Priority support             │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

### Settings (After Upgrade)
```
┌─────────────────────────────────────┐
│  ⭐ Pro              Active          │
│  Unlimited invoices                 │
│  All features unlocked              │
└─────────────────────────────────────┘
```

---

## 💰 What Happens After Purchase

1. **Immediate**: User upgraded to Pro tier in database
2. **Immediate**: Invoice limit raised to 999,999
3. **Immediate**: Pro badge appears in Settings
4. **Immediate**: Dashboard banner disappears
5. **Immediate**: Can create unlimited invoices
6. **24 hours**: Subscription appears in Play Store → Subscriptions
7. **Monthly**: Google charges user $3.99
8. **Monthly**: You receive $3.39 (after 15% Google fee)
9. **Monthly**: Subscription auto-renews unless user cancels

---

## 📊 Monitoring

### View Subscription Stats
1. **Google Play Console** → **Monetize** → **Overview**
2. See:
   - Active subscribers
   - New subscribers this month
   - Churned subscribers
   - Monthly recurring revenue
   - Retention rate

### View Individual Purchases
1. **Google Play Console** → **Order management**
2. Search by email or order ID
3. See transaction history, refunds, cancellations

### Database Check
```sql
-- Count Pro users
SELECT COUNT(*) 
FROM profiles 
WHERE subscription_tier = 'pro';

-- View subscription details
SELECT 
  id,
  subscription_tier,
  invoice_count,
  subscription_status,
  subscription_expires_at
FROM profiles;
```

---

## 🎯 Success Metrics

After 1 week of testing:
- [ ] 5+ test purchases completed successfully
- [ ] All purchases activated correctly in app
- [ ] Purchase restoration works after reinstall
- [ ] No crashes or errors reported
- [ ] Unlimited invoices work for Pro users
- [ ] Free users properly blocked at limit

**Ready for production once all boxes checked!**

---

## 📞 Support

Need help? Check these resources:
1. **Technical issues**: Review `SUBSCRIPTION_READY_CHECKLIST.md`
2. **Google Play setup**: See `GOOGLE_PLAY_SETUP.md`
3. **Code questions**: Check `MONETIZATION_IMPLEMENTATION.md`
4. **Google Play support**: [Developer Support](https://support.google.com/googleplay/android-developer)

---

## ⏭️ After Testing

Once testing is complete:
1. Move to **Closed testing** (alpha) with 50-100 users
2. Collect feedback on pricing and features
3. Submit for **Production** review
4. Set up Supabase cron for monthly reset
5. Add analytics to track conversion rates
6. Consider annual plan ($39.99/year)

**Time to first paying customer**: 1-2 weeks from now! 🎉
