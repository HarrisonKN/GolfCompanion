import { supabase } from "@/components/supabase";

export interface NotificationPayload {
  screen?: string; // 'scorecard' | 'account' | 'gameModes' | 'home' | etc.
  gameId?: string;
  courseId?: string;
  courseName?: string;
  [key: string]: string | undefined; // Additional custom data
}

/**
 * Send a notification to a specific user
 * @param userId - Supabase user ID
 * @param title - Notification title
 * @param body - Notification body
 * @param payload - Navigation and custom data
 */
export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  payload?: NotificationPayload
) {
  try {
    console.log(`📤 Sending notification to user ${userId}...`);

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
    throw err;
  }
}

/**
 * Send a notification to multiple users
 * @param userIds - Array of Supabase user IDs
 * @param title - Notification title
 * @param body - Notification body
 * @param payload - Navigation and custom data
 */
export async function sendNotificationToMultipleUsers(
  userIds: string[],
  title: string,
  body: string,
  payload?: NotificationPayload
) {
  try {
    const results = await Promise.all(
      userIds.map((id) => sendNotificationToUser(id, title, body, payload))
    );
    console.log("✅ Batch notifications sent");
    return results;
  } catch (err) {
    console.error("❌ Error sending batch notifications:", err);
    throw err;
  }
}