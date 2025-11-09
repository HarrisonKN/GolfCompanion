import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from "@/lib/supabaseClient";

interface AuthContextType {
  user: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
  const loadSessionFromSecureStore = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('supabase_access_token');
      const refreshToken = await SecureStore.getItemAsync('supabase_refresh_token');

      if (accessToken && refreshToken) {
        console.log('🔁 Backup session loader: restoring tokens to Supabase client');
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      } else {
        console.log('⚠️ No tokens found in SecureStore for backup session restore');
      }
    } catch (error) {
      console.error('❌ Failed to load session from SecureStore:', error);
    }
  };

  loadSessionFromSecureStore();
}, []);

  // Restore session from SecureStore on mount
  useEffect(() => {
    const restoreSession = async () => {
      console.log('Starting session restore...');
      const accessToken = await SecureStore.getItemAsync('supabase_access_token');
      const refreshToken = await SecureStore.getItemAsync('supabase_refresh_token');
      console.log('RestoreSession: accessToken length:', accessToken?.length || 0);
      console.log('RestoreSession: refreshToken length:', refreshToken?.length || 0);

      if (accessToken && refreshToken) {
        console.log('Both tokens found, restoring session...');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.log('Failed to restore session:', error);
          await SecureStore.deleteItemAsync('supabase_access_token');
          await SecureStore.deleteItemAsync('supabase_refresh_token');
        } else {
          console.log('Session restored successfully');
        }
      } else {
        console.log('Missing tokens, cannot restore session');
      }
      
      // Always get the current session and update state
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      // After restoring session, explicitly sync Supabase client with tokens if present
      if (session?.access_token && session?.refresh_token) {
      console.log('🔑 Session is active after login (no need to re-set)');
      }
      setLoading(false);
      setIsInitialized(true);
      console.log('Session restore complete. User:', session?.user ? 'found' : 'not found');
    };
    restoreSession();
  }, []);

  // Listen for auth state changes and sync with SecureStore
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event);
      console.log('Session present:', !!session);
      
      // Don't clear tokens on INITIAL_SESSION if we haven't finished restoring yet
      if (event === 'INITIAL_SESSION' && !isInitialized) {
        console.log('Skipping INITIAL_SESSION cleanup - still restoring');
        return;
      }
      
      if (session) {
        console.log('Saving tokens to SecureStore');
        console.log('Access token present:', !!session.access_token);
        console.log('Refresh token present:', !!session.refresh_token);
        
        await SecureStore.setItemAsync('supabase_access_token', session.access_token);
        await SecureStore.setItemAsync('supabase_refresh_token', session.refresh_token);

        if (session?.access_token && session?.refresh_token) {
          console.log('🔑 Session active after login (no need to re-set)');
        }

        setUser(session.user);
      } else {
        console.log('Clearing tokens from SecureStore');
        SecureStore.deleteItemAsync('supabase_access_token');
        SecureStore.deleteItemAsync('supabase_refresh_token');
        setUser(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [isInitialized]);

  const signOut = async () => {
    console.log('Signing out...');
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync('supabase_access_token');
    await SecureStore.deleteItemAsync('supabase_refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}