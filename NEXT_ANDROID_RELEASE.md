# Next Android release: optimization and edge-to-edge

Google Play reported two Android quality items for production version `1.3.0 (22)`. They do not block the current release, but they must be treated as release gates for the next Android update.

## Findings

### DEX optimization

Build 22 has an obfuscation score of 1%. R8 is available in the generated Android project, but release minification and resource shrinking currently default to `false`.

### Android edge-to-edge APIs

The application source only sets light or dark status-bar icon style. It does not call the deprecated window-color or display-cutout APIs reported by Play. The reported calls originate in the native versions bundled with Expo SDK 54:

- React Native 0.81 `StatusBarModule` and `WindowUtilKt`.
- React Native Screens 4.16 `ScreenWindowTraits`.
- Expo Image Picker 17 `ExpoCropImageUtils`.
- Android Material Components sheet and edge-to-edge helpers.

Edge-to-edge is already enabled and must remain enabled. Android 15 enforces edge-to-edge for apps targeting API 35, and Expo SDK 54 targets API 36. Disabling it would not remove the deprecated bytecode and would create layout risk.

## Required implementation

Complete this work on a dedicated next-release branch after the current Google and Apple submissions settle:

1. Upgrade from Expo SDK 54 / React Native 0.81 to Expo SDK 57 at `expo@57.0.17` or newer, which includes React Native 0.86.3 or newer. Use Node.js 22.13 or newer for the upgrade.
2. Upgrade every Expo module with `npx expo install --fix`, including Expo Image Picker, and use the React Native Screens version supported by the new SDK.
3. Remove the obsolete `android.edgeToEdgeEnabled` app-config field. Edge-to-edge is mandatory in newer Expo SDKs.
4. Regenerate or carefully reconcile the native Android project, then remove the legacy `android:statusBarColor` theme item if the upgraded template no longer creates it.
5. Enable R8 and resource shrinking in both configuration sources used by this repository:
   - `expo-build-properties`: `enableMinifyInReleaseBuilds: true` and `enableShrinkResourcesInReleaseBuilds: true`.
   - `android/gradle.properties`: `android.enableMinifyInReleaseBuilds=true` and `android.enableShrinkResourcesInReleaseBuilds=true`.
6. Keep ProGuard rules narrow. Retain a billing keep rule only when the upgraded billing library or a release-build test demonstrates that it is required.

Official references:

- https://developer.android.com/about/versions/15/behavior-changes-15#edge-to-edge
- https://developer.android.com/topic/performance/issues/code-optimization
- https://expo.dev/changelog/sdk-57
- https://docs.expo.dev/versions/v54.0.0/sdk/build-properties/
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/

## Validation before store submission

- Run `npm ci`, TypeScript, all app tests, billing verifier tests and `npx expo-doctor`.
- Review the native prebuild diff for permissions, deep links, billing, signing, Apple Sign-In and photo access.
- Build and install an internal release APK with R8 enabled. Test cold start, email/password and Google sign-in, contacts, photo selection/cropping, quote conversion, PDF/email sharing, marking paid, receipts, purchase, restore and account deletion.
- Test Android 15 and Android 16 with gesture navigation and three-button navigation. Check login, menu, document forms, Settings, modals, image picker and PDF preview for content hidden under system bars or display cutouts.
- Build the store AAB and inspect its R8 metadata/mapping. Upload it to an internal Play track first and review the pre-launch report and DEX optimization scores.
- Submit to production only after the internal artifact passes. EAS should assign version code 23 or higher; use the number EAS reports as authoritative.

The next production artifact should clear the 25% Play obfuscation threshold and should remove or materially reduce the deprecated edge-to-edge API findings. If Play still identifies a compatibility call retained by an upgraded dependency for older Android versions, record the exact class and upstream version before release.
