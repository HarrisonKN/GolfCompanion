import React, { useEffect, useState, useRef } from 'react';
import { View, TextInput, FlatList, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { COLORS } from '@/constants/theme';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';

export const unstable_settings = {
  // This hides the screen from the tab bar
  initialRoute: false,
  tabBarVisible: false,
};

export const dynamic = 'force-static'; // (optional, for optimization)
export const navigationOptions = {
  tabBarStyle: { display: 'none' },
  tabBarButton: () => null,
};

export default function HubRoomScreen() {
  const { roomId, roomName } = useLocalSearchParams<{ roomId: string; roomName: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Fetch initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('voice_messages')
        .select('text, user:users(full_name)')
        .eq('group_id', roomId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        setMessages(
          data.map((msg: any) => ({
            user: msg.user?.full_name ?? 'Unknown',
            text: msg.text,
          }))
        );
      }
    };
    fetchMessages();
  }, [roomId]);

  // Real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel('public:voice_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_messages', filter: `group_id=eq.${roomId}` },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => [
            ...prev,
            {
              user: user?.full_name ?? 'Unknown',
              text: newMsg.text,
            },
          ]);
          // Scroll to bottom
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [roomId, user?.full_name]);

  // Send message
  const sendMessage = async () => {
    if (!chatInput.trim()) return;
    await supabase.from('voice_messages').insert({
      group_id: roomId,
      user_id: user?.id,
      text: chatInput,
    });
    setChatInput('');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedText type="title" style={styles.header}>{roomName}</ThemedText>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(_, idx) => idx.toString()}
        renderItem={({ item }) => (
          <View style={styles.messageRow}>
            <ThemedText style={styles.messageUser}>{item.user}:</ThemedText>
            <ThemedText>{item.text}</ThemedText>
          </View>
        )}
        style={styles.messageList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder="Type a message..."
          placeholderTextColor={COLORS.textLight}
        />
        <Pressable style={styles.sendButton} onPress={sendMessage}>
          <ThemedText style={styles.sendButtonText}>Send</ThemedText>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
  },
  messageList: {
    flex: 1,
    marginBottom: 12,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageUser: {
    fontWeight: 'bold',
    color: COLORS.primary,
    marginRight: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 8,
    color: COLORS.textDark,
    backgroundColor: COLORS.white,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  sendButtonText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});