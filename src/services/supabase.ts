import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const missingEnvVars = [
  !supabaseUrl ? 'EXPO_PUBLIC_SUPABASE_URL' : null,
  !supabaseAnonKey ? 'EXPO_PUBLIC_SUPABASE_ANON_KEY' : null,
].filter(Boolean);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required Supabase environment variables: ${missingEnvVars.join(', ')}`
  );
}

if (!/^https?:\/\//i.test(supabaseUrl)) {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL must be a valid HTTP/HTTPS URL. Received: ${supabaseUrl}`
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
