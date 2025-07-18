import { COLORS } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const features = [
  {
    title: "📋 Digital Scorecard",
    description: "Track every stroke with our intuitive Scorecard. Add players, input scores, and get feedback.",
  },
  {
    title: "🗺️ Course View",
    description: "Visualize each hole with satellite maps and AI-powered club suggestions.",
  },
  {
    title: "🎙️ Group Voice Chat",
    description: "Form a party and stay connected through real-time voice chat.",
  },
  {
    title: "🎵 Sync Music with Spotify",
    description: "Start a shared Spotify session and vibe together.",
  },
];

export default function RotatingFeatureCard() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const feature = features[index];

  return (
    <View style={styles.container}>
      <Animated.View
        key={index}
        entering={FadeIn.duration(500)}
        exiting={FadeOut.duration(500)}
        style={styles.card}
      >
        <Text style={styles.title}>{feature.title}</Text>
        <Text style={styles.description}>{feature.description}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: COLORS.secondary,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#f2f2f2',
  },
});
