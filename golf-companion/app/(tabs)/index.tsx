//HOME PAGE


// app/(tabs)/index.tsx

// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import RotatingText from '@/components/RotatingText';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { COLORS } from "@/constants/theme"; //Importing Color themes for consistency
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';

// ------------------- HOME SCREEN LOGIC -------------------------
export default function HomeScreen() {
  const { user, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={
          <ThemedView style={styles.headerRow}>
            <Image
              source={require('@/assets/images/golf-logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <ThemedView style={styles.rotatingTextContainer}>
              <ThemedText style={[styles.text]} type="title">Golf</ThemedText>
              <RotatingText
                texts={['Companion', 'Banter', 'Scores', 'Games', 'Beers!']}
                rotationInterval={2000}
              />
            </ThemedView>
          </ThemedView>
        }
      >
        <ThemedView style={styles.authContainer}>
          <ThemedText type="subtitle" style={styles.authTitle}>Loading...</ThemedText>
        </ThemedView>
      </ParallaxScrollView>
    );
  }

  // ------------------- UI Setup -------------------------
  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: COLORS.background, dark: COLORS.primary }}
        headerImage={
          <ThemedView style={styles.headerRow}>
            <Image
              source={require('@/assets/images/golf-logo.png')}
              style={styles.logo}
              contentFit="contain"
            />
            <ThemedView style={styles.rotatingTextContainer}>
              <ThemedText style={[styles.text]} type="title">Golf</ThemedText>
              <RotatingText
                texts={['Companion', 'Banter', 'Scores', 'Games', 'Beers!']}
                rotationInterval={2000}
              />
            </ThemedView>
          </ThemedView>
        }
      >
        {/* Conditional Auth/Welcome Section */}
        <ThemedView style={styles.authContainer}>
          {user ? (
            <>
              <ThemedText type="subtitle" style={styles.authTitle}>Welcome Back!</ThemedText>
              <ThemedText style={styles.welcomeText}>
                Ready for another round? Check out your scores and course views.
              </ThemedText>
              {/* Example: Add a button for logged-in users */}
              <Pressable
                style={styles.authButton}
                onPress={() => router.push('/course-view')}
              >
                <ThemedText style={styles.authButtonText}>Go to Course View</ThemedText>
              </Pressable>
            </>
          ) : (
            <>
              <ThemedText type="subtitle" style={styles.authTitle}>Get Started</ThemedText>
              <ThemedView style={styles.buttonRow}>
                <Pressable
                  style={styles.authButton}
                  onPress={() => router.push('/login')}
                >
                  <ThemedText style={styles.authButtonText}>Login</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.authButton}
                  onPress={() => router.push('/signup')}
                >
                  <ThemedText style={styles.authButtonText}>Sign Up</ThemedText>
                </Pressable>
              </ThemedView>
            </>
          )}
        </ThemedView>

        {/* App Overview */}
        <ThemedView style={styles.sectionContainer}>
          <ThemedText type="subtitle" style={styles.featureTitle}>🏌️‍♂️ Your Ultimate Golf Companion</ThemedText>
          <ThemedText style={styles.featureText}>
            {`Connect with friends, track scores, and make your golf rounds more fun, social, and smart.`}
          </ThemedText>
        </ThemedView>

        {/* Rest of your feature cards remain the same */}
        <ThemedView style={styles.featureCard}>
          <ThemedText type="subtitle" style={styles.featureTitle}>📋 Digital Scorecard</ThemedText>
          <ThemedText style={styles.featureText}>
            {`Track every stroke with our intuitive Scorecard screen. Add players, input scores, and get instant feedback on your game.`}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.featureCard}>
          <ThemedText type="subtitle" style={styles.featureTitle}>🗺️ Course View</ThemedText>
          <ThemedText style={styles.featureText}>
            {`Visualize each hole with satellite course maps, layouts, and AI-powered club suggestions based on distance and your play style.`}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.featureCard}>
          <ThemedText type="subtitle" style={styles.featureTitle}>🎙️ Group Voice Chat</ThemedText>
          <ThemedText style={styles.featureText}>
            {`Form a party with your friends and stay connected through real-time voice chat even when you're on different holes.`}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.featureCard}>
          <ThemedText type="subtitle" style={styles.featureTitle}>🎵 Sync Music with Spotify</ThemedText>
          <ThemedText style={styles.featureText}>
            {`Start a shared Spotify session so your group can listen to the same music together.`}
          </ThemedText>
        </ThemedView>

      </ParallaxScrollView>  
      <Toast/>
    </>
  );
}

// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10, //This changed the height of the header, smaller value = smaller header height
    //leaves a gap between header and login buttons
    backgroundColor: COLORS.third,// use this value for same colour as app #1c3d46
  },
  logo: {
    width: 120,
    height: 120,
    marginRight: 16,
  },
  rotatingTextContainer: {
    flexShrink: 1,
    justifyContent: 'center',
    backgroundColor: "transparent",
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginVertical: 10,
    alignItems: 'center',
    backgroundColor:COLORS.background,
  },
  
  featureCard: {
    backgroundColor: COLORS.secondary,
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  featureText:{
    fontSize: 14,
    textAlign: 'center',
    color: COLORS.textDark,
  },
  //added to change the headings of the feature cards
  featureTitle: {
  color: COLORS.textDark, 
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
    backgroundColor: COLORS.background,
  },
  
  authTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    color: COLORS.textDark,
  },
  
  buttonRow: {
    flexDirection: 'row',
    gap: 16,
  },
  
  /*authButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: COLORS.primary,
  },
  
  authButtonText: {
    color: COLORS.textDark,
    fontWeight: '600',
    fontSize: 16,
    backgroundColor: COLORS.primary,
  },*/
  authButton: {
  backgroundColor: COLORS.third,
  paddingVertical: 12,
  paddingHorizontal: 24,
  borderRadius: 8,
  elevation: 3,
},
authButtonText: {
  color: COLORS.white,
  fontWeight: '700',
  fontSize: 16,
  letterSpacing: 0.5,
},
  text: {
    color: COLORS.secondary,
  
  },
  welcomeText: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textDark,
  },
});
