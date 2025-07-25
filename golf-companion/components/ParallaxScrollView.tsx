import { useState, type PropsWithChildren, type ReactElement } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
} from 'react-native-reanimated';

import { ThemedView } from '@/components/ThemedView';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import { Colors } from "@/constants/Colors";
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/components/ThemeContext';


type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
   contentContainerStyle?: StyleProp<ViewStyle>;
   style?: ViewStyle;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  contentContainerStyle,
  style,
}: Props) {

  
  const { palette } = useTheme();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const bottom = useBottomTabOverflow();

  const [headerHeight, setHeaderHeight] = useState(200)
  const headerHeightShared = useSharedValue(200);

  const onHeaderLayout = (event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    setHeaderHeight(height);
    headerHeightShared.value = height;
  };

  const headerAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(
            scrollOffset.value,
            [-headerHeightShared.value, 0, headerHeightShared.value],
            [-headerHeightShared.value / 2, 0, headerHeightShared.value * 0.75]
          ),
        },
        {
          scale: interpolate(
            scrollOffset.value,
            [-headerHeightShared.value, 0, headerHeightShared.value],
            [2, 1, 1]),
        },
      ],
    };
  });

  return (
    <ThemedView style={[styles.container, style]}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ bottom }}
        contentContainerStyle={[
          {flexGrow: 1, paddingBottom: bottom },
          contentContainerStyle,
          ]}>
        <Animated.View
          onLayout={onHeaderLayout}
          style={[
            { backgroundColor: palette.background},
            headerAnimatedStyle,
        ]}
        >
          <View
            onLayout={onHeaderLayout}
            style={{ padding: 0, margin: 0 }}
          >
            {headerImage}
          </View>
        </Animated.View>
        <ThemedView style={styles.content}>{children}</ThemedView>
      </Animated.ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
  },
});
