{/*
  Notes
  Changing room name on 1 device doesnt change room name for others, 
  also someone who joins can change room name, should be creator can only change room name

  Also Delete group should only be available to creator, and leave group should be available to joiners
  Deleting also doesnt delete it off supabase, 
  
  
  
  
  
  
  */}
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, Platform, Switch, PermissionsAndroid, TextInput, Modal, Text } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from "@/components/ThemeContext";
import { IconSymbol } from '@/components/ui/IconSymbol';
import { IRtcEngine, createAgoraRtcEngine } from 'react-native-agora';
import { AGORA_APP_ID } from '@/constants/agora';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';

const mockTrack = {
  title: 'Green on the Fairway',
  artist: 'Birdie Band',
  albumArt: 'https://picsum.photos/100',
};

type VoiceGroup = {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
};

export default function GolfHubScreen() {
  const [groups, setGroups] = useState<VoiceGroup[]>([]);
  const [headerGroupName, setHeaderGroupName] = useState('');
  const [modalGroupName, setModalGroupName] = useState('');
  const [modalGroupDesc, setModalGroupDesc] = useState('');
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
  const [editGroupDesc, setEditGroupDesc] = useState(''); // <-- Add this
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState<any[]>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);

  const engineRef = useRef<any>(null); // Use 'any' or the correct instance type if available
  const flatListRef = useRef<FlatList>(null);

  const { palette } = useTheme();

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
    await supabase.from('voice_groups').delete().eq('id', groupId);
    setGroups(groups.filter(g => g.id !== groupId));
  };

  const handleEditGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    setEditGroupId(groupId);
    setEditGroupName(group.name);
    setEditGroupDesc(group.description ?? ''); // <-- Add this
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
    await supabase
      .from('voice_groups')
      .update({ name: editGroupName, description: editGroupDesc }) // <-- Update description
      .eq('id', editGroupId);
    setGroups(groups.map(g => g.id === editGroupId ? { ...g, name: editGroupName, description: editGroupDesc } : g));
    setEditModalVisible(false);
  };

  const fetchMessages = async (groupId: string) => {
    const { data, error } = await supabase
      .from('voice_messages')
      .select('text, user_id')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
  
    if (!error && data) {
      // Get all unique user_ids
      const userIds = [...new Set(data.map((msg: any) => msg.user_id))];
      let userNames: Record<string, string> = {};
  
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
  
        profiles?.forEach((profile: any) => {
          userNames[profile.id] = profile.full_name;
        });
      }
  
      setMessages(
        data.map((msg: any) => ({
          user: msg.user_id === user?.id ? 'You' : userNames[msg.user_id] ?? 'Unknown',
          text: msg.text,
          user_id: msg.user_id,
        }))
      );
    }
  };

  // Fetch groups from Supabase
  useEffect(() => {
    const fetchGroups = async () => {
      const { data, error } = await supabase
        .from('voice_groups')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) setGroups(data);
    };
    fetchGroups();
  }, []);

  useEffect(() => {
    if (joinedGroupId) {
      fetchMessages(joinedGroupId);
    }
  }, [joinedGroupId]);

  useEffect(() => {
    if (!joinedGroupId) return;
    const subscription = supabase
      .channel('public:voice_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_messages', filter: `group_id=eq.${joinedGroupId}` },
        async (payload) => {
          const newMsg = payload.new;
          let senderName = 'Unknown';
  
          if (newMsg.user_id === user?.id) {
            senderName = 'You';
          } else {
            try {
              const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', newMsg.user_id)
                .single();
              if (data && data.full_name) senderName = data.full_name;
            } catch {}
          }
  
          setMessages((prev) => [
            ...prev,
            {
              user: senderName,
              text: newMsg.text,
              user_id: newMsg.user_id,
            },
          ]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();
  
    return () => {
      subscription.unsubscribe();
    };
  }, [joinedGroupId, user?.id]);

  // Create a new group in Supabase
  const createGroup = async () => {
    console.log('Create group pressed');
  
    if (!modalGroupName.trim()) return;
  
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData?.user?.id) {
      // User not authenticated
      return;
    }
    const creatorId = authData.user.id;
  
    const { data, error } = await supabase
      .from('voice_groups')
      .insert({
        name: modalGroupName,
        description: modalGroupDesc,
        creator_id: creatorId, // Must match auth.uid()
      })
      .select();
  
    console.log('Supabase insert result:', { data, error });
  
    if (!error && data && data.length > 0) {
      setGroups((prev) => [data[0], ...prev]);
      setModalGroupName('');
      setModalGroupDesc('');
      setCreateModalVisible(false);
    }
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
          backgroundColor: palette.error,
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
          marginRight: 8,
        }}
      >
        <ThemedText style={{ color: palette.white, fontWeight: '700', fontSize: 16 }}>
          Delete
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => handleEditGroup(groupId)}
        style={{
          backgroundColor: palette.grey,
          borderRadius: 8,
          paddingHorizontal: 16,
          paddingVertical: 8,
        }}
      >
        <ThemedText style={{ color: palette.white, fontWeight: '700', fontSize: 16 }}>
          Edit
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderItem = ({ item }: { item: VoiceGroup }) => (
    <Swipeable
      renderRightActions={() => renderRightActions(item.id)}
      overshootRight={false}
    >
      <Pressable
        style={styles(palette).groupItem}
        onPress={() => router.push({ pathname: '/hubRoom', params: { roomId: item.id, roomName: item.name, roomDesc: item.description } })} // <-- Pass description
      >
        <View style={{ flex: 1 }}>
          <ThemedText style={styles(palette).groupName}>{item.name}</ThemedText>
          {item.description ? (
            <ThemedText style={styles(palette).groupMembers}>{item.description}</ThemedText>
          ) : null}
        </View>
      </Pressable>
    </Swipeable>
  );

  useEffect(() => {
    const fetchFriends = async () => {
      const { data } = await supabase
        .from('friends')
        .select('friend_id, profiles(full_name)')
        .eq('user_id', user.id);
      setFriends(data || []);
    };
    fetchFriends();
  }, [user]);

  const inviteFriend = async (friendId: string, groupId: string) => {
    await supabase.from('hubroom_invites').insert({
      group_id: groupId,
      invited_user_id: friendId,
      inviter_user_id: user.id,
    });
    // Optionally show a toast
  };

  // ------------------- UI -------------------------
  return (
    <ThemedView style={styles(palette).screen}>
      {/* Header */}
      <View style={styles(palette).header}>
        <ThemedText type="title" style={styles(palette).title}>GolfHub</ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable style={styles(palette).createButton} onPress={() => setCreateModalVisible(true)}>
            <ThemedText style={styles(palette).createButtonText}>+ Create Group</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Scrollable Chat Rooms */}
      <View style={{ flex: 1, marginBottom: 24 }}>
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          style={styles(palette).groupList}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={renderItem}
          ListEmptyComponent={<ThemedText>No groups available</ThemedText>}
          ref={flatListRef} // Add this
        />
      </View>

      {/* Spotify Section (proof of concept) */}
      <View style={styles(palette).spotifyOverlay}>
        <View style={styles(palette).albumArtContainer}>
          <IconSymbol name="music.note" size={60} color={palette.primary} />
        </View>
        <View style={styles(palette).trackInfo}>
          <ThemedText style={styles(palette).trackTitle}>{mockTrack.title}</ThemedText>
          <ThemedText style={styles(palette).trackArtist}>{mockTrack.artist}</ThemedText>
        </View>
        <Pressable onPress={() => setIsPlaying(!isPlaying)} style={styles(palette).playPauseButton}>
          <IconSymbol
            name={isPlaying ? 'pause.circle.fill' : 'play.circle.fill'}
            size={48}
            color={palette.primary}
          />
        </Pressable>
      </View>
      <View style={styles(palette).spotifyConnectContainer}>
        <ThemedText style={styles(palette).spotifyConnectLabel}>Spotify Connected</ThemedText>
        <Switch
          value={spotifyConnected}
          onValueChange={() => setSpotifyConnected(!spotifyConnected)}
          thumbColor={Platform.OS === 'android' ? (spotifyConnected ? palette.primary : '#ccc') : undefined}
          trackColor={{ false: palette.grey, true: palette.secondary }}
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
            backgroundColor: palette.white,
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
                borderColor: palette.primary,
                borderRadius: 8,
                padding: 8,
                width: '100%',
                marginBottom: 16,
                color: palette.textDark,
                backgroundColor: palette.background,
              }}
              placeholder="New group name"
              placeholderTextColor={palette.textLight}
            />
            <TextInput
              value={editGroupDesc}
              onChangeText={setEditGroupDesc}
              style={{
                borderWidth: 1,
                borderColor: palette.primary,
                borderRadius: 8,
                padding: 8,
                width: '100%',
                marginBottom: 16,
                color: palette.textDark,
                backgroundColor: palette.background,
              }}
              placeholder="Description (optional)"
              placeholderTextColor={palette.textLight}
            />
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                style={[styles(palette).createButton, { marginRight: 8 }]}
                onPress={saveEditedGroupName}
              >
                <ThemedText style={styles(palette).createButtonText}>Save</ThemedText>
              </Pressable>
              <Pressable
                style={styles(palette).leaveButton}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText style={styles(palette).leaveButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={createModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)'
        }}>
          <View style={{
            backgroundColor: palette.white,
            padding: 24,
            borderRadius: 16,
            width: '80%',
            alignItems: 'center'
          }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Create New Group</ThemedText>
            <TextInput
              value={modalGroupName}
              onChangeText={setModalGroupName}
              style={{
                borderWidth: 1,
                borderColor: palette.primary,
                borderRadius: 8,
                padding: 8,
                width: '100%',
                marginBottom: 16,
                color: palette.textDark,
                backgroundColor: palette.background,
              }}
              placeholder="Group name"
              placeholderTextColor={palette.textLight}
            />
            <TextInput
              value={modalGroupDesc}
              onChangeText={setModalGroupDesc}
              style={{
                borderWidth: 1,
                borderColor: palette.primary,
                borderRadius: 8,
                padding: 8,
                width: '100%',
                marginBottom: 16,
                color: palette.textDark,
                backgroundColor: palette.background,
              }}
              placeholder="Description (optional)"
              placeholderTextColor={palette.textLight}
            />
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                style={[styles(palette).createButton, { marginRight: 8 }]}
                onPress={createGroup}
              >
                <ThemedText style={styles(palette).createButtonText}>Create</ThemedText>
              </Pressable>
              <Pressable
                style={styles(palette).leaveButton}
                onPress={() => setCreateModalVisible(false)}
              >
                <ThemedText style={styles(palette).leaveButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Pressable onPress={() => setInviteModalVisible(true)} style={[styles(palette).createButton, { marginTop: 12 }]}>
        <ThemedText style={styles(palette).createButtonText}>Invite Friends</ThemedText>
      </Pressable>
      <Modal visible={inviteModalVisible} transparent animationType="slide" onRequestClose={() => setInviteModalVisible(false)}>
        <View style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(0,0,0,0.3)'
        }}>
          <View style={{
            backgroundColor: palette.white,
            padding: 24,
            borderRadius: 16,
            width: '80%',
            alignItems: 'center'
          }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Select friends to invite:</ThemedText>
            {friends.length === 0 ? (
              <ThemedText style={{ color: palette.error }}>No friends found.</ThemedText>
            ) : (
              friends.map(f => (
                <Pressable
                  key={f.friend_id}
                  style={[styles(palette).createButton, { marginBottom: 8, width: '100%' }]}
                  onPress={() => joinedGroupId && inviteFriend(f.friend_id, joinedGroupId)}
                >
                  <ThemedText style={styles(palette).createButtonText}>{f.profiles?.full_name}</ThemedText>
                </Pressable>
              ))
            )}
            <Pressable
              style={[styles(palette).leaveButton, { marginTop: 12 }]}
              onPress={() => setInviteModalVisible(false)}
            >
              <ThemedText style={styles(palette).leaveButtonText}>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

// ------------------- UI Styling -------------------------
const styles = (palette: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
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
    color: palette.primary,
  },
  createButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  createButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  groupList: {
    flexGrow: 0,
    marginBottom: 30,
  },
  groupItem: {
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  groupItemJoined: {
    borderWidth: 2,
    borderColor: palette.primary,
  },
  groupName: {
    fontWeight: '700',
    fontSize: 18,
    color: palette.third,
    flex: 1,
  },
  groupMembers: {
    marginHorizontal: 12,
    fontSize: 14,
    color: palette.textLight,
  },
  joinButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  joinButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  leaveButton: {
    backgroundColor: palette.error,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leaveButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  spotifyOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.secondary,
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  albumArtContainer: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: palette.background,
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
    color: palette.primary,
  },
  trackArtist: {
    fontSize: 14,
    color: palette.textLight,
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
    color: palette.textDark,
    fontSize: 14,
  },
  muteButton: {
    backgroundColor: palette.secondary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
  speakerButton: {
    backgroundColor: palette.third,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 6,
  },
});