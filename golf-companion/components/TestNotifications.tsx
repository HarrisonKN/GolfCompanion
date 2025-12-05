// components/TestNotifications.tsx
// 🧪 Complete FCM Test Notification Component
// Provides UI to test push notifications in development

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from './supabase';
import { sendNotificationToUser } from '@/lib/sendNotification';
import Toast from 'react-native-toast-message';
import messaging from '@react-native-firebase/messaging';

type Friend = {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  fcm_token?: string | null;
};

type TestNotificationsProps = {
  currentUserId: string;
  palette: any;
};

export function TestNotifications({ currentUserId, palette }: TestNotificationsProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  useEffect(() => {
    loadFriends();
    loadCurrentToken();
  }, []);

  const loadCurrentToken = async () => {
    try {
      const token = await messaging().getToken();
      setCurrentToken(token);
      console.log('📱 Current FCM Token:', token.substring(0, 30) + '...');
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
    }
  };

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select(`
          friend_id,
          profiles:profiles!friends_friend_id_profiles_fkey(id, full_name, avatar_url, fcm_token)
        `)
        .eq('user_id', currentUserId);

      if (error) throw error;

      const friendsList: Friend[] =
        data
          ?.map((item: any) => item.profiles?.[0])
          .filter((p: any) => p?.id) || [];

      setFriends(friendsList);
      console.log(`👥 Loaded ${friendsList.length} friends for testing`);
    } catch (error: any) {
      console.error('❌ Error loading friends:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to load friends',
        text2: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async (
    targetUserId: string,
    testType: 'simple' | 'game' | 'friend-request'
  ) => {
    setSending(true);
    try {
      let title = '';
      let body = '';
      let data: Record<string, string> = { testType };

      switch (testType) {
        case 'simple':
          title = '🧪 Test Notification';
          body = 'This is a simple test notification from Golf Companion';
          break;
        case 'game':
          title = '⛳ Game Invitation';
          body = 'You have been invited to a golf game!';
          data = {
            ...data,
            route: 'gameModes',
            gameId: 'test-game-123',
            courseId: 'test-course-456',
            courseName: 'Test Course',
          };
          break;
        case 'friend-request':
          title = '👋 Friend Request';
          body = 'Someone wants to be your friend!';
          data = {
            ...data,
            route: 'account',
          };
          break;
      }

      console.log(`📤 Sending ${testType} notification to user ${targetUserId}`);
      
      await sendNotificationToUser(targetUserId, title, body, data);

      Toast.show({
        type: 'success',
        text1: '✅ Notification Sent!',
        text2: `${testType} notification sent successfully`,
      });

      console.log(`✅ ${testType} notification sent to ${targetUserId}`);
    } catch (error: any) {
      console.error('❌ Failed to send notification:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to send notification',
        text2: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  const sendToSelf = async () => {
    setSending(true);
    try {
      console.log('📤 Sending test notification to self...');
      await sendNotificationToUser(
        currentUserId,
        '🔔 Self Test',
        'Testing notification to yourself!',
        { testType: 'self-test' }
      );

      Toast.show({
        type: 'success',
        text1: '✅ Self-Test Sent!',
        text2: 'Check if you received the notification',
      });
    } catch (error: any) {
      console.error('❌ Self-test failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Self-test failed',
        text2: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  const verifyTokenInDatabase = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('fcm_token')
        .eq('id', currentUserId)
        .single();

      if (error) throw error;

      if (data?.fcm_token) {
        Alert.alert(
          '✅ Token Verified',
          `Your FCM token is saved:\n\n${data.fcm_token.substring(0, 50)}...`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          '⚠️ No Token Found',
          'No FCM token found in database. Please restart the app.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      Alert.alert('❌ Error', error.message);
    }
  };

  const refreshToken = async () => {
    setSending(true);
    try {
      console.log('🔄 Refreshing FCM token...');
      
      // Get new token
      const newToken = await messaging().getToken();
      
      // Save to database
      const { error } = await supabase
        .from('profiles')
        .update({ fcm_token: newToken })
        .eq('id', currentUserId);

      if (error) throw error;

      setCurrentToken(newToken);
      
      Toast.show({
        type: 'success',
        text1: '✅ Token Refreshed',
        text2: 'New FCM token saved',
      });

      console.log('✅ New token:', newToken.substring(0, 30) + '...');
    } catch (error: any) {
      console.error('❌ Token refresh failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Token refresh failed',
        text2: error.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.background }]}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: palette.textDark }]}>
          🧪 Notification Testing
        </Text>
        
        {/* Token Status */}
        <View style={[styles.card, { backgroundColor: palette.secondary }]}>
          <Text style={[styles.cardTitle, { color: palette.textDark }]}>
            📱 Your FCM Token Status
          </Text>
          <Text style={[styles.tokenText, { color: palette.textLight }]} numberOfLines={2}>
            {currentToken ? `${currentToken.substring(0, 60)}...` : 'Loading...'}
          </Text>
          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.smallButton, { backgroundColor: palette.primary }]}
              onPress={verifyTokenInDatabase}
            >
              <Text style={styles.buttonText}>Verify in DB</Text>
            </Pressable>
            <Pressable
              style={[styles.smallButton, { backgroundColor: palette.third }]}
              onPress={refreshToken}
              disabled={sending}
            >
              <Text style={styles.buttonText}>Refresh Token</Text>
            </Pressable>
          </View>
        </View>

        {/* Self Test */}
        <View style={[styles.card, { backgroundColor: palette.secondary }]}>
          <Text style={[styles.cardTitle, { color: palette.textDark }]}>
            🔔 Self Test
          </Text>
          <Text style={[styles.description, { color: palette.textLight }]}>
            Send a notification to yourself to verify the system works
          </Text>
          <Pressable
            style={[styles.testButton, { backgroundColor: palette.primary }]}
            onPress={sendToSelf}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send to Myself</Text>
            )}
          </Pressable>
        </View>

        {/* Friends List */}
        <View style={[styles.card, { backgroundColor: palette.secondary }]}>
          <Text style={[styles.cardTitle, { color: palette.textDark }]}>
            👥 Test with Friends
          </Text>
          <Text style={[styles.description, { color: palette.textLight }]}>
            Select a friend and send different types of test notifications
          </Text>

          {loading ? (
            <ActivityIndicator color={palette.primary} size="large" style={{ marginTop: 20 }} />
          ) : friends.length === 0 ? (
            <Text style={[styles.noFriends, { color: palette.textLight }]}>
              No friends found. Add friends first!
            </Text>
          ) : (
            <View style={styles.friendsList}>
              {friends.map((friend) => (
                <Pressable
                  key={friend.id}
                  style={[
                    styles.friendItem,
                    {
                      backgroundColor:
                        selectedFriend?.id === friend.id
                          ? palette.primary
                          : palette.third,
                    },
                  ]}
                  onPress={() => setSelectedFriend(friend)}
                >
                  <Text style={[styles.friendName, { color: palette.white }]}>
                    {friend.full_name}
                  </Text>
                  {!friend.fcm_token && (
                    <Text style={[styles.noTokenBadge, { color: palette.error }]}>
                      ⚠️ No token
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          )}

          {selectedFriend && (
            <View style={styles.testButtons}>
              <Text style={[styles.selectedText, { color: palette.textDark }]}>
                Testing with: {selectedFriend.full_name}
              </Text>
              
              <Pressable
                style={[styles.testButton, { backgroundColor: palette.primary }]}
                onPress={() => sendTestNotification(selectedFriend.id, 'simple')}
                disabled={sending || !selectedFriend.fcm_token}
              >
                <Text style={styles.buttonText}>📬 Simple Test</Text>
              </Pressable>

              <Pressable
                style={[styles.testButton, { backgroundColor: palette.third }]}
                onPress={() => sendTestNotification(selectedFriend.id, 'game')}
                disabled={sending || !selectedFriend.fcm_token}
              >
                <Text style={styles.buttonText}>⛳ Game Invite Test</Text>
              </Pressable>

              <Pressable
                style={[styles.testButton, { backgroundColor: palette.secondary }]}
                onPress={() => sendTestNotification(selectedFriend.id, 'friend-request')}
                disabled={sending || !selectedFriend.fcm_token}
              >
                <Text style={styles.buttonText}>👋 Friend Request Test</Text>
              </Pressable>

              {!selectedFriend.fcm_token && (
                <Text style={[styles.warningText, { color: palette.error }]}>
                  ⚠️ This friend has no FCM token. They need to log in first.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Info Section */}
        <View style={[styles.card, { backgroundColor: palette.secondary }]}>
          <Text style={[styles.cardTitle, { color: palette.textDark }]}>
            ℹ️ Testing Info
          </Text>
          <Text style={[styles.infoText, { color: palette.textLight }]}>
            • Simple Test: Basic notification{'\n'}
            • Game Invite: Opens gameModes screen{'\n'}
            • Friend Request: Opens account screen{'\n\n'}
            All notifications are sent via FCM (Firebase Cloud Messaging)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  tokenText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButton: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  friendsList: {
    marginTop: 12,
    gap: 8,
  },
  friendItem: {
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
  },
  noTokenBadge: {
    fontSize: 12,
  },
  noFriends: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 14,
  },
  testButtons: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  selectedText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
