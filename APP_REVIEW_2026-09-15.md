> Historical working notes. For current deployment and release state, use [RELEASE_STATUS.md](RELEASE_STATUS.md). Earlier pending/completed claims below may be superseded.

# Swift Invoice: app review and retention plan

Reviewed September 15, 2026.

## Scope and conclusion

Reviewed the current working tree: navigation, authentication, onboarding, invoice creation/detail/email, customers, branding, dashboard/reports, subscriptions, settings/support, SQL definitions, and backend functions. Existing uncommitted changes were present; application files were not changed. This is a source review with TypeScript validation and small logic reproductions, not a device usability test or an audit of the deployed database, Play release, billing configuration, or email delivery.

The app has useful foundations: saved customers, invoice history, payment instructions, branding, receipts, and reports. The strongest retention hypothesis is to make completing and repeating a real job effortless: **resume a draft → reuse customer/services → send a dependable document → follow up → record payment → invoice the next job**.

The Play screenshot cannot establish why users leave. Active devices are not equivalent to active people, and average DAU divided by average MAU is not a retention cohort. Recommendations below are hypotheses to validate, not measured causes of churn.

## 1. Reliability and trust: fix before adding major features

### Critical: the current checkout fails type checking

`npm run typecheck` returned nine diagnostics:

- `src/navigation/AppNavigator.tsx:118`: callback referenced before declaration (two diagnostics).
- `src/screens/DashboardScreen.tsx:133`: same issue with `loadSubscription` (two diagnostics).
- `src/screens/InvoiceBrandingScreen.tsx:119` and `:133`: duplicate `contentType` declaration (two diagnostics).
- `src/screens/InvoiceDetailScreen.tsx:335–337`: nullable values passed to optional string fields (three diagnostics).

The declaration errors can prevent rendering/bundling, beyond merely failing a check. Navigation also places `useMemo` after a conditional early return; move every hook above conditional returns. React explicitly requires this in its [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks).

Release check: typecheck, Android bundle, cold start signed out/signed in, onboarding, dashboard, and logo upload. These findings concern this checkout; confirm which commit produced the store build.

### Critical: invoice voiding lacks an ownership check in supplied SQL

`supabase/schema.sql:262`, `supabase/reconcile_schema_20260212.sql:51`, and `supabase/add_void_support.sql:22` define `void_invoice` as `SECURITY DEFINER` and update by invoice ID without checking the caller owns it. If deployed with callable grants and an owner that bypasses RLS, a caller knowing another invoice ID could void it.

Use an ownership-constrained update, explicit authentication, restricted execution grants, and a fixed search path; prefer invoker permissions where sufficient. Verify using two isolated test accounts. See [Supabase function security](https://supabase.com/docs/guides/database/functions). Production exploitability was not tested.

### High: marking paid can leave inconsistent records

`src/screens/InvoiceDetailScreen.tsx:222` marks the invoice paid before inserting its payment record. The supplied schema enables RLS on `payment_records` but defines only a SELECT policy (`supabase/schema.sql:190`). No insert policy was found in the supplied SQL.

With that schema, the invoice update succeeds but the payment insert fails, leaving a paid invoice and an error alert. Make recording payment and updating status one authorized transaction, with retry protection. Validate actual deployed policies before assuming production has the same issue.

### High: invoice creation can partially succeed

`src/services/invoice.ts:45–84` inserts the invoice, then items, then increments quota through separate requests. An item failure leaves a header behind; retry can create another invoice/customer. Quota increment errors are ignored. Number generation uses COUNT+1 (`supabase/schema.sql:224`), creating collisions under concurrent creation or some deletion patterns.

Create invoice, items, number, and quota atomically on the server. Use a request idempotency key and concurrency-safe numbering. Test failed item insertion, repeated taps, network interruption, and concurrent saves.

### High: form bugs can change the invoice

In `src/screens/NewInvoiceScreen.tsx`:

- Line 106 uses item count to generate IDs. Add three items, delete the middle one, then add: IDs become `1,3,3`. Editing/removing one can affect both. Use independent unique IDs.
- Preview treats zero quantity as zero, but saving at line 198 converts it to one. Validate finite positive quantities and prices consistently; do not substitute values at save time.
- Item validation at line 165 misses nonnumeric prices and negative quantities. Validate trimmed descriptions and finite numbers, with matching server constraints.
- Line 55 converts zero-day terms to 30. Explicitly support zero if offering payment due immediately.

The ID collision and zero-value conversions were reproduced with Node using the same expressions.

### High: dates and reports can mislead

`src/services/invoice.ts:261` parses date-only strings with `new Date()` and reads the local month. September 1 becomes August 31 in New York; this can shift an invoice into the wrong reporting month. Date displays elsewhere use the same pattern. Read calendar dates as calendar dates, separate from timestamps.

Reports group paid totals by invoice issue date, not payment date. Label that basis clearly or calculate cash received from payment records. Dashboard outstanding totals include drafts and cancelled invoices because they include every non-paid, non-void status. Separate drafts, issued outstanding, overdue, cancelled, and collected amounts. Reports also refresh on year changes only, so returning from marking an invoice paid can show stale figures.

### High: subscriptions need server-verified entitlements

`src/services/subscription.ts:373` does not verify a purchase with Google: it updates the profile and invents expiry as now plus one/twelve months. Restore repeats this calculation; entitlement checks depend on tier alone and ignore expiry/status. The supplied profile policy allows users to update their own row without protecting subscription columns.

Verify tokens on a trusted backend, bind purchases to accounts, protect entitlement fields from client changes, and process renewal/expiry/refund state. Google documents [backend purchase verification](https://developer.android.com/google/play/billing/security). Test pending/cancelled purchases, renewal, expiry, restore, and account switching.

Other gaps: Settings hardcodes $3.99 rather than displaying the store price; the purchase UI reloads after a fixed two seconds; no visible restore/manage subscription controls were found. Free quota reset SQL exists, but no scheduled invocation was found. Verify deployment or calculate usage by an explicit month window.

## 2. First-invoice experience

| Current behavior | Improvement | Why it may help |
|---|---|---|
| Authentication followed by four introductory slides, including an upgrade slide | Short, skippable setup for business name/payment instructions, then create first invoice | Gets people to a useful result sooner |
| Email required even to save (`NewInvoiceScreen.tsx:155`) | Require email only for email delivery; permit saving and PDF sharing without it | Supports clients reached by text or in person |
| Creation warns invoices can never be edited (`:176`) | Editable drafts; preserve issued versions and use an explicit correction flow after sending | Makes a typo recoverable |
| Successful save returns to the list (`:206`) | Open the created invoice with a clear preview/share action | Completes the task while intent is strongest |
| Form lives only in component state | Account-scoped local draft autosave and restore; safe sync later | Avoids lost work after interruption or process death |
| Business/payment setup lives in Settings | Contextual missing-info prompt in preview, with a skip option where appropriate | Avoids sending generic branding or no payment instructions |

Authentication also needs verification: signup immediately attempts login even when email confirmation may be required; password-reset email exists but no password-update screen or recovery callback handling was found. The Google sign-in service requires a module absent from `package.json`. Confirm a reproducible release build rather than relying on a previously installed module. The supplied schema also lacks the profile-creation trigger that email signup expects.

## 3. Sending, customer history, and support

- **PDF export is the biggest delivery gap.** Help explicitly says PDF sharing exists (`HelpSupportScreen.tsx:37`), but the active flow sends HTML through the device email composer, with mailto/plain-text share fallbacks (`src/services/email.ts:136`). No PDF creation/export path was found. Add PDF save/share with the same totals and branding as preview, including multi-page invoices. Device email rendering needs actual Android email-app testing.
- **Keep delivery state honest.** Opening a composer is not proof of delivery. The current confirmation to mark sent is a useful distinction; preserve it. Generic share fallback ignores dismissal and reports an undetermined success. Distinguish opened, cancelled, user-confirmed sent, and provider-confirmed delivery if a server flow is later added.
- **Customer history is fragile.** Customer deletion is exposed in the picker. The foreign key sets `customer_id` to null, while only the name is copied to the invoice. Email/phone can disappear, and sending/receipts depend on the joined customer. Snapshot billing identity/contact details on issued invoices; archive customers with history.
- **Customer management is incomplete.** There is selection/deletion, but no customer edit/search/history screen was found. A contact-import service exists without an apparent UI call site. Add search and correction of customer details before expanding CRM features.
- **Help overpromises.** PDF export and invoice deletion instructions do not match available invoice-detail actions. README pricing ($12/month) also disagrees with the UI ($3.99/month). Align all user-facing claims with implemented behavior.
- **Feedback failure copy is inaccurate.** It says feedback was recorded when emailing fails, but the function shows no durable feedback insert. Persist feedback before sending a notification, or state clearly that submission failed.
- **Account controls:** no in-app account deletion/export workflow was found. Provide clear account/data controls and distinguish subscription cancellation from account deletion.
- **Accessibility:** icon-only actions lack explicit accessibility labels in the searched source. Check TalkBack, large text, keyboard overlap, contrast, and tap targets on a device; visual pass/fail was not established by this review.

## 4. Retention features in priority order

These are product hypotheses, not guaranteed retention lifts. Effort is relative, not a delivery estimate.

| Priority | Feature | Concrete repeat-use benefit | Relative effort |
|---|---|---|---|
| 1 | Duplicate an invoice into an editable draft | Next job for the same client starts mostly complete; reset number/status/dates/payment data | Small–medium |
| 1 | Saved services, prices, tax and payment-term defaults | Reuse “Labor, 2 hours, $80/hour” without typing it each time | Medium |
| 1 | Draft autosave and resume | A phone call or app close does not erase work | Medium |
| 1 | Reliable PDF share/save | Finish delivery through the client's preferred channel | Medium |
| 2 | Outstanding/overdue work queue and owner reminders | Gives a useful reason to return and follow up on money owed | Medium |
| 2 | Customer search, history, and “new invoice for this client” | Makes repeat customers easier to serve | Medium |
| 2 | Deposits and partial payments | Supports staged contractor jobs; shows an accurate remaining balance | Medium–large |
| 3 | Estimates converted into invoices | Keeps the workflow from initial quote through completed job | Large |
| 3 | Recurring invoice drafts, with pause/skip controls | Helps repeat maintenance or service customers | Large |
| 3 | CSV reports/export | Makes monthly administration useful and portable | Medium |

Start reminders with owner-controlled prompts and manual follow-up. The existing `send-reminders` function is not ready to be treated as a shipped retention feature: it has a placeholder sender, no visible user preference controls, and marks invoices overdue even when sending the three-days-before-due reminder. It also lacks an application-level scheduler authorization check and robust duplicate-send prevention. Deployment/gateway authorization is unknown. No push-token registration or notification scheduling call sites were found despite the installed package.

The remaining email/payment backend functions need deployment inventory before reuse: which endpoints are live, which are unused? Generic authenticated email endpoints accept caller-supplied recipients/content without a visible invoice ownership association or rate limit. Several backend HTML templates interpolate unescaped user data. The Stripe webhook verifies its signature and upserts payment records, but repeated events can resend receipts and overwrite the payment time. Address these before enabling additional automation.

## 5. Measure value and repeat use

No product-event analytics or crash-reporting integration was found in the reviewed source. Console logs and invoice rows are insufficient to measure the entire funnel.

Instrument these events with a pseudonymous app/user identifier, event timestamp, app version, result/error code, and a deduplication ID. Do not send customer names/emails, line-item text, payment instructions, or invoice contents into analytics.

1. `first_open`, `signup_started`, `signup_completed`.
2. `invoice_started`, `invoice_saved`, `invoice_save_failed`.
3. `invoice_previewed`, `share_opened`, `share_cancelled`, `invoice_marked_sent`.
4. `payment_recorded` after the complete transaction succeeds.
5. `invoice_duplicated`, `draft_restored`, `saved_service_used`.
6. `limit_reached`, `upgrade_opened`, `purchase_verified`, `purchase_failed`.

Metrics:

- First invoice saved within seven days of first open; break down signup and save failures separately.
- First invoice user-confirmed sent/shared within seven days, clearly labelled as a proxy when delivery cannot be verified.
- Median time to first invoice; first save-to-share completion rate.
- **Repeat invoicing:** among users who saved their first invoice, percentage saving another on a later calendar day within 30 days. Include only cohorts with a complete 30-day observation window; show counts beside percentages.
- Weekly unique users creating/sending invoices or recording payments, alongside task success/crash rates.
- Limit-reached users who complete a verified purchase, and whether they continue invoicing afterward.

Existing authenticated invoice rows can provide an initial first/second-invoice cohort by user and creation date, excluding identified test accounts. They cannot establish install-to-signup conversion, abandoned forms, reliable sending, or causation. Verify partial saves before treating every existing invoice row as a completed invoice.

Keep the two-invoice free limit under review: counting drafts/corrections can consume the allowance before users experience repeat value. First fix counting and correctness, then evaluate a clearly communicated allowance or trial. Avoid changing price, quota, onboarding, and reminders simultaneously. With this small audience, use cohort counts and user interviews alongside gradual releases rather than expecting rapid statistical certainty.

## 6. Recommended release sequence

1. **Reliability:** resolve build errors; secure void/entitlement access; make creation/payments atomic; fix IDs, validation, dates and reporting. Add focused regressions for these failures.
2. **First successful invoice:** editable/autosaved drafts, optional recipient email at save, direct post-save preview, PDF sharing, accurate help, event/crash instrumentation.
3. **Second invoice:** duplicate, saved services/defaults, customer search/history. Compare completed 30-day cohorts and collect feedback about unfinished tasks.
4. **Collections workflow:** owner reminders, partial payments, then estimates/recurring drafts if actual customers need them.

Before release, test Android on a clean install and an upgrade: signup/verification/recovery, draft interruption, bad network during save, multiple line items, no-email customer, multi-page PDF, email cancellation, deleted customer history, payment retries, purchase restore/expiry, and account switching. TypeScript currently excludes `supabase/functions`; backend checks need their own validation. This review did not execute production mutations, send emails, or make purchases.
