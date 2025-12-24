// ⚠️ CRITICAL: Import background message handler FIRST before anything else
// This sets up FCM to handle notifications when app is closed/minimized
import "@/lib/BackgroundMessageHandler";

// Initialize Firebase (including Analytics) early
import "@/lib/firebase";

import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { View, Text, Pressable, StyleSheet, Animated, Modal } from 'react-native';
import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';

import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';

import { AuthProvider } from "@/components/AuthContext";
import { ThemeProvider } from "@/components/ThemeContext";
import { VoiceProvider } from '@/components/VoiceContext';
import { SpotifyProvider } from '@/components/SpotifyContext';
import { GlobalVoiceBar } from '@/components/GlobalVoiceBar';
import { GlobalNotificationPanel } from '@/components/GlobalNotificationPanel';
import { initializeNotificationHandlers, setupAndroidNotificationChannel, handleNotificationNavigation, navigateWithRetry, NotificationData } from "@/lib/NotificationService";

function BootRoundResume() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeRound, setActiveRound] = useState<any | null>(null);
  const [showResumeModal, setShowResumeModal] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    console.log('🔍 [BOOT] Looking for active rounds in golf_rounds for user:', user.id);

    const checkActiveRound = async () => {
      console.log('📡 [BOOT] Querying golf_rounds table for active round...');
      const { data, error } = await supabase
        .from('golf_rounds')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('⚠️ [BOOT] Error querying golf_rounds:', error);
        return;
      }

      if (!data) {
        console.log('✅ [BOOT] No active rounds found');
        return;
      }

      if (data.status !== 'active') {
        console.log('ℹ️ [BOOT] Round found but not active, ignoring:', {
          round_id: data.id,
          status: data.status,
        });
        return;
      }

      console.log('🎯 [BOOT] Active round found:', {
        round_id: data.id,
        course: data.course_name,
        current_hole: data.current_hole,
      });

      setActiveRound(data);
      setShowResumeModal(true);
    };

    checkActiveRound();
  }, [user?.id]);

  const handleContinueRound = () => {
    if (!activeRound) return;
    setShowResumeModal(false);

    router.replace({
      // scorecard lives under app/(tabs)/scorecard.tsx
      pathname: '/(tabs)/scorecard',
      params: {
        // 🔑 IMPORTANT: Scorecard expects gameId for multiplayer hydration
        gameId: activeRound.id,
        // keep roundId for any legacy code paths that still reference it
        roundId: activeRound.id,
        courseId: activeRound.course_id ?? undefined,
        // expo-router params are strings
        hole: String(activeRound.current_hole ?? 1),
        newGame: '0',
      },
    });
  };

  const handleAbandonRound = async () => {
    if (!activeRound) return;

    await supabase
      .from('golf_rounds')
      .update({ status: 'abandoned' })
      .eq('id', activeRound.id);

    setActiveRound(null);
    setShowResumeModal(false);
  };

  return (
    <Modal visible={showResumeModal} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#0f172a', padding: 20, borderRadius: 12, width: '85%' }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
            Resume round?
          </Text>
          <Text style={{ color: '#cbd5e1', marginBottom: 20 }}>
            You have an active round at {activeRound?.course_name}.
          </Text>

          <Pressable
            onPress={handleContinueRound}
            style={{ backgroundColor: '#22c55e', padding: 12, borderRadius: 8, marginBottom: 10 }}
          >
            <Text style={{ color: '#000', fontWeight: '700', textAlign: 'center' }}>
              Continue Round
            </Text>
          </Pressable>

          <Pressable
            onPress={handleAbandonRound}
            style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
              Abandon Round
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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

  // Check for initial notification when app is cold-started from notification tap
  useEffect(() => {
    const checkInitialNotification = async () => {
      console.log('🚀 Checking for initial notification on cold start...');
      
      try {
        const remoteMessage = await messaging().getInitialNotification();
        
        if (remoteMessage && remoteMessage.data) {
          console.log('🎯 Found initial notification on cold start:', remoteMessage.data);
          
          // Give router multiple attempts to be ready, with increasing delays
          for (let i = 0; i < 3; i++) {
            await new Promise(resolve => setTimeout(resolve, 500 + i * 300));
            try {
              handleNotificationNavigation(router, remoteMessage.data as NotificationData);
              console.log('✅ Navigation from cold start notification successful');
              break;
            } catch (navErr) {
              console.warn(`⚠️ Navigation attempt ${i + 1} failed:`, navErr);
              if (i === 2) {
                console.error('❌ All navigation attempts failed');
              }
            }
          }
        } else {
          console.log('ℹ️ No initial notification on cold start');
        }
      } catch (err) {
        console.error('❌ Error checking initial notification:', err);
      }
    };
    
    checkInitialNotification();
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <ThemeProvider>
          <AuthProvider>
            <BootRoundResume />
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