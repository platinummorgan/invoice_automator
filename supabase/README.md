# Supabase deployment state

Verified September 20, 2026. Project: dfqjfbtizqrzqujkvalx.

## Applied migrations

| Version | Purpose |
| --- | --- |
| 202609150001 | Reliable, owner-checked payment and invoice operations |
| 202609150002 | Atomic invoice draft saving |
| 202609190001 | Verified Google billing registry, RPCs and scoped protection |
| 202609200001 | Five-minute billing reconciliation schedule |
| 202609210001 | Quote conversion, job completion, private job photos and receipt workflow |

The last two migrations had been applied manually. Their function bodies and live triggers were verified against source, their tables have RLS and no anon/authenticated grants, and migration history was repaired to applied. Do not replay them.

The database existed before these migrations. Root SQL files are historical setup/patch scripts, not an ordered migration chain for a new database. Use a reviewed baseline when provisioning a new project.

## Deployed billing services

Source downloaded from production matched all four local files for verify-google-purchase, its entitlement helper, the shared verifier and reconcile-google-purchases. Both functions use internal authentication; config.toml records verify_jwt=false. A subsequent full download verified all nine deployed function entrypoints and the shared billing helpers against repository source. The existing delete-account source was recovered into main without invoking or redeploying it. config.toml records the observed gateway JWT settings for all nine functions. The Android candidate still uses the support-assisted deletion request page.

The google-play-reconciliation cron job is active every five minutes. Recent retained HTTP responses were 200. Its credential is stored in Vault and Edge Function secrets; never commit it. Terminal legacy tokens are excluded from automatic retries without downgrading legacy access.

The document workflow migration was applied September 21, 2026. `create-payment-link` version 8 rejects quotes and closed invoices, `send-reminders` version 8 excludes quotes, and `delete-account` version 5 removes private job pictures before deleting the account. The `job-photos` bucket is private and restricted to the authenticated owner's folder.

## Deliberately pending production activation

The public billing flag remains off and the test allowlist remains configured. Profile protection currently covers the authorized test account and previously server-verified accounts, preserving compatibility for legacy users.

After compatible-build acceptance and live renewal/refund testing, coordinate GOOGLE_PLAY_BILLING_ENABLED=true with the reviewed full guard in pending-billing/activate-production-guard.sql. Record that activation as a new migration at execution time. Do not copy it into the automatic migration chain before rollout. Existing legacy access must be preserved.

## Verification

Run npm test and the Deno billing tests. SQL regressions in tests/google-billing.sql and tests/invoice-transactions.sql are for a disposable local PostgreSQL database, never customer production data. The scheduler migration additionally needs Supabase Vault, pg_net and pg_cron.

Read-only checks: supabase migration list and db push --dry-run with the explicit project reference. Deployment credentials are operator-managed and excluded from Git.
