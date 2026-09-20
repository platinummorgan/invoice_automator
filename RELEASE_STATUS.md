# Swift Invoice release status

Verified September 20, 2026. This document is the authoritative summary; older review and working-note files are historical.

## Versions

| Surface | Status |
| --- | --- |
| Google Play production | 1.2.1, version code 15, completed rollout (API verified) |
| Android candidate | 1.2.2; final rebuild pending after payment-link improvements |
| Previous candidate build 18 | Finished, superseded; not the final artifact |
| GitHub release | 1.2.2 draft being prepared; not marked published |
| Play Data safety | Owner reports submitted for review; approval not verified |
| Supabase | All four tracked migrations applied; billing function source matches deployment |

No Play production draft was present when checked. The earlier build-18 upload was rolled back after a commit-parameter error.

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

All four migrations match remote history. The seven billing/scheduler function bodies match the local migrations; billing tables have RLS and no client grants. Deployed billing Edge Function source matches local source. Cron is active every five minutes with recent HTTP 200 responses.

## Before production rollout

- Finish the final AAB, inspect Play validation and test the final build on a device.
- Complete sign-in/reset, draft save/reopen, PDF/payment-link and record-payment checks.
- Verify real Google test renewal and refund/revocation; local simulations alone do not close these checks.
- Resolve Diagnostics sharing disclosure: current submitted answer is collected, not shared, non-ephemeral, required, analytics; the sharing exemption has not been confirmed.
- Coordinate public billing enablement and full profile protection with the compatible app rollout. They remain deliberately test-scoped; see supabase/README.md.
- Publish the GitHub release when the store rollout is ready, attaching the matching build and checksum.

## Branch scope

The Android release branch preserves the tested Android work. Separate iOS/App Store readiness commits remain on codex/android-1-2-1-subscription-restore and its existing draft PR; they have not been overwritten or folded into this Android candidate. GitHub Pages privacy/deletion changes from main are incorporated.
