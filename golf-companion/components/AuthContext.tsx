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
      const sessionStr = await SecureStore.getItemAsync('supabase_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        const { data, error } = await supabase.auth.setSession(session);
        if (error) {
          console.log('Failed to restore session:', error);
          await SecureStore.deleteItemAsync('supabase_session');
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
        SecureStore.setItemAsync('supabase_session', JSON.stringify(session));
        setUser(session.user);
      } else {
        SecureStore.deleteItemAsync('supabase_session');
        setUser(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync('supabase_session');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}