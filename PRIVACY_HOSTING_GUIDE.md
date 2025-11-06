# Privacy Policy & Terms Hosting Guide

## 📄 What You Have

✅ **privacy-policy.html** - Complete privacy policy  
✅ **terms-of-service.html** - Complete terms of service  
✅ **In-app privacy screen** - Already built in Settings  

## 🌐 How to Host (Choose One)

### Option 1: GitHub Pages (Recommended - Free)

1. **Push files to GitHub**:
```bash
git add privacy-policy.html terms-of-service.html
git commit -m "Add privacy policy and terms"
git push origin main
```

2. **Enable GitHub Pages**:
   - Go to your repo: https://github.com/platinummorgan/invoice_automator
   - Click **Settings** tab
   - Scroll to **Pages** section
   - Source: **Deploy from a branch**
   - Branch: **main** / **root**
   - Click **Save**

3. **Wait 2-3 minutes**, then your files will be live at:
   - `https://platinummorgan.github.io/invoice_automator/privacy-policy.html`
   - `https://platinummorgan.github.io/invoice_automator/terms-of-service.html`

4. **Use these URLs** in Google Play Console

---

### Option 2: Netlify Drop (Instant - Free)

1. Go to [Netlify Drop](https://app.netlify.com/drop)
2. Drag and drop both HTML files
3. Get instant URLs like:
   - `https://your-site-name.netlify.app/privacy-policy.html`
   - `https://your-site-name.netlify.app/terms-of-service.html`

---

### Option 3: Google Drive (Quick Hack)

1. Upload HTML files to Google Drive
2. Right-click → **Share** → **Anyone with the link**
3. **Not recommended** - May not be accepted by Google Play

---

## 📝 For Google Play Console

When setting up your app:

### Store Listing Section

**Privacy Policy URL** (Required):
```
https://platinummorgan.github.io/invoice_automator/privacy-policy.html
```

**Store Listing Description** (Include):
```
Swift Invoice - Create professional invoices on the go!

FREE FEATURES:
• 2 free invoices per month
• Professional PDF generation
• Email invoices to customers
• Customer management
• Tax calculations

PRO FEATURES ($3.99/month):
• Unlimited invoices
• Priority support
• All features unlocked

Privacy Policy: [your URL]
Terms of Service: [your URL]
```

### App Content Section

When asked about:
- **Privacy Policy**: Paste your URL
- **Target audience**: 13+ (per your policy)
- **App access**: Full access (no login required for demo)
- **Ads**: None
- **Sensitive permissions**: Explain any you use

---

## 🔗 Update Your App

Add clickable links in your app's About or Settings:

```typescript
// In SettingsScreen.tsx or AboutScreen.tsx
const privacyUrl = 'https://platinummorgan.github.io/invoice_automator/privacy-policy.html';
const termsUrl = 'https://platinummorgan.github.io/invoice_automator/terms-of-service.html';

// Add buttons that open in browser
<TouchableOpacity onPress={() => Linking.openURL(privacyUrl)}>
  <Text>View Privacy Policy Online</Text>
</TouchableOpacity>
```

---

## ✅ Checklist

Before submitting to Google Play:

- [ ] Privacy policy HTML created
- [ ] Terms of service HTML created
- [ ] Files hosted on public URL
- [ ] URLs are accessible (test in browser)
- [ ] URLs added to Google Play Console
- [ ] Privacy policy link in app Settings (already done ✓)
- [ ] Terms mentioned on sign-up screen (already done ✓)
- [ ] Last updated date is current (November 6, 2025 ✓)

---

## 🚨 Important Notes

### What Google Requires:
- ✅ Publicly accessible URL (not PDF download)
- ✅ Must be live before app submission
- ✅ Cannot be localhost or temporary link
- ✅ Must match your app's actual data practices

### What's Already in Your App:
- ✅ Privacy policy screen in Settings
- ✅ Terms mentioned on sign-up
- ✅ Comprehensive coverage of data practices
- ✅ Mentions subscription billing

### What's NEW in the HTML:
- ✅ Added subscription/billing section
- ✅ Added Google Play Billing mention
- ✅ Added international data transfer clause
- ✅ Updated for Pro tier ($3.99/month)

---

## 📞 If Google Rejects Your Policy

Common reasons:
1. **URL not working** - Test in incognito browser
2. **Missing data disclosure** - Policy must match Data Safety form
3. **No refund policy** - Added in Terms of Service
4. **Subscription terms unclear** - Clearly stated in both docs

---

## Next Steps

1. **Push to GitHub** and enable Pages (5 minutes)
2. **Test URLs** work in browser
3. **Copy URLs** to Google Play Console
4. **Fill out Data Safety** form (matches privacy policy)
5. **Submit for review**

Your privacy policy is comprehensive and ready for Google Play! 🎉
