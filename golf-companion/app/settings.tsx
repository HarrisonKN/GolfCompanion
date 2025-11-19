import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/components/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';
import BugReportModal from '@/components/BugReportModal';

export default function SettingsScreen() {
  const { mode, setMode, palette } = useTheme();
  const [bugReportModalVisible, setBugReportModalVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: palette.background, padding: 24 }}>
      <ThemedText type="title" style={{ marginBottom: 24 }}>Settings</ThemedText>
      
      {/* Theme Section */}
      <ThemedText style={{ fontWeight: '700', marginBottom: 12, color: palette.textDark }}>
        Theme
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexDirection: 'row', gap: 16 }}
        style={{ marginBottom: 32 }}
      >
        {['system', 'light', 'dark', 'alt1', 'alt2', 'alt3'].map((themeMode) => (
          <Pressable
            key={themeMode}
            style={{
              backgroundColor: mode === themeMode ? palette.primary : palette.grey,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 12,
              height: 40,
              justifyContent: 'center',
            }}
            onPress={() => setMode(themeMode as any)}
          >
            <ThemedText style={{ color: palette.white, fontWeight: '700' }}>
              {themeMode === 'alt1'
                ? 'Forest'
                : themeMode === 'alt2'
                ? 'Navy'
                : themeMode === 'alt3'
                ? 'Mint'
                : themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Help & Support Section */}
      <ThemedText style={{ fontWeight: '700', marginBottom: 12, color: palette.textDark }}>
        Help & Support
      </ThemedText>
      
      <Pressable
        style={styles(palette).settingItem}
        onPress={() => setBugReportModalVisible(true)}
      >
        <View style={styles(palette).settingIcon}>
          <MaterialIcons name="bug-report" size={24} color={palette.primary} />
        </View>
        <View style={styles(palette).settingContent}>
          <ThemedText style={styles(palette).settingTitle}>Report Bug</ThemedText>
          <ThemedText style={styles(palette).settingSubtitle}>
            Help us improve Golf Companion
          </ThemedText>
        </View>
        <MaterialIcons name="chevron-right" size={24} color={palette.textLight} />
      </Pressable>

      {/* Bug Report Modal */}
      <BugReportModal
        visible={bugReportModalVisible}
        onClose={() => setBugReportModalVisible(false)}
      />
    </View>
  );
}

// StyleSheet
const styles = (palette: any) => StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textDark,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: palette.textLight,
  },
});