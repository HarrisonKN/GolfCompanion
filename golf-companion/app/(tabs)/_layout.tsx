// ------------------- NOTES AND UPDATES -----------------
{/* 

*/}
// app/(tabs)/_layout.tsx
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { CourseProvider } from "@/components/CourseContext";
import { useTheme } from "@/components/ThemeContext";
import { IconSymbol } from "@/components/ui/IconSymbol";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { supabase } from "@/components/supabase";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";

export default function TabsLayout() {
  const { palette } = useTheme();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      console.log("🔐 Initializing auth...");
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.log("✅ Existing session found");
        setUser(session.user);
        setAuthReady(true);
        return;
      }
      const accessToken = await SecureStore.getItemAsync("supabase_access_token");
      const refreshToken = await SecureStore.getItemAsync("supabase_refresh_token");
      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.log("Restore session error:", error.message);
        if (data.session) setUser(data.session.user);
      }
      setAuthReady(true);
    };
    initAuth();
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth state change:", event);
      if (event === "SIGNED_IN" && session) {
        console.log("🟢 SIGNED_IN event detected, setting user");
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        console.log("🔴 SIGNED_OUT event detected, redirecting to login");
        setUser(null);
        router.replace("/login");
      } else {
        console.log("⏸️ Ignoring auth event:", event);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Prevent early redirects or flickers by waiting for user resolution
  useEffect(() => {
    if (authReady && user) {
      console.log("✅ Auth ready with user:", user.email);
    } else if (authReady && !user) {
      console.log("⚠️ Auth ready but no user — likely signed out");
      // Only redirect here if truly signed out and not during INITIAL_SESSION noise
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) {
          console.log("🔴 Confirmed no active session, redirecting to login");
        // router.replace("/login"); this makes it go straight to login can implement later if we want
        } else {
          console.log("🟢 Session actually valid, skipping redirect");
          setUser(data.session.user);
        }
      });
    }
  }, [authReady]);

  if (!authReady) return null;

  return (
    <CourseProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            borderTopWidth: 0,
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            elevation: 10,
          },
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "#aaa",
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontWeight: "700", fontSize: 13 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} /> }} />
        <Tabs.Screen name="scorecard" options={{ title: "Scorecard", tabBarIcon: ({ color }) => <MaterialIcons name="view-list" size={28} color={color} /> }} />
        <Tabs.Screen name="course-view" options={{ title: "Course View", tabBarIcon: ({ color }) => <MaterialIcons name="golf-course" size={28} color={color} /> }} />
        <Tabs.Screen name="golfHub" options={{ title: "GolfHub", tabBarIcon: ({ color }) => <MaterialIcons name="audiotrack" size={28} color={color} /> }} />
        <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color }) => <MaterialIcons name="account-circle" size={28} color={color} /> }} />
      </Tabs>
    </CourseProvider>
  );
}