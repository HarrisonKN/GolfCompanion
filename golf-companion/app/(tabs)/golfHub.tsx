{/*
  Notes
  Changing room name on 1 device doesnt change room name for others, 
  also someone who joins can change room name, should be creator can only change room name

  Also Delete group should only be available to creator, and leave group should be available to joiners
  Deleting also doesnt delete it off supabase, 
  
  
  
  
  
  
  */}
import React, { useEffect, useRef, useState } from 'react';
import { View, Pressable, FlatList, StyleSheet, Platform, Switch, PermissionsAndroid, TextInput, Modal, Text, Alert } from 'react-native';
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
import { MaterialIcons } from '@expo/vector-icons';

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
  creator_id: string;
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
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const engineRef = useRef<any>(null); // Use 'any' or the correct instance type if available
  const flatListRef = useRef<FlatList>(null);

  const { palette } = useTheme();

  // Toast function
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

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
      const userIds = Array.from(new Set(data.map((msg: any) => msg.user_id)));
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
    const fetchAllUserGroups = async () => {
      if (!user?.id) return;
      
      try {
        // Fetch groups where user is a member
        const { data: memberGroups, error: memberError } = await supabase
          .from('voice_group_members')
          .select(`
            group_id,
            voice_groups (
              id,
              name,
              description,
              created_at,
              creator_id
            )
          `)
          .eq('user_id', user.id);
        
        if (memberError) {
          console.error('Error fetching member groups:', memberError);
          return;
        }
  
        // Extract and flatten the group data correctly
        const allGroups = memberGroups
          ?.map(m => m.voice_groups)
          .filter(Boolean)
          .flat() as VoiceGroup[] || [];
        
        console.log('✅ All User Groups:', allGroups);
        setGroups(allGroups);
        
      } catch (error) {
        console.error('Error in fetchAllUserGroups:', error);
      }
    };
    
    fetchAllUserGroups();
  }, [user?.id]);

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
    if (!modalGroupName.trim() || !user?.id) return;
  
    try {
      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('voice_groups')
        .insert({
          name: modalGroupName,
          description: modalGroupDesc,
          creator_id: user.id,
        })
        .select()
        .single();
  
      if (groupError) throw groupError;
  
      // Add creator as a member
      const { error: memberError } = await supabase
        .from('voice_group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
        });
  
      if (memberError) throw memberError;
  
      // Update local state immediately
      setGroups(prev => [groupData, ...prev]);
      setModalGroupName('');
      setModalGroupDesc('');
      setCreateModalVisible(false);
      showToast('Group created successfully!');
      
      console.log('✅ Group created and user added as member:', groupData);
      
    } catch (error) {
      console.error('❌ Error creating group:', error);
      showToast('Error creating group');
    }
  };

  const handleDeleteOrLeave = async () => {
    if (!groupToDelete || !user?.id) return;
    
    const group = groups.find(g => g.id === groupToDelete);
    if (!group) return;

    try {
      if (group.creator_id === user.id) {
        // Creator: delete the entire group (this will cascade delete members due to foreign key)
        const { error } = await supabase
          .from('voice_groups')
          .delete()
          .eq('id', groupToDelete);
        
        if (error) throw error;
        showToast('Group deleted successfully');
      } else {
        // Member: just remove their membership (this is what you want for "leave")
        const { error } = await supabase
          .from('voice_group_members')
          .delete()
          .eq('group_id', groupToDelete)
          .eq('user_id', user.id);
        
        if (error) throw error;
        showToast('Left group successfully');
      }

      // Update local state to remove group from UI immediately
      setGroups(prev => prev.filter(g => g.id !== groupToDelete));
      setDeleteConfirmVisible(false);
      setGroupToDelete(null);
      
    } catch (error) {
      console.error('❌ Error processing request:', error);
      showToast('Error processing request');
    }
  };

  const renderRightActions = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return null;
    
    const isCreator = group.creator_id === user?.id;

    return (
      <View style={styles(palette).swipeActions}>
        <Pressable
          onPress={() => {
            setGroupToDelete(groupId);
            setDeleteConfirmVisible(true);
          }}
          style={[
            styles(palette).swipeButton,
            { backgroundColor: palette.error }
          ]}
        >
          <ThemedText style={styles(palette).swipeButtonText}>
            {isCreator ? 'Delete' : 'Leave'}
          </ThemedText>
        </Pressable>
        
        {isCreator && (
          <>
            <Pressable
              onPress={() => {
                setInviteGroupId(groupId);
                setInviteModalVisible(true);
              }}
              style={[
                styles(palette).swipeButton,
                { backgroundColor: palette.primary }
              ]}
            >
              <ThemedText style={styles(palette).swipeButtonText}>
                Invite
              </ThemedText>
            </Pressable>
            
            <Pressable
              onPress={() => {
                setEditGroupId(groupId);
                setEditGroupName(group.name);
                setEditGroupDesc(group.description || '');
                setEditModalVisible(true);
              }}
              style={[
                styles(palette).swipeButton,
                { backgroundColor: palette.grey }
              ]}
            >
              <ThemedText style={styles(palette).swipeButtonText}>
                Edit
              </ThemedText>
            </Pressable>
          </>
        )}
      </View>
    );
  };

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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <ThemedText style={styles(palette).groupName}>{item.name}</ThemedText>
            {item.creator_id === user?.id && (
              <View style={styles(palette).creatorBadge}>
                <ThemedText style={styles(palette).creatorBadgeText}>Owner</ThemedText>
              </View>
            )}
          </View>
          {item.description && (
            <ThemedText style={styles(palette).groupDescription}>
              {item.description}
            </ThemedText>
          )}
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

  useEffect(() => {
    if (!user?.id) return;
  
    // Listen for when user is added to groups
    const membershipChannel = supabase
      .channel('voice_group_memberships')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_group_members', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          console.log('🔥 ADDED TO NEW GROUP:', payload);
          // Fetch the group details
          const { data: groupData } = await supabase
            .from('voice_groups')
            .select('*')
            .eq('id', payload.new.group_id)
            .single();
          
          if (groupData) {
            setGroups(prev => {
              const exists = prev.some(g => g.id === groupData.id);
              if (exists) return prev;
              return [...prev, groupData];
            });
            showToast('Added to new group!');
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'voice_group_members', filter: `user_id=eq.${user.id}` },
        (payload) => {
          console.log('🔥 REMOVED FROM GROUP:', payload);
          setGroups(prev => prev.filter(g => g.id !== payload.old.group_id));
          showToast('Removed from group');
        }
      )
      .subscribe();
  
    // Listen for group updates (name changes, etc.)
    const groupUpdatesChannel = supabase
      .channel('voice_group_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'voice_groups' },
        (payload) => {
          console.log('🔥 GROUP UPDATED:', payload);
          setGroups(prev => 
            prev.map(g => g.id === payload.new.id ? { ...g, ...payload.new } : g)
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'voice_groups' },
        (payload) => {
          console.log('🔥 GROUP DELETED:', payload);
          setGroups(prev => prev.filter(g => g.id !== payload.old.id));
          showToast('Group was deleted');
        }
      )
      .subscribe();
  
    return () => {
      membershipChannel.unsubscribe();
      groupUpdatesChannel.unsubscribe();
    };
  }, [user?.id]);

  // ------------------- UI -------------------------
  return (
    <ThemedView style={styles(palette).screen}>
      {/* Toast */}
      {toast && (
        <View style={styles(palette).toast}>
          <ThemedText style={styles(palette).toastText}>{toast}</ThemedText>
        </View>
      )}

      {/* Header */}
      <View style={styles(palette).header}>
        <ThemedText type="title" style={styles(palette).title}>GolfHub</ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable style={styles(palette).createButton} onPress={() => setCreateModalVisible(true)}>
            <ThemedText style={styles(palette).createButtonText}>+ Create Group</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Groups Section */}
      <View style={{ flex: 1, marginBottom: 24 }}>
        <ThemedText style={styles(palette).sectionTitle}>
          My Groups ({groups.length})
        </ThemedText>
        
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          style={styles(palette).groupList}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles(palette).emptyState}>
              <IconSymbol name="person.3" size={48} color={palette.textLight} />
              <ThemedText style={styles(palette).emptyStateText}>
                No groups yet
              </ThemedText>
              <ThemedText style={styles(palette).emptyStateSubtext}>
                Create a group or wait for an invite to get started
              </ThemedText>
            </View>
          }
        />
      </View>

      {/* Enhanced Music Player Section */}
      <View style={styles(palette).musicPlayerContainer}>
        {/* Header */}
        <View style={styles(palette).musicPlayerHeader}>
          <View style={styles(palette).musicBrandingContainer}>
            <View style={styles(palette).spotifyIcon}>
              <MaterialIcons name="music-note" size={20} color={palette.white} />
            </View>
            <ThemedText style={styles(palette).musicBrandingText}>Now Playing</ThemedText>
          </View>
          <Pressable style={styles(palette).musicMenuButton}>
            <MaterialIcons name="more-horiz" size={20} color={palette.textLight} />
          </Pressable>
        </View>

        {/* Main Player Content */}
        <View style={styles(palette).musicPlayerContent}>
          {/* Album Art & Track Info */}
          <View style={styles(palette).trackInfoContainer}>
          <View style={styles(palette).albumArtContainer}>
            <MaterialIcons name="music-note" size={48} color={palette.primary} />
            <View style={styles(palette).playIndicator}>
              <View style={[styles(palette).soundWave, { animationDelay: '0ms' }]} />
              <View style={[styles(palette).soundWave, { animationDelay: '150ms' }]} />
              <View style={[styles(palette).soundWave, { animationDelay: '300ms' }]} />
            </View>
          </View>
            
            <View style={styles(palette).trackDetails}>
              <ThemedText style={styles(palette).trackTitle}>{mockTrack.title}</ThemedText>
              <ThemedText style={styles(palette).trackArtist}>{mockTrack.artist}</ThemedText>
              <View style={styles(palette).trackMetadata}>
                <ThemedText style={styles(palette).trackDuration}>3:24</ThemedText>
                <View style={styles(palette).trackGenreBadge}>
                  <ThemedText style={styles(palette).trackGenreText}>Golf Vibes</ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles(palette).progressContainer}>
            <ThemedText style={styles(palette).progressTime}>1:23</ThemedText>
            <View style={styles(palette).progressBarContainer}>
              <View style={styles(palette).progressBar}>
                <View style={[styles(palette).progressFill, { width: '40%' }]} />
                <View style={styles(palette).progressThumb} />
              </View>
            </View>
            <ThemedText style={styles(palette).progressTime}>3:24</ThemedText>
          </View>

          {/* Controls */}
          <View style={styles(palette).musicControls}>
            <Pressable style={styles(palette).controlButton}>
              <MaterialIcons name="skip-previous" size={24} color={palette.textDark} />
            </Pressable>
            
            <Pressable 
              onPress={() => setIsPlaying(!isPlaying)} 
              style={styles(palette).playPauseButton}
            >
              <MaterialIcons
                name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
                size={52}
                color={palette.primary}
              />
            </Pressable>
            
            <Pressable style={styles(palette).controlButton}>
              <MaterialIcons name="skip-next" size={24} color={palette.textDark} />
            </Pressable>
          </View>

          {/* Additional Controls */}
          <View style={styles(palette).additionalControls}>
            <Pressable style={styles(palette).smallControlButton}>
              <MaterialIcons name="shuffle" size={18} color={palette.textLight} />
            </Pressable>
            
            <Pressable style={styles(palette).smallControlButton}>
              <MaterialIcons name="favorite" size={18} color={palette.error} />
            </Pressable>
            
            <Pressable style={styles(palette).smallControlButton}>
              <MaterialIcons name="repeat" size={18} color={palette.primary} />
            </Pressable>
            
            <Pressable style={styles(palette).smallControlButton}>
              <MaterialIcons name="volume-up" size={18} color={palette.textLight} />
            </Pressable>
          </View>
        </View>
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

      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
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
            <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: palette.error }}>
              {groupToDelete && groups.find(g => g.id === groupToDelete)?.creator_id === user?.id 
                ? 'Delete Group?' 
                : 'Leave Group?'
              }
            </ThemedText>
            <ThemedText style={{ fontSize: 15, color: palette.textDark, marginBottom: 18, textAlign: 'center' }}>
              {groupToDelete && groups.find(g => g.id === groupToDelete)?.creator_id === user?.id
                ? 'This will permanently delete the group for all members.'
                : 'You will be removed from this group. You can be reinvited to join again.'
              }
            </ThemedText>
            <View style={{ flexDirection: 'row' }}>
              <Pressable
                style={({ pressed }) => [
                  styles(palette).leaveButton, 
                  { marginRight: 8 },
                  pressed && { backgroundColor: '#B91C1C', transform: [{ scale: 0.95 }] }
                ]}
                onPress={handleDeleteOrLeave}
              >
                <ThemedText style={styles(palette).leaveButtonText}>
                  {groupToDelete && groups.find(g => g.id === groupToDelete)?.creator_id === user?.id ? 'Delete' : 'Leave'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles(palette).createButton,
                  pressed && { backgroundColor:'#2563EB', transform: [{ scale: 0.95 }] }
                ]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <ThemedText style={styles(palette).createButtonText}>Cancel</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Friends Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles(palette).modalOverlay}>
          <View style={styles(palette).modalContent}>
            <ThemedText style={styles(palette).modalTitle}>Invite Friends</ThemedText>
            
            <FlatList
              data={friends}
              keyExtractor={(item) => item.friend_id}
              style={{ maxHeight: 300, width: '100%' }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles(palette).friendItem}
                  onPress={() => {
                    inviteFriend(item.friend_id, inviteGroupId!);
                    setInviteModalVisible(false);
                  }}
                >
                  <View style={styles(palette).friendAvatar}>
                    <ThemedText style={styles(palette).friendAvatarText}>
                      {item.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <ThemedText style={styles(palette).friendName}>
                      {item.profiles?.full_name || 'Unknown'}
                    </ThemedText>
                    <ThemedText style={styles(palette).friendEmail}>
                      {item.profiles?.email || ''}
                    </ThemedText>
                  </View>
                </Pressable>
              )}
              ListEmptyComponent={
                <ThemedText style={styles(palette).emptyStateText}>
                  No friends to invite
                </ThemedText>
              }
            />
            
            <Pressable
              style={[styles(palette).modalButton, { backgroundColor: palette.grey, marginTop: 16 }]}
              onPress={() => setInviteModalVisible(false)}
            >
              <ThemedText style={styles(palette).modalButtonText}>Close</ThemedText>
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
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    zIndex: 999,
    shadowColor: palette.black,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  toastText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 12,
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
  musicPlayerContainer: {
    backgroundColor: palette.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  musicPlayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  musicBrandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spotifyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  musicBrandingText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.primary,
  },
  musicMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  musicPlayerContent: {
    gap: 16,
  },
  trackInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  albumArtContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: palette.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  playIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  soundWave: {
    width: 3,
    height: 12,
    backgroundColor: palette.primary,
    borderRadius: 1.5,
    opacity: 0.8,
  },
  trackDetails: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textDark,
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 15,
    color: palette.textLight,
    marginBottom: 8,
  },
  trackMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackDuration: {
    fontSize: 13,
    color: palette.textLight,
    fontWeight: '600',
  },
  trackGenreBadge: {
    backgroundColor: palette.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  trackGenreText: {
    fontSize: 11,
    color: palette.primary,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressTime: {
    fontSize: 12,
    color: palette.textLight,
    fontWeight: '600',
    minWidth: 32,
  },
  progressBarContainer: {
    flex: 1,
  },
  progressBar: {
    height: 6,
    backgroundColor: palette.background,
    borderRadius: 3,
    position: 'relative',
  },
  progressFill: {
    height: 6,
    backgroundColor: palette.primary,
    borderRadius: 3,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  progressThumb: {
    width: 14,
    height: 14,
    backgroundColor: palette.primary,
    borderRadius: 7,
    position: 'absolute',
    top: -4,
    left: '40%',
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  musicControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseButton: {
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  additionalControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: palette.background,
  },
  smallControlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
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
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '85%',
    borderRadius: 14,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  swipeButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 4,
  },
  swipeButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.textLight,
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: palette.textLight,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: palette.white,
    padding: 24,
    borderRadius: 16,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: palette.primary,
  },
  modalText: {
    fontSize: 16,
    color: palette.textDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: palette.grey,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    marginBottom: 16,
    color: palette.textDark,
    backgroundColor: palette.background,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  modalButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendAvatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textDark,
  },
  friendEmail: {
    fontSize: 14,
    color: palette.textLight,
  },
  creatorBadge: {
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  creatorBadgeText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '700',
  },
  groupDescription: {
    fontSize: 14,
    color: palette.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },
});