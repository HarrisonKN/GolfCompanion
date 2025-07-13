import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Environment variables pulled from EAS secrets
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Enhanced debugging
console.log('=== SUPABASE DEBUG INFO ===');
console.log('Environment:', __DEV__ ? 'Development' : 'Production');
console.log('Supabase URL:', supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING');
console.log('Supabase Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'MISSING');
console.log('Process env keys:', Object.keys(process.env).filter(key => key.startsWith('EXPO_PUBLIC_')));

// Create the client - either real or mock
let supabaseClient;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = `Supabase configuration missing:
    URL: ${supabaseUrl ? 'Present' : 'MISSING'}
    Key: ${supabaseAnonKey ? 'Present' : 'MISSING'}
    
    Available env vars: ${Object.keys(process.env).filter(key => key.startsWith('EXPO_PUBLIC_')).join(', ')}`;
  
  console.error(errorMessage);
  
  // Create a mock client that will fail gracefully
  supabaseClient = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
} else {
  console.log('✅ Supabase client created successfully');
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
}

// Export the client
export const supabase = supabaseClient;

// Test connection function with better error reporting
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