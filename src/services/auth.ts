import { supabase } from './supabase';
import { Profile } from '../types';

type GoogleSigninClient = {
  configure: (params: { webClientId: string }) => void;
  hasPlayServices: () => Promise<void>;
  signIn: () => Promise<any>;
};

let cachedGoogleSignin: GoogleSigninClient | null = null;
let googleSigninInitAttempted = false;

const GOOGLE_WEB_CLIENT_ID =
  '884636010114-k636nc5f4397hve5vmfj765m9o9rsbgj.apps.googleusercontent.com';

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

export const authService = {
  isGoogleSignInAvailable() {
    return !!getGoogleSigninClient();
  },

  async signInWithGoogle() {
    try {
      console.log('Starting Google Sign-In...');
      const GoogleSignin = getGoogleSigninClient();

      if (!GoogleSignin) {
        throw new Error(
          'Google Sign-In is unavailable in Expo Go. Use email/password locally, or run a custom dev build.'
        );
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

      // Ensure profile exists for Google users (trigger might not fire for OAuth)
      if (data.user) {
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single();

        if (!existingProfile) {
          console.log('Creating profile for Google user...');
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: userInfo.data.user?.name || data.user.email?.split('@')[0] || 'User',
              email: data.user.email,
            });

          if (profileError) {
            console.error('Error creating profile:', profileError);
          }
        }
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
