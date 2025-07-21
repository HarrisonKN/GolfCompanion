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
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from "@/components/ThemeContext";
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

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
  const router = useRouter();

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
        .select('friend_id, profiles:friend_id(full_name)')
        .eq('user_id', user.id);
      setFriends(data || []);
    };
    fetchFriends();
  }, [user?.id]);

  const inviteFriend = async (friendId: string) => {
    await supabase.from('hubroom_invites').insert({
      group_id: roomId,
      invited_user_id: friendId,
      inviter_user_id: user.id,
      status: 'pending'
    });
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    await supabase.from('voice_messages').insert({
      group_id: roomId,
      user_id: user?.id,
      text: chatInput,
    });
    setChatInput('');
    fetchMessages();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.background, paddingTop: insets.top }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : insets.top + 60}
    >
      {/* Header */}
      <View style={styles(palette).headerCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Pressable
            onPress={() => router.back()}
            style={styles(palette).backButton}
            hitSlop={10}
          >
            <ThemedText style={styles(palette).backButtonText}>{'\u25C0'}</ThemedText>
            {/* Or use an icon from @expo/vector-icons if preferred */}
          </Pressable>
          <ThemedText type="title" style={styles(palette).headerText}>
            {roomName}
          </ThemedText>
        </View>
        <Pressable onPress={() => setInviteModalVisible(true)} style={styles(palette).inviteButton}>
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
        <Pressable style={styles(palette).sendButton} onPress={sendMessage}>
          <ThemedText style={styles(palette).sendButtonText}>Send</ThemedText>
        </Pressable>
      </View>

      {/* Invite Modal */}
      <Modal visible={inviteModalVisible} transparent animationType="slide" onRequestClose={() => setInviteModalVisible(false)}>
        <View style={styles(palette).modalOverlay}>
          <View style={styles(palette).modalCard}>
            <ThemedText style={styles(palette).modalTitle}>Invite Friends</ThemedText>
            {friends.length === 0 ? (
              <ThemedText style={{ color: palette.error }}>No friends found.</ThemedText>
            ) : (
              friends.map(f => (
                <Pressable
                  key={f.friend_id}
                  style={styles(palette).friendButton}
                  onPress={() => inviteFriend(f.friend_id)}
                >
                  <View style={styles(palette).avatarCircle}>
                    <ThemedText style={styles(palette).avatarText}>
                      {f.profiles?.full_name?.[0] || '?'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles(palette).friendName}>{f.profiles?.full_name}</ThemedText>
                </Pressable>
              ))
            )}
            <Pressable
              style={styles(palette).closeModalButton}
              onPress={() => setInviteModalVisible(false)}
            >
              <ThemedText style={styles(palette).closeModalButtonText}>Close</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---- Dynamic Styles ----
const styles = (palette: any) => StyleSheet.create({
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
  inviteButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
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
    padding: 10,
    borderRadius: 16,
    marginVertical: 6,
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
  },
  messageText: {
    color: palette.white,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    padding: 10,
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
    padding: 10,
    color: palette.textDark,
    backgroundColor: palette.background,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  modalCard: {
    backgroundColor: palette.white,
    padding: 24,
    borderRadius: 20,
    width: '85%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: palette.primary,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: palette.primary,
  },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    width: '100%',
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  friendName: {
    fontSize: 16,
    color: palette.textDark,
    fontWeight: '600',
  },
  closeModalButton: {
    backgroundColor: palette.error,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
  },
  closeModalButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  backButton: {
    marginRight: 10,
    padding: 6,
    borderRadius: 8,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 22,
    color: palette.primary,
    fontWeight: 'bold',
  },
});
