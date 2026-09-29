# Swift Invoice: first iOS App Store submission

This repository is prepared for iOS version `1.3.0` with bundle identifier `com.invoiceautomator.app`. EAS Build manages the iOS certificate and provisioning profile remotely. The App Store Connect app record is configured as Apple ID `6788092733`. Audited replacement [EAS build 29](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/18738c76-d2db-4b1e-8af5-c1f6f7324980) finished successfully from commit `40e6abd5f52777b1ad5f6a9a0348e4ef2ab5c993`.

Do not submit build 28 for review. It was uploaded successfully, but the September 29 release audit found that it allowed a Google Play entitlement to unlock iPhone features without offering the same tier through Apple In-App Purchase. The replacement candidate makes the iPhone app a self-contained free plan, removes references to other mobile platforms from the iOS interface, removes an unused Contacts permission, and targets iPhone only. Google Play entitlements remain Android-only until Apple billing is implemented.

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

Build 29 is the replacement candidate. Build again only if source changes. The build command is:

```bash
npm run build:ios
```

EAS read version `1.3.0` from `app.json` and assigned build number 29. The signed IPA is 15,346,142 bytes with SHA-256 `e519410bdb7966afc4d5df6ed22bd1f62cbd1e119003187aa1e38f6bea745d9e`. Inspection confirmed bundle `com.invoiceautomator.app`, iPhone-only device family, iOS 15.1 minimum, Xcode/iOS SDK 26, production signing, Sign in with Apple entitlement, and `ITSAppUsesNonExemptEncryption=false`.

Install the build through TestFlight and test on a physical iPhone:

- Email/password, Google, and Apple sign-in.
- Create a quote with a before picture, email/share it, approve it, and convert it to an invoice.
- Add a finished picture, mark the invoice paid, and generate/share the receipt.
- Reach the free limit and confirm the app blocks another new document while existing documents remain accessible.
- Settings → Delete account must show two destructive confirmations. Use a disposable test account because the deletion is real.
- Deny and later grant Contacts and Photos permission to confirm both paths remain usable.

## 4. Upload to App Store Connect

Build 28 was uploaded successfully through [EAS submission d2eb5ed2](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/submissions/d2eb5ed2-133c-4a84-9184-67a810d22e52), but is superseded and must not be selected for App Review.

Build 29 upload is blocked on refreshing the stored App Store Connect API key. [Submission 1b021081](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/submissions/1b021081-3f82-4119-8cf8-e51e4ce715b4) and [retry 56d41264](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/submissions/56d41264-691e-4950-8092-dd57071fb7e4) both errored before a submission worker or log file was created. EAS Submit and Apple Developer APIs reported operational, making the nine-month-old stored key the likely cause.

Refresh it with `npx eas-cli@latest credentials --platform ios`, choose `production`, authenticate to Apple, then choose **App Store Connect: Manage your API Key** and replace the EAS Submit key. Alternatively, create an App Store Connect team API key with sufficient app-management access, download its `.p8` file once, and add that key through the same menu. Do not use a Sign in with Apple key; it is a different credential type. Then retry the replacement upload with:

```bash
npx eas-cli@latest submit --platform ios --profile production --id 18738c76-d2db-4b1e-8af5-c1f6f7324980
```

The submit profile targets App Store Connect app `6788092733`. Processing in App Store Connect can take several minutes. Attach only build 29 to the `1.3.0` version.

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
> The free plan includes two new documents each month. Existing documents remain available.

## 6. App privacy answers

Answer App Store Connect's privacy questions from the app's actual behavior. Swift Invoice stores data in the user's account to provide app functionality; it does not use data for third-party advertising or tracking.

| Data category | Examples in Swift Invoice | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact info | Account name/email, business contact details, customer names/emails/phones | Yes | App functionality |
| Financial info | Invoice amounts, payment records, and business-supplied payment instructions or links | Yes | App functionality |
| User content | Quotes, invoices, receipts, notes, business logo, job pictures | Yes | App functionality |
| Customer support | Feedback text, optional reply email, and rating | Yes | App functionality |
| Identifiers | Supabase account/user ID | Yes | Authentication and app functionality |
| Purchases | Account subscription status and Android purchase verification records | Yes | App functionality |
| Diagnostics | Declare only if the final binary or enabled service actually sends crash or diagnostic data | Depends on service | App functionality or analytics, as applicable |

Select **No** for tracking unless a later release adds cross-app tracking or advertising SDKs. Recheck the generated iOS privacy report and every enabled third-party SDK before submitting.

## 7. Screenshots and review information

Capture screenshots from the final TestFlight build. The replacement is iPhone-only, so do not add an iPad screenshot set. Apple currently accepts one to ten screenshots and can scale the highest-resolution iPhone set to smaller sizes. Good screens are Menu, a quote with before pictures, the converted invoice, a paid receipt with finished pictures, and the document list. Use fictional customer and business data.

Create a disposable reviewer account with sample business/customer data. Put its email and password in **App Review Information**, never in Git. Suggested review notes:

> Swift Invoice creates quotes, converts approved quotes into invoices, and creates receipts after an invoice is marked paid. To test: sign in with the review account, open Menu → Quotes, create or open the sample quote, mark it approved, choose Convert to invoice, then mark the invoice paid to generate the receipt. Job pictures can be added from the document form. Account deletion is available at Settings → Delete account. The iPhone app has a free monthly allowance and offers no purchases or subscriptions. Payment links are instructions supplied by the business for collecting payment for physical goods or services outside the app; Swift Invoice does not process those customer payments.

If the reviewer account uses Sign in with Apple, deletion also displays Apple's manual authorization-removal path because the native identity-token flow does not retain an Apple refresh token for programmatic revocation. Prefer an email/password reviewer account so the reviewer can reuse it throughout review.

Before pressing **Add for Review**, complete App Privacy, age rating, export compliance, content rights, support contact, review credentials, screenshots, and version metadata. `ITSAppUsesNonExemptEncryption` is set to `false` in the app configuration because the app does not implement non-exempt encryption.
