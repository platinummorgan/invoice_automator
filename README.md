# Invoice Automator

**Dead-simple invoicing for contractors** - Create invoices from the job site in 60 seconds with clear payment instructions and fast sending.

## 🚀 MVP Features

- ✅ **Invoice Creation** - Quick invoice form with line items and tax calculation
- ✅ **Customer Management** - Save customers or import from device contacts
- ✅ **Flexible Payment Instructions** - Add your own payment methods (PayPal, Venmo, Cash App, Zelle, Stripe links, etc.)
- ✅ **Dashboard** - View all invoices with paid/unpaid filters
- ✅ **Email Invoices** - Open your phone's email app with a pre-filled invoice draft
- ✅ **Invoice Branding** - Upload your logo and choose invoice template styles
- 🧾 **Receipts** - Open your phone's email app with a pre-filled receipt draft
- 🔔 **Push Notifications** - Get notified when invoices are paid
- 💰 **Subscription Tiers** - Free (2 invoices/mo) → $12-24/mo with optional platform fees

## 🛠 Tech Stack

- **Frontend**: React Native with Expo (Android-first)
- **Backend**: Supabase (Auth, Database, Real-time)
- **Payments**: Business-provided payment methods and links
- **Email**: Device email composer (Expo Mail Composer)
- **Notifications**: Expo Notifications + FCM

## 📋 Prerequisites

- Node.js 18+ and npm
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)
- Accounts:
  - [Supabase](https://supabase.com) (free tier)

## 🏗 Setup Instructions

### 1. Clone and Install

```bash
cd invoice_automator
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Get your project URL and anon key from Settings > API

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
EXPO_PUBLIC_APP_URL=https://yourdomain.com
```

### 4. Run the App

```bash
# Start Expo development server
npm start

# Run on Android
npm run android

# Run on iOS (requires macOS)
npm run ios
```

## 📱 Using the App

### First Time Setup
1. Sign up with email/password
2. Add your business details in settings (optional)
3. Start creating invoices!

### Creating an Invoice
1. Tap the **+** button on dashboard
2. Select or add a customer
3. Add line items with descriptions and prices
4. Set tax rate (if applicable)
5. Tap "Create Invoice"

### Sending Invoices
1. Open the invoice
2. Tap "Preview Invoice"
3. Tap "Open Email"
4. Add payment methods/links in Settings > Business Info > Payment Methods

### Managing Subscriptions
- **Free Tier**: 2 invoices per month
- **Monthly Basic ($12/mo)**: Unlimited invoices
- **Annual Basic ($120/year)**: Unlimited invoices + 15% discount
- **Platform Fee**: Optional 0.5-1% fee on paid invoices

## 🗂 Project Structure

```
invoice_automator/
├── src/
│   ├── screens/          # App screens
│   │   ├── LoginScreen.tsx
│   │   ├── SignUpScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   └── NewInvoiceScreen.tsx
│   ├── navigation/       # Navigation setup
│   ├── services/         # API services
│   │   ├── supabase.ts  # Supabase client
│   │   ├── auth.ts      # Authentication
│   │   ├── invoice.ts   # Invoice CRUD
│   │   ├── customer.ts  # Customer management
│   │   └── payment.ts   # Payment status + manual payment records
│   ├── components/       # Reusable components
│   └── types/           # TypeScript types
├── supabase/
│   └── schema.sql       # Database schema
├── App.tsx              # Root component
└── app.json             # Expo configuration
```

## 🔧 Development Tasks

### Completed ✅
- [x] Project setup with Expo + TypeScript
- [x] Supabase database schema with RLS
- [x] Authentication (email/password)
- [x] Dashboard with invoice list
- [x] Invoice creation with line items
- [x] Customer management
- [x] Basic navigation

### In Progress 🚧
- [ ] Payment status tracking
- [ ] Push notifications setup
- [ ] Auto-reminder system
- [ ] Receipt generation
- [ ] Subscription management

### Next Steps 📝
1. Create invoice detail screen
2. Improve payment-method templates
3. Add native share functionality
4. Set up Supabase Edge Functions for reminders
5. Implement push notifications
6. Add subscription billing with RevenueCat or Stripe
7. Create receipt PDF generation
8. Add onboarding flow

## 🚀 Deployment

### Building for Android

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build APK for testing
eas build --platform android --profile preview

# Build for Google Play Store
eas build --platform android --profile production
```

### Environment Variables for Production

Set these in your EAS secrets:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
```

## 🐛 Troubleshooting

### "Module not found" errors
```bash
npm install
expo start -c  # Clear cache
```

### Android build fails
```bash
cd android && ./gradlew clean
cd .. && npm run android
```

### Supabase connection issues
- Check your `.env` file has correct credentials
- Verify Supabase project is active
- Check RLS policies are set correctly

## 💡 Future Enhancements

- 🪄 **Magic Invoice**: Generate from plain text or screenshot (AI)
- 🔄 **Recurring Invoices**: Auto-generate monthly/weekly invoices
- 📊 **Reports**: Revenue tracking and analytics
- 💳 **Multiple Payment Methods**: Better templates and customer payment UX
- 🌍 **Multi-currency**: Support international customers
- 📱 **iOS Version**: Expand to iOS after Android validation
- 🎨 **Custom Branding**: Logo and color customization

## 📄 License

MIT License - feel free to use for your own projects!

## 🤝 Contributing

This is an MVP project. Contributions welcome!

## 📧 Support

For issues or questions, open a GitHub issue or contact support@invoiceautomator.com

---

**Built with ❤️ for contractors who need to invoice fast**
