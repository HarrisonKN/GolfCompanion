/**
 * hubRoom.tsx
 *
 * Purpose
 * - The main “room” screen for a voice group:
 *   - Live voice controls (join/leave/mute) via VoiceContext.
 *   - Presence strip showing users currently in the voice channel.
 *   - Simple text chat for the group via Supabase (voice_messages).
 *   - Group management UI (invite friends, view members, leave/delete group).
 *
 * Key Responsibilities
 * - Read roomId/roomName from router params and render the group’s view.
 * - Display live voice presence (voiceMembers) and speaking highlights.
 * - Provide one-tap actions: Join, Leave, Mute, Refresh presence.
 * - Fetch chat history, subscribe to new messages, and send chat messages.
 * - Show a Group Info modal with group details and member list;
 *   allow creator to remove members or delete the group, and non-creators to leave.
 *
 * Data & Realtime
 * - Supabase tables:
 *   - voice_messages: text chat (group_id, user_id, text)
 *   - voice_groups, voice_group_members, profiles: metadata and membership
 * - Realtime:
 *   - Subscribes to INSERT on voice_messages for this group.
 * - Voice presence:
 *   - Provided by VoiceContext via public.voice_channel_presence.
 *
 * UX Notes
 * - Voice Members Bar shows only users currently in voice, with active speaker highlight.
 * - Buttons are disabled/enabled based on isJoined.
 * - “Invite Friends” modal lists existing friends to invite to the group.
 *
 * Known Pitfalls
 * - Active speaker highlight in the Group Info modal compares user_id (uuid) to activeSpeakerUid (number).
 *   That will never match. It’s documented below; keep it until you add per-member agora_uid there.
 * - Ensure RLS policies allow the current user to read voice_messages and group metadata.
 */

// ===== Section: Imports =====
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  Alert,
  FlatList,
  AppState,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from "@/components/ThemeContext";
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useVoice } from '@/components/VoiceContext';
import { Audio } from 'expo-av';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// ===== Section: Utilities =====
const playSound = async (soundFile: any) => {
  const { sound } = await Audio.Sound.createAsync(soundFile);
  await sound.playAsync();
};

// ===== Section: Navigation/Expo Router Options =====
export const unstable_settings = {
  initialRoute: false,
  tabBarVisible: false,
};

export const dynamic = 'force-static';
export const navigationOptions = {
  headerShown: false,
  tabBarStyle: { display: 'none' },
  tabBarButton: () => null,
};

// ===== Section: Screen Component =====
export default function HubRoomScreen() {
  // ---- Router Params + Auth ----
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName: string }>();
  const { user } = useAuth();

  // ---- Local State (chat, modals, lists, toasts) ----
  const [messages, setMessages] = useState<{ user: string; text: string; user_id: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const flatListRef = useRef<KeyboardAwareFlatList>(null);
  const insets = useSafeAreaInsets();
  const { palette } = useTheme();
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const router = useRouter();
  const [groupInfoModalVisible, setGroupInfoModalVisible] = useState(false);
  const [groupDetails, setGroupDetails] = useState<any>(null);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [isGroupCreator, setIsGroupCreator] = useState(false);

  // ---- Voice Context (live presence and controls) ----
  const {
    isJoined,
    isMuted,
    activeSpeakerUid,
    voiceMembers,
    joinVoiceChannel,
    leaveVoiceChannel,
    toggleMute,
    fetchVoiceMembers,
  } = useVoice();

  // ===== Section: Toast helper =====
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // ===== Section: Chat — initial fetch =====
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('voice_messages')
      .select('text, user_id')
      .eq('group_id', roomId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      // Resolve user names for sender labels
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

  useEffect(() => {
    fetchMessages();
  }, [roomId]);

  // ===== Section: Chat — realtime subscription =====
  useEffect(() => {
    const subscription = supabase
      .channel('public:voice_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_messages', filter: `group_id=eq.${roomId}` },
        async (payload) => {
          const newMsg = payload.new;
          let senderName = 'Unknown';

          if (newMsg.user_id === user?.id) {
            senderName = 'You';
          } else {
            const { data } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', newMsg.user_id)
              .single();
            if (data?.full_name) senderName = data.full_name;
          }

          setMessages((prev) => [
            ...prev,
            {
              user: senderName,
              text: newMsg.text,
              user_id: newMsg.user_id,
            },
          ]);

          // Smooth autoscroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd(true);
          }, 100);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId, user?.id]);

  // ===== Section: Keyboard handling (auto-scroll on open) =====
  useEffect(() => {
    const keyboardShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd(true);
      }, 100);
    });
    return () => {
      keyboardShow.remove();
    };
  }, []);

  // ===== Section: Friends list for invites =====
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('friends')
        .select('friend_id, profiles:friend_id(full_name, email)')
        .eq('user_id', user.id);
      setFriends(data || []);
    };
    fetchFriends();
  }, [user?.id]);

  // ===== Section: Invite helpers =====
  const inviteFriend = async (friendId: string) => {
    try {
      const { error } = await supabase.from('hubroom_invites').insert({
        group_id: roomId,
        invited_user_id: friendId,
        inviter_user_id: user?.id,
        status: 'pending'
      });

      if (error) throw error;
      showToast('Invite sent!');
      setInviteModalVisible(false);
    } catch (error) {
      console.error('Error sending invite:', error);
      showToast('Error sending invite');
    }
  };

  // ===== Section: Chat — send message =====
  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    try {
      const { error } = await supabase.from('voice_messages').insert({
        group_id: roomId,
        user_id: user?.id,
        text: chatInput,
      });

      if (error) throw error;
      setChatInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Error sending message');
    }
  };

  // ===== Section: Header handlers =====
  const handleBackPress = () => {
    router.back();
  };

  const handleInvitePress = () => {
    if (friends.length === 0) {
      showToast('No friends to invite');
      return;
    }
    setInviteModalVisible(true);
  };

  // ===== Section: Group Info — details and member list =====
  const fetchGroupDetails = async () => {
    try {
      // Group details
      const { data: groupData, error: groupError } = await supabase
        .from('voice_groups')
        .select('*')
        .eq('id', roomId)
        .single();
      if (groupError) throw groupError;
      setGroupDetails(groupData);
      setIsGroupCreator(groupData?.creator_id === user?.id);

      // Members
      const { data: membersData, error: membersError } = await supabase
        .from('voice_group_members')
        .select('user_id, joined_at')
        .eq('group_id', roomId);
      if (membersError) throw membersError;

      // Unique userIds incl. creator
      const memberUserIds = (membersData || []).map(m => m.user_id);
      const allUserIds = Array.from(new Set([...memberUserIds, groupData?.creator_id].filter(Boolean)));

      // Profiles for display
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', allUserIds);
      if (profilesError) throw profilesError;

      // Final list for UI
      const finalMembers = allUserIds.map(userId => {
        const memberData = membersData?.find(m => m.user_id === userId);
        const profile = profilesData?.find(p => p.id === userId);
        return {
          user_id: userId,
          joined_at: memberData?.joined_at || groupData?.created_at,
          profiles: profile || null
        };
      });

      setGroupMembers(finalMembers);
    } catch (error) {
      console.error('Error fetching group details:', error);
      showToast('Error loading group details');
    }
  };

  // ===== Section: Group management (remove/leave/delete) =====
  const removeMember = async (memberId: string) => {
    if (!isGroupCreator) {
      showToast('Only group creators can remove members');
      return;
    }

    try {
      const { error } = await supabase
        .from('voice_group_members')
        .delete()
        .eq('group_id', roomId)
        .eq('user_id', memberId);
      if (error) throw error;

      setGroupMembers(prev => prev.filter(member => member.user_id !== memberId));
      showToast('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Error removing member');
    }
  };

  const leaveGroup = async () => {
    // Note: RLS must allow current user to delete their membership row.
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('voice_group_members')
                .delete()
                .eq('group_id', roomId)
                .eq('user_id', user?.id);
              if (error) throw error;

              showToast('Left group successfully');
              router.back();
            } catch (error) {
              console.error('Error leaving group:', error);
              showToast('Error leaving group');
            }
          }
        }
      ]
    );
  };

  const deleteGroup = async () => {
    if (!isGroupCreator) {
      showToast('Only group creators can delete groups');
      return;
    }

    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('voice_groups')
                .delete()
                .eq('id', roomId);
              if (error) throw error;

              showToast('Group deleted successfully');
              router.back();
            } catch (error) {
              console.error('Error deleting group:', error);
              showToast('Error deleting group');
            }
          }
        }
      ]
    );
  };

  // ===== Section: Group Info modal toggle =====
  const handleGroupInfoPress = () => {
    fetchGroupDetails();
    setGroupInfoModalVisible(true);
  };

  // ===== Section: Voice join/leave handlers =====
  const handleJoin = async () => {
    if (!isJoined && roomId && roomName) {
      await joinVoiceChannel(String(roomId), String(roomName));
    }
  };

  const handleLeave = async () => {
    if (isJoined) {
      await leaveVoiceChannel();
    }
  };

  // ===== Section: Render =====
  return (
    <View style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}>
      {/* Toast */}
      {toast && (
        <View style={styles(palette).toast}>
          <ThemedText style={styles(palette).toastText}>{toast}</ThemedText>
        </View>
      )}

      {/* Header */}
      <View style={styles(palette).headerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={handleBackPress}
            style={({ pressed }) => [
              styles(palette).backButton,
              pressed && styles(palette).backButtonPressed,
            ]}
            hitSlop={10}
          >
            <ThemedText style={styles(palette).backButtonText}>{'\u25C0'}</ThemedText>
          </Pressable>
          <Pressable 
            onPress={handleGroupInfoPress}
            style={{ flex: 1 }}
          >
            <ThemedText type="title" style={styles(palette).headerText}>
              {roomName}
            </ThemedText>
            <ThemedText style={styles(palette).headerSubtext}>
              Tap for group info
            </ThemedText>
          </Pressable>
        </View>
        <Pressable 
          onPress={handleInvitePress} 
          style={({ pressed }) => [
            styles(palette).inviteButton,
            pressed && styles(palette).inviteButtonPressed,
          ]}
        >
          <ThemedText style={styles(palette).inviteButtonText}>Invite</ThemedText>
        </Pressable>
      </View>

      {/* Voice Members Bar — shows ONLY users currently in the voice channel */}
      <View style={[styles(palette).voiceMembersBar, { backgroundColor: palette.secondary, borderRadius: 12, margin: 8, elevation: 2 }]}>
        <ThemedText style={styles(palette).sectionTitle}>Voice Channel ({voiceMembers.length})</ThemedText>
        <FlatList
          horizontal
          data={voiceMembers}
          keyExtractor={(item) => `${item.user_id}:${item.session_id ?? ''}`} // Stable key across updates
          renderItem={({ item }) => (
            <View style={[
              styles(palette).voiceMemberAvatar,
              item.agora_uid === activeSpeakerUid ? styles(palette).activeSpeaker : null // correct mapping: agora_uid -> activeSpeakerUid
            ]}>
              <ThemedText style={styles(palette).voiceMemberInitial}>
                {item.profiles?.full_name?.[0]?.toUpperCase() || '?'}
              </ThemedText>
              <ThemedText style={styles(palette).voiceMemberName}>
                {item.profiles?.full_name || 'Unknown'}
              </ThemedText>

              {/* Per-member mute indicator from presence */}
              {item.is_muted ? (
                <ThemedText style={{ color: palette.error, fontSize: 10 }}>Muted</ThemedText>
              ) : null}

              {/* Explicit "You (Muted)" for the local user */}
              {item.user_id === user?.id && isMuted && (
                <ThemedText style={{ color: palette.error, fontSize: 10 }}>You (Muted)</ThemedText>
              )}
            </View>
          )}
          ListEmptyComponent={
            <ThemedText style={styles(palette).emptyText}>No one in voice channel</ThemedText>
          }
          style={{ paddingVertical: 8 }}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Voice Controls Bar */}
      <View style={[styles(palette).voiceControlsBar, { backgroundColor: palette.third, borderRadius: 12, marginHorizontal: 8, marginBottom: 8, elevation: 2 }]}>
        <Pressable
          onPress={handleJoin}
          style={({ pressed }) => [
            styles(palette).iconButton,
            styles(palette).iconJoin,
            isJoined && styles(palette).iconDisabled,
            pressed && styles(palette).iconPressed,
          ]}
          disabled={isJoined}
        >
          <MaterialCommunityIcons name="phone-plus" size={24} color={palette.white} />
          <ThemedText style={styles(palette).iconLabel}>{isJoined ? 'Joined' : 'Join'}</ThemedText>
        </Pressable>

        <Pressable
          onPress={handleLeave}
          style={({ pressed }) => [
            styles(palette).iconButton,
            styles(palette).iconLeave,
            !isJoined && styles(palette).iconDisabled,
            pressed && styles(palette).iconPressed,
          ]}
          disabled={!isJoined}
        >
          <MaterialCommunityIcons name="phone-hangup" size={24} color={palette.white} />
          <ThemedText style={styles(palette).iconLabel}>Leave</ThemedText>
        </Pressable>

        <Pressable 
          onPress={toggleMute}
          style={({ pressed }) => [
            styles(palette).iconButton,
            isMuted ? styles(palette).iconMuteActive : styles(palette).iconMute,
            !isJoined && styles(palette).iconDisabled,
            pressed && styles(palette).iconPressed,
          ]}
          disabled={!isJoined}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color={palette.white} />
          <ThemedText style={styles(palette).iconLabel}>
            {isMuted ? 'Unmute' : 'Mute'}
          </ThemedText>
        </Pressable>

        <Pressable
          onPress={fetchVoiceMembers} // manual refresh helper
          style={({ pressed }) => [
            styles(palette).iconButton,
            styles(palette).iconRefresh,
            pressed && styles(palette).iconPressed,
          ]}
        >
          <Ionicons name="refresh" size={24} color={palette.white} />
          <ThemedText style={styles(palette).iconLabel}>Refresh</ThemedText>
        </Pressable>
      </View>

      {/* Messages Container with KeyboardAvoidingView */}
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={{ flex: 1 }}>
          {/* Messages List */}
          <View style={[styles(palette).messagesContainer, { backgroundColor: palette.background, borderRadius: 12, margin: 8, elevation: 1 }]}>
            <KeyboardAwareFlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, idx) => idx.toString()}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles(palette).messageBubble,
                    item.user === 'You'
                      ? styles(palette).myMessage
                      : styles(palette).otherMessage,
                  ]}
                >
                  <ThemedText style={styles(palette).messageUser}>{item.user}</ThemedText>
                  <ThemedText style={styles(palette).messageText}>{item.text}</ThemedText>
                </View>
              )}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 10, paddingHorizontal: 8 }}
              keyboardShouldPersistTaps="handled"
              extraHeight={100}
              enableOnAndroid={true}
              showsVerticalScrollIndicator={false}
            />
          </View>
          
          {/* Input Bar */}
          <View style={[styles(palette).inputBar, { marginBottom: insets.bottom }]}>
            <TextInput
              style={styles(palette).input}
              value={chatInput}
              onChangeText={setChatInput}
              placeholder="Type a message..."
              placeholderTextColor={palette.textLight}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
              multiline={false}
            />
            <Pressable 
              style={({ pressed }) => [
                styles(palette).sendButton,
                pressed && styles(palette).sendButtonPressed,
              ]} 
              onPress={sendMessage}
            >
              <ThemedText style={styles(palette).sendButtonText}>Send</ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Invite Modal */}
      <Modal visible={inviteModalVisible} transparent animationType="slide" onRequestClose={() => setInviteModalVisible(false)}>
        <View style={styles(palette).modalOverlay}>
          <View style={styles(palette).modalCard}>
            <ThemedText style={styles(palette).modalTitle}>Invite Friends</ThemedText>
            {friends.length === 0 ? (
              <View style={styles(palette).emptyFriendsContainer}>
                <ThemedText style={styles(palette).emptyFriendsText}>No friends found.</ThemedText>
                <ThemedText style={styles(palette).emptyFriendsSubtext}>
                  Add friends in the Account tab to invite them to groups.
                </ThemedText>
              </View>
            ) : (
              <View style={styles(palette).friendsList}>
                {friends.map(f => (
                  <Pressable
                    key={f.friend_id}
                    style={({ pressed }) => [
                      styles(palette).friendButton,
                      pressed && styles(palette).friendButtonPressed,
                    ]}
                    onPress={() => inviteFriend(f.friend_id)}
                  >
                    <View style={styles(palette).avatarCircle}>
                      <ThemedText style={styles(palette).avatarText}>
                        {f.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                      </ThemedText>
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles(palette).friendName}>
                        {f.profiles?.full_name || 'Unknown'}
                      </ThemedText>
                      <ThemedText style={styles(palette).friendEmail}>
                        {f.profiles?.email || ''}
                      </ThemedText>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable
              style={({ pressed }) => [
                styles(palette).closeModalButton,
                pressed && styles(palette).closeModalButtonPressed,
              ]}
              onPress={() => setInviteModalVisible(false)}
            >
              <ThemedText style={styles(palette).closeModalButtonText}>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Group Info Modal */}
      <Modal 
        visible={groupInfoModalVisible} 
        transparent 
        animationType="slide" 
        onRequestClose={() => setGroupInfoModalVisible(false)}
      >
        <View style={styles(palette).modalOverlay}>
          <View style={styles(palette).groupInfoModal}>
            {/* Header */}
            <View style={styles(palette).groupInfoHeader}>
              <ThemedText style={styles(palette).groupInfoTitle}>
                {groupDetails?.name || 'Group Info'}
              </ThemedText>
              <Pressable
                onPress={() => setGroupInfoModalVisible(false)}
                style={styles(palette).closeButton}
              >
                <ThemedText style={styles(palette).closeButtonText}>✕</ThemedText>
              </Pressable>
            </View>

            <View style={styles(palette).groupInfoContent}>
              {/* Group Details Section */}
              <View style={styles(palette).infoSection}>
                <ThemedText style={styles(palette).sectionTitle}>Group Details</ThemedText>
                <View style={styles(palette).infoRow}>
                  <ThemedText style={styles(palette).infoLabel}>Name:</ThemedText>
                  <ThemedText style={styles(palette).infoValue}>{groupDetails?.name}</ThemedText>
                </View>
                {groupDetails?.description && (
                  <View style={styles(palette).infoRow}>
                    <ThemedText style={styles(palette).infoLabel}>Description:</ThemedText>
                    <ThemedText style={styles(palette).infoValue}>{groupDetails.description}</ThemedText>
                  </View>
                )}
                <View style={styles(palette).infoRow}>
                  <ThemedText style={styles(palette).infoLabel}>Created:</ThemedText>
                  <ThemedText style={styles(palette).infoValue}>
                    {groupDetails?.created_at ? new Date(groupDetails.created_at).toLocaleDateString() : 'Unknown'}
                  </ThemedText>
                </View>
                <View style={styles(palette).infoRow}>
                  <ThemedText style={styles(palette).infoLabel}>Members:</ThemedText>
                  <ThemedText style={styles(palette).infoValue}>{groupMembers.length}</ThemedText>
                </View>
              </View>

              {/* Members Section */}
              <View style={styles(palette).infoSection}>
                <ThemedText style={styles(palette).sectionTitle}>
                  Members ({groupMembers.length})
                </ThemedText>
                <FlatList
                  data={groupMembers}
                  keyExtractor={(item) => item.user_id}
                  style={styles(palette).membersList}
                  renderItem={({ item }) => (
                    <View style={[
                      styles(palette).memberItem,
                      // NOTE: This comparison will not highlight correctly because user_id (uuid) !== activeSpeakerUid (number).
                      // Keep as a placeholder until you fetch/attach per-member agora_uid here.
                      item.user_id === activeSpeakerUid ? styles(palette).activeSpeaker : null
                    ]}>
                      <View style={styles(palette).memberAvatar}>
                        <ThemedText style={styles(palette).memberAvatarText}>
                          {item.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                        </ThemedText>
                      </View>
                      <View style={styles(palette).memberInfo}>
                        <ThemedText style={styles(palette).memberName}>
                          {item.profiles?.full_name || 'Unknown'}
                          {item.user_id === groupDetails?.creator_id && (
                            <ThemedText style={styles(palette).creatorBadge}> (Creator)</ThemedText>
                          )}
                          {item.user_id === user?.id && (
                            <ThemedText style={styles(palette).youBadge}> (You)</ThemedText>
                          )}
                        </ThemedText>
                        <ThemedText style={styles(palette).memberEmail}>
                          {item.profiles?.email || ''}
                        </ThemedText>
                        <ThemedText style={styles(palette).memberJoined}>
                          Joined: {new Date(item.joined_at).toLocaleDateString()}
                        </ThemedText>
                      </View>
                      {isGroupCreator && item.user_id !== user?.id && item.user_id !== groupDetails?.creator_id && (
                        <Pressable
                          onPress={() => removeMember(item.user_id)}
                          style={styles(palette).removeMemberButton}
                        >
                          <ThemedText style={styles(palette).removeMemberButtonText}>Remove</ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}
                  ListEmptyComponent={
                    <ThemedText style={styles(palette).emptyText}>No members found</ThemedText>
                  }
                />
              </View>

              {/* Action Buttons */}
              <View style={styles(palette).actionButtons}>
                {isGroupCreator ? (
                  <Pressable
                    onPress={deleteGroup}
                    style={styles(palette).deleteGroupButton}
                  >
                    <ThemedText style={styles(palette).deleteGroupButtonText}>Delete Group</ThemedText>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={leaveGroup}
                    style={styles(palette).leaveGroupButton}
                  >
                    <ThemedText style={styles(palette).leaveGroupButtonText}>Leave Group</ThemedText>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---- Dynamic Styles ----
const styles = (palette: any) => StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.white,
    padding: 16,
    borderRadius: 16,
    margin: 12,
    elevation: 3,
    shadowColor: palette.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  headerText: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.primary,
  },
  headerSubtext: {
    fontSize: 12,
    color: palette.textLight,
    marginTop: 2,
  },
  backButton: {
    marginRight: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    backgroundColor: palette.grey,
    transform: [{ scale: 0.95 }],
  },
  backButtonText: {
    fontSize: 20,
    color: palette.primary,
    fontWeight: 'bold',
  },
  inviteButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  inviteButtonPressed: {
    backgroundColor: palette.primaryDark || '#2563EB',
    transform: [{ scale: 0.95 }],
  },
  inviteButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  messagesContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: palette.primary,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: palette.grey,
  },
  messageUser: {
    fontWeight: 'bold',
    color: palette.white,
    marginBottom: 2,
    fontSize: 12,
  },
  messageText: {
    color: palette.white,
    fontSize: 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    padding: 4,
    marginHorizontal: 12,
    borderRadius: 16,
    elevation: 2,
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  input: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 8,
    padding: 12,
    color: palette.textDark,
    backgroundColor: palette.background,
    marginRight: 12,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendButtonPressed: {
    backgroundColor: palette.primaryDark || '#2563EB',
    transform: [{ scale: 0.95 }],
  },
  sendButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalCard: {
    backgroundColor: palette.white,
    padding: 24,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 4,
    shadowColor: palette.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: palette.primary,
    textAlign: 'center',
  },
  friendsList: {
    maxHeight: 300,
    width: '100%',
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
  },
  friendButtonPressed: {
    backgroundColor: palette.grey,
    transform: [{ scale: 0.98 }],
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 18,
  },
  friendName: {
    fontSize: 16,
    color: palette.textDark,
    fontWeight: '600',
  },
  friendEmail: {
    fontSize: 14,
    color: palette.textLight,
    marginTop: 2,
  },
  emptyFriendsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyFriendsText: {
    fontSize: 16,
    color: palette.textLight,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyFriendsSubtext: {
    fontSize: 14,
    color: palette.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  closeModalButton: {
    backgroundColor: palette.error,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  closeModalButtonPressed: {
    backgroundColor: '#B91C1C',
    transform: [{ scale: 0.95 }],
  },
  closeModalButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  groupInfoModal: {
    backgroundColor: palette.white,
    borderRadius: 20,
    width: '95%',
    maxHeight: '85%',
    elevation: 4,
    shadowColor: palette.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  groupInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
  },
  groupInfoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.primary,
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: palette.textDark,
    fontWeight: '700',
  },
  groupInfoContent: {
    padding: 20,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textLight,
    width: 80,
    marginRight: 12,
  },
  infoValue: {
    fontSize: 14,
    color: palette.textDark,
    flex: 1,
  },
  membersList: {
    maxHeight: 200,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.background,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.textDark,
  },
  memberEmail: {
    fontSize: 12,
    color: palette.textLight,
    marginTop: 2,
  },
  memberJoined: {
    fontSize: 11,
    color: palette.textLight,
    marginTop: 2,
  },
  creatorBadge: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  youBadge: {
    color: palette.secondary,
    fontWeight: '700',
    fontSize: 12,
  },
  removeMemberButton: {
    backgroundColor: palette.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeMemberButtonText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textLight,
    fontStyle: 'italic',
    marginTop: 20,
  },
  actionButtons: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: palette.grey,
  },
  deleteGroupButton: {
    backgroundColor: palette.error,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteGroupButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  leaveGroupButton: {
    backgroundColor: palette.error,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaveGroupButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  muteButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  muteButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  activeSpeaker: {
    borderColor: palette.success || '#22C55E',
    borderWidth: 3,
    backgroundColor: palette.primaryLight || '#E0E7FF',
  },
  voiceMembersBar: {
    backgroundColor: palette.secondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    margin: 8,
    elevation: 2,
  },
  voiceMemberAvatar: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 12,
    backgroundColor: palette.primaryLight || '#E0E7FF',
    borderWidth: 1,
    borderColor: palette.grey,
  },
  voiceMemberInitial: {
    fontSize: 18,
    fontWeight: 'bold',
    color: palette.primary,
  },
  voiceMemberName: {
    fontSize: 12,
    color: palette.textDark,
    marginTop: 4,
  },
  voiceControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: palette.third,
    paddingVertical: 8,
    borderRadius: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    elevation: 2,
  },
  voiceControlButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  voiceControlButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  iconButton: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  iconLabel: {
    color: palette.white,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  iconPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  iconDisabled: {
    opacity: 0.5,
  },
  iconJoin: {
    backgroundColor: palette.success || '#22C55E',
  },
  iconLeave: {
    backgroundColor: palette.error,
  },
  iconMute: {
    backgroundColor: palette.primary,
  },
  iconMuteActive: {
    backgroundColor: palette.warning || '#F59E42',
  },
  iconRefresh: {
    backgroundColor: palette.primaryDark || '#2563EB',
  },
});