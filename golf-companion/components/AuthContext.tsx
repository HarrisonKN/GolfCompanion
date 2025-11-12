import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { supabase } from "@/components/supabase";

interface AuthContextType {
  user: any;
  loading: boolean;
  signOut: () => Promise<void>;
  setUser: (user: any) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  setUser: () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Restore session from SecureStore
  useEffect(() => {
    const restoreSession = async () => {
      console.log("Starting session restore...");
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData?.session?.user) {
        console.log("✅ Supabase session active");
        setUser(sessionData.session.user);
        setLoading(false);
        return;
      }

      const accessToken = await SecureStore.getItemAsync("supabase_access_token");
      const refreshToken = await SecureStore.getItemAsync("supabase_refresh_token");

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
        }
      }

      setLoading(false);
    };
    restoreSession();
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", event);

      if (event === "SIGNED_IN" && session) {
        console.log("🟢 Signed in — updating user and saving tokens");
        setUser(session.user);
        await SecureStore.setItemAsync("supabase_access_token", session.access_token);
        await SecureStore.setItemAsync("supabase_refresh_token", session.refresh_token);
      } else if (event === "SIGNED_OUT") {
        console.log("🔴 Signed out — clearing session");
        setUser(null);
        await SecureStore.deleteItemAsync("supabase_access_token");
        await SecureStore.deleteItemAsync("supabase_refresh_token");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    console.log("Signing out...");
    await supabase.auth.signOut();
    await SecureStore.deleteItemAsync("supabase_access_token");
    await SecureStore.deleteItemAsync("supabase_refresh_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}