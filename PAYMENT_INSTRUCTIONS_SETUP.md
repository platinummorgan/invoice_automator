# Payment Instructions Setup

## What Changed

Added **Payment Instructions** field so users can specify their payment methods (Venmo, Zelle, Cash App, PayPal, etc.) without needing Stripe.

## How It Works

### For Users:
1. Add payment methods in profile settings (coming soon)
2. Example: "Venmo: @johnsmith | Zelle: 555-1234 | Cash App: $johnsmith"
3. When invoice is emailed, payment instructions show in email

### For Invoices:
- **If payment instructions exist**: Shows in email with instructions
- **If Stripe payment link exists**: Shows "Pay with Card" button
- **If both exist**: Shows both options
- **If neither**: Shows "Please contact us for payment instructions"

## What You Need to Do

### 1. Run SQL Migration
Run this in Supabase SQL Editor:

```sql
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS payment_instructions TEXT;

COMMENT ON COLUMN public.profiles.payment_instructions IS 'Payment methods accepted by this business (e.g., Venmo @username, Zelle: 555-1234, Cash App: $username, PayPal: email@example.com)';
```

File: `supabase/add_payment_instructions.sql`

### 2. Email Template Now Supports:
- ✅ Payment instructions (Venmo, Zelle, Cash App, etc.)
- ✅ Stripe payment link (optional)
- ✅ Both together
- ✅ Neither (shows generic message)

### 3. Send Email Without Stripe:
- No longer requires payment link to send invoice
- Removed validation check for payment link
- Users can send invoices with just payment instructions

## Example Email Content:

**With Payment Instructions Only:**
```
Total Due: $150.00

Payment Instructions:
Venmo: @johnsmith
Zelle: 555-123-4567
Cash App: $johnsmith
PayPal: john@example.com
```

**With Both Payment Link and Instructions:**
```
Total Due: $150.00

[Pay Invoice Now] ← Blue button (Stripe)
Click the button above to securely pay with card

Payment Instructions:
Or pay via:
Venmo: @johnsmith
Zelle: 555-123-4567
```

## Next Steps:

1. ✅ Run payment_instructions SQL migration
2. ⏳ Add Settings screen where users can edit payment_instructions
3. ⏳ Load payment_instructions when sending email
4. ⏳ Test sending invoice with payment instructions
5. ⏳ (Optional) Add Stripe Connect later for card payments

## Benefits:

- ✅ Launch without Stripe
- ✅ Users can accept payments via Venmo/Zelle/Cash App
- ✅ Add Stripe Connect later as premium feature
- ✅ Simpler onboarding - no Stripe setup required
- ✅ Works for contractors who prefer cash/Venmo
