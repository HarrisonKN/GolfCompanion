import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

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

  // Restore session from SecureStore on mount
  useEffect(() => {
    const restoreSession = async () => {
      const accessToken = await SecureStore.getItemAsync('supabase_access_token');
      const refreshToken = await SecureStore.getItemAsync('supabase_refresh_token');
      console.log('RestoreSession: accessToken', accessToken, 'refreshToken', refreshToken);
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          console.log('Failed to restore session:', error);
          await SecureStore.deleteItemAsync('supabase_access_token');
          await SecureStore.deleteItemAsync('supabase_refresh_token');
        }
      }
      // Always get the latest session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };
    restoreSession();
  }, []);

  // Listen for auth state changes and sync with SecureStore
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Store only tokens, not the whole session object
        SecureStore.setItemAsync('supabase_access_token', session.access_token);
        SecureStore.setItemAsync('supabase_refresh_token', session.refresh_token);
        setUser(session.user);
      } else {
        SecureStore.deleteItemAsync('supabase_access_token');
        SecureStore.deleteItemAsync('supabase_refresh_token');
        setUser(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
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