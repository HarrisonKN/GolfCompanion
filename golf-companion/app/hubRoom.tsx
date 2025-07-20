import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from "@/components/ThemeContext";
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';
import { KeyboardAwareFlatList } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const unstable_settings = {
  initialRoute: false,
  tabBarVisible: false,
};

export const dynamic = 'force-static';
export const navigationOptions = {
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
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={
        Platform.OS === 'ios' ? insets.top + 64 : insets.top + 60
      }
    >
      <View style={styles(palette).screen}>
        <ThemedText type="title" style={styles(palette).header}>
          {roomName}
        </ThemedText>

        <View style={styles(palette).flexContainer}>
          <KeyboardAwareFlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(_, idx) => idx.toString()}
            renderItem={({ item }) => (
              <View style={styles(palette).messageRow}>
                <ThemedText style={styles(palette).messageUser}>{item.user}:</ThemedText>
                <ThemedText style={styles(palette).messageText}>{item.text}</ThemedText>
              </View>
            )}
            style={styles(palette).messageList}
            contentContainerStyle={{ paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            extraHeight={100}
            enableOnAndroid={true}
          />

          <View style={styles(palette).inputRowContainer}>
            <View style={styles(palette).inputRow}>
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
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ---- Dynamic Styles ----
const styles = (palette: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.primary,
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
    color: palette.primary,
    marginRight: 6,
  },
  messageText: {
    color: palette.black,
  },
  inputRowContainer: {
    backgroundColor: palette.background,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: palette.primary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.primary,
    borderRadius: 8,
    padding: 8,
    color: palette.textDark,
    backgroundColor: palette.white,
  },
  sendButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  sendButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
  flexContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
});
