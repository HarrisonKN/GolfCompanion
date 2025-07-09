import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
  screenOptions={{
    headerShown: false,
    // any other options you have
  }}
>
  <Tabs.Screen
    name="index"
    options={{
      title: 'Home',
      tabBarIcon: ({ color }) => (
        <IconSymbol size={28} name="house.fill" color={color} />
      ),
    }}
  />
  <Tabs.Screen
    name="explore"
    options={{
      title: 'Explore',
      tabBarIcon: ({ color }) => (
        <IconSymbol size={28} name="paperplane.fill" color={color} />
      ),
    }}
  />
  <Tabs.Screen
    name="scorecard"
    options={{
      title: 'Scorecard',
      tabBarIcon: ({ color }) => (
        <IconSymbol size={28} name="list.bullet" color={color} />
      ),
    }}
  />
  <Tabs.Screen
    name="course-view"
    options={{
      title: 'Course View',
      tabBarIcon: ({ color }) => (
        <IconSymbol size={28} name="map.fill" color={color} />
      ),
    }}
  />
</Tabs>
    
  );
}
