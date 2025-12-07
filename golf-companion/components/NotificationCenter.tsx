// components/NotificationCenter.tsx
// Modal component for viewing notification history
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import {
  getNotificationHistory,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  StoredNotification,
} from '@/lib/NotificationHistory';

interface NotificationCenterProps {
  userId: string;
  unreadCount: number;
  onUnreadChange?: (count: number) => void;
}

export function NotificationCenter({
  userId,
  unreadCount,
  onUnreadChange,
}: NotificationCenterProps) {
  const { palette } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationHistory(userId);
      setNotifications(data);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  useEffect(() => {
    if (modalVisible) {
      loadNotifications();
    }
  }, [modalVisible, loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    await markNotificationAsRead(notificationId);
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    if (onUnreadChange) {
      const newUnread = notifications.filter(n => !n.read).length - 1;
      onUnreadChange(Math.max(0, newUnread));
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllNotificationsAsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (onUnreadChange) {
      onUnreadChange(0);
    }
  };

  const handleDelete = async (notificationId: string) => {
    await deleteNotification(notificationId);
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const formatTime = (dateString: string) => {
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
      
      // Format as "Dec 1" without date-fns
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      return `${month} ${day}`;
    } catch {
      return 'unknown';
    }
  };

  const renderNotification = ({ item }: { item: StoredNotification }) => (
    <Pressable
      style={[
        styles.notificationItem,
        {
          backgroundColor: item.read ? palette.background : palette.primary + '20',
          borderLeftColor: item.read ? palette.grey : palette.primary,
        },
      ]}
      onPress={() => !item.read && handleMarkAsRead(item.id)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text
            style={[
              styles.notificationTitle,
              {
                color: palette.textDark,
                fontWeight: item.read ? '500' : '700',
              },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {!item.read && (
            <View
              style={[styles.unreadBadge, { backgroundColor: palette.primary }]}
            />
          )}
        </View>
        <Text
          style={[styles.notificationBody, { color: palette.textLight }]}
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <Text
          style={[styles.notificationTime, { color: palette.textLight }]}
        >
          {formatTime(item.created_at)}
        </Text>
      </View>
      <Pressable
        style={styles.deleteButton}
        onPress={() => handleDelete(item.id)}
      >
        <MaterialIcons name="close" size={20} color={palette.grey} />
      </Pressable>
    </Pressable>
  );

  const emptyComponent = (
    <View style={styles.emptyContainer}>
      <MaterialIcons
        name="notifications-none"
        size={64}
        color={palette.grey}
      />
      <Text style={[styles.emptyText, { color: palette.grey }]}>
        No notifications yet
      </Text>
      <Text style={[styles.emptySubtext, { color: palette.grey }]}>
        When you receive notifications, they'll appear here
      </Text>
    </View>
  );

  return (
    <>
      {/* Floating notification bell icon */}
      <Pressable
        style={[
          styles.floatingButton,
          { backgroundColor: palette.primary },
        ]}
        onPress={() => setModalVisible(true)}
      >
        <MaterialIcons name="notifications" size={24} color="#fff" />
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: '#ff4444' }]}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </Pressable>

      {/* Notification modal */}
      <Modal
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
        animationType="slide"
        presentationStyle="pageSheet"
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" />
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: palette.background },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.modalHeader,
              { backgroundColor: palette.primary },
            ]}
          >
            <Text style={styles.modalTitle}>Notifications</Text>
            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <Pressable
                  style={styles.headerButton}
                  onPress={handleMarkAllAsRead}
                >
                  <Text style={styles.headerButtonText}>Mark all as read</Text>
                </Pressable>
              )}
              <Pressable
                style={styles.headerButton}
                onPress={() => setModalVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* Notifications list */}
          {loading && !notifications.length ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={palette.primary} />
            </View>
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotification}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={emptyComponent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={palette.primary}
                />
              }
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
    zIndex: 1000,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 0,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderLeftWidth: 4,
    alignItems: 'flex-start',
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 14,
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationBody: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
  },
  deleteButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
