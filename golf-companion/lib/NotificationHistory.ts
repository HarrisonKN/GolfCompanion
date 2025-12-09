// lib/NotificationHistory.ts
// Manages notification history storage and retrieval
import { supabase } from '@/components/supabase';

export interface StoredNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

/**
 * Save a notification to user's history
 * Called automatically when notifications are received
 */
export async function saveNotificationHistory(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const { error } = await supabase
      .from('notification_history')
      .insert({
        user_id: userId,
        title,
        body,
        data: data || {},
        read: false,
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Failed to save notification history:', error);
      return false;
    }

    console.log('✅ Notification saved to history');
    return true;
  } catch (err) {
    console.error('❌ Error saving notification history:', err);
    return false;
  }
}

/**
 * Get all notifications for a user
 * Sorted by most recent first
 */
export async function getNotificationHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notification_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('❌ Failed to fetch notification history:', error);
      return [];
    }

    return data as StoredNotification[];
  } catch (err) {
    console.error('❌ Error fetching notification history:', err);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notification_history')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('❌ Failed to mark notification as read:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Error marking notification as read:', err);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const { error } = await supabase
      .from('notification_history')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ Failed to mark all notifications as read:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Error marking all notifications as read:', err);
    return false;
  }
}

/**
 * Get count of unread notifications
 */
export async function getUnreadNotificationCount(userId: string) {
  try {
    const { data, error } = await supabase
      .from('notification_history')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('❌ Failed to get unread count:', error);
      return 0;
    }

    return data ? data.length : 0;
  } catch (err) {
    console.error('❌ Error getting unread count:', err);
    return 0;
  }
}

/**
 * Delete a notification from history
 */
export async function deleteNotification(notificationId: string) {
  try {
    const { error } = await supabase
      .from('notification_history')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('❌ Failed to delete notification:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Error deleting notification:', err);
    return false;
  }
}

/**
 * Clear all notification history for a user
 */
export async function clearNotificationHistory(userId: string) {
  try {
    const { error } = await supabase
      .from('notification_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Failed to clear notification history:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('❌ Error clearing notification history:', err);
    return false;
  }
}
