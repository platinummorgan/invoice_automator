# Swift Invoice release status

Verified September 20, 2026. This document is the authoritative summary; older review and working-note files are historical.

## Versions

| Surface | Status |
| --- | --- |
| Google Play production | 1.2.1, version code 15, completed rollout (API verified) |
| Android candidate | 1.2.2 (19), uploaded and API-validated; production draft saved |
| Google Play internal testing | 1.2.2 (19), completed release status (API verified); tester access/device install still to confirm |
| Previous candidate build 18 | Finished, superseded; not the final artifact |
| GitHub release | 1.2.2 draft created; not marked published |
| Play Data safety | Owner reports submitted for review; approval not verified |
| Supabase | All four tracked migrations applied; billing function source matches deployment |

Build 19 is now saved as a production draft and released to internal testing. A fresh track read confirmed production 15 remains completed, production 19 is draft, and internal 19 is completed. No public production rollout was started. The earlier build-18 upload was rolled back after a commit-parameter error.

Tester opt-in: https://play.google.com/apps/testing/com.invoiceautomator.app. Tester eligibility and Play propagation still require checking with the intended Google account.

## Candidate provenance

- Source commit: d47a3d8d6996e0881c91f52b193f1385f1023d49.
- Merged into main by [PR #2](https://github.com/platinummorgan/invoice_automator/pull/2), merge commit 22e43bb3b7862cd88431a046e857ed2d8ff87910; identical source tree at merge.
- [EAS build 19](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/cb6900f0-0d62-46af-978d-d3891648495b).
- [GitHub releases](https://github.com/platinummorgan/invoice_automator/releases): v1.2.2 is a draft, visible to repository maintainers.
- Artifact: swift-invoice-1.2.2-19.aab (70314528 bytes); SHA-256: a5b6d811b0854fb5aed58fd5636686381bfebf6ed5e368f8a26c99ff27f4090e.
- Draft assets include the AAB, SHA256SUMS.txt and release-manifest.json. The AAB is a Play upload artifact, not a directly installable APK.
- Later main commits only update documentation and backend deployment records; Android app source/configuration still matches the recorded build commit.
- GitHub PR CI and credential scanning passed. Local working tree contains no credentials or build artifacts tracked by Git.

## Changes in 1.2.2

- Refreshed invoice, reports, settings and account screens.
- Recoverable invoice drafts, atomic saves, safer payment recording and explicit sent status.
- PDF preview/share and clearer business payment links in PDFs and emails.
- Validation for selected payment methods and fresh payment settings at export time.
- Password recovery, support-assisted account deletion links and corrected policy wording.
- Server-verified Google subscriptions, restore/cancellation messaging, foreground refresh and scheduled reconciliation.

## Verified

TypeScript, five app regression suites and three shared billing verifier tests pass. Local PostgreSQL billing and invoice transaction tests pass. These SQL tests roll back fixtures and do not touch production customer data.

The owner tested license purchase, restore, cancellation and return to Free after expiry. Google acknowledged the test purchase. Saved payment details were confirmed to appear on invoices; additional link-label and export-load improvements need the new build's device check.

All four migrations match remote history. The seven billing/scheduler function bodies match the local migrations; billing tables have RLS and no client grants. All nine deployed Edge Function entrypoints and shared billing helpers match repository source; the pre-existing delete-account function was recovered into main without redeployment. Cron is active every five minutes with recent HTTP 200 responses.

## Before production rollout

- Google API edit validation passed for build 19. Inspect Console warnings/pre-launch results and install the internal build for final device checks. API validation is not policy approval or device acceptance.
- Owner confirmed draft save/reopen, payment recording and sign-out/sign-in on the current test build. Recheck the final build, including password reset and the improved PDF/payment links.
- Verify real Google test renewal and refund/revocation; local simulations alone do not close these checks.
- Resolve Diagnostics sharing disclosure: current submitted answer is collected, not shared, non-ephemeral, required, analytics; the sharing exemption has not been confirmed.
- Coordinate public billing enablement and full profile protection with the compatible app rollout. They remain deliberately test-scoped; see supabase/README.md.
- Publish the GitHub release when the store rollout is ready, attaching the matching build and checksum.

## Branch scope

The Android release branch preserves the tested Android work. Separate iOS/App Store readiness commits remain on codex/android-1-2-1-subscription-restore and its existing draft PR; they have not been overwritten or folded into this Android candidate. GitHub Pages privacy/deletion changes from main are incorporated.
