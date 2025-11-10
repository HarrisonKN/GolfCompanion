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
      console.log("Starting session restore...");
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session?.user) {
        console.log("✅ Supabase session active");
        setUser(sessionData.session.user);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      // Manual fallback from SecureStore
      const accessToken = await SecureStore.getItemAsync('supabase_access_token');
      const refreshToken = await SecureStore.getItemAsync('supabase_refresh_token');

      if (accessToken && refreshToken) {
        console.log("🔄 Restoring session manually...");
        const { data: restored, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) console.error("Manual restore error:", error.message);
        if (restored?.session?.user) {
          console.log("✅ Manual restore successful");
          setUser(restored.session.user);
          setLoading(false);
          setIsInitialized(true);
          return;
        }
      }

      console.warn("🚪 No valid session found, retrying before redirect...");

      // Give Supabase a bit more time to persist session (retry once)
      await new Promise(resolve => setTimeout(resolve, 800));
      const { data: retrySession } = await supabase.auth.getSession();
      if (retrySession?.session?.user) {
        console.log("✅ Session found on retry");
        setUser(retrySession.session.user);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      console.warn("❌ Still no session after retry, waiting briefly for possible SIGNED_IN event...");

      await new Promise(resolve => setTimeout(resolve, 1000));
      const { data: finalCheck } = await supabase.auth.getSession();
      if (finalCheck?.session?.user) {
        console.log("✅ Session appeared after final wait");
        setUser(finalCheck.session.user);
        setLoading(false);
        setIsInitialized(true);
        return;
      }

      console.warn("🚪 No session even after final wait — holding redirect until Auth is initialized...");
      setUser(null);
      setLoading(false);

      // Do NOT immediately redirect; mark as initialized so login can complete
      if (!isInitialized) {
        console.log("🕐 Auth not fully initialized yet — skipping redirect");
        setIsInitialized(true);
        return;
      }

      // If we already initialized and still no session, then we redirect next render
      console.log("🚪 No session after initialization — safe to redirect now");
      setIsInitialized(true);
    };
    restoreSession();
  }, []);

  // Listen for auth state changes and sync with SecureStore
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event);

      // Ignore INITIAL_SESSION events to avoid false sign-outs
      if (event === "INITIAL_SESSION") {
        console.log("Skipping cleanup on INITIAL_SESSION");
        if (session) {
          setUser(session.user);
        }
        return;
      }

      if (event === "SIGNED_IN") {
        console.log("🟢 Signed in event caught, updating user");
        setUser(session?.user ?? null);
        if (session?.access_token && session?.refresh_token) {
          await SecureStore.setItemAsync('supabase_access_token', session.access_token);
          await SecureStore.setItemAsync('supabase_refresh_token', session.refresh_token);
        }
        return;
      }

      if (event === "SIGNED_OUT") {
        console.log("User signed out");
        await SecureStore.deleteItemAsync('supabase_access_token');
        await SecureStore.deleteItemAsync('supabase_refresh_token');
        setUser(null);
        return;
      }

      // Default handling for other events (e.g. TOKEN_REFRESHED)
      if (session) {
        console.log("Saving tokens to SecureStore");
        await SecureStore.setItemAsync('supabase_access_token', session.access_token);
        await SecureStore.setItemAsync('supabase_refresh_token', session.refresh_token);
        setUser(session.user);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [isInitialized]);

  const signOut = async () => {
    //console.log("skipping signout.");
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