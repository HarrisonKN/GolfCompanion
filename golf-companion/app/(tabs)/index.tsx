//HOME PAGE


// app/(tabs)/index.tsx

import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

// Import your components
import ParallaxScrollView from '@/components/ParallaxScrollView';
import RotatingText from '@/components/RotatingText';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

export default function HomeScreen() {
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/golf-logo.png')}
          style={{ width: 250, height: 275 }}
          contentFit="contain"
        />
        
      }
    >
      {/* RotatingText header */}
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title">Golf</ThemedText>
        <RotatingText
          texts={['Companion', 'Banter', 'Scores', 'Games', 'Beers!']}
          rotationInterval={2000}
        />
      </ThemedView>

      {/* Step 1 */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Select Scorecard Screen to Begin tracking your scores!</ThemedText>
        </ThemedView>
      
      {/* Step 2 */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Feature 2: On Course DISCORD</ThemedText>
        <ThemedText>
          {`Make a party with your friends and talk to each other when split apart on the course `}
        </ThemedText>
      </ThemedView>

      {/* Step 3 */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Feature 3: Spotify</ThemedText>
        <ThemedText>
          {`Join a Spotify session with your friends and listen to music together while you play!`}
        </ThemedText>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    gap:8,
  },
  stepContainer: {
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
});
