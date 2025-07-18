import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, Platform, Switch, PermissionsAndroid, TextInput, Modal } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IRtcEngine, createAgoraRtcEngine } from 'react-native-agora';
import { AGORA_APP_ID } from '@/constants/agora';
import { supabase } from '@/components/supabase';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';

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
  const [messages, setMessages] = useState<{user: string, text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const { user } = useAuth();
  const router = useRouter();

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

  const handleDeleteGroup = async (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
    // Optionally, delete from Supabase:
    await supabase.from('voice_groups').delete().eq('id', groupId);
  };

  const handleEditGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setEditGroupId(groupId);
    setEditGroupName(group.name);
    setEditModalVisible(true);
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    setMessages([...messages, { user: user?.full_name ?? 'Me', text: chatInput }]);
    setChatInput('');
    // Optionally, send to Supabase
    await supabase.from('voice_messages').insert({
      group_id: joinedGroupId,
      user_id: user?.id,
      text: chatInput,
    });
  };

  const saveEditedGroupName = async () => {
    if (!editGroupId || !editGroupName.trim()) return;
    setGroups(groups.map(g => g.id === editGroupId ? { ...g, name: editGroupName } : g));
    setEditModalVisible(false);
    // Optionally, update in Supabase
    await supabase.from('voice_groups').update({ name: editGroupName }).eq('id', editGroupId);
  };

  const renderRightActions = (groupId: string) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      height: '80%',
      borderRadius: 14,
      marginBottom: 14,
      paddingHorizontal: 10,
    }}>
      <Pressable
        onPress={() => handleDeleteGroup(groupId)}
        style={{
          backgroundColor: COLORS.error,
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          marginRight: 8,
        }}
      >
        <ThemedText style={{ color: COLORS.white, fontWeight: '700', fontSize: 16 }}>
          Delete
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => handleEditGroup(groupId)}
        style={{
          backgroundColor: COLORS.grey,
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <ThemedText style={{ color: COLORS.white, fontWeight: '700', fontSize: 16 }}>
          Edit
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: typeof groups[0] }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
    >
      <Pressable
        style={styles.groupItem}
        onPress={() => router.push({ pathname: '/hubRoom', params: { roomId: item.id, roomName: item.name } })}
      >
        <ThemedText style={styles.groupName}>{item.name}</ThemedText>
      </Pressable>
    </Swipeable>
  );

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

      {/* Scrollable Chat Rooms */}
      <View style={{ flex: 1, marginBottom: 24 }}>
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          style={styles.groupList}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={renderItem}
          ListEmptyComponent={<ThemedText>No groups available</ThemedText>}
        />
      </View>

      {/* Spotify Section (proof of concept) */}
      <View style={styles.spotifyOverlay}>
        <View style={styles.albumArtContainer}>
          <IconSymbol name="music.note" size={60} color={COLORS.primary} />
        </View>
        <View style={styles.trackInfo}>
          <ThemedText style={styles.trackTitle}>{mockTrack.title}</ThemedText>
          <ThemedText style={styles.trackArtist}>{mockTrack.artist}</ThemedText>
        </View>
        <Pressable onPress={() => setIsPlaying(!isPlaying)} style={styles.playPauseButton}>
          <IconSymbol
            name={isPlaying ? 'pause.circle.fill' : 'play.circle.fill'}
            size={48}
            color={COLORS.primary}
          />
        </Pressable>
      </View>
      <View style={styles.spotifyConnectContainer}>
        <ThemedText style={styles.spotifyConnectLabel}>Spotify Connected</ThemedText>
        <Switch
          value={spotifyConnected}
          onValueChange={() => setSpotifyConnected(!spotifyConnected)}
          thumbColor={Platform.OS === 'android' ? (spotifyConnected ? COLORS.primary : '#ccc') : undefined}
          trackColor={{ false: COLORS.grey, true: COLORS.secondary }}
        />
      </View>

      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)'
        }}>
          <View style={{
            backgroundColor: COLORS.white,
            padding: 24,
            borderRadius: 16,
            width: '80%',
            alignItems: 'center'
          }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Edit Group Name</ThemedText>
            <TextInput
              value={editGroupName}
              onChangeText={setEditGroupName}
              style={{
                borderWidth: 1,
                borderColor: COLORS.primary,
                borderRadius: 8,
                padding: 8,
                width: '100%',
                marginBottom: 16,
                color: COLORS.textDark,
                backgroundColor: COLORS.background,
              }}
              placeholder="New group name"
              placeholderTextColor={COLORS.textLight}
            />
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                style={[styles.createButton, { marginRight: 8 }]}
                onPress={saveEditedGroupName}
              >
                <ThemedText style={styles.createButtonText}>Save</ThemedText>
              </Pressable>
              <Pressable
                style={styles.leaveButton}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText style={styles.leaveButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
    paddingBottom: 80,
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
    color: COLORS.primary,
  },
  createButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
  groupList: {
    flexGrow: 0,
    marginBottom: 30,
  },
  groupItem: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.black,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  groupItemJoined: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  groupName: {
    fontWeight: '700',
    fontSize: 18,
    color: COLORS.third,
    flex: 1,
  },
  groupMembers: {
    marginHorizontal: 12,
    fontSize: 14,
    color: COLORS.textLight,
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leaveButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
  spotifyOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  albumArtContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: COLORS.background,
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
    color: COLORS.primary,
  },
  trackArtist: {
    fontSize: 14,
    color: COLORS.textLight,
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
    color: COLORS.textDark,
    fontSize: 14,
  },
  muteButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
  speakerButton: {
    backgroundColor: COLORS.third,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
});