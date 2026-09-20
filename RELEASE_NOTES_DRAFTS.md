> Historical working notes. For current deployment and release state, use [RELEASE_STATUS.md](RELEASE_STATUS.md). Earlier pending/completed claims below may be superseded.

# Draft and reliability update

## Implemented

- Fixed startup callback ordering, conditional hook ordering, duplicate variable declaration, and nullable email parameters.
- Account-scoped local autosave restores unfinished invoice forms. Saved cloud drafts can be edited; issued invoices remain protected by the draft-save RPC.
- Customer email is optional when saving. Successful creation opens invoice details directly.
- PDF share/save uses Expo Print and the invoice HTML template. Device share-sheet completion is not treated as proof of delivery.
- Invoice creation/items/customer/quota are saved in a single PostgreSQL transaction. Request IDs make retried creation idempotent, with per-user locking for concurrent numbering.
- Manual payment recording and paid status are atomic; repeated calls return the existing successful record. Voiding checks authenticated ownership.
- Fixed line-item IDs, quantity validation, date-only handling, monthly grouping, draft/cancelled amounts in outstanding totals, and stale reports on refocus.
- Quota displays/checks count invoices created during the current UTC month instead of relying on a scheduled reset.
- Saved invoice contact snapshots preserve new invoice delivery details after customer deletion. Older invoices retain their existing fallback behavior.

## Deploy in this order

1. Compare the live schema to the supplied schema and test on staging. These migrations expect the existing invoice/profile/payment tables and columns in `supabase/schema.sql`.
2. Apply `supabase/migrations/202609150001_reliable_payments.sql`.
3. Apply `supabase/migrations/202609150002_invoice_drafts.sql`.
4. Build a new Android binary with the added `expo-print` and `expo-file-system` dependencies; do not ship these new native imports as an update to an older binary that lacks the native modules.
5. Run the device acceptance checks below, then release the compatible app. The new app depends on these RPCs; do not release it before the migrations.

### Supabase deployment completed â€” September 15, 2026

Both migrations above were applied to the app's configured `invoice_automator` project (`dfqjfbtizqrzqujkvalx`) after checking the live schema, constraints, policies, triggers, and subscription compatibility. Migration history records both versions; a final dry run reports the remote database is up to date.

Verified all three deployed function bodies against the local SQL, fixed empty search paths, authenticated execution permissions, and denied anonymous execution. Authentication and missing-invoice guards passed in a rolled-back transaction. The three new invoice columns and unique request index are present. Invoice/payment row counts remained 106/0 across the deployment checks; the migrations did not modify customer records or subscription entitlements.

The two existing Pro profiles use legacy subscription fields. This deployment preserves their existing access; reconciling billing with Google remains follow-up work. No emails, purchases, Android build installation, or store deployment were performed. The remaining release steps are the native Android rebuild and device acceptance checks.

## Validation

- `npm run typecheck`
- `node tests/invoiceValues.test.cjs`
- `npx expo export --platform android --output-dir .validation/android`
- Disposable PostgreSQL 18 database: apply `tests/database-bootstrap.sql`, `supabase/schema.sql`, both migrations, then `tests/invoice-transactions.sql` with `ON_ERROR_STOP=1`. Bootstrap is for an empty local test database only, never production.

The SQL regressions exercise save retries, money rounding, transaction rollback on an injected item failure, editing without consuming quota, cross-account authorization, payment retry deduplication, and rejection of edits to paid invoices. Fixtures roll back.

## Device checks still required

- Cold start, sign in, create an invoice without email, close/reopen its unfinished draft, then save and edit it.
- Terminate the app during a form edit and confirm the latest completed local write restores. Changes not yet written at the instant of termination cannot be guaranteed.
- Interrupt network during a save, retry, and check there is only one invoice.
- Share a short and multi-page invoice using Android's email and file-saving destinations; check logo loading, pagination, quantities, tax, dates and total.
- Verify a physical device with the rebuilt native binary. JavaScript export is not a native build or a visual PDF test.
- Confirm existing paid customers' tier/expiry fields and any legacy custom quota agree with the new RPC. The server currently enforces the documented two-invoice allowance for free users.

## Follow-up work

Server-verified Google Play entitlements, protection of entitlement columns, analytics/crash reporting, device validation of authentication recovery, draft discard/management, saved services, duplication, and reminders remain outstanding. Current subscription activation is still client-driven; this update does not claim to fix billing security. PDF export reuses the existing HTML renderer; native rendering and share-destination behavior require the device checks above.


## Sent status and password recovery â€” September 19, 2026

- Draft details now has an explicit Mark as sent action with confirmation. PDF sharing does not imply delivery. The transition updates only rows still in draft status, preserves the first sent timestamp on retry, and rejects paid/void/cancelled invoices. The email flow uses the same guarded transition.
- Reset emails redirect to `com.invoiceautomator.app://auth/callback/recovery`. The app handles cold and warm links, checks the exact callback and recovery token fields, verifies the session, and presents a new-password form with confirmation and expired-link handling. Tokens are not logged. The form identifies the account being updated.
- Added the exact recovery callback to the live Supabase redirect allowlist while preserving existing URLs. The CLI reported exactly one auth property updated, no secrets changed, and 13 undeclared settings preserved. A follow-up diff showed zero remaining declared changes.
- Added a top-level native app scheme. A new native build and real reset-email test are required; this is not validated by JavaScript export alone.
- Checks: TypeScript, invoice value regressions, `node tests/recovery-and-sent.test.cjs`, isolated recovery form checks, Android JavaScript export. Tests use fixtures; no customer email or password was changed.

Recovery implementation follows the Supabase native deep-link flow: https://supabase.com/docs/guides/auth/native-mobile-deep-linking and https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail.


## Google Play verification â€” staged September 19, 2026

The working-tree app now calls a server verifier instead of writing Pro tier/expiry from the device. Added checkout readiness checks, account binding, offer selection, Restore purchases, and purchase-result refresh. The verifier and protective database migration are prepared and locally tested, but NOT deployed: the Google Play service-account credential is missing. Live billing has not been changed. The edited app's new purchases remain gated until setup succeeds.

See `supabase/pending-billing/README.md` for deployment steps, legacy compatibility and remaining real-time notification/reconciliation work. Billing must not be described as production-ready yet.


### Google Play credential configured

Configured the billing service-account JSON as a Supabase secret without committing it or printing its contents. Google OAuth and the app subscription catalog both returned HTTP 200. The monthly subscription and its monthly base plan are active; the catalog did not return the annual SKU. Purchase-token verification, acknowledgement and lifecycle reconciliation remain untested against Google. No live entitlements were modified; the billing migration and verifier remain staged.


### Billing backend deployment and permission blocker

Deployed verify-google-purchase and reconcile-google-purchases, each with application-level authentication. Anonymous verification and invalid scheduler secrets return 401. Added permanent replaced-token tracking, a service-only request limit, leased reconciliation batches, sanitized failure/backoff fields and expiration maintenance for verified accounts. Scheduler SQL is prepared but not enabled. Shared-verifier and PostgreSQL tests passed. A live rolled-back migration dry run preserved all 220 profiles and bound two existing tokens.

Google OAuth/catalog access works, but purchase-status requests for both saved tokens return HTTP 401 permissionDenied. The migration remains staged and checkout is disabled by an unset GOOGLE_PLAY_BILLING_ENABLED flag. Live entitlements are unchanged. Fix the service account's Play financial/order permissions (or allow propagation if already saved), then recheck before activation. Real device purchase and acknowledgement remain outstanding.


### Permission retry resolved; old tokens unavailable

The latest Google check returned HTTP 410 subscriptionPurchaseNoLongerAvailable for both saved tokens instead of HTTP 401 permissionDenied. No subscription state or acknowledgement data was returned, so these tokens cannot complete the billing acceptance test. Existing profile access is unchanged. Added and deployed safe terminal-token classification, plus staged SQL to stop retrying permanently unavailable tokens. Shared verifier and PostgreSQL tests pass. A fresh Google Play license-test purchase in the compatible native build is the next acceptance step; checkout/enforcement/scheduling are not yet activated.

## September 19: internal build and scoped billing rollout

Added the missing Google Sign-In native dependency and an internal APK EAS test profile using the production public configuration and local signing credentials. Typecheck, Android JS export, invoice/recovery/entitlement tests and three Google verifier tests passed. Native device validation is pending.

Applied 202609190001_verified_google_billing.sql with profile protection limited to the authorized test account and accounts already verified by the server; the remaining legacy-client guard is staged in pending-billing/activate-production-guard.sql. The authorized account was changed from Pro to Free for a fresh purchase test; its prior plan was saved locally. The other Pro account was preserved. The verifier now gates both readiness and purchase requests to confirmed tester emails while the global billing flag is off. Reconciliation scheduling and real renewal/refund tests remain pending.

## September 20: automatic reconciliation enabled

The google-play-reconciliation job is active every five minutes (up to ten due purchases per run, with retry backoff). Credential stored in Vault and Edge Function secret. Deployed migration: 202609200001_schedule_google_reconciliation.sql. Individual checks can take another scheduled run before becoming due.

Live Google verification confirmed the tester purchase EXPIRED and account Free; the other legacy Pro account was preserved. Two permanently unavailable legacy tokens were retired from polling without changing access. Follow-up invocation returned HTTP 200, checked=1, verified=1, failed=0; unauthorized invocation returned 401. SQL tests passed for renewal extension, subsequent expiry/revocation, and account isolation. Deno checks and three verifier tests passed.

Actual Google renewal and refund/revocation testing remain before production rollout. Refund without revoked entitlement must not automatically remove access. Global checkout is still tester-only and full legacy-client field protection remains staged. No new APK is required for automatic checks.
