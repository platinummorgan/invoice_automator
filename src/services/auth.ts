import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';
import { Profile } from '../types';

type GoogleSigninClient = {
  configure: (params: { webClientId: string }) => void;
  hasPlayServices: () => Promise<void>;
  signIn: () => Promise<any>;
};

type AppleAuthModule = {
  AppleAuthenticationScope: {
    FULL_NAME: number;
    EMAIL: number;
  };
  AppleAuthenticationCredentialState: {
    AUTHORIZED: number;
  };
  isAvailableAsync: () => Promise<boolean>;
  signInAsync: (params: { requestedScopes: number[] }) => Promise<{
    identityToken?: string | null;
    fullName?: {
      givenName?: string | null;
      familyName?: string | null;
    } | null;
    email?: string | null;
  }>;
};

let cachedGoogleSignin: GoogleSigninClient | null = null;
let googleSigninInitAttempted = false;
let cachedAppleAuth: AppleAuthModule | null = null;
let appleAuthInitAttempted = false;

const GOOGLE_WEB_CLIENT_ID =
  '884636010114-k636nc5f4397hve5vmfj765m9o9rsbgj.apps.googleusercontent.com';
const APP_AUTH_REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'com.invoiceautomator.app',
  path: 'auth/callback',
});

function getGoogleSigninClient(): GoogleSigninClient | null {
  if (cachedGoogleSignin) return cachedGoogleSignin;
  if (googleSigninInitAttempted) return null;

  googleSigninInitAttempted = true;

  try {
    const googleModule = require('@react-native-google-signin/google-signin');
    const client = googleModule?.GoogleSignin as GoogleSigninClient | undefined;

    if (!client) {
      return null;
    }

    client.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
    });

    cachedGoogleSignin = client;
    return cachedGoogleSignin;
  } catch (error) {
    console.warn('Google Sign-In native module unavailable. Falling back to email/password.');
    return null;
  }
}

function getAppleAuthModule(): AppleAuthModule | null {
  if (cachedAppleAuth) return cachedAppleAuth;
  if (appleAuthInitAttempted) return null;

  appleAuthInitAttempted = true;

  try {
    const appleAuth = require('expo-apple-authentication') as AppleAuthModule;
    cachedAppleAuth = appleAuth;
    return cachedAppleAuth;
  } catch (error) {
    console.warn('Apple Sign-In native module unavailable.');
    return null;
  }
}

const ensureProfileForOAuthUser = async (
  user: any,
  profile: { fullName?: string | null; email?: string | null }
) => {
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (existingProfile) return;

  const fallbackName = profile.fullName || user.email?.split('@')[0] || 'User';
  const { error: profileError } = await supabase.from('profiles').insert({
    id: user.id,
    full_name: fallbackName,
    email: profile.email || user.email,
  });

  if (profileError) {
    console.error('Error creating profile:', profileError);
  }
};

const getAuthCodeFromRedirectUrl = (redirectUrl: string) => {
  const parsedUrl = new URL(redirectUrl);
  const queryCode = parsedUrl.searchParams.get('code');

  if (queryCode) return queryCode;

  if (parsedUrl.hash) {
    return new URLSearchParams(parsedUrl.hash.replace(/^#/, '')).get('code');
  }

  return null;
};

const signInWithGoogleBrowser = async () => {
  const { data: oauthData, error: oauthError } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: APP_AUTH_REDIRECT_URI,
      skipBrowserRedirect: true,
    },
  });

  if (oauthError) throw oauthError;
  if (!oauthData.url) {
    throw new Error('Unable to start Google Sign-In');
  }

  const result = await WebBrowser.openAuthSessionAsync(oauthData.url, APP_AUTH_REDIRECT_URI);

  if (result.type !== 'success') {
    throw new Error('Sign-in was cancelled');
  }

  const authCode = getAuthCodeFromRedirectUrl(result.url);
  if (!authCode) {
    throw new Error('No authorization code received from Google');
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(authCode);
  if (error) throw error;

  if (data.user) {
    await ensureProfileForOAuthUser(data.user, {
      fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
      email: data.user.email,
    });
  }

  return data;
};

export const authService = {
  isGoogleSignInAvailable() {
    return true;
  },

  async isAppleSignInAvailable() {
    const appleAuth = getAppleAuthModule();
    if (!appleAuth) return false;
    return appleAuth.isAvailableAsync();
  },

  async signInWithGoogle() {
    try {
      console.log('Starting Google Sign-In...');
      const GoogleSignin = getGoogleSigninClient();

      if (!GoogleSignin) {
        return await signInWithGoogleBrowser();
      }

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // Sign in with Google
      const userInfo = await GoogleSignin.signIn();
      console.log('Google sign-in successful, got user info');

      if (!userInfo.data?.idToken) {
        throw new Error('No ID token received from Google');
      }

      console.log('Signing in to Supabase with Google ID token...');

      // Sign in to Supabase with the Google ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: userInfo.data.idToken,
      });

      if (error) {
        console.error('Supabase sign-in error:', error);
        throw error;
      }

      if (data.user) {
        await ensureProfileForOAuthUser(data.user, {
          fullName: userInfo.data.user?.name,
          email: data.user.email,
        });
      }

      console.log('Google Sign-In successful!');
      return data;
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      
      // Handle specific error cases
      if (error.code === 'SIGN_IN_CANCELLED') {
        throw new Error('Sign-in was cancelled');
      } else if (error.code === 'IN_PROGRESS') {
        throw new Error('Sign-in is already in progress');
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        throw new Error('Google Play Services not available');
      }
      
      throw error;
    }
  },

  async signInWithApple() {
    try {
      const appleAuth = getAppleAuthModule();
      if (!appleAuth) {
        throw new Error('Sign in with Apple is unavailable on this device.');
      }

      const available = await appleAuth.isAvailableAsync();
      if (!available) {
        throw new Error('Sign in with Apple is unavailable on this device.');
      }

      const credential = await appleAuth.signInAsync({
        requestedScopes: [
          appleAuth.AppleAuthenticationScope.FULL_NAME,
          appleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('No Apple identity token received');
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;

      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (data.user) {
        await ensureProfileForOAuthUser(data.user, {
          fullName,
          email: credential.email || data.user.email,
        });
      }

      return data;
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        throw new Error('Sign-in was cancelled');
      }

      console.error('Apple Sign-In Error:', error);
      throw error;
    }
  },

  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    // Profile is automatically created by database trigger
    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async deleteAccount() {
    const { error } = await supabase.functions.invoke('delete-account', {
      body: {},
    });

    if (error) throw error;

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) {
      console.warn('Local sign out after account deletion failed:', signOutError);
    }
  },

  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  async resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    if (error) throw error;
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async getProfile(): Promise<Profile | null> {
    const session = await this.getSession();
    if (!session?.user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateProfile(updates: Partial<Profile>) {
    const session = await this.getSession();
    if (!session?.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
