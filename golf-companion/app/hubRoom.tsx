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
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from "@/components/ThemeContext";
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlatList } from 'react-native';

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

export default function HubRoomScreen() {
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName: string }>();
  const { user } = useAuth();
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

  // Toast function
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('voice_messages')
      .select('text, user_id')
      .eq('group_id', roomId)
      .order('created_at', { ascending: true });

    if (!error && data) {
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

  useEffect(() => {
    fetchMessages();
  }, [roomId]);

  // Realtime updates
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

  // Ensure scroll when keyboard opens
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

  useEffect(() => {
    // Fetch friends for the current user
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
      // Don't call fetchMessages() here as realtime will handle it
    } catch (error) {
      console.error('Error sending message:', error);
      showToast('Error sending message');
    }
  };

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

  const fetchGroupDetails = async () => {
    try {
      // Fetch group details
      const { data: groupData, error: groupError } = await supabase
        .from('voice_groups')
        .select('*')
        .eq('id', roomId)
        .single();
  
      if (groupError) throw groupError;
      setGroupDetails(groupData);
      setIsGroupCreator(groupData?.creator_id === user?.id);
  
      // Fetch group members
      const { data: membersData, error: membersError } = await supabase
        .from('voice_group_members')
        .select('user_id, joined_at')
        .eq('group_id', roomId);
  
      if (membersError) throw membersError;
  
      // Get all unique user IDs including creator
      const memberUserIds = (membersData || []).map(m => m.user_id);
      const allUserIds = [...new Set([...memberUserIds, groupData?.creator_id].filter(Boolean))];
  
      // Fetch profiles for all users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', allUserIds);
  
      if (profilesError) throw profilesError;
  
      // Build final members list
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
  
      // Update local state
      setGroupMembers(prev => prev.filter(member => member.user_id !== memberId));
      showToast('Member removed successfully');
  
    } catch (error) {
      console.error('Error removing member:', error);
      showToast('Error removing member');
    }
  };
  
  const leaveGroup = async () => {
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
              router.back(); // Navigate back to GolfHub
              
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
              router.back(); // Navigate back to GolfHub
              
            } catch (error) {
              console.error('Error deleting group:', error);
              showToast('Error deleting group');
            }
          }
        }
      ]
    );
  };
  
  const handleGroupInfoPress = () => {
    fetchGroupDetails();
    setGroupInfoModalVisible(true);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : insets.top + 60}
    >
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

      {/* Messages */}
      <View style={styles(palette).messagesContainer}>
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
          contentContainerStyle={{ paddingBottom: 80, paddingHorizontal: 8 }}
          keyboardShouldPersistTaps="handled"
          extraHeight={100}
          enableOnAndroid={true}
        />
      </View>

      {/* Input Bar */}
      <View style={styles(palette).inputBar}>
        <TextInput
          style={styles(palette).input}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Type a message..."
          placeholderTextColor={palette.textLight}
          onSubmitEditing={sendMessage}
          returnKeyType="send"
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
                    <View style={styles(palette).memberItem}>
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
    </KeyboardAvoidingView>
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
    padding: 12,
    borderRadius: 16,
    margin: 12,
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
});
