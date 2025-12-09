/**
 * GlobalNotificationPanel
 *
 * Purpose
 * - A floating, always-available notification panel that sits above the tab bar.
 * - Displays pending friend requests and group invites in a collapsible card.
 * - Provides quick access to accept/decline actions without navigating to account page.
 * - Collapsible UI: Expanded (full notification list + controls) and Collapsed (compact notification count).
 *
 * Data Sources
 * - Supabase real-time subscriptions:
 *   - Friend requests (pending)
 *   - Group invites (pending)
 *
 * Behavior
 * - Only renders when there are pending notifications (friend requests or group invites).
 * - Tap to navigate to account page for full notification management.
 * - Slide animation for collapse/expand using React Native Animated.spring.
 *
 * UX Notes
 * - Collapsed state keeps a small tab visible with notification badge showing count.
 * - Shows unread count of all pending notifications.
 * - Quick actions (accept/decline) directly from the panel without full page navigation.
 *
 * Performance Tips
 * - Uses React.memo to prevent unnecessary re-renders.
 * - Animation uses native driver for smooth transitions.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, Animated, Dimensions, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/components/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';

const { width: screenWidth } = Dimensions.get('window');

export const GlobalNotificationPanel = React.memo(() => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [pendingFriendRequests, setPendingFriendRequests] = useState<any[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const slideAnim = useRef(new Animated.Value(150)).current;

  const totalNotifications = pendingFriendRequests.length + pendingInvites.length;

  // Fetch pending notifications
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      const [{ data: requests }, { data: invites }] = await Promise.all([
        supabase
          .from('friend_requests')
          .select('*')
          .eq('requested_user_id', user.id)
          .eq('status', 'pending'),
        supabase
          .from('hubroom_invites')
          .select('id, group_id, voice_groups(name), status')
          .eq('invited_user_id', user.id)
          .eq('status', 'pending'),
      ]);

      setPendingFriendRequests(requests || []);
      setPendingInvites(invites || []);
    };

    fetchNotifications();

    // Subscribe to real-time updates
    const friendChannel = supabase
      .channel('global:friend_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `requested_user_id=eq.${user.id}` },
        (payload) => {
          setPendingFriendRequests(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    const inviteChannel = supabase
      .channel('global:hubroom_invites')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hubroom_invites', filter: `invited_user_id=eq.${user.id}` },
        (payload) => {
          setPendingInvites(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      friendChannel.unsubscribe();
      inviteChannel.unsubscribe();
    };
  }, [user?.id]);

  if (totalNotifications === 0) return null;

  const toggleCollapse = () => {
    const toValue = isCollapsed ? 0 : 150;
    setIsCollapsed(!isCollapsed);

    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleAcceptFriend = async (requestId: string, requesterId: string) => {
    try {
      await supabase.from('friends').insert([
        { user_id: user.id, friend_id: requesterId },
        { user_id: requesterId, friend_id: user.id }
      ]);

      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId);
      setPendingFriendRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const handleDeclineFriend = async (requestId: string) => {
    try {
      await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', requestId);
      setPendingFriendRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error) {
      console.error('Error declining friend request:', error);
    }
  };

  const handleAcceptInvite = async (inviteId: string, groupId: string) => {
    try {
      await supabase.from('voice_group_members').insert({
        group_id: groupId,
        user_id: user.id,
      });

      await supabase.from('hubroom_invites').update({ status: 'accepted' }).eq('id', inviteId);
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (error) {
      console.error('Error accepting invite:', error);
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await supabase.from('hubroom_invites').update({ status: 'declined' }).eq('id', inviteId);
      setPendingInvites(prev => prev.filter(inv => inv.id !== inviteId));
    } catch (error) {
      console.error('Error declining invite:', error);
    }
  };

  const navigateToNotifications = () => {
    router.push('/(tabs)/account');
  };

  return (
    <Animated.View
      style={[
        styles(palette).container,
        {
          bottom: insets.bottom + 90,
          transform: [{ translateX: slideAnim }],
        },
      ]}
    >
      {isCollapsed ? (
        // Collapsed State - Notification Badge
        <View style={styles(palette).collapsedContainer}>
          <Pressable onPress={toggleCollapse} style={styles(palette).expandTab}>
            <MaterialIcons name="notifications" size={18} color={palette.white} />
            <View style={styles(palette).badge}>
              <ThemedText style={styles(palette).badgeText}>{totalNotifications}</ThemedText>
            </View>
          </Pressable>

          <Pressable onPress={navigateToNotifications} style={styles(palette).collapsedLabel}>
            <ThemedText style={styles(palette).collapsedText}>
              {totalNotifications} notification{totalNotifications !== 1 ? 's' : ''}
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        // Expanded State - Full Notification List
        <View style={styles(palette).expandedContainer}>
          {/* Header */}
          <View style={styles(palette).expandedHeader}>
            <ThemedText style={styles(palette).headerTitle}>📬 Notifications</ThemedText>
            <Pressable onPress={toggleCollapse} style={styles(palette).collapseButton}>
              <MaterialIcons name="keyboard-arrow-right" size={20} color={palette.primary} />
            </Pressable>
          </View>

          {/* Notifications List */}
          <ScrollView style={styles(palette).notificationsList} showsVerticalScrollIndicator={false}>
            {/* Friend Requests */}
            {pendingFriendRequests.map(request => (
              <View key={request.id} style={styles(palette).notificationItem}>
                <View style={styles(palette).notificationContent}>
                  <ThemedText style={styles(palette).notificationTitle}>Friend Request</ThemedText>
                  <ThemedText style={styles(palette).notificationMessage}>
                    New friend request received
                  </ThemedText>
                </View>
                <View style={styles(palette).notificationActions}>
                  <Pressable
                    style={styles(palette).acceptButton}
                    onPress={() => handleAcceptFriend(request.id, request.requester_user_id)}
                  >
                    <MaterialIcons name="check" size={16} color={palette.white} />
                  </Pressable>
                  <Pressable
                    style={styles(palette).declineButton}
                    onPress={() => handleDeclineFriend(request.id)}
                  >
                    <MaterialIcons name="close" size={16} color={palette.white} />
                  </Pressable>
                </View>
              </View>
            ))}

            {/* Group Invites */}
            {pendingInvites.map(invite => (
              <View key={invite.id} style={styles(palette).notificationItem}>
                <View style={styles(palette).notificationContent}>
                  <ThemedText style={styles(palette).notificationTitle}>Group Invite</ThemedText>
                  <ThemedText style={styles(palette).notificationMessage} numberOfLines={1}>
                    Join "{invite.voice_groups?.name || 'group'}"
                  </ThemedText>
                </View>
                <View style={styles(palette).notificationActions}>
                  <Pressable
                    style={styles(palette).acceptButton}
                    onPress={() => handleAcceptInvite(invite.id, invite.group_id)}
                  >
                    <MaterialIcons name="check" size={16} color={palette.white} />
                  </Pressable>
                  <Pressable
                    style={styles(palette).declineButton}
                    onPress={() => handleDeclineInvite(invite.id)}
                  >
                    <MaterialIcons name="close" size={16} color={palette.white} />
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* View All Button */}
          <Pressable
            style={styles(palette).viewAllButton}
            onPress={navigateToNotifications}
          >
            <ThemedText style={styles(palette).viewAllText}>View All Notifications</ThemedText>
            <MaterialIcons name="arrow-forward" size={16} color={palette.white} />
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
});

GlobalNotificationPanel.displayName = 'GlobalNotificationPanel';

const styles = (palette: any) => StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    width: screenWidth,
    zIndex: 50,
  },
  collapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    marginBottom: 12,
  },
  expandTab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: palette.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: palette.white,
  },
  badgeText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },
  collapsedLabel: {
    marginRight: 12,
    paddingHorizontal: 12,
  },
  collapsedText: {
    fontSize: 13,
    color: palette.primary,
    fontWeight: '600',
  },
  expandedContainer: {
    backgroundColor: palette.white,
    borderRadius: 16,
    marginRight: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: palette.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    maxHeight: 380,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: palette.primary + '12',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: palette.primary,
    letterSpacing: 0.3,
  },
  collapseButton: {
    padding: 4,
  },
  notificationsList: {
    maxHeight: 280,
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.primary + '08',
  },
  notificationContent: {
    flex: 1,
    marginRight: 10,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 2,
  },
  notificationMessage: {
    fontSize: 12,
    color: palette.textLight,
    fontWeight: '500',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  declineButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: palette.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.error,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewAllButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.primary,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.primary + '12',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.white,
    letterSpacing: 0.3,
  },
});
