# Play Console checks for Swift Invoice 1.2.2

## Data safety is separate from the privacy policy

Open Policy and programs → App content → Data safety → Manage. The owner submitted corrected collection/deletion declarations for review on September 20. Review approval is not yet verified. Diagnostics sharing remains unresolved; privacy-policy disclosure does not substitute for the Data safety declaration. Public listing crawls may lag Console changes.

The app transmits and stores account email, profile/business details, customer details, invoices, payment records, subscription verification records and optional business logos. Do not select No data collected merely because there is no advertising or analytics.

Review these Google categories against the fields actually used:

- Personal info: email, name, user ID; address and phone where supplied.
- Financial info: subscription purchase history, optional business payment account instructions, and invoice/payment information. Google Play card details are not received by Swift Invoice.
- Contacts: selected contact details imported and saved as customers; distinguish on-device reading from off-device storage.
- Photos: an optional uploaded business logo.
- Other user-generated content: user-supplied descriptions, notes and support feedback, as applicable.

Purposes are account management and app functionality, plus developer communications for support. Required/optional answers vary by field; logos and business details are optional. Stored server data is not ephemeral. Service-provider processing and user-initiated sending have specific sharing exceptions; review Google's definitions rather than automatically marking every provider as data sharing. Review SDK behavior too. Do not attest to an independent security review unless one exists.

Official guidance: https://support.google.com/googleplay/android-developer/answer/10787469

## Account deletion

Public URL: https://platinummorgan.github.io/invoice_automator/delete-account.html
In-app path in build 18: Settings → Request account deletion.
This is a support-assisted process. Requests go to support@platovalabs.com. Verify the requester's account ownership before any deletion, confirm any retained records and retention duration, and confirm completion. No actual account is deleted by opening the page. Google Play subscription cancellation is separate.

The operator must monitor and fulfill these requests. Check retention/disclosure requirements against the actual backup and operational practices; the page does not invent a fixed retention period.

Official guidance: https://support.google.com/googleplay/android-developer/answer/13327111

## Release activation

A production draft does not make the new version available to users. Build 18 is superseded by the final rebuild. Review the draft and Play validation, complete device smoke checks and live renewal/refund testing, then coordinate the public billing flag and full profile guard with rollout. The current global billing gate remains test-only.
