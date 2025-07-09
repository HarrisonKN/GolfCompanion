import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { MaterialIcons } from '@expo/vector-icons';
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
    name="scorecard"
    options={{
      title: 'Scorecard',
      tabBarIcon: ({ color }) => (
        <MaterialIcons name="view-list" size={28} color={color} />
      ),
    }}
  />
  <Tabs.Screen
    name="course-view"
    options={{
      title: 'Course View',
      tabBarIcon: ({ color }) => (
        <MaterialIcons name="golf-course" size={28}  color={color} />
      ),
    }}
  />
  <Tabs.Screen
    name="discord"
    options={{
      title: 'Discord',
      tabBarIcon: ({ color }) => (
        <MaterialIcons size={28} name="audiotrack" color={color} />
      ),
    }}
  />
</Tabs>
    
  );
}
