# Auto Email Setup - Invoice Automator

## Overview
Implemented automatic invoice email sending using the Resend API. Invoices can now be sent directly to customers with a professional HTML template and payment link.

## What Was Added

### 1. Email Service (`src/services/email.ts`)
- Created `sendInvoiceEmail()` function that sends emails via Resend API
- Uses fetch API for React Native compatibility (no Node.js dependencies)
- Professional HTML email template with:
  - Invoice header with invoice number
  - Customer details (name, email, phone)
  - Issue date and due date
  - Line items table with descriptions, quantities, prices
  - Subtotal, tax, and total calculations
  - Notes section (if applicable)
  - Blue "Pay Invoice Now" button linked to Stripe payment
  - Professional styling with responsive design

### 2. Invoice Detail Screen Updates
- Added "Send Invoice Email" button next to "Share Payment Link"
- Button shows loading state while sending
- Validates that customer has email address
- Validates that payment link exists before sending
- Confirmation dialog before sending
- Updates invoice status to 'sent' after successful send
- Shows success/error alerts

### 3. Database Updates
- Created SQL migration `supabase/add_sent_at.sql` to add `sent_at` timestamp column
- Added index for querying sent invoices
- Updated TypeScript types to include `sent_at` field

### 4. Service Updates
- Modified `updateInvoiceStatus()` to set `sent_at` timestamp when marking invoice as 'sent'
- Invoice status automatically changes from 'draft' to 'sent' after email is sent

## Setup Required

### 1. Run SQL Migration
Run the SQL in `supabase/add_sent_at.sql` in your Supabase SQL Editor:
```sql
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_invoices_sent_at ON public.invoices(sent_at) 
  WHERE sent_at IS NOT NULL;

COMMENT ON COLUMN public.invoices.sent_at IS 'Timestamp when invoice was emailed to customer';
```

### 2. Configure Resend API
1. Sign up at https://resend.com (free tier: 100 emails/day, 3,000 emails/month)
2. Get your API key from the dashboard
3. Update `.env` file:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

### 3. Update Email "From" Address
Edit `src/services/email.ts` line 40:
```typescript
from: 'Invoice Automator <invoices@yourdomain.com>', // Update with your domain
```

With Resend free tier, you can use:
- `onboarding@resend.dev` (for testing only, 100 emails/day limit)
- Or verify your own domain in Resend dashboard

## How to Use

1. Create an invoice with a customer that has an email address
2. Generate a payment link for the invoice
3. Click "Send Invoice Email" button
4. Confirm sending in the dialog
5. Email will be sent to customer with payment link
6. Invoice status changes from "Draft" to "Sent"

## Features

✅ Professional HTML email template
✅ Validates email and payment link exist
✅ Loading states and error handling
✅ Confirmation dialog before sending
✅ Automatic status update to 'sent'
✅ Timestamp tracking with sent_at field
✅ Works with existing Share feature
✅ Mobile-friendly (uses fetch, not Node.js SDK)

## Testing Steps

1. **Configure Resend API key** in .env
2. **Run SQL migration** to add sent_at column
3. **Create test invoice** with your email address as customer
4. **Generate payment link**
5. **Click "Send Invoice Email"**
6. **Check your email** - should receive professional invoice
7. **Click payment link** - should open Stripe payment page
8. **Verify status changed** to "Sent" in app

## Email Template Preview

The email includes:
- Header with invoice number
- Customer information
- Issue and due dates
- Line items table with item descriptions, quantities, prices
- Tax and total calculations
- Notes section (if added)
- Prominent "Pay Invoice Now" button
- Professional blue/white color scheme
- Mobile responsive design

## Notes

- Email sending requires customer to have email address (now required field)
- Payment link must be generated before sending email
- Resend free tier: 100 emails/day, 3,000 emails/month
- For production, verify your domain in Resend for better deliverability
- Email template uses inline CSS for maximum email client compatibility
- sent_at timestamp helps track communication history
- Can still use Share feature for manual sending via SMS/WhatsApp
