import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import * as Notifications from 'expo-notifications';

import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { VoiceProvider } from '@/components/VoiceContext';
import { SpotifyProvider } from '@/components/SpotifyContext';
import { GlobalVoiceBar } from '@/components/GlobalVoiceBar';
import { GlobalNotificationPanel } from '@/components/GlobalNotificationPanel';
import { initializeNotificationHandlers, setupAndroidNotificationChannel, NotificationData } from "@/lib/NotificationService";

// Ensure foreground notifications show a banner/sound when permitted
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const router = useRouter();
  const [notification, setNotification] = useState<{ title: string; body: string; data: NotificationData } | null>(null);
  const slideAnim = useState(new Animated.Value(-100))[0];

  // Show notification banner
  const showNotificationBanner = (title: string, body: string, data: NotificationData) => {
    setNotification({ title, body, data });
    
    // Slide down
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Auto-hide after 4 seconds
    setTimeout(() => {
      hideNotificationBanner();
    }, 4000);
  };

  const hideNotificationBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setNotification(null);
    });
  };

  const handleBannerTap = () => {
    if (notification?.data) {
      hideNotificationBanner();
    }
  };

  // Initialize notifications on app mount
  useEffect(() => {
    // Setup Android notification channel
    setupAndroidNotificationChannel();

    // Initialize all FCM and Expo notification handlers
    const cleanup = initializeNotificationHandlers(router, showNotificationBanner);

    return cleanup;
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <AuthProvider>
            <SpotifyProvider>
              <VoiceProvider>
              {/* Notification Banner */}
              {notification && (
                <Animated.View
                  style={[
                    notificationStyles.banner,
                    {
                      transform: [{ translateY: slideAnim }],
                    },
                  ]}
                >
                  <Pressable
                    onPress={handleBannerTap}
                    style={notificationStyles.bannerContent}
                  >
                    <View style={notificationStyles.textContainer}>
                      <Text style={notificationStyles.title} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      <Text style={notificationStyles.body} numberOfLines={2}>
                        {notification.body}
                      </Text>
                    </View>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        hideNotificationBanner();
                      }}
                      style={notificationStyles.closeButton}
                    >
                      <Text style={notificationStyles.closeText}>✕</Text>
                    </Pressable>
                  </Pressable>
                </Animated.View>
              )}
              
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
              <GlobalNotificationPanel />
              <GlobalVoiceBar />
              <StatusBar style="auto" />
            </VoiceProvider>
            </SpotifyProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const notificationStyles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 10,
  },
  bannerContent: {
    backgroundColor: '#1e293b',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginTop: -4,
  },
  closeText: {
    fontSize: 20,
    color: '#94a3b8',
    fontWeight: '400',
  },
});