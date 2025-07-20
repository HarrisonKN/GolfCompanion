import React from 'react';
import { View, Pressable } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/components/ThemeContext';

export default function SettingsScreen() {
  const { mode, setMode, palette } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, padding: 24 }}>
      <ThemedText type="title" style={{ marginBottom: 24 }}>Settings</ThemedText>
      <ThemedText style={{ fontWeight: '700', marginBottom: 12, color: palette.textDark }}>Theme</ThemedText>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        {['system', 'light', 'dark'].map((themeMode) => (
          <Pressable
            key={themeMode}
            style={{
              backgroundColor: mode === themeMode ? palette.primary : palette.grey,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 12,
            }}
            onPress={() => setMode(themeMode as any)}
          >
            <ThemedText style={{ color: palette.white, fontWeight: '700' }}>
              {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}