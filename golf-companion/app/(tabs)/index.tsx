//HOME PAGE


// app/(tabs)/index.tsx

// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/components/ThemeContext';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { getAppVersion } from '@/utils/version';
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ------------------- HOME SCREEN LOGIC -------------------------
export default function HomeScreen() {
  const { user } = useAuth();
  const { palette } = useTheme();
  const { displayVersion } = getAppVersion();
  const insets = useSafeAreaInsets();

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

        {/* Future feed content will go here */}
        <ThemedView style={styles(palette).authContainer}>
          <ThemedText style={styles(palette).welcomeText}>
            Stay tuned for activity updates from your golf community!
          </ThemedText>
        </ThemedView>

        
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