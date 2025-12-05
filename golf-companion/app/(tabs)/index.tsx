//HOME PAGE


// app/(tabs)/index.tsx

// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import RotatingText from '@/components/RotatingText';
import { ThemedText } from '@/components/ThemedText';
import { TextInput } from "react-native";
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/components/ThemeContext';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import { getAppVersion } from '@/utils/version';
import { registerForPushNotificationsAsync } from '@/lib/PushNotifications';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from '@/lib/supabaseClient';

// ------------------- HOME SCREEN LOGIC -------------------------
export default function HomeScreen() {
  const { user, loading } = useAuth();
  const { palette } = useTheme();
  const { displayVersion } = getAppVersion(); // Add this line
  const insets = useSafeAreaInsets();
  const [targetUserId, setTargetUserId] = useState("");
  const [friends, setFriends] = useState<any[]>([]);

  useEffect(() => {
    const loadFriends = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from("friends")
        .select(`friend_id, profiles:profiles!friends_friend_id_profiles_fkey(id, full_name)`)
        .eq("user_id", user.id);

      if (error) {
        console.error("❌ Error loading friends for notification test:", error);
        return;
      }

      setFriends(data || []);
    };

    loadFriends();
  }, [user]);

 const testNotification = async () => {
  if (!user) {
    Toast.show({
      type: 'error',
      text1: 'Not logged in',
      text2: 'Please log in first'
    });
    return;
  }

  try {
    console.log("🧪 Testing notification for user:", user.id);
    
    const { data, error } = await supabase.functions.invoke("pushNotification", {
      body: {
        userId: user.id,
        title: "🧪 Test Notification",
        body: "If you see this, push notifications are working!",
        data: { test: "true", route: "index" },
      },
    });
    
    if (error) {
      console.error("❌ Test notification failed:", error);
      Toast.show({
        type: 'error',
        text1: 'Test failed',
        text2: error.message
      });
    } else {
      console.log("✅ Test notification sent:", data);
      Toast.show({
        type: 'success',
        text1: '✅ Test sent!',
        text2: 'Check for notification in a few seconds'
      });
    }
  } catch (e: any) {
    console.error("❌ Exception:", e);
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: e.message || 'Unknown error'
    });
  }
};

const sendNotificationToOtherUser = async () => {
  if (!targetUserId.trim()) {
    Toast.show({
      type: "error",
      text1: "Missing target user",
      text2: "Paste a user ID to send to",
    });
    return;
  }

  try {
    console.log("📤 Sending cross-device test to:", targetUserId);

    const { data, error } = await supabase.functions.invoke("pushNotification", {
      body: {
        userId: targetUserId.trim(),
        title: "📱 Cross-device test",
        body: "This notification was sent from another device.",
        data: { test: "cross-device", route: "index" },
      },
    });

    if (error) {
      console.error("❌ Cross-device test failed:", error);
      Toast.show({
        type: "error",
        text1: "Send failed",
        text2: error.message,
      });
    } else {
      console.log("✅ Cross-device notification sent:", data);
      Toast.show({
        type: "success",
        text1: "✅ Sent to other device",
        text2: "Check that device for a notification",
      });
    }
  } catch (e: any) {
    console.error("❌ Exception sending cross-device test:", e);
    Toast.show({
      type: "error",
      text1: "Error",
      text2: e.message || "Unknown error",
    });
  }
};

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
                  source={require('@/assets/images/MullyLogo.png')}
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
                source={require('@/assets/images/MullyLogo.png')}
                style={styles(palette).logo}
                contentFit="contain"
              />
            </View>
            <View style={styles(palette).divider} />
            {/*
            <View style={styles(palette).rotatingTextContainer}>
              <ThemedText style={[styles(palette).text]} type="title">Golf</ThemedText>
              <RotatingText
                texts={['Companion', 'Banter', 'Scores', 'Games', 'Beers!']}
                rotationInterval={2000}
              />
            </View>
            */}
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

              <View style={styles(palette).divider} />
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
        <ThemedText type="subtitle" style={styles(palette).authTitle}>Feed</ThemedText>

        {user && (
          <View style={styles(palette).authContainer}>
            {/* Existing self-test button */}
            <Pressable
              style={({ pressed }) => [
                styles(palette).authButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={testNotification}
            >
              <ThemedText style={styles(palette).authButtonText}>
                🧪 Test Push Notification
              </ThemedText>
            </Pressable>

            {/* New cross-device test controls */}
            <View style={{ marginTop: 16, width: "100%", alignItems: "center" }}>
              <ThemedText style={{ color: palette.textLight, marginBottom: 8 }}>
                Send to one of your friends:
              </ThemedText>

              <ScrollView
                style={{ maxHeight: 120, width: "100%" }}
                contentContainerStyle={{ alignItems: "stretch" }}
              >
                {friends.length === 0 ? (
                  <ThemedText style={{ color: palette.textLight }}>
                    No friends found. Add a friend to test cross-device notifications.
                  </ThemedText>
                ) : (
                  friends.map((f) => {
                    const friendProfile = f.profiles?.[0] ?? f.profiles;
                    const name = friendProfile?.full_name || f.friend_id;
                    const isSelected = targetUserId === friendProfile?.id;
                    return (
                      <Pressable
                        key={friendProfile?.id || f.friend_id}
                        onPress={() => setTargetUserId(friendProfile?.id || f.friend_id)}
                        style={({ pressed }) => [
                          {
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 8,
                            marginBottom: 8,
                            borderWidth: isSelected ? 2 : 1,
                            borderColor: isSelected ? palette.primary : palette.textLight,
                            backgroundColor: pressed ? palette.secondary : palette.background,
                          },
                        ]}
                      >
                        <ThemedText style={{ color: palette.textDark }}>
                          {name}
                        </ThemedText>
                        <ThemedText style={{ color: palette.textLight, fontSize: 12 }}>
                          {friendProfile?.id}
                        </ThemedText>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>

              {friends.length > 0 && (
                <Pressable
                  style={({ pressed }) => [
                    styles(palette).authButton,
                    { width: "100%", marginTop: 8, alignItems: "center" },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={sendNotificationToOtherUser}
                >
                  <ThemedText style={styles(palette).authButtonText}>
                    📤 Send to Selected Friend
                  </ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        )}

        
        {/* Feature Cards */}
        {/*
        <ThemedView style={styles(palette).featureCard}>
          <ThemedText type="subtitle" style={styles(palette).featureTitle}>{featureCards[currentCardIndex].title}</ThemedText>
          <ThemedText style={styles(palette).featureText}>
            {featureCards[currentCardIndex].description}
          </ThemedText>
        </ThemedView>
        */}
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
    backgroundColor: palette.background,
    //flexDirection: 'row',
    alignItems: 'center',
    //justifyContent: 'center',
    //paddingLeft: 80,
    paddingHorizontal: 16,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    paddingTop: 0,
    paddingLeft: 0,
  },
  // titleContainer: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   marginVertical: 5,
  //   gap:8,
  //   backgroundColor: palette.main,
  // },
  // stepContainer: {
  //   marginTop:0,
  //   gap: 8,
  //   marginBottom: 8,
    
    
  // },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 0,
    height:100,
    
  },
  logo: {
    width: 300,
    height: 300,
    //justifyContent: 'center',

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
    color: palette.textLight,
  },
  featureTitle: {
    color: palette.textLight, 
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
    color: palette.textLight,
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
    //paddingHorizontal: 32,
    elevation: 8,
    //shadowColor: palette.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    transform: [{ scale: 1 }],
    transitionDuration: '200ms',
    width: '100%'
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
    color: palette.textLight,
  },
  welcomeText: {
    textAlign: 'center',
    fontSize: 14,
    color: palette.textLight,
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
  divider: {
  width: '90%',
  height: 1,
  backgroundColor: palette.textLight,
  alignSelf: 'center',
  marginTop: 10,
},
});