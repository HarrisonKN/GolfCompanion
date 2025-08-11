// GlobalVoiceBar
import React, { useState, useRef } from 'react';
import { View, Pressable, StyleSheet, Animated, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/components/ThemeContext';
import { useVoice } from '@/components/VoiceContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

const { width: screenWidth } = Dimensions.get('window');

export const GlobalVoiceBar = () => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    isJoined,
    isMuted,
    audioRoute,
    currentRoomId,
    currentRoomName,
    voiceMembers,
    speakingUsers,
    leaveVoiceChannel,
    toggleMute,
    toggleAudioRoute,
  } = useVoice();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const mutedCount = voiceMembers.filter(m => m?.is_muted).length;

  if (!isJoined || !currentRoomName) return null;

  const toggleCollapse = () => {
    // When collapsed, slide out but keep 50px visible on the right side
    const toValue = isCollapsed ? 0 : 120; // Reduced slide distance
    setIsCollapsed(!isCollapsed);
    
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const navigateToRoom = () => {
    if (currentRoomId && currentRoomName) {
      router.push({
        pathname: '/hubRoom',
        params: { roomId: currentRoomId, roomName: currentRoomName }
      });
    }
  };

  return (
    <Animated.View 
      style={[
        styles(palette).container, 
        { 
          bottom: insets.bottom + 90, // Position above tab bar (tab bar is ~80px + padding)
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      {isCollapsed ? (
        /* Collapsed State - Sidebar Tab */
        <View style={styles(palette).collapsedContainer}>
          <Pressable onPress={toggleCollapse} style={styles(palette).expandTab}>
            <MaterialIcons name="keyboard-arrow-left" size={18} color={palette.white} />
          </Pressable>
          
          <View style={styles(palette).collapsedContent}>
            <View style={styles(palette).micContainer}>
              <MaterialIcons name="mic" size={14} color={palette.white} />
              <View style={[
                styles(palette).speakingDot,
                { backgroundColor: speakingUsers.size > 0 ? '#22C55E' : palette.textLight }
              ]} />
            </View>
            
            <View style={styles(palette).collapsedStats}>
              <ThemedText style={styles(palette).statText}>{voiceMembers.length}</ThemedText>
              <View style={[
                styles(palette).speakingIndicator,
                { backgroundColor: speakingUsers.size > 0 ? '#22C55E' : 'transparent' }
              ]}>
                <ThemedText style={styles(palette).speakingCount}>
                  {speakingUsers.size}
                </ThemedText>
              </View>
            </View>
            
            {/* Quick mute button */}
            <Pressable 
              onPress={toggleMute} 
              style={[
                styles(palette).quickMuteButton,
                { backgroundColor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.2)' }
              ]}
            >
              <MaterialIcons 
                name={isMuted ? "mic-off" : "mic"} 
                size={10} 
                color={palette.white} 
              />
            </Pressable>
          </View>
        </View>
      ) : (
        /* Expanded State */
        <View style={styles(palette).expandedContainer}>
          {/* Header Row */}
          <View style={styles(palette).header}>
            <Pressable 
              onPress={navigateToRoom}
              style={styles(palette).roomNameButton}
              hitSlop={8}
            >
              <MaterialIcons name="group" size={12} color={palette.white} />
              <ThemedText style={styles(palette).roomName} numberOfLines={1}>
                {currentRoomName}
              </ThemedText>
            </Pressable>
            
            <Pressable onPress={toggleCollapse} hitSlop={8}>
              <MaterialIcons name="keyboard-arrow-right" size={16} color={palette.white} />
            </Pressable>
          </View>
          
          {/* Status Row */}
          <View style={styles(palette).statusRow}>
            <View style={styles(palette).statusInfo}>
              <MaterialIcons name="people" size={10} color={palette.white} />
              <ThemedText style={styles(palette).statusText}>{voiceMembers.length}</ThemedText>

              <MaterialIcons name="mic" size={10} color={speakingUsers.size > 0 ? '#22C55E' : palette.textLight} />
              <ThemedText style={styles(palette).statusText}>{speakingUsers.size}</ThemedText>

              {/* muted count */}
              <MaterialIcons name="mic-off" size={10} color={mutedCount > 0 ? '#EF4444' : palette.textLight} />
              <ThemedText style={styles(palette).statusText}>{mutedCount}</ThemedText>
            </View>
            
            {/* Quick Controls */}
            <View style={styles(palette).quickControls}>
              <Pressable 
                onPress={toggleMute} 
                style={[
                  styles(palette).quickButton,
                  { backgroundColor: isMuted ? '#EF4444' : 'rgba(255,255,255,0.2)' }
                ]}
              >
                <MaterialIcons name={isMuted ? "mic-off" : "mic"} size={12} color={palette.white} />
              </Pressable>
              
              <Pressable 
                onPress={toggleAudioRoute} 
                style={[styles(palette).quickButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
              >
                <MaterialIcons name={audioRoute === 'speaker' ? "volume-up" : "hearing"} size={12} color={palette.white} />
              </Pressable>
              
              <Pressable 
                onPress={leaveVoiceChannel} 
                style={[styles(palette).quickButton, { backgroundColor: '#EF4444' }]}
              >
                <MaterialIcons name="call-end" size={12} color={palette.white} />
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = (palette: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    backgroundColor: palette.primary,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    minWidth: 130,
  },
  
  // Collapsed State Styles
  collapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    width: 130,
  },
  expandTab: {
    width: 24,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  collapsedContent: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  micContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  speakingDot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: palette.white,
  },
  collapsedStats: {
    alignItems: 'center',
  },
  statText: {
    color: palette.white,
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  speakingIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  speakingCount: {
    color: palette.white,
    fontSize: 8,
    fontWeight: '700',
  },
  quickMuteButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Expanded State Styles
  expandedContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 180,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roomNameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  roomName: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 11,
    marginLeft: 4,
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusText: {
    color: palette.white,
    fontSize: 9,
    marginHorizontal: 3,
    opacity: 0.9,
  },
  quickControls: {
    flexDirection: 'row',
    gap: 4,
  },
  quickButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});