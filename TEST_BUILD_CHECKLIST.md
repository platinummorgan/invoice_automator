> Current build and deployment status: [RELEASE_STATUS.md](RELEASE_STATUS.md). Use this checklist for final device acceptance; historical progress notes below are superseded by that status.

# Combined Android test build

## Build status

The design changes are implemented. TypeScript checks and Android JavaScript export have passed during the design pass. A JavaScript export is not an installable Android build. Native appearance, Google sign-in, purchases, PDF rendering and sharing still need device testing.

Use an internal Android build with the new native PDF dependencies. Supabase migrations 202609150001 and 202609150002 were deployed on September 15, 2026. Do not reapply them manually.

## One device testing session

1. Sign in, create an account if needed, and open password reset. Confirm the keyboard leaves fields and buttons reachable. Open signup terms and privacy policy; close each.
2. Complete the short welcome screen. Check Invoices, Reports and Settings in light and dark mode, then with larger system text.
3. Start an invoice without an email address. Add several items, change quantities, tax and due date. Leave and reopen the unfinished draft; confirm values restore.
4. Save the draft, edit it, and save again. Confirm it remains one invoice. Interrupt the connection during another save and retry; check for duplicates.
5. Preview and share a PDF. Check a short invoice and a multi-page invoice for logo, item descriptions, dates, totals and pagination. Try both file saving and an email destination.
6. On test invoices, record full payment and void an unpaid issued invoice. Confirm paid invoices cannot be voided and report totals update.
7. Save business details and payment instructions. Reopen Settings and check persistence. Change invoice design, preview it, save, then reopen. Upload, replace and remove a test logo.
8. Change report years quickly. Check paid/outstanding totals and empty years. Reports uses invoice dates, not payment dates.
9. Open help, About, terms and privacy policy. Check scrolling, close controls and large text. Send feedback only when you intend to send a real message.
10. Check the displayed plan against the account's expected entitlement. Test any purchase flow using the configured Google Play test account and distribution method.

## Quote, pictures and receipt checks — build 20

1. Open Menu and confirm the order is Quote, Invoice, Receipt.
2. Create a quote with a customer, two items, tax, notes and at least one job/before picture. Save it, reopen it and share its PDF. Confirm it says Quote and contains no payment request.
3. Email the quote. Confirm the email draft has the quote PDF attached. After customer approval, tap Approve quote & create invoice. Confirm the customer, items, totals, notes and picture remain, and the original quote number is shown.
4. Review the invoice dates, add a finished picture and mark the job completed. Confirm completion alone does not create a receipt or mark the invoice paid.
5. Record full payment. Confirm the receipt email opens with a PDF attached. Cancel once and retry from Receipts. Use Share receipt PDF / text and select a messaging app.
6. Open the received quote, invoice and receipt PDFs. Confirm both picture sections render, including after waiting at least an hour so temporary image links have expired.
7. Deny photo permission once, retry after granting it, and repeat once while offline. Confirm the document remains usable and no duplicate payment or invoice is created.
8. With both free documents used, attempt to create another invoice and tap Upgrade to Pro. Confirm the app opens Settings directly at Your plan with the Upgrade to Pro button visible. Repeat from the dashboard's View plans link.

Owner confirmation — September 21, 2026: all build 21 checks passed on device, including the free-limit upgrade route.

Record each issue with the screen, action, expected result and actual result. Include theme, text size and device model when layout is affected.

## Remaining release limitations

Google Play entitlement verification and other product follow-ups are listed in RELEASE_NOTES_DRAFTS.md. This design pass does not close those items. Complete device checks before a production release.


## Added recovery and sent-status checks

- Request a real password reset for your test account. Open the link with the app closed, then repeat with the app already open. Confirm the correct account email, mismatched-password error and successful new password. Sign out and sign in using the new password.
- Open an expired link. Verify there is no editable reset form and that Back to sign in works. Cancel a valid recovery flow and confirm it signs out.
- Share a draft PDF and cancel the share sheet: it must remain Draft. After actually sending, choose Mark as sent and confirm. It should move into outstanding totals and stop offering Edit draft.
- Tap Mark as sent after another device has paid or voided the invoice. It must not overwrite that status. A repeated sent request must preserve the original sent timestamp.

## September 19 billing test setup

- Internal APK build: https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/23247f56-8cbb-44f1-b811-64ceb7ce7e8b (version 1.2.1, Android build 16).
- Sign into Swift Invoice and Google Play as mdorminey79@gmail.com. The app account was reset to Free at the owner's request; original plan fields are saved locally in the ignored .validation/test-plan-backup.json. Other accounts were not reset.
- Open Settings → Upgrade to Pro. Confirm the Google purchase dialog offers a license-test payment method before completing the purchase.
- Check that Pro appears after verification, survives app restart, and Restore purchases succeeds. Report the result so the server verification record can be checked.
- Automated reconciliation is not scheduled yet. Renewal, expiration and refund validation remain before production rollout.
- Verification is enabled only for the confirmed test email. The global checkout flag remains disabled. Billing storage is deployed; profile protection covers the test account and server-verified accounts. Legacy-client protection for all accounts is a separate production activation step.

## September 20: automatic reconciliation enabled

The google-play-reconciliation job is active every five minutes (up to ten due purchases per run, with retry backoff). Credential stored in Vault and Edge Function secret. Deployed migration: 202609200001_schedule_google_reconciliation.sql. Individual checks can take another scheduled run before becoming due.

Live Google verification confirmed the tester purchase EXPIRED and account Free; the other legacy Pro account was preserved. Two permanently unavailable legacy tokens were retired from polling without changing access. Follow-up invocation returned HTTP 200, checked=1, verified=1, failed=0; unauthorized invocation returned 401. SQL tests passed for renewal extension, subsequent expiry/revocation, and account isolation. Deno checks and three verifier tests passed.

Actual Google renewal and refund/revocation testing remain before production rollout. Refund without revoked entitlement must not automatically remove access. Global checkout is still tester-only and full legacy-client field protection remains staged. No new APK is required for automatic checks.

## Final payment-link checks

Select PayPal without details and save: expect a clear validation message. Paste the real recipient payment link, save, reopen Settings, export a new PDF and tap the link as the customer. Repeat with Venmo or another provider. Check Zelle/bank instructions remain readable. A failed profile load must stop export rather than omit payment details. Do not send money during this check.

## Owner confirmation — September 20, 2026

The owner confirmed saving/reopening drafts, recording a payment, and signing out/back in all worked on the current test build. Final-build acceptance and live renewal/refund checks remain separate.

## Build 19 follow-up

After the internal build was released and the owner was asked to check PDF/payment links and subscription restore, the owner reported “everything passed again.” Record those requested checks as passed; do not infer live automatic renewal or refund/revocation coverage from this statement.
