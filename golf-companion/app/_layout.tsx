import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { VoiceProvider } from '@/components/VoiceContext';
import { GlobalVoiceBar } from '@/components/GlobalVoiceBar';

// Configure how notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Listen for notifications when app is in foreground
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log("📬 Notification received:", notification);
    });

    // 🆕 LISTEN FOR USER TAPPING ON NOTIFICATION
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("👆 User tapped notification:", response);
      
      const { data } = response.notification.request.content;
      
      // Handle game invitation taps
      if (data?.route === "gameModes" && data?.gameId) {
        console.log("🎮 Navigating to game:", data.gameId);
        router.push({
          pathname: "/gameModes" as any,
          params: {
            gameId: data.gameId as string,
            courseId: data.courseId as string,
            courseName: data.courseName as string,
            isJoiningExistingGame: "1",
          },
        });
      }
      // Handle other routes as needed
      else if (data?.route) {
        router.push(data.route as any);
      }
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <AuthProvider>
            <VoiceProvider>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="login" options={{ headerShown: false }} />
                <Stack.Screen name="signup" options={{ headerShown: false }} />
                <Stack.Screen name="hubRoom" options={{ headerShown: false }} />
                <Stack.Screen name="friendProfile" options={{ headerShown: false }} />
                <Stack.Screen name="startGame" options={{ headerShown: false }} />
                <Stack.Screen name="gameModes" options={{ headerShown: false }} />
                <Stack.Screen name="+not-found" />
              </Stack>
              <GlobalVoiceBar />
              <StatusBar style="auto" />
            </VoiceProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}