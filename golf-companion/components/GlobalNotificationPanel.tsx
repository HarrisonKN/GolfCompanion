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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/components/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';

import {
  deleteNotification,
  getNotificationHistory,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type StoredNotification,
} from '@/lib/NotificationHistory';

export const GlobalNotificationPanel = React.memo(() => {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const minDim = useMemo(() => Math.min(screenWidth, screenHeight), [screenHeight, screenWidth]);

  const sizes = useMemo(() => {
    // All sizing derives from the current device dimensions.
    const px = (ratio: number) => Math.round(minDim * ratio);
    const pxH = (ratio: number) => Math.round(screenHeight * ratio);
    const border = Math.max(1, px(0.005));

    return {
      bottomOffset: insets.bottom + pxH(0.11),

      handleWidth: Math.max(px(0.06), 22),
      handleHeight: Math.max(px(0.12), 40),

      iconSm: px(0.04),
      iconMd: px(0.06),
      iconLg: px(0.16),

      padXs: px(0.01),
      padSm: px(0.02),
      padMd: px(0.04),

      radiusSm: px(0.03),
      radiusMd: px(0.04),
      radiusLg: px(0.08),

      textXs: px(0.026),
      textSm: px(0.03),
      textMd: px(0.036),
      textLg: px(0.05),

      badgeSize: Math.max(px(0.05), 18),
      badgeBorder: border,

      shadowRadius: px(0.02),
      shadowOffsetY: Math.max(1, px(0.008)),
      elevation: Math.max(2, px(0.015)),
      tapSlop: px(0.02),

      listPad: px(0.03),
      itemGap: px(0.02),
      itemPad: px(0.03),
      itemRadius: px(0.035),

      modalHeaderPadV: px(0.04),
      modalHeaderPadH: px(0.05),
      modalHeaderTopPad: Math.max(px(0.02), insets.top + px(0.02)),

      // Initial hidden position before we measure actual layout width.
      initialCollapsedTranslateX: 0,
    };
  }, [insets.bottom, insets.top, minDim, screenHeight]);

  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showFullModal, setShowFullModal] = useState(false);
  const [collapsedTranslateX] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Keep animation state stable on rotation / dimension changes.
    if (isCollapsed) {
      slideAnim.setValue(0);
    }
  }, [isCollapsed, slideAnim]);

  const prevUnreadCount = useRef(unreadCount);

  const loadUnread = useCallback(async () => {
    if (!user?.id) return;
    const count = await getUnreadNotificationCount(user.id);
    setUnreadCount(count);
  }, [user?.id]);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getNotificationHistory(user.id);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadUnread(), loadNotifications()]);
    setRefreshing(false);
  }, [loadNotifications, loadUnread]);

  useEffect(() => {
    if (!user?.id) return;

    loadUnread();

    const channel = supabase
      .channel(`notification_history:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notification_history', filter: `user_id=eq.${user.id}` },
        () => {
          loadUnread();
          if (showFullModal) {
            loadNotifications();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadNotifications, loadUnread, showFullModal, user?.id]);

  useEffect(() => {
    if (unreadCount > prevUnreadCount.current && unreadCount > 0) {
      setIsCollapsed(false);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
    prevUnreadCount.current = unreadCount;
  }, [slideAnim, unreadCount]);

  const toggleCollapse = () => {
    const toValue = isCollapsed ? 0 : collapsedTranslateX;
    setIsCollapsed(!isCollapsed);

    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      await markNotificationAsRead(notificationId);
      setNotifications(prev => prev.map(n => (n.id === notificationId ? { ...n, read: true } : n)));
      loadUnread();
    },
    [loadUnread]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    await markAllNotificationsAsRead(user.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    loadUnread();
  }, [loadUnread, user?.id]);

  const handleDelete = useCallback(
    async (notificationId: string) => {
      await deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      loadUnread();
    },
    [loadUnread]
  );

  const handleAcceptGameInvite = useCallback(
    async (item: StoredNotification) => {
      const gameId = item.data?.gameId;
      if (!gameId || !user?.id) return;

      await supabase
        .from('game_participantsv2')
        .update({ status: 'accepted' })
        .eq('game_id', gameId)
        .eq('user_id', user.id);

      await deleteNotification(item.id);
      setNotifications(prev => prev.filter(n => n.id !== item.id));
      loadUnread();

      router.push({
        pathname: '/(tabs)/scorecard',
        params: { gameId },
      });
    },
    [loadUnread, router, user?.id]
  );

  const handleDeclineGameInvite = useCallback(
    async (item: StoredNotification) => {
      const gameId = item.data?.gameId;
      if (!gameId || !user?.id) return;

      await supabase
        .from('game_participantsv2')
        .update({ status: 'declined' })
        .eq('game_id', gameId)
        .eq('user_id', user.id);

      await handleDelete(item.id);
    },
    [handleDelete, user?.id]
  );

  const formatTime = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      return `${month} ${day}`;
    } catch {
      return 'unknown';
    }
  }, []);

  const isGameInvite = useCallback((item: StoredNotification) => {
    return (item.title ?? '').toLowerCase().includes('game invite');
  }, []);

  const modalTitle = useMemo(() => '📬 Notifications', []);

  useEffect(() => {
    if (showFullModal) {
      loadNotifications();
    }
  }, [loadNotifications, showFullModal]);

  const renderNotification = useCallback(
    ({ item }: { item: StoredNotification }) => {
      const unread = !item.read;
      const gameInvite = isGameInvite(item);

      return (
        <Pressable
          onPress={() => unread && handleMarkAsRead(item.id)}
          style={[
            styles(palette, sizes, insets).historyItem,
            {
              backgroundColor: unread ? palette.primary + '20' : palette.background,
              borderLeftColor: unread ? palette.primary : palette.grey,
            },
          ]}
        >
          <View style={styles(palette, sizes, insets).historyContent}>
            <View style={styles(palette, sizes, insets).historyHeader}>
              <ThemedText
                style={[
                  styles(palette, sizes, insets).historyTitle,
                  { fontWeight: unread ? '800' : '600' },
                ]}
                numberOfLines={2}
              >
                {item.title}
              </ThemedText>
              {!item.read && <View style={styles(palette, sizes, insets).unreadDot} />}
            </View>

            <ThemedText style={styles(palette, sizes, insets).historyBody} numberOfLines={2}>
              {item.body}
            </ThemedText>

            <ThemedText style={styles(palette, sizes, insets).historyTime}>
              {formatTime(item.created_at)}
            </ThemedText>

            {gameInvite && (
              <View style={styles(palette, sizes, insets).inviteActions}>
                <Pressable
                  style={styles(palette, sizes, insets).inviteAccept}
                  onPress={() => handleAcceptGameInvite(item)}
                >
                  <ThemedText style={styles(palette, sizes, insets).inviteActionText}>Accept</ThemedText>
                </Pressable>
                <Pressable
                  style={styles(palette, sizes, insets).inviteDecline}
                  onPress={() => handleDeclineGameInvite(item)}
                >
                  <ThemedText style={styles(palette, sizes, insets).inviteActionText}>Decline</ThemedText>
                </Pressable>
              </View>
            )}
          </View>

          <Pressable
            style={styles(palette, sizes, insets).historyDelete}
            onPress={() => handleDelete(item.id)}
            hitSlop={sizes.tapSlop}
          >
            <MaterialIcons name="close" size={sizes.iconSm} color={palette.grey} />
          </Pressable>
        </Pressable>
      );
    },
    [
      formatTime,
      handleAcceptGameInvite,
      handleDeclineGameInvite,
      handleDelete,
      handleMarkAsRead,
      isGameInvite,
      palette,
    ]
  );

  return (
    <>
      {/* Notification Panel - Bottom Right */}
      <Animated.View
        style={[
          styles(palette, sizes, insets).container,
          {
            bottom: sizes.bottomOffset,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        {isCollapsed ? (
          // ===== Collapsed State =====
          <View
            style={styles(palette, sizes, insets).collapsedContainer}
            onLayout={() => {
              // No-op: we keep the collapsed panel flush-right.
            }}
          >
            {/* Compact content: notification count moved left of handle */}
            <View style={styles(palette, sizes, insets).collapsedContent}>
              {unreadCount > 0 && (
                <View style={styles(palette, sizes, insets).countBubble}>
                  <ThemedText style={styles(palette, sizes, insets).countText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </ThemedText>
                </View>
              )}
              <MaterialIcons name="notifications" size={Math.round(sizes.iconSm * 0.9)} color={palette.white} />
            </View>

            {/* Expand tab */}
            <Pressable onPress={toggleCollapse} style={styles(palette, sizes, insets).expandTab}>
              <MaterialIcons name="keyboard-arrow-left" size={Math.round(sizes.iconSm * 0.9)} color={palette.white} />
            </Pressable>
          </View>
        ) : (
          // ===== Expanded State =====
          <View style={styles(palette, sizes, insets).expandedContainer}>
            <Pressable 
              onPress={() => {
                setShowFullModal(true);
                loadNotifications();
              }}
              style={styles(palette, sizes, insets).expandedButton}
            >
              <MaterialIcons name="notifications" size={sizes.iconMd} color={palette.white} />
              {unreadCount > 0 && (
                <View style={styles(palette, sizes, insets).badge}>
                  <ThemedText style={styles(palette, sizes, insets).badgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </ThemedText>
                </View>
              )}
            </Pressable>
            
            <Pressable onPress={toggleCollapse} hitSlop={sizes.tapSlop} style={styles(palette, sizes, insets).collapseButton}>
              <MaterialIcons name="keyboard-arrow-right" size={sizes.iconSm} color={palette.white} />
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* Full Screen Modal */}
      <Modal
        visible={showFullModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFullModal(false)}
      >
        <View style={styles(palette, sizes, insets).modalContainer}>
          {/* Header */}
          <View style={styles(palette, sizes, insets).modalHeader}>
            <ThemedText style={styles(palette, sizes, insets).modalTitle}>{modalTitle}</ThemedText>
            <View style={styles(palette, sizes, insets).modalHeaderActions}>
              {unreadCount > 0 && (
                <Pressable onPress={handleMarkAllAsRead} style={styles(palette, sizes, insets).markAllButton}>
                  <ThemedText style={styles(palette, sizes, insets).markAllText}>Mark all read</ThemedText>
                </Pressable>
              )}
              <Pressable onPress={() => setShowFullModal(false)} style={styles(palette, sizes, insets).closeButton}>
                <MaterialIcons name="close" size={sizes.iconMd} color={palette.white} />
              </Pressable>
            </View>
          </View>

          {/* Notifications List */}
          {loading && notifications.length === 0 ? (
            <View style={styles(palette, sizes, insets).loaderContainer}>
              <ActivityIndicator size="large" color={palette.primary} />
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={(item) => item.id}
              contentContainerStyle={
                notifications.length === 0
                  ? styles(palette, sizes, insets).emptyList
                  : styles(palette, sizes, insets).listContent
              }
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.primary}
                />
              }
              ListEmptyComponent={
                <View style={styles(palette, sizes, insets).emptyState}>
                  <MaterialIcons name="notifications-none" size={sizes.iconLg} color={palette.textLight} />
                  <ThemedText style={styles(palette, sizes, insets).emptyText}>All caught up!</ThemedText>
                  <ThemedText style={styles(palette, sizes, insets).emptySubtext}>
                    No notifications right now
                  </ThemedText>
                </View>
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
});

GlobalNotificationPanel.displayName = 'GlobalNotificationPanel';

const styles = (
  palette: any,
  sizes: {
    bottomOffset: number;
    handleWidth: number;
    handleHeight: number;
    iconSm: number;
    iconMd: number;
    iconLg: number;
    padXs: number;
    padSm: number;
    padMd: number;
    radiusSm: number;
    radiusMd: number;
    radiusLg: number;
    textXs: number;
    textSm: number;
    textMd: number;
    textLg: number;
    badgeSize: number;
    badgeBorder: number;
    shadowRadius: number;
    shadowOffsetY: number;
    elevation: number;
    tapSlop: number;
    listPad: number;
    itemGap: number;
    itemPad: number;
    itemRadius: number;
    modalHeaderPadV: number;
    modalHeaderPadH: number;
    modalHeaderTopPad: number;
    initialCollapsedTranslateX: number;
  },
  insets: { top: number; bottom: number }
) =>
  StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 50,
  },
  collapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  expandTab: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: Math.round(sizes.handleWidth * 0.85) + sizes.padXs,
    backgroundColor: palette.primary,
    borderTopRightRadius: sizes.radiusLg,
    borderBottomRightRadius: sizes.radiusLg,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: sizes.padXs,
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: sizes.shadowRadius,
    shadowOffset: { width: 0, height: sizes.shadowOffsetY },
    elevation: sizes.elevation,
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary,
    paddingHorizontal: sizes.padXs,
    paddingVertical: 0,
    height: Math.round(sizes.handleHeight * 0.85),
    borderTopLeftRadius: sizes.radiusMd,
    borderBottomLeftRadius: sizes.radiusMd,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    paddingRight: sizes.padXs + Math.round(sizes.handleWidth * 0.85) + sizes.padXs,
    gap: sizes.padXs,
  },
  countBubble: {
    backgroundColor: palette.error,
    minWidth: Math.round(sizes.badgeSize * 0.9),
    height: Math.round(sizes.badgeSize * 0.9),
    borderRadius: Math.round((sizes.badgeSize * 0.9) / 2),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sizes.padXs,
  },
  countText: {
    color: palette.white,
    fontSize: sizes.textXs,
    fontWeight: '700',
  },
  expandedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.primary,
    borderTopLeftRadius: sizes.radiusLg,
    borderBottomLeftRadius: sizes.radiusLg,
    paddingLeft: sizes.padMd,
    paddingRight: sizes.padSm,
    paddingVertical: sizes.padSm,
    shadowColor: palette.primary,
    shadowOpacity: 0.3,
    shadowRadius: sizes.shadowRadius,
    shadowOffset: { width: 0, height: sizes.shadowOffsetY },
    elevation: sizes.elevation,
  },
  expandedButton: {
    width: Math.max(sizes.handleHeight, sizes.handleWidth) + sizes.padXs,
    height: Math.max(sizes.handleHeight, sizes.handleWidth) + sizes.padXs,
    borderRadius: Math.round((Math.max(sizes.handleHeight, sizes.handleWidth) + sizes.padXs) / 2),
    justifyContent: 'center',
    alignItems: 'center',
  },
  collapseButton: {
    padding: sizes.padXs,
  },
  badge: {
    position: 'absolute',
    top: -sizes.padXs,
    right: 0,
    backgroundColor: palette.error,
    minWidth: sizes.badgeSize,
    height: sizes.badgeSize,
    borderRadius: Math.round(sizes.badgeSize / 2),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: sizes.badgeBorder,
    borderColor: palette.primary,
    paddingHorizontal: sizes.padXs,
  },
  badgeText: {
    color: palette.white,
    fontSize: sizes.textXs,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: palette.background,
  },
  modalHeader: {
    backgroundColor: palette.primary,
    paddingVertical: sizes.modalHeaderPadV,
    paddingHorizontal: sizes.modalHeaderPadH,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: sizes.modalHeaderTopPad,
  },
  modalTitle: {
    fontSize: sizes.textLg,
    fontWeight: '800',
    color: palette.white,
  },
  closeButton: {
    padding: sizes.padXs,
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.itemGap,
  },
  markAllButton: {
    paddingHorizontal: sizes.padSm,
    paddingVertical: sizes.padXs,
    borderRadius: sizes.radiusLg,
    backgroundColor: palette.white + '26',
  },
  markAllText: {
    color: palette.white,
    fontSize: sizes.textSm,
    fontWeight: '700',
  },
  modalContent: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sizes.modalHeaderPadV,
  },
  listContent: {
    padding: sizes.listPad,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Math.max(sizes.modalHeaderPadV, sizes.listPad * 2),
    paddingHorizontal: sizes.listPad,
  },
  emptyText: {
    marginTop: sizes.padMd,
    fontSize: sizes.textMd,
    color: palette.textDark,
    fontWeight: '600',
  },
  emptySubtext: {
    marginTop: sizes.padSm,
    fontSize: sizes.textSm,
    color: palette.textLight,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: sizes.itemPad,
    marginBottom: sizes.itemGap,
    borderRadius: sizes.itemRadius,
    borderLeftWidth: Math.max(2, Math.round(sizes.badgeBorder * 1.5)),
  },
  historyContent: {
    flex: 1,
    marginRight: sizes.padSm,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes.padSm,
    marginBottom: sizes.padXs,
  },
  historyTitle: {
    flex: 1,
    color: palette.textDark,
    fontSize: sizes.textSm,
  },
  unreadDot: {
    width: sizes.padSm,
    height: sizes.padSm,
    borderRadius: Math.round(sizes.padSm / 2),
    backgroundColor: palette.primary,
  },
  historyBody: {
    color: palette.textLight,
    fontSize: sizes.textSm,
    lineHeight: Math.round(sizes.textSm * 1.25),
    marginBottom: sizes.padXs,
  },
  historyTime: {
    color: palette.textLight,
    fontSize: sizes.textXs,
  },
  historyDelete: {
    padding: sizes.padSm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: sizes.itemGap,
    marginTop: sizes.itemGap,
  },
  inviteAccept: {
    backgroundColor: palette.primary,
    paddingHorizontal: sizes.padMd,
    paddingVertical: sizes.padSm,
    borderRadius: sizes.radiusMd,
  },
  inviteDecline: {
    backgroundColor: palette.error,
    paddingHorizontal: sizes.padMd,
    paddingVertical: sizes.padSm,
    borderRadius: sizes.radiusMd,
  },
  inviteActionText: {
    color: palette.white,
    fontWeight: '800',
  },
  });