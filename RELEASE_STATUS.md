# Swift Invoice release status

Verified September 21, 2026. This document is the authoritative summary; older review and working-note files are historical.

## Versions

| Surface | Status |
| --- | --- |
| Google Play production | 1.3.0, version code 22, release committed and production track `completed` (API verified); store propagation may lag |
| iOS App Store candidate | 1.3.0 (28), signed build and App Store Connect upload finished; Apple processing, TestFlight validation, metadata, and review submission pending |
| Android release artifact | 1.3.0 (22), signed EAS production AAB uploaded to Google Play |
| Google Play internal testing | 1.2.2 (19), completed release status (API verified); owner reports final-build checks passed |
| Workflow test APK | 1.2.2 (20), EAS build finished and installed on the connected device; not uploaded to Play |
| Upgrade-route test APK | 1.2.2 (21), installed and owner-accepted on device; not uploaded to Play |
| Previous candidate build 18 | Finished, superseded; not the final artifact |
| GitHub | Version 1.3.0 source and release records are on `main`; 1.2.2 release remains a historical draft |
| Play Data safety | Owner reports submitted for review; approval not verified |
| Supabase | All five tracked migrations applied; document and billing function deployments verified; iOS Apple and Google callback authentication configured |

Build 19 was released to internal testing and later completed on production. It has now been superseded on production by version 1.3.0 (22). The earlier build-18 upload was rolled back after a commit-parameter error.

Build 20 is the internal APK that introduced the quote → invoice → receipt workflow. It finished successfully on EAS and was installed over the existing app on the connected device with data preservation. [EAS build 20](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/7b73bd5c-6372-4b14-a8c6-0475388fe7bb); APK SHA-256: `760027F33A4552B84DF1860721AC1CCBA7B358B4AED090389D9991162CC4BCB0`.

Build 21 fixes the free-limit Upgrade and View plans routes so they select the nested Settings tab and scroll directly to Your plan. [EAS build 21](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/e0b14d86-4b69-42f0-9977-ca63d44870a9); APK SHA-256: `74533615A8E4615B76A76E3C8B82256378FDB7FB2BCE03B3A4DA91998B2AFE06`. It was installed over build 20 with app-data preservation and the owner confirmed all requested checks passed, including the upgrade route.

Tester opt-in: https://play.google.com/apps/testing/com.invoiceautomator.app. The owner reports the requested final-build tests passed.

## Android production provenance

- Version: 1.3.0 (22).
- Source commit: `0927f3233e7811caa6ca57a07dc38a3e33536cd1`.
- [EAS build 22](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/aa238a5e-fc2f-4e80-98da-700ffea02ec1).
- Artifact: `swift-invoice-1.3.0-22.aab` (70,106,912 bytes); SHA-256: `5463610A620636CB72160CF0E36CE567346A36280C97AF0BA9D2D9B2499B4048`.
- Google Play accepted the edit for the production track. A fresh API read returned release `1.3.0 (22)`, status `completed`, version code `22`.
- Release notes: Create quotes, convert approved quotes into invoices, add before and finished job photos, generate receipts after payment, and use clearer upgrade navigation.
- The production AAB and local service-account credential are excluded from Git. GitHub contains the matching source and provenance only.

## Previous Android release provenance

- Source commit: d47a3d8d6996e0881c91f52b193f1385f1023d49.
- Merged into main by [PR #2](https://github.com/platinummorgan/invoice_automator/pull/2), merge commit 22e43bb3b7862cd88431a046e857ed2d8ff87910; identical source tree at merge.
- [EAS build 19](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/cb6900f0-0d62-46af-978d-d3891648495b).
- [GitHub releases](https://github.com/platinummorgan/invoice_automator/releases): v1.2.2 is a draft, visible to repository maintainers.
- Artifact: swift-invoice-1.2.2-19.aab (70314528 bytes); SHA-256: a5b6d811b0854fb5aed58fd5636686381bfebf6ed5e368f8a26c99ff27f4090e.
- Draft assets include the AAB, SHA256SUMS.txt and release-manifest.json. The AAB is a Play upload artifact, not a directly installable APK.
- Build 19 is superseded by production build 22.
- GitHub PR CI and credential scanning passed. Local working tree contains no credentials or build artifacts tracked by Git.

## Changes in 1.3.0

- Added the Quote, Invoice and Receipt menu workflow.
- Approved quotes convert into invoices without re-entering customer, job or line-item data.
- Added before and finished job pictures to documents, PDFs and email delivery.
- Marking an invoice paid generates a receipt that can be emailed or shared.
- Fixed the free-limit Upgrade and View plans routes so they open the plan section in Settings.
- Added first-release iOS configuration, Sign in with Apple, iPhone Google OAuth and permanent in-app account deletion.

## Changes in 1.2.2

- Refreshed invoice, reports, settings and account screens.
- Recoverable invoice drafts, atomic saves, safer payment recording and explicit sent status.
- PDF preview/share and clearer business payment links in PDFs and emails.
- Validation for selected payment methods and fresh payment settings at export time.
- Password recovery, support-assisted account deletion links and corrected policy wording.
- Server-verified Google subscriptions, restore/cancellation messaging, foreground refresh and scheduled reconciliation.

## Verified

TypeScript, five app regression suites and three shared billing verifier tests pass. Local PostgreSQL billing and invoice transaction tests pass. These SQL tests roll back fixtures and do not touch production customer data.

The owner tested license purchase, restore, cancellation and return to Free after expiry. Google acknowledged the test purchase. The owner subsequently reported the final build passed the requested app, PDF/payment-link and restore checks. Live automatic renewal and refund/revocation coverage is being confirmed separately.

All five migrations match remote history. The seven billing/scheduler function bodies match the local migrations; billing tables have RLS and no client grants. The document workflow migration created the private owner-scoped job-photo bucket. `create-payment-link` v8, `send-reminders` v8 and `delete-account` v5 match repository source. Cron is active every five minutes with recent HTTP 200 responses.

## Post-release follow-up

- Google accepted and validated production build 22. The production track reports `completed`; confirm storefront availability after propagation and review any Play Console policy or pre-launch findings.
- Owner confirmed draft save/reopen, payment recording and sign-out/sign-in, then reported the final-build checks passed, including the requested PDF/payment-link and restore checks. Password reset was not separately confirmed.
- Verify real Google test renewal and refund/revocation; local simulations alone do not close these checks.
- Resolve Diagnostics sharing disclosure: current submitted answer is collected, not shared, non-ephemeral, required, analytics; the sharing exemption has not been confirmed.
- Coordinate public billing enablement and full profile protection with the compatible app rollout. They remain deliberately test-scoped; see supabase/README.md.
- Publish a GitHub 1.3.0 release if a separate downloadable release record is desired; the store AAB should remain a Play upload artifact.

## First iOS submission

Version 1.3.0 adds the iOS native configuration, Sign in with Apple, browser-based Google OAuth fallback, permanent in-app account deletion, App Store Connect submit target, and iPhone-safe plan messaging. The first iPhone release does not offer an in-app Pro purchase. Existing account entitlements still load; Android remains the purchase and restore platform until Apple billing is implemented.

[EAS iOS build 28](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/7d92d41f-cd6a-4e39-8a2b-15b94fdb8e1e) finished successfully from source commit `b861072f2344cf03d208bc2936fcb2c357a79c1b`. The signed IPA is 16,354,604 bytes with SHA-256 `6710D98B00F56906AE97CDAA53A4F11EC2F14D1003516EE3728C1C327F2DD2A5`. The temporary direct artifact URL expires; use the stable EAS build page.

[EAS submission](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/submissions/d2eb5ed2-133c-4a84-9184-67a810d22e52) finished successfully and uploaded build 28 to App Store Connect app `6788092733`.

Production Supabase project `dfqjfbtizqrzqujkvalx` now has Apple authentication enabled for client ID `com.invoiceautomator.app`. Google authentication remains enabled, and the exact iOS OAuth callback `com.invoiceautomator.app://auth/callback` was added to the redirect allow list. Both settings were read back after the update.

The remaining work must be completed with the Apple Developer/App Store Connect accounts: verify the App ID capability, wait for Apple processing, validate build 28 through TestFlight, finish App Privacy and listing metadata, and submit for review. See `IOS_APP_STORE_SUBMISSION.md`.

## Branch scope

The tested Android workflow is preserved in commit `fa8dd3d`. The current main branch folds the relevant iOS readiness work into the newer quote-to-receipt codebase; the older iOS branch is historical.
