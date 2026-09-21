# Quote, invoice and receipt workflow

The home menu opens Quotes, Invoices and Receipts in that order. Quotes reuse the invoice form, branding, items, tax and customer information. The owner records customer approval with **Approve quote & create invoice**. This converts the same job into a draft invoice, preserves the quote number and approval time, and retains all details and photos. Conversion retries return the same invoice. Review dates before sending the converted draft. Quotes are excluded from invoice reports, balances and payment reminders.

**Mark job completed** records completion separately from payment. **Record full payment** records payment once and opens a receipt email using the existing device email composer. The owner still taps Send in their email app; opening a composer does not prove delivery. Cancellation or email failure does not undo payment. Paid invoices remain in Receipts, with Email receipt and Share receipt PDF / text for retries or messaging apps. No SMS provider is introduced.

Quote, invoice and receipt email drafts attach a PDF. The existing plain-text mailto/share fallback cannot attach PDFs; use Share / save PDF if the device composer is unavailable. Job/before and finished photos appear in PDFs and HTML. Photos are private in Supabase Storage; HTML uses temporary signed URLs, while exported PDFs retain their pictures. Up to 12 JPEG photos per job, 5 MB each. Photo access requires connectivity. Removing a picture detaches it from the document; stored uploads are retained so other drafts or previously attached photos are not broken. Account deletion removes all uploads in that owner’s photo folder.

Quote creation consumes one existing monthly document allowance; converting it does not consume another. Existing invoices retain their current type and behavior.

## Deployment

Apply `supabase/migrations/202609210001_document_workflow.sql` after the existing migrations, before installing this app build. It adds document fields, transactional quote conversion, photo validation and the private `job-photos` bucket with owner policies. Deploy updated `send-reminders`, `create-payment-link` and `delete-account` functions if those endpoints are enabled. No production migration or deployment is performed by the source change.

## Validation

- `npm run typecheck` and `npm test`.
- In an empty disposable PostgreSQL database, run `tests/database-bootstrap.sql`, `supabase/schema.sql`, `tests/storage-bootstrap.sql`, the reliable-payments and invoice-drafts migrations, then the document-workflow migration. Run `tests/invoice-transactions.sql` and `tests/document-workflow.sql`. The storage bootstrap is a local schema stand-in, never a production migration.
- On a native device: create a quote with photos; save and reopen it; email its PDF; approve and convert; review customer/items/tax/photos; add finished photos; mark completed; record payment; send the receipt; share the receipt PDF through a messaging app. Check permission denial, offline retries, cancelled composer, dark mode and long multi-page PDFs. Verify pictures render inside received attachments after signed URLs expire.
