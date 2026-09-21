# Swift Invoice

Android invoicing for small businesses, built with Expo, React Native, TypeScript and Supabase.

## Release status

See [Release status](RELEASE_STATUS.md) for the current store version, candidate build, database state, and remaining release checks. Version 1.2.2 is a release candidate, not a published Play update.

## Features

- Customer records and optional contact import.
- Recoverable quote and invoice drafts, line items, taxes, dates and notes.
- Quote approval and conversion into an invoice without re-entering the job.
- Before/finished job pictures in documents, PDFs and receipt emails.
- Invoice branding, PDF preview/share, device email drafts and paid receipt emails.
- Business-provided payment links and instructions; manual payment recording.
- Explicit sent/paid/void status and reports.
- Google Play Pro subscriptions verified by the backend, with restore and scheduled reconciliation.
- Password recovery and a support-assisted account deletion request path.

Payment links take customers to the business's provider. Swift Invoice does not automatically confirm those external payments. Notification and reminder source files are not evidence of an enabled end-to-end feature.

See [Quote, invoice and receipt workflow](DOCUMENT_WORKFLOW.md) for the new menu, conversion, job pictures and required migration.

## Development

Use Node 20 or newer. Install dependencies with `npm ci`, copy `.env.example` to `.env`, and configure the public Supabase URL/anon key. Never put service-role credentials or Google service-account keys in the app or repository.

- `npm start`: Expo development server.
- `npm run android`: native Android development build.
- `npm run typecheck`: TypeScript validation.
- `npm test`: app regression suite.
- `npx deno test --node-modules-dir=none supabase/functions/_tests/googleBilling.test.ts`: server billing tests.

Native PDF and billing features require a native build. They cannot be validated solely in Expo Go.

## Database and billing operations

See [Supabase deployment](supabase/README.md). The live database predates the migration directory; do not blindly replay historical root SQL files against production. Schema changes must be tracked through migrations. Secrets belong in Supabase secrets/Vault and local credential storage.

## Android builds

EAS controls Android version codes remotely; `app.json` supplies the user-facing version. Build with `npx eas-cli build --platform android --profile production` (AAB) or `--profile test` (internal APK). Local Android signing credentials are intentionally excluded from Git.

GitHub releases remain drafts until the corresponding store rollout is ready. See [device checklist](TEST_BUILD_CHECKLIST.md) and [Play Console checks](PLAY_CONSOLE_RELEASE_CHECKS.md).

## Public support pages

- [Privacy policy](https://platinummorgan.github.io/invoice_automator/privacy-policy.html)
- [Account and selected-data deletion requests](https://platinummorgan.github.io/invoice_automator/delete-account.html)

Support: support@platovalabs.com
