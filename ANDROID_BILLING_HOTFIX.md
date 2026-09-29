# Android subscription renewal hotfix — September 29, 2026

Google Play was returning an active, renewed test subscription while the stored profile still contained the previous period's expiry. The five-minute reconciliation schedule could leave the app showing Free until its next verification, while Play refused another purchase because the subscription was still owned.

The Android app now checks owned subscriptions with the server before presenting an unpaid plan or enforcing the free invoice limit. Upgrade restores an existing active purchase before opening checkout, and already-owned purchase errors trigger restoration. Verification examines all supported purchases so an obsolete token cannot hide an active one. Concurrent refreshes share a verification pass for the same signed-in user; failures do not falsely report a confirmed Free plan. Dashboard plan hints refresh on billing events and foregrounding.

iPhone remains Free-only. No billing schema, public billing flag or existing Apple artifact is changed. See NEXT_ANDROID_RELEASE.md for the scoped hotfix exception to the planned native upgrade.

## Release validation

- Automated coverage: stale expiry followed by renewal; renewed access above the free invoice limit; restore before checkout; old token failure followed by a valid subscription; concurrent refresh; already-owned recovery; verification errors; confirmed expiry; iOS Free-only behavior.
- Run clean dependency installation, app tests, TypeScript, Deno verifier tests and Expo Doctor before building.
- Upload the signed AAB to internal testing first. Test a release candidate against Google Play: buy a test subscription, leave/reopen across at least two five-minute renewal boundaries, verify Pro and access to document creation beyond the free limit, restore, and confirm genuine expiry returns to Free. Prefer a Play-installed candidate; if preserving an existing sideloaded installation requires using its signing key, record that distinction and compare the app payload with Google's generated APK.
- Production promotion requires the candidate's device test result. Automated tests do not establish that Google Play's native purchase flow passed on a phone.

## Build provenance

- Source: `164005ed1d9fdce29326264cd82954e2a5f9e1d9`, pushed to `main` after syncing the Mac's build-29 commits.
- Version: 1.3.0, Android version code 23 (assigned by EAS).
- [EAS build](https://expo.dev/accounts/platinummorgan/projects/invoice-automator/builds/23a6a574-5bfe-4dc1-9167-f36ecb33a786).
- Clean `npm ci`, all app tests, TypeScript, all three Deno billing verifier tests and all 18 Expo Doctor checks passed. [GitHub CI](https://github.com/platinummorgan/invoice_automator/actions/runs/36585543815) passed.
- The connected Galaxy S24+ runs Android 16 and initially had sideloaded build 21. Its signing certificate differs from Play App Signing. Do not uninstall it to replace it with a Play-signed build: that would discard local app data. A test APK derived from the exact release AAB and signed with the existing local key can update it in place. Record this signing/install difference separately from Play track validation.

## Artifact and internal release

- EAS build finished; signed AAB SHA-256: `610c0c87acf7097486e7f1a8ae9887243a065c265d05bc8e3e13e18c09b18539`.
- Google Play accepted and validated the AAB. A fresh track read confirmed internal release `1.3.0 (23) - Pro renewal fix`, status `completed`, version code `23`. Production remained on build 22 during testing.
- The Google-generated universal APK signature verified; SHA-256: `9a1f9641994bf064e36138ff652cb73e8f91e1c274ba1e159475ad6ef118f9d5`. JavaScript and native library entries matched the AAB-derived device APK. Play processing changed two DEX entries and the baseline profile entries; the test installation is not described as Play-installed.
- Build 23 was installed over sideloaded build 21 with `adb install -r`, preserving app data. The app opened successfully, displayed Pro, restored purchases with a `Purchase verified` confirmation, and opened the previously blocked quote editor without an upgrade alert. No customer document was created or sent by these checks.
- At the old test subscription's true expiry (11:11:16 Eastern), foregrounding correctly returned to Free. A new purchase was completed using Google's explicitly no-charge `Test card, always approves`; both the app and backend then showed active Pro through 11:17:04 Eastern.

- First renewal check: before expiry, the backend still reported 11:17:04 Eastern. After that boundary, the backgrounded app was reopened and displayed `Swift Invoice Pro` / `Unlimited invoices`; the quote editor opened without an upgrade prompt. Evidence: ignored local screenshot `.validation/billing-hotfix-renewal1.png`.

- Second renewal check: after the 11:22:04 Eastern boundary, reopening again displayed Pro and unlimited invoices; the quote editor again opened without an upgrade prompt. Evidence: ignored local screenshot `.validation/billing-hotfix-renewal2.png`.

## Production promotion

After the two live renewal checks, build 23 was promoted from internal to production. Google validated and committed the edit. A fresh API read confirmed both tracks contain version code `23`, release `1.3.0 (23) - Pro renewal fix`, status `completed`. Store availability and user auto-updates may propagate later.

The connected phone remains on the data-preserving, locally signed test APK derived from the production AAB (SHA-256 `8b1f8f351409dbccaf9dd9865d8fd6aa40abb49ec74bb0df26456d5c223672ee`). It is build 23; it is not a Play-installed APK. Test subscriptions still have Google's accelerated expiry; this hotfix prevents false downgrades during a valid renewal and does not grant permanent access.
