import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables pulled from app.json extra
const expoExtra = Constants.expoConfig?.extra;
const manifestExtra = (Constants as any)?.manifestExtra;
const legacyManifestExtra = (Constants.manifest as any)?.extra;
const extra = expoExtra ?? manifestExtra ?? legacyManifestExtra ?? {};
const supabaseUrl = extra.supabaseUrl;
const supabaseAnonKey = extra.supabaseAnonKey;

// Enhanced debugging
console.log('=== SUPABASE DEBUG INFO ===');
console.log('Environment:', __DEV__ ? 'Development' : 'Production');
console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING');
console.log('Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');

let supabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `Supabase configuration missing:
    URL: ${supabaseUrl ? 'Present' : 'MISSING'}
    Key: ${supabaseAnonKey ? 'Present' : 'MISSING'}
    
    Check that app.config.js or app.json has:
    {
      "expo": {
        "extra": {
          "supabaseUrl": "...",
          "supabaseAnonKey": "..."
        }
      }
    }
  `;
  console.error(errorMessage);
  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key');
} else {
  console.log('✅ Supabase client created successfully');
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = supabaseClient;

export const testSupabaseConnection = async () => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Cannot test connection - missing credentials');
      return false;
    }
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('✅ Supabase connection test successful');
    return true;
  } catch (err) {
    console.error('Supabase connection test error:', err);
    return false;
  }
};
