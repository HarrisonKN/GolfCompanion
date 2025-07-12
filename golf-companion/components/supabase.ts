import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Environment variables pulled from .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing. Check your .env file or EAS secrets.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);