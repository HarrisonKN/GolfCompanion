import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import messaging from '@react-native-firebase/messaging';

import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { VoiceProvider } from '@/components/VoiceContext';
import { GlobalVoiceBar } from '@/components/GlobalVoiceBar';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // 🔥 FCM: Handle background message (when app is closed or killed)
    // This must be set at the very top level and OUTSIDE of useEffect for Android
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('🛌 FCM Background message (app closed/killed):', remoteMessage);
      console.log('Title:', remoteMessage.notification?.title);
      console.log('Body:', remoteMessage.notification?.body);
      console.log('Data:', remoteMessage.data);
      // The notification will automatically be shown in the system tray
      // Navigation will happen when user taps the notification
      return Promise.resolve();
    });

    // 🔥 FCM: Handle foreground notifications
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      console.log('📬 FCM Foreground notification:', remoteMessage);
      
      // You can display a custom UI or use a notification library here
      // The notification will automatically show in the system tray on Android
      console.log('Title:', remoteMessage.notification?.title);
      console.log('Body:', remoteMessage.notification?.body);
      console.log('Data:', remoteMessage.data);
    });

    // 🔥 FCM: Handle notification taps (when app is in background or quit)
    const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('👆 FCM: User tapped notification (background):', remoteMessage);
      handleNotificationNavigation(remoteMessage.data);
    });

    // 🔥 FCM: Handle notification that opened the app from quit state
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('🚀 FCM: App opened from quit state by notification:', remoteMessage);
          handleNotificationNavigation(remoteMessage.data);
        }
      });

    return () => {
      unsubscribeForeground();
      unsubscribeNotificationOpened();
    };
  }, [router]);

  // Helper function to handle navigation from notification data
  const handleNotificationNavigation = (data: any) => {
    if (!data) return;

    console.log('🧭 Processing notification navigation:', data);

    // Handle game invitation taps
    if (data.route === "gameModes" && data.gameId) {
      console.log("🎮 Navigating to game:", data.gameId);
      router.push({
        pathname: "/gameModes" as any,
        params: {
          gameId: data.gameId,
          courseId: data.courseId || '',
          courseName: data.courseName || '',
          isJoiningExistingGame: "1",
        },
      });
    }
    // Handle other routes
    else if (data.route) {
      console.log('📍 Navigating to route:', data.route);
      router.push(data.route as any);
    }
  };

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