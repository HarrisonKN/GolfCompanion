import { supabase } from "@/components/supabase";

export async function sendNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
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
          data,
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

export async function sendNotificationToMultipleUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    const results = await Promise.all(
      userIds.map((id) => sendNotificationToUser(id, title, body, data))
    );
    console.log("✅ Batch notifications sent:", results);
    return results;
  } catch (err) {
    console.error("❌ Error sending batch notifications:", err);
    throw err;
  }
}