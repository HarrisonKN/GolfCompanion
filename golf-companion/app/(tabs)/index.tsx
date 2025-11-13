//HOME PAGE


// app/(tabs)/index.tsx

// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import RotatingText from '@/components/RotatingText';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/components/ThemeContext';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { getAppVersion } from '@/utils/version';
import { registerForPushNotificationsAsync } from '@/lib/PushNotifications';
import * as Notifications from 'expo-notifications';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from '@/lib/supabaseClient';

// ------------------- HOME SCREEN LOGIC -------------------------
export default function HomeScreen() {
  const { user, loading } = useAuth();
  const { palette } = useTheme();
  const { displayVersion } = getAppVersion(); // Add this line
  const insets = useSafeAreaInsets();

 

//----------------------------------------------------------------
// Adding to make it so there is only 1 feature card at a time on the home screen
  const featureCards = [
    { title: '🏌️‍♂️ Your Ultimate Golf Companion',
      description: 'Connect with friends, track scores, and make your golf rounds more fun, social and smart ',
    },
    {
      title: '📋 Digital Scorecard',
      description: `Track every stroke with our intuitive Scorecard screen. Add players, input scores, and get instant feedback on your game.`,
    },
    {
      title: '🗺️ Course View',
      description: `Visualize each hole with satellite course maps, layouts, and AI-powered club suggestions based on distance and your play style.`,
    },
    {
      title: '🎙️ Group Voice Chat',
      description: `Form a party with your friends and stay connected through real-time voice chat even when you're on different holes.`,
    },
    {
      title: '🎵 Sync Music with Spotify',
      description: `Start a shared Spotify session so your group can listen to the same music together.`,
    },
    {
      title: '📊 Stats and Analytics',
      description: `Get detailed insights into your game with stats on strokes, putts, fairways hit, and more.`,
    },
    {
      title: '🏆 Achievements and Leaderboards',
      description: `Compete with friends and track your progress with achievements and leaderboards.`,
    },    
  ];
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
   useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCardIndex((prev) => (prev + 1) % featureCards.length);
    }, 5000); // rotate every 5 seconds

    return () => clearInterval(interval); // cleanup on unmount
  }, []);

//------------------------------------------------------------------------------

  // Show loading state while checking auth
  if (loading) {
    return (
      <ThemedView style={[styles(palette).container]}>
        <ParallaxScrollView
          style={styles(palette).scrollRoot}
          contentContainerStyle={styles(palette).scrollContent}
          headerBackgroundColor={{ light: palette.background, dark: palette.background }}
          headerImage={
            <ThemedView style={[styles(palette).headerRow, { paddingTop: insets.top }]}>
              <View style={styles(palette).logoContainer}>
                <Image
                  source={require('@/assets/images/golf-logo.png')}
                  style={styles(palette).logo}
                  contentFit="contain"
                />
              </View>
              <View style={styles(palette).rotatingTextContainer}>
                <ThemedText style={[styles(palette).text]} type="title">Golf</ThemedText>
                <RotatingText
                  texts={['Companion', 'Banter', 'Scores', 'Games', 'Beers!']}
                  rotationInterval={2000}
                />
              </View>
            </ThemedView>
          }
        >
          <ThemedView style={styles(palette).authContainer}>
            <ThemedText type="subtitle" style={styles(palette).authTitle}>Loading...</ThemedText>
          </ThemedView>
        </ParallaxScrollView>
      </ThemedView>
    );
  }

  // ------------------- UI Setup -------------------------
  return (
    <ThemedView style={[styles(palette).container]}>
      <ParallaxScrollView
        style={styles(palette).scrollRoot}
        contentContainerStyle={styles(palette).scrollContent}
        headerBackgroundColor={{ light: palette.background, dark: palette.background }}
        headerImage={
          <ThemedView style={[styles(palette).headerRow, { paddingTop: insets.top }]}>
            <View style={styles(palette).logoContainer}>
              <Image
                source={require('@/assets/images/golf-logo.png')}
                style={styles(palette).logo}
                contentFit="contain"
              />
            </View>
            <View style={styles(palette).rotatingTextContainer}>
              <ThemedText style={[styles(palette).text]} type="title">Golf</ThemedText>
              <RotatingText
                texts={['Companion', 'Banter', 'Scores', 'Games', 'Beers!']}
                rotationInterval={2000}
              />
            </View>
          </ThemedView>
        }
      >
        {/* Conditional Auth/Welcome Section */}
        <ThemedView style={styles(palette).authContainer}>
          {user ? (
            <>
              <ThemedText type="subtitle" style={styles(palette).authTitle}>Welcome Back!</ThemedText>
              <ThemedText style={styles(palette).welcomeText}>
                Ready for another round? Check out your scores and course views.
              </ThemedText>

              <Pressable
                style={({ pressed }) => [
                  styles(palette).startGameButton,
                  pressed && styles(palette).startGameButtonPressed,
                ]}
                onPress={() => {
                  // Animate button press, then navigate
                  router.push('../startGame');
                }}
              >
                <ThemedText style={styles(palette).startGameButtonText}>
                  Press to Start a Game
                </ThemedText>
              </Pressable>

              <Pressable
                style={styles(palette).authButton}
                onPress={() => router.push('/course-view')}
              >
                <ThemedText style={styles(palette).authButtonText}>Go to Course View</ThemedText>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles(palette).startGameButton,
                  pressed && styles(palette).startGameButtonPressed,
                ]}
                onPress={async () => {
                  try {
                    const tokenResponse = await Notifications.getDevicePushTokenAsync();
                    //const fcmToken = tokenResponse.data;
                    const fcmToken = tokenResponse.data + "_" + Math.floor(Math.random() * 1000);
                    console.log('✅ FCM Token:', fcmToken);

                    const supabaseUser = user?.id;
                    console.log("👤 Supabase user:", supabaseUser);
                    if (!fcmToken || !supabaseUser) throw new Error("Missing token or user ID");

                    // 🔧 Ensure Supabase client knows about the current session before querying
                    if (user?.access_token && user?.refresh_token) {
                      console.log("🔄 Forcing Supabase session sync before update");
                      await supabase.auth.setSession({
                        access_token: user.access_token,
                        refresh_token: user.refresh_token,
                      });
                    }

                    // 🔄 Forcing Supabase client to re-sync after login
                    console.log("🔄 Forcing Supabase client to re-sync after login");
                    await supabase.auth.refreshSession();

                    const {
                      data: { session },
                    } = await supabase.auth.getSession();
                    console.log("🧠 Auth UID from Supabase:", session?.user?.id);

                    const { data, error } = await supabase
                      .from("profiles")
                      .update({ fcm_token: fcmToken })
                      .eq("id", supabaseUser)
                      .select();

                    if (error) {
                      console.error("❌ Supabase error:", error.message, error.details, error.hint);
                      Toast.show({
                        type: 'error',
                        text1: 'Error saving token',
                        text2: error.message,
                      });
                    } else {
                      console.log("✅ Supabase update success:", data);
                      Toast.show({
                        type: 'success',
                        text1: 'Push token saved!',
                        text2: fcmToken,
                      });

                      // 🔔 Send push notifications to all friends
                      const { data: friends, error: friendsError } = await supabase
                        .from("friends")
                        .select(`
                          friend_id,
                          profiles:profiles!friends_friend_id_profiles_fkey(id, full_name, fcm_token)
                        `)
                        .eq("user_id", supabaseUser);
                      console.log("👥 Friends found:", friends);

                      if (friendsError) {
                        console.error("❌ Error fetching friends:", friendsError);
                        Toast.show({
                          type: 'error',
                          text1: 'Failed to fetch friends',
                          text2: friendsError.message,
                        });
                      } else if (friends && friends.length > 0) {
                        for (const friend of friends) {
                          const friendToken = friend.profiles?.[0]?.fcm_token;
                          console.log(`🔔 Sending to ${friend.profiles?.[0]?.full_name} (${friend.friend_id})`);
                          if (!friendToken) continue;
                          const { error: notifError } = await supabase.functions.invoke("pushNotification", {
                            body: {
                              token: friendToken,
                              title: "Golf Invite 🏌️‍♂️",
                              body: "Your friend just invited you for a round!",
                            },
                          });
                          if (notifError) {
                            console.error("❌ Push error:", notifError);
                          } else {
                            console.log(`✅ Push sent to ${friend.profiles?.[0]?.full_name} (${friendToken})`);
                          }
                        }
                        Toast.show({
                          type: 'success',
                          text1: 'Push notifications sent to all friends!',
                        });
                      } else {
                        Toast.show({
                          type: 'info',
                          text1: 'No friends found to send notifications',
                        });
                      }
                      // --- end friends notification block ---
                    }
                  } catch (err: any) {
                    Toast.show({
                      type: 'error',
                      text1: 'Error saving token, do something different bozo',
                      text2: err.message,
                    });
                    console.log(err.message)
                  }
                }}
              >
                <ThemedText style={styles(palette).startGameButtonText}>
                  Test Push Notifications
                </ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles(palette).authTitle}>Get Started</ThemedText>
              <ThemedView style={styles(palette).buttonRow}>
                <Pressable
                  style={styles(palette).authButton}
                  onPress={() => router.push('/login')}
                >
                  <ThemedText style={styles(palette).authButtonText}>Login</ThemedText>
                </Pressable>
                <Pressable
                  style={styles(palette).authButton}
                  onPress={() => router.push('/signup')}
                >
                  <ThemedText style={styles(palette).authButtonText}>Sign Up</ThemedText>
                </Pressable>
              </ThemedView>
            </>
          )}
        </ThemedView>

        {/* Feature Cards */}
        <ThemedView style={styles(palette).featureCard}>
          <ThemedText type="subtitle" style={styles(palette).featureTitle}>{featureCards[currentCardIndex].title}</ThemedText>
          <ThemedText style={styles(palette).featureText}>
            {featureCards[currentCardIndex].description}
          </ThemedText>
        </ThemedView>
        
        {/* Add version display at the bottom */}
        <ThemedView style={styles(palette).versionContainer}>
          <ThemedText style={styles(palette).versionText}>
            Golf Companion {displayVersion}
          </ThemedText>
        </ThemedView>
      </ParallaxScrollView>  
      <Toast/>
    </ThemedView>
  );
}

// ------------------- UI Styling -------------------------
// Add this type definition above your styles function or import it from your theme context if already defined
type PaletteType = {
  background: string;
  primary: string;
  secondary: string;
  third: string;
  black: string;
  white: string;
  textDark: string;
  textLight: string;
  main: string;
};
const styles = (palette: PaletteType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollRoot: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: palette.background,
    paddingBottom: 20,
  },
  headerRow: {
    backgroundColor: palette.main,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 80,
    paddingTop: 10,
    paddingHorizontal: 16,
    flex: 1, // Add this to ensure it fills the header space
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
    gap:8,
    
  },
  stepContainer: {
    marginTop:0,
    gap: 8,
    marginBottom: 8,
    
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
  logoContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logo: {
    width: 120,
    height: 120,
  },
  golfTextContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    width: 60,
    marginRight: 8,
    
  },
  rotatingTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
    minWidth: 60,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginVertical: 10,
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  featureCard: {
    backgroundColor: palette.secondary,
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    height: 140,
  },
  featureText:{
    fontSize: 14,
    textAlign: 'center',
    color: palette.textDark,
  },
  featureTitle: {
    color: palette.textDark, 
    fontWeight: 'bold',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 4,
  },
  authContainer: {
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: palette.background,
  },
  authTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    color: palette.textDark,
  },
  buttonRow: {
    backgroundColor: palette.background,
    flexDirection: 'row',
    gap: 16,
  },
  authButton: {
    backgroundColor: palette.third,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    elevation: 3,
  },
  startGameButton: {
    backgroundColor: palette.primary,
    borderRadius: 12,
    marginVertical: 20,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    transform: [{ scale: 1 }],
    transitionDuration: '200ms',
  },
  startGameButtonPressed: {
    backgroundColor: palette.third,
    elevation: 2,
    shadowOpacity: 0.1,
    transform: [{ scale: 0.96 }],
  },
  startGameButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 18,
    textShadowColor: '#222',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 4,
  },
  authButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  text: {
    color: palette.secondary,
  },
  welcomeText: {
    textAlign: 'center',
    fontSize: 14,
    color: palette.textDark,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    backgroundColor: palette.background,
    paddingBottom: 20,
  },
  versionContainer: {
    alignItems: 'center',
    position: 'relative',
    paddingVertical: 20,
    marginTop: 20,
    backgroundColor: "transparent",
    
  },
  versionText: {
    fontSize: 12,
    color: palette.textLight,
    fontWeight: '500',
    opacity: 0.7,
  },
});