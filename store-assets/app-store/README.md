# App Store screenshots

The `iphone-69` directory contains the iPhone 6.9-inch portrait screenshot set for Swift Invoice 1.3.0. Every image is 1320 × 2868 pixels, uses fictional business and customer data, and has no alpha channel.

Recommended upload order:

1. `01-job-workflow.png`
2. `02-invoices.png`
3. `03-quote-detail.png`
4. `04-quote-preview.png`
5. `05-paid-receipt.png`
6. `06-reports.png`

`07-quotes-optional.png` and `08-receipts-optional.png` are document-list alternatives. The app is iPhone-only, so no iPad set is needed.

The dedicated review account email is `apple-review-20260930@invoiceautomator.app`. Its password is stored in the macOS login Keychain under the service `Swift Invoice App Review`; it is intentionally not stored in Git. Retrieve it locally with:

```sh
security find-generic-password \
  -a apple-review-20260930@invoiceautomator.app \
  -s "Swift Invoice App Review" \
  -w
```

The Maestro login flow contains no password. Supply `REVIEW_EMAIL` and `REVIEW_PASSWORD` through Maestro's `-e` arguments when rerunning it.

Simulator PNG captures include an alpha channel even when every pixel is opaque. Run `flatten-png.swift` after recapturing an image so App Store Connect accepts it.
