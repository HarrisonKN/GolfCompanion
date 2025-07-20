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
import { Pressable, StyleSheet, View } from 'react-native';
import Toast from 'react-native-toast-message';


// ------------------- HOME SCREEN LOGIC -------------------------
export default function HomeScreen() {
  const { user, loading } = useAuth();
  const { palette } = useTheme();
//----------------------------------------------------------------
// Adding to make it so there is only 1 feature card at a time on the home screen
  const featureCards = [
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
          style={{ flex: 1 }}
          headerBackgroundColor={{ light: palette.background, dark: palette.primary }}
          headerImage={
            <ThemedView style={styles(palette).headerRow}>
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
          contentContainerStyle={styles(palette).contentContainer}
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
        headerBackgroundColor={{ light: palette.background, dark: palette.primary }}
        headerImage={
          <ThemedView style={styles(palette).headerRow}>
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
        contentContainerStyle={styles(palette).contentContainer}
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
                style={styles(palette).authButton}
                onPress={() => router.push('/course-view')}
              >
                <ThemedText style={styles(palette).authButtonText}>Go to Course View</ThemedText>
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

        {/* App Overview */}
        <ThemedView style={styles(palette).sectionContainer}>
          <ThemedText type="subtitle" style={styles(palette).featureTitle}>🏌️‍♂️ Your Ultimate Golf Companion</ThemedText>
          <ThemedText style={styles(palette).featureText}>
            {`Connect with friends, track scores, and make your golf rounds more fun, social, and smart.`}
          </ThemedText>
        </ThemedView>

        {/* Rest of your feature cards remain the same */}
        <ThemedView style={styles(palette).featureCard}>
          <ThemedText type="subtitle" style={styles(palette).featureTitle}>{featureCards[currentCardIndex].title}</ThemedText>
          <ThemedText style={styles(palette).featureText}>
            {featureCards[currentCardIndex].description}
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
};
const styles = (palette: PaletteType) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background, // full-page background
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
  headerRow: {
    backgroundColor: palette.third,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 80,
    paddingTop: 10,
    paddingHorizontal: 16,
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
});
