# Android subscription renewal hotfix — September 29, 2026

Google Play was returning an active, renewed test subscription while the stored profile still contained the previous period's expiry. The five-minute reconciliation schedule could leave the app showing Free until its next verification, while Play refused another purchase because the subscription was still owned.

The Android app now checks owned subscriptions with the server before presenting an unpaid plan or enforcing the free invoice limit. Upgrade restores an existing active purchase before opening checkout, and already-owned purchase errors trigger restoration. Verification examines all supported purchases so an obsolete token cannot hide an active one. Concurrent refreshes share a verification pass for the same signed-in user; failures do not falsely report a confirmed Free plan. Dashboard plan hints refresh on billing events and foregrounding.

iPhone remains Free-only. No billing schema, public billing flag or existing Apple artifact is changed. See NEXT_ANDROID_RELEASE.md for the scoped hotfix exception to the planned native upgrade.

## Release validation

- Automated coverage: stale expiry followed by renewal; renewed access above the free invoice limit; restore before checkout; old token failure followed by a valid subscription; concurrent refresh; already-owned recovery; verification errors; confirmed expiry; iOS Free-only behavior.
- Run clean dependency installation, app tests, TypeScript, Deno verifier tests and Expo Doctor before building.
- Upload the signed AAB to internal testing first. On the Play-installed candidate, buy a test subscription, leave/reopen across at least two five-minute renewal boundaries, verify Pro and invoice creation beyond the free limit, restore, and confirm genuine expiry returns to Free.
- Production promotion requires the candidate's device test result. Automated tests do not establish that Google Play's native purchase flow passed on a phone.

Build and upload provenance will be recorded here once available.
