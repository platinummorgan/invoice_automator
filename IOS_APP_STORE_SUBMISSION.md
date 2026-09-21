# Swift Invoice: first iOS App Store submission

This repository is prepared for iOS version `1.3.0` with bundle identifier `com.invoiceautomator.app`. EAS Build manages the iOS certificate and provisioning profile remotely. The App Store Connect app record is configured as Apple ID `6788092733`. Signed App Store build `1.3.0 (28)` completed successfully at [EAS build 28](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/7d92d41f-cd6a-4e39-8a2b-15b94fdb8e1e).

The first iPhone release uses the free plan. It does not sell Pro inside the iOS app. Existing account entitlements still load from the Swift Invoice account, while new Pro purchases and purchase restoration remain Android-only until Apple billing is added in a later release.

## 1. Pull and verify the release on the Mac

Install Git and Node.js 20 or newer, then run:

```bash
git clone https://github.com/platinummorgan/invoice_automator.git
cd invoice_automator
git checkout main
git pull --ff-only origin main
npm ci
npm run typecheck
npm test
npx expo-doctor
```

For local development, copy `.env.example` to `.env` and add the production public Supabase URL and anon key. Do not commit `.env`, Apple keys, certificates, or provisioning profiles. EAS production builds use the project's EAS `production` environment; verify it with:

```bash
npx eas-cli@latest login
npx eas-cli@latest project:info
npx eas-cli@latest env:list --environment production
```

The production environment must contain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## 2. Verify the one-time Apple setup

Use the same Apple Developer team for Apple Developer and App Store Connect.

1. In Apple Developer → Certificates, Identifiers & Profiles → Identifiers, verify an explicit App ID for `com.invoiceautomator.app`. Enable **Sign in with Apple** for that identifier.
2. In App Store Connect, open app `6788092733` and confirm its bundle ID is `com.invoiceautomator.app`. The bundle ID cannot be changed after the first build is uploaded.
3. Supabase production authentication is already configured: Apple is enabled with client ID `com.invoiceautomator.app`, Google is enabled, and `com.invoiceautomator.app://auth/callback` is in the redirect allow list. This was read back from project `dfqjfbtizqrzqujkvalx` after the update on September 21, 2026.
4. The deployed `delete-account` Edge Function was already verified at version 5.

EAS already produced successful App Store builds 23, 24, 26, and 27 for this bundle identifier, so the remote distribution certificate and provisioning profile are working. If EAS ever prompts again, sign in with the Apple account that has access to the same team and allow EAS to manage credentials.

## 3. Build the App Store binary

Build 28 is already complete from commit `b861072f2344cf03d208bc2936fcb2c357a79c1b`. Build again only after changing source. The build command is:

```bash
npm run build:ios
```

Select the correct Apple team if prompted. EAS reads the user-facing version `1.3.0` from `app.json` and auto-increments the iOS build number remotely. Build 28 is the uploaded candidate, so a replacement should become build 29; use the number EAS reports as authoritative. Wait for the build to finish and keep the EAS build URL.

Install the build through TestFlight and test on a physical iPhone:

- Email/password, Google, and Apple sign-in.
- Create a quote with a before picture, email/share it, approve it, and convert it to an invoice.
- Add a finished picture, mark the invoice paid, and generate/share the receipt.
- Reach the free limit and confirm Settings explains that Pro purchase is not offered in this iPhone release.
- Settings → Delete account must show two destructive confirmations. Use a disposable test account because the deletion is real.
- Deny and later grant Contacts and Photos permission to confirm both paths remain usable.

## 4. Upload to App Store Connect

Build 28 has already been uploaded successfully through [EAS submission d2eb5ed2](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/submissions/d2eb5ed2-133c-4a84-9184-67a810d22e52). Use this command only for a replacement build:

```bash
npx eas-cli@latest submit --platform ios --profile production --latest
```

The submit profile targets App Store Connect app `6788092733`. Processing in App Store Connect can take several minutes. When build 28 appears, attach it to the `1.3.0` version.

## 5. App Store listing draft

Use these values as a starting point:

- **Name:** Swift Invoice
- **Subtitle:** Quotes, Invoices & Receipts
- **Primary category:** Business
- **Secondary category:** Productivity
- **Privacy policy URL:** https://platinummorgan.github.io/invoice_automator/privacy-policy.html
- **Support URL:** https://platinummorgan.github.io/invoice_automator/support.html
- **Marketing URL:** optional
- **Age rating:** complete the questionnaire based on actual content; the app contains no user-facing mature content
- **Copyright:** use the current year and the legal owner of Platova Labs
- **Keywords:** `invoice,quote,receipt,contractor,small business,billing,payment,estimate,job photos`

Suggested description:

> Swift Invoice helps small service businesses move from quote to payment without entering the same job twice. Create a quote, add before pictures, convert an approved quote into an invoice, attach finished pictures, and generate a receipt when payment is recorded.
>
> Keep customers, line items, taxes, payment instructions, branded PDFs, and document history together. Share professional quotes, invoices, and receipts from your iPhone using your preferred email or sharing app.
>
> The free plan includes two new documents each month. Existing documents remain available. Pro purchases are not offered in this first iPhone release.

## 6. App privacy answers

Answer App Store Connect's privacy questions from the app's actual behavior. Swift Invoice stores data in the user's account to provide app functionality; it does not use data for third-party advertising or tracking.

| Data category | Examples in Swift Invoice | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact info | Account name/email, business contact details, customer names/emails/phones | Yes | App functionality |
| User content | Quotes, invoices, receipts, notes, business logo, job pictures | Yes | App functionality |
| Identifiers | Supabase account/user ID | Yes | Authentication and app functionality |
| Purchases | Account subscription status and Android purchase verification records | Yes | App functionality |
| Diagnostics | Declare only if the final binary or enabled service actually sends crash or diagnostic data | Depends on service | App functionality or analytics, as applicable |

Select **No** for tracking unless a later release adds cross-app tracking or advertising SDKs. Recheck the generated iOS privacy report and every enabled third-party SDK before submitting.

## 7. Screenshots and review information

Capture screenshots from the final TestFlight build. Apple requires screenshots for the device sizes selected in App Store Connect; use App Store Connect's current prompts because required sizes can change. Good screens are Menu, a quote with before pictures, the converted invoice, a paid receipt with finished pictures, and the document list.

Create a disposable reviewer account with sample business/customer data. Put its email and password in **App Review Information**, never in Git. Suggested review notes:

> Swift Invoice creates quotes, converts approved quotes into invoices, and creates receipts after an invoice is marked paid. To test: sign in with the review account, open Menu → Quotes, create or open the sample quote, mark it approved, choose Convert to invoice, then mark the invoice paid to generate the receipt. Job pictures can be added from the document form. Account deletion is available at Settings → Delete account. The first iOS release uses the free plan and does not offer in-app subscription purchases. Payment links are business-supplied external payment instructions; the app does not process customer payments.

Before pressing **Add for Review**, complete App Privacy, age rating, export compliance, content rights, support contact, review credentials, screenshots, and version metadata. `ITSAppUsesNonExemptEncryption` is set to `false` in the app configuration because the app does not implement non-exempt encryption.
