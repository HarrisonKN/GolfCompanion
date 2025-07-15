import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, Platform, Switch, PermissionsAndroid } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IRtcEngine, createAgoraRtcEngine } from 'react-native-agora';
import { AGORA_APP_ID } from '@/constants/agora';
import { supabase } from '@/components/supabase';

const mockGroups = [
  { id: '1', name: 'Morning Golfers' },
  { id: '2', name: 'Weekend Warriors' },
  { id: '3', name: 'Pro Tips Chat' },
];

const mockTrack = {
  title: 'Green on the Fairway',
  artist: 'Birdie Band',
  albumArt: 'https://picsum.photos/100',
};

export default function GolfHubScreen() {
  const [groups, setGroups] = useState(mockGroups);
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null);
  const [joinedGroupName, setJoinedGroupName] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [activeSpeakerUid, setActiveSpeakerUid] = useState<number | null>(null);


  const engineRef = useRef<any>(null); // Use 'any' or the correct instance type if available

  // ------------------- AGORA INIT -------------------------
    useEffect(() => {
      const initAgora = async () => {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message: 'We need access to your microphone for voice chat.',
              buttonPositive: 'OK',
            }
          );
      
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('Microphone permission denied');
            return;
          }
        }
      
        try {
          const engine: IRtcEngine = createAgoraRtcEngine();
          engine.initialize({ appId: AGORA_APP_ID });
          engine.enableAudio();
      
          // Register active speaker handler
          engine.registerEventHandler({
            onActiveSpeaker: (connection, uid) => {
              setActiveSpeakerUid(uid);
              console.log('Active speaker UID:', uid);
            },
            onJoinChannelSuccess: (connection, uid) => {
              console.log('Successfully joined channel:', connection.channelId, 'with UID:', uid);
            },
            onUserJoined: (connection, remoteUid) => {
              console.log('User joined:', remoteUid);
            },
            onUserOffline: (connection, remoteUid) => {
              console.log('User offline:', remoteUid);
            }
          });
      
          engineRef.current = engine;
        } catch (error) {
          console.error('Agora init error:', error);
        }
      };

    initAgora();

    return () => {
      engineRef.current?.release();
    };
  }, []);

  // ------------------- VOICE CHAT -------------------------
  const joinVoiceGroup = async (groupId: string, channelName: string) => {
    if (!engineRef.current) return;
  
    await engineRef.current.joinChannel(null, channelName, null, 0);
    setJoinedGroupId(groupId);
    setJoinedGroupName(channelName);
  
    // Add to Supabase presence table
    await supabase.from('voice_participants').insert({
      user_id: 0,
      group_id: groupId,
    });
  };
  
  const leaveVoiceGroup = async () => {
    if (!engineRef.current || !joinedGroupId) return;
  
    await engineRef.current.leaveChannel();
    setJoinedGroupId(null);
    setJoinedGroupName(null);
  
    // Remove from Supabase presence table
    await supabase
      .from('voice_participants')
      .delete()
      .eq('user_id', 0)
      .eq('group_id', joinedGroupId);
  };

  const toggleMute = () => {
    if (engineRef.current) {
      engineRef.current.muteLocalAudioStream(!isMuted);
      setIsMuted((prev) => !prev);
    }
  };

  const toggleSpeaker = () => {
    if (engineRef.current) {
      const newSpeakerState = !isSpeakerEnabled;
      engineRef.current.setEnableSpeakerphone(newSpeakerState);
      setIsSpeakerEnabled(newSpeakerState);
    }
  };

  // ------------------- UI -------------------------
  return (
    <ThemedView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>GolfHub</ThemedText>
        <Pressable
          style={styles.createButton}
          onPress={() => {
            const newGroup = {
              id: Date.now().toString(),
              name: `New Group ${groups.length + 1}`,
            };
            setGroups([newGroup, ...groups]);
          }}
        >
          <ThemedText style={styles.createButtonText}>+ Create Group</ThemedText>
        </Pressable>
      </View>

      {/* Groups List */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        style={styles.groupList}
        renderItem={({ item }) => {
          const joined = item.id === joinedGroupId;
          return (
            <View style={[styles.groupItem, joined && styles.groupItemJoined]}>
              <ThemedText style={styles.groupName}>{item.name}</ThemedText>

              {joined ? (
                <Pressable style={styles.leaveButton} onPress={leaveVoiceGroup}>
                  <ThemedText style={styles.leaveButtonText}>Leave</ThemedText>
                </Pressable>
              ) : (
                <Pressable style={styles.joinButton} onPress={() => joinVoiceGroup(item.id, item.name)}>
                  <ThemedText style={styles.joinButtonText}>Join</ThemedText>
                </Pressable>
              )}
              {joined && (
                <Pressable onPress={toggleMute} style={styles.muteButton}>
                  <ThemedText style={styles.leaveButtonText}>
                    {isMuted ? 'Unmute' : 'Mute'}
                  </ThemedText>
                </Pressable>
              )}
              {joined && (
                <Pressable onPress={toggleSpeaker} style={styles.speakerButton}>
                  <ThemedText style={styles.leaveButtonText}>
                    {isSpeakerEnabled ? 'Speaker Off' : 'Speaker On'}
                  </ThemedText>
                </Pressable>
              )}
              {activeSpeakerUid && (
                <ThemedText style={{ marginTop: 10, fontSize: 14, color: '#111' }}>
                  Active Speaker UID: {activeSpeakerUid}
                </ThemedText>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<ThemedText>No groups available</ThemedText>}
      />

      {/* Spotify Section (unchanged) */}
      <View style={styles.spotifyOverlay}>
        <View style={styles.albumArtContainer}>
          <IconSymbol name="music.note" size={60} color="#3B82F6" />
        </View>
        <View style={styles.trackInfo}>
          <ThemedText style={styles.trackTitle}>{mockTrack.title}</ThemedText>
          <ThemedText style={styles.trackArtist}>{mockTrack.artist}</ThemedText>
        </View>
        <Pressable onPress={() => setIsPlaying(!isPlaying)} style={styles.playPauseButton}>
          <IconSymbol
            name={isPlaying ? 'pause.circle.fill' : 'play.circle.fill'}
            size={48}
            color="#3B82F6"
          />
        </Pressable>
      </View>

      <View style={styles.spotifyConnectContainer}>
        <ThemedText style={styles.spotifyConnectLabel}>Spotify Connected</ThemedText>
        <Switch
          value={spotifyConnected}
          onValueChange={() => setSpotifyConnected(!spotifyConnected)}
          thumbColor={Platform.OS === 'android' ? (spotifyConnected ? '#3B82F6' : '#ccc') : undefined}
          trackColor={{ false: '#767577', true: '#A5B4FC' }}
        />
      </View>
    </ThemedView>
  );
}

// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E40AF',
  },
  createButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  groupList: {
    flexGrow: 0,
    marginBottom: 30,
  },
  groupItem: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  groupItemJoined: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  groupName: {
    fontWeight: '700',
    fontSize: 18,
    color: '#1E3A8A',
    flex: 1,
  },
  groupMembers: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  joinButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leaveButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  spotifyOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  albumArtContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  trackArtist: {
    fontSize: 14,
    color: '#4B5563',
  },
  playPauseButton: {
    marginLeft: 10,
  },
  spotifyConnectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  spotifyConnectLabel: {
    fontWeight: '600',
    color: '#374151',
    fontSize: 14,
  },
  muteButton: {
    backgroundColor: '#FBBF24',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
  speakerButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
});
