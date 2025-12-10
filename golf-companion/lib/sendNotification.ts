import { supabase } from "@/components/supabase";

export interface NotificationPayload {
  screen?: string; // 'scorecard' | 'account' | 'gameModes' | 'home' | etc.
  gameId?: string;
  courseId?: string;
  courseName?: string;
  groupId?: string;
  groupName?: string;
  type?: string; // notification type identifier
  [key: string]: string | undefined; // Additional custom data
}

/**
 * Send a notification to a specific user
 * @param userId - Supabase user ID
 * @param title - Notification title (shown in system tray)
 * @param body - Notification body (shown in system tray)
 * @param payload - Navigation and custom data
 * @returns Promise with response data
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  payload?: NotificationPayload
) {
  try {
    console.log(`📤 Sending notification to user ${userId}...`);
    console.log(`   Title: ${title}`);
    console.log(`   Body: ${body}`);
    console.log(`   Payload:`, payload);

    const { data: response, error } = await supabase.functions.invoke(
      "pushNotification",
      {
        body: {
          userId,
          title,
          body,
          data: payload || {},
        },
      }
    );

    if (error) {
      console.error("❌ Failed to send notification:", error);
      throw error;
    }

    console.log("✅ Notification sent successfully:", response);
    return response;
  } catch (err) {
    console.error("❌ Error sending notification:", err);
    // Don't throw - allow notifications to fail gracefully without breaking the app
    return { success: false, error: String(err) };
  }
}

/**
 * Send a notification to multiple users
 * @param userIds - Array of Supabase user IDs
 * @param title - Notification title
 * @param body - Notification body
 * @param payload - Navigation and custom data
 * @returns Promise with array of responses
 */
export async function sendNotificationToMultipleUsers(
  userIds: string[],
  title: string,
  body: string,
  payload?: NotificationPayload
) {
  try {
    console.log(`📤 Sending notifications to ${userIds.length} users...`);
    
    const results = await Promise.all(
      userIds.map((id) => sendNotificationToUser(id, title, body, payload))
    );
    
    const successful = results.filter(r => r.success !== false).length;
    console.log(`✅ Batch notifications sent: ${successful}/${userIds.length} successful`);
    
    return results;
  } catch (err) {
    console.error("❌ Error sending batch notifications:", err);
    // Don't throw - allow batch operations to fail gracefully
    return [];
  }
}

/**
 * Send a notification to a user by their FCM token directly (if you have it)
 * Useful for testing or specialized scenarios
 * @param token - FCM registration token
 * @param title - Notification title
 * @param body - Notification body
 * @param payload - Navigation and custom data
 */
export async function sendNotificationByToken(
  token: string,
  title: string,
  body: string,
  payload?: NotificationPayload
) {
  try {
    console.log(`📤 Sending notification to token: ${token.substring(0, 20)}...`);

    const { data: response, error } = await supabase.functions.invoke(
      "pushNotification",
      {
        body: {
          token,
          title,
          body,
          data: payload || {},
        },
      }
    );

    if (error) {
      console.error("❌ Failed to send notification:", error);
      throw error;
    }

    console.log("✅ Notification sent successfully to token");
    return response;
  } catch (err) {
    console.error("❌ Error sending notification:", err);
    return { success: false, error: String(err) };
  }
}