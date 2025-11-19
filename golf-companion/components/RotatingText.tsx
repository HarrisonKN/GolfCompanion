// components/RotatingText.tsx
import { COLORS } from "@/constants/theme"; //Importing Color themes for consistency
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "@/components/ThemeContext";

interface RotatingTextProps {
  texts: string[];
  rotationInterval?: number;
}

export default function RotatingText({
  texts,
  rotationInterval = 2000,
}: RotatingTextProps) {
  const { palette } = useTheme();
  const [index, setIndex] = useState(0);
  const translateY = useRef(new Animated.Value(30)).current;

  const animateIn = () => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 30,
      stiffness: 400,
    }).start();
  };

  useEffect(() => {
    animateIn();

    const interval = setInterval(() => {
      Animated.timing(translateY, {
        toValue: -30,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % texts.length);
        translateY.setValue(10);
        animateIn();
      });
    }, rotationInterval);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: palette.primary }]}>
      <Animated.Text style={[styles.text, { transform: [{ translateY }] }]}>
        {texts[index]}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
    borderRadius: 8,
  },
  text: {
    fontSize: 24,
    color: "white",
    backgroundColor: "transparent",
  },
});
