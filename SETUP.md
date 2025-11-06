# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Environment Setup

1. Copy the example environment file:
```bash
copy .env.example .env
```

2. Fill in your credentials in `.env`:
   - **Supabase**: Get from https://app.supabase.com → Your Project → Settings → API
   - **Stripe**: Get from https://dashboard.stripe.com → Developers → API Keys (use test mode)
   - **Resend**: Get from https://resend.com → API Keys

### Step 2: Database Setup

1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/schema.sql`
4. Click "Run" to create all tables and functions

### Step 3: Run the App

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm start

# In a new terminal, run on Android
npm run android
```

## 🎯 First Actions

1. **Sign Up**: Create your account in the app
2. **Add a Customer**: Go to the New Invoice screen and add customer details
3. **Create Invoice**: Add line items, set tax rate, and create your first invoice
4. **Generate Payment Link**: (Coming soon - requires Stripe setup)

## 📋 Feature Checklist

### ✅ Working Now
- [x] User authentication (signup/login)
- [x] Dashboard with invoice list
- [x] Create invoices with multiple line items
- [x] Tax calculation
- [x] Customer management
- [x] Paid/unpaid filtering

### 🚧 Requires Additional Setup
- [ ] Stripe payment links (need Stripe API configured)
- [ ] Email reminders (need Resend API + Supabase Edge Functions deployed)
- [ ] Push notifications (need Firebase Cloud Messaging setup)
- [ ] Receipt generation (need to implement PDF generation)
- [ ] Subscription billing (need to integrate payment processor)

## 🔧 Next Steps for Production

### 1. Deploy Supabase Edge Functions

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy stripe-webhook
supabase functions deploy send-reminders

# Set secrets
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set RESEND_API_KEY=re_...
```

### 2. Configure Stripe Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint: `https://your-project.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Copy webhook secret and add to Supabase secrets

### 3. Schedule Email Reminders

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Add a new cron job:
   ```sql
   SELECT cron.schedule(
     'send-daily-reminders',
     '0 9 * * *', -- Run at 9 AM daily
     $$
     SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/send-reminders',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb
     ) as request_id;
     $$
   );
   ```

### 4. Build for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure build
eas build:configure

# Create production build
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

## 🐛 Common Issues

### "Supabase connection failed"
- Check your `.env` file has correct `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Verify your Supabase project is not paused

### "Invoice creation fails"
- Ensure database schema is properly set up (run `supabase/schema.sql`)
- Check Row Level Security policies are enabled
- Verify you're authenticated (check auth.users table)

### "Can't run on Android"
- Make sure Android Studio is installed
- Start Android emulator first: `npm run android` will use it
- Or connect a physical device with USB debugging enabled

### "Module not found" errors
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
expo start -c
```

## 💡 Tips

- **Free Tier Limit**: Track invoice count in profiles table
- **Testing Payments**: Use Stripe test card `4242 4242 4242 4242`
- **Email Testing**: Resend has a generous free tier (3000 emails/month)
- **Performance**: Add indexes if querying gets slow with many invoices

## 📞 Need Help?

- Check the main README.md for detailed documentation
- Review the database schema in `supabase/schema.sql`
- Inspect the service files in `src/services/` for API usage

---

**Ready to invoice from the job site!** 🎉
