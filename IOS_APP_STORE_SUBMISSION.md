# Swift Invoice: first iOS App Store submission

This repository is prepared for iOS version `1.3.0` with bundle identifier `com.invoiceautomator.app`. EAS Build manages the iOS certificate and provisioning profile remotely. The App Store Connect app record is configured as Apple ID `6788092733`. Build 29 is a signed free-plan fallback; build 30 is the finished release candidate with Apple monthly and annual Pro subscriptions.

Do not submit builds 28 or 29 for review. Build 28 had a cross-platform entitlement compliance issue; build 29 removed iPhone purchases. Build 30 adds Apple In-App Purchase, verified monthly and annual Pro plans, restore/manage-subscription controls, dynamic localized prices, and App Store Server Notifications.

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

## 3. App Store binary

Build 30 finished successfully from commit `0eef3e04e90157cf1f4e0651b7dcfbfd31df9a06`:

- **EAS build ID:** `ff714008-f94b-49ba-9e6f-2d60e0e41453`
- **Version/build:** `1.3.0 (30)`
- **IPA size:** 15,353,311 bytes
- **SHA-256:** `55940d05bb2c392cc1a2f1027462dc15ab2c350d18ffdb022b99c2c35a0d45ac`
- **Build page:** https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/ff714008-f94b-49ba-9e6f-2d60e0e41453

Artifact inspection confirmed that the candidate is iPhone-only, production signed, uses bundle ID `com.invoiceautomator.app`, and declares `ITSAppUsesNonExemptEncryption=false`. Rebuild only if release source changes; EAS will then assign a build number higher than 30.

Install the build through TestFlight and test on a physical iPhone:

- Email/password, Google, and Apple sign-in.
- Create a quote with a before picture, email/share it, approve it, and convert it to an invoice.
- Add a finished picture, mark the invoice paid, and generate/share the receipt.
- Reach the free limit and confirm the app blocks another new document while existing documents remain accessible.
- Purchase monthly Pro in Apple's sandbox, confirm unlimited access, sign out/in, and restore it.
- Repeat with annual Pro and verify the App Store manage-subscription link.
- Settings → Delete account must show two destructive confirmations. Use a disposable test account because the deletion is real.
- Deny and later grant Contacts and Photos permission to confirm both paths remain usable.

## 4. Upload to App Store Connect

Build 28 was uploaded successfully through [EAS submission d2eb5ed2](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/submissions/d2eb5ed2-133c-4a84-9184-67a810d22e52), but is superseded and was not selected for App Review.

Build 30 (`b4038ae2-2174-4f9c-8972-2fc4926427b9`) was uploaded, processed as `VALID`, and attached to version 1.3.0. Its EAS build ID is `ff714008-f94b-49ba-9e6f-2d60e0e41453` and its source commit is `0eef3e04e90157cf1f4e0651b7dcfbfd31df9a06`.

## 5. Apple Pro products

The **Swift Invoice Pro** subscription group (`22431275`) contains two same-level products:

| Product ID | Duration | US price | Display name |
| --- | --- | --- | --- |
| `swift_invoice_pro_monthly` | 1 month | $3.99 | Monthly Pro |
| `swift_invoice_pro_annual` | 1 year | $39.99 | Annual Pro |

Both products are localized, have private review screenshots and notes, use Apple's equalized prices, and are available in all 175 territories. Production and sandbox Version 2 server notification URLs are `https://dfqjfbtizqrzqujkvalx.supabase.co/functions/v1/apple-store-notifications`.

## 6. App Store listing draft

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
> The free plan includes two new documents each month. Existing documents remain available. Optional Monthly Pro and Annual Pro subscriptions provide unlimited quotes and invoices.

## 7. App privacy answers

Answer App Store Connect's privacy questions from the app's actual behavior. Swift Invoice stores data in the user's account to provide app functionality; it does not use data for third-party advertising or tracking.

| Data category | Examples in Swift Invoice | Linked to user | Purpose |
| --- | --- | --- | --- |
| Contact info | Name, email address, phone number and physical address for the account, business and customers | Yes | App functionality |
| Financial info | Payment information/instructions, invoice amounts, payment records and income reports | Yes | App functionality |
| User content | Email/message contents, photos/videos, quotes, invoices, receipts, notes and other document content | Yes | App functionality |
| Customer support | Feedback text, optional reply email, and rating | Yes | App functionality |
| Identifiers | Supabase account/user ID | Yes | Authentication and app functionality |
| Purchases | Apple/Google transaction identifiers, product, status and expiration | Yes | App functionality |
| Diagnostics | Declare only if the final binary or enabled service actually sends crash or diagnostic data | Depends on service | App functionality or analytics, as applicable |

All 12 listed data types were published October 1, 2026 as linked to the user's identity, used only for app functionality, and not used for tracking. Recheck the generated iOS privacy report and every enabled third-party SDK before any later privacy-label update.

## 9. Submitted review

App version 1.3.0, the Swift Invoice Pro group, Monthly Pro and Annual Pro were submitted together as required for the first auto-renewable subscription release. App Store Connect submission `5e3b5ccc-e195-43b2-a54b-8efa8768d638` was accepted at `2026-10-01T14:46:51.153Z`; the app and both subscription products are `WAITING_FOR_REVIEW`. Automatic release is enabled.

## 8. Screenshots and review information

Capture screenshots from the final TestFlight build. The replacement is iPhone-only, so do not add an iPad screenshot set. Apple currently accepts one to ten screenshots and can scale the highest-resolution iPhone set to smaller sizes. Good screens are Menu, a quote with before pictures, the converted invoice, a paid receipt with finished pictures, and the document list. Use fictional customer and business data.

Create a disposable reviewer account with sample business/customer data. Put its email and password in **App Review Information**, never in Git. Suggested review notes:

> Swift Invoice creates quotes, converts approved quotes into invoices, and creates receipts after an invoice is marked paid. To test: sign in with the review account, open Menu → Quotes, create or open the sample quote, mark it approved, choose Convert to invoice, then mark the invoice paid to generate the receipt. Job pictures can be added from the document form. Account deletion is available at Settings → Delete account. Settings → Your plan offers Monthly Pro and Annual Pro through Apple In-App Purchase and includes Restore purchases. Payment links are instructions supplied by the business for collecting payment for physical goods or services outside the app; Swift Invoice does not process those customer payments.

If the reviewer account uses Sign in with Apple, deletion also displays Apple's manual authorization-removal path because the native identity-token flow does not retain an Apple refresh token for programmatic revocation. Prefer an email/password reviewer account so the reviewer can reuse it throughout review.

Before pressing **Add for Review**, complete App Privacy, age rating, export compliance, content rights, support contact, review credentials, screenshots, and version metadata. `ITSAppUsesNonExemptEncryption` is set to `false` in the app configuration because the app does not implement non-exempt encryption.
