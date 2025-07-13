import { Tabs } from 'expo-router';
import React from 'react';

import { IconSymbol } from '@/components/ui/IconSymbol';
import { MaterialIcons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
            <MaterialIcons name="golf-course" size={28} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="golfHub"
        options={{
          title: 'GolfHub',
          tabBarIcon: ({ color }) => (
            <MaterialIcons size={28} name="audiotrack" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="account-circle" size={28} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
