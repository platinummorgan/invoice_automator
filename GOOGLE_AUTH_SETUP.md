# Google OAuth Setup Guide

## Overview
Google Sign-In has been integrated into your Swift Invoice app. Since you already have Google OAuth credentials from your website, you'll need to configure them in Supabase and add the mobile app redirect URIs.

## Step 1: Configure Supabase

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your `invoice_automator` project

2. **Enable Google Provider**
   - Go to **Authentication** → **Providers**
   - Find **Google** in the list
   - Click to enable it

3. **Add your Google OAuth Credentials**
   - **Client ID**: Your existing Google OAuth Client ID
   - **Client Secret**: Your existing Google OAuth Client Secret
   - Click **Save**

## Step 2: Update Google Cloud Console

Since you already have a Google OAuth app, you need to add the mobile redirect URIs:

1. **Go to Google Cloud Console**
   - Navigate to: https://console.cloud.google.com/apis/credentials
   - Select your existing OAuth 2.0 Client ID

2. **Add Authorized Redirect URIs**
   
   Add these redirect URIs to your existing ones:
   
   ```
   https://[YOUR-SUPABASE-PROJECT-REF].supabase.co/auth/v1/callback
   com.invoiceautomator.app://auth/callback
   ```
   
   Replace `[YOUR-SUPABASE-PROJECT-REF]` with your actual Supabase project reference (found in your Supabase project URL).

3. **Save the changes**

## Step 3: Find Your Supabase Project Reference

Your Supabase project reference is in your project URL:
- Format: `https://[PROJECT-REF].supabase.co`
- Example: `https://abcdefghijklmnop.supabase.co` → Project Ref: `abcdefghijklmnop`

You can also find it in:
- Supabase Dashboard → **Settings** → **API** → **Project URL**

## Step 4: Test the Integration

1. **Rebuild your app** (since we added new packages):
   ```bash
   npx expo prebuild --clean
   cd android
   ./gradlew clean
   cd ..
   npx expo run:android
   ```

2. **Test Google Sign-In**:
   - Open the app
   - On Login or Sign Up screen, tap **"Continue with Google"**
   - You should see the Google account picker
   - Select an account
   - The app should authenticate and log you in

## What's Been Implemented

### Code Changes:
1. **Auth Service** (`src/services/auth.ts`):
   - Added `signInWithGoogle()` method
   - Uses PKCE flow for security
   - Handles OAuth redirect properly

2. **LoginScreen** (`src/screens/LoginScreen.tsx`):
   - Added "Continue with Google" button
   - Separated loading states for email and Google
   - Added OR divider for better UX

3. **SignUpScreen** (`src/screens/SignupScreen.tsx`):
   - Added "Continue with Google" button
   - Same UX as LoginScreen for consistency

4. **App Config** (`app.json`):
   - Added URL scheme: `com.invoiceautomator.app`
   - Added intent filters for deep linking
   - Configured iOS scheme

### Packages Installed:
- `expo-web-browser` - Opens OAuth in browser
- `expo-auth-session` - Handles OAuth redirects
- `expo-crypto` - For PKCE security

## Troubleshooting

### Issue: "Google sign-in was cancelled or failed"
- Check that redirect URIs are properly configured in Google Cloud Console
- Verify Supabase Google provider is enabled
- Ensure Client ID and Secret are correct in Supabase

### Issue: App doesn't open after Google authentication
- Check URL scheme in app.json matches: `com.invoiceautomator.app`
- Verify intent filters are properly configured
- Rebuild the app with `npx expo prebuild --clean`

### Issue: "Invalid redirect URI"
- Double-check the redirect URI format in Google Cloud Console
- Make sure it exactly matches: `https://[PROJECT-REF].supabase.co/auth/v1/callback`
- No trailing slashes

## Profile Creation

When a user signs in with Google for the first time:
- Supabase creates a user account automatically
- Your database trigger creates a profile with the user's Google display name
- The user is logged in immediately
- No email verification required (Google already verified)

## Security Notes

- Uses PKCE (Proof Key for Code Exchange) for enhanced security
- Access tokens are stored securely by Supabase
- Refresh tokens enable persistent sessions
- OAuth flow happens in secure system browser

## Next Steps

After Google Sign-In is working:
1. Test with multiple Google accounts
2. Test the sign-out flow
3. Verify profile information is captured correctly
4. Test on both new and existing users
