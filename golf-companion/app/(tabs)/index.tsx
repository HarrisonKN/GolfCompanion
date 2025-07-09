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
        <ThemedText type="subtitle">Step 2: Explore</ThemedText>
        <ThemedText>
          {`Tap the Explore tab to learn more about what's included in this starter app.`}
        </ThemedText>
      </ThemedView>

      {/* Step 3 */}
      <ThemedView style={styles.stepContainer}>
        <ThemedText type="subtitle">Step 3: Get a fresh start</ThemedText>
        <ThemedText>
          {`When you're ready, run `}
          <ThemedText type="defaultSemiBold">npm run reset-project</ThemedText>{' '}
          to get a fresh{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> directory.
          This will move the current{' '}
          <ThemedText type="defaultSemiBold">app</ThemedText> to{' '}
          <ThemedText type="defaultSemiBold">app-example</ThemedText>.
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
