import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "@/components/supabase";

export async function registerForPushNotificationsAsync(userId) {
  if (!userId) {
    console.warn("⚠️ No userId provided for push notifications");
    return null;
  }

  if (!Device.isDevice) {
    alert("Must use physical device for Push Notifications");
    console.warn("⚠️ Push notifications only work on physical devices");
    return null;
  }



  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      alert("Permission not granted for notifications");
      console.warn("⚠️ Permission not granted for notifications");
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log("Obtained Push token:", token);

    //save to supabase
    const { error } = await supabase
      .from("profiles")
      .update({ expo_push_token: token })
      .eq("id", userId);

    if (error) {
      console.error("❌ Failed to save token to Supabase", error);
      return null
    }

    console.log("✅ Push token saved to Supabase");
    return token;
  }
  catch (error) {
    console.error("❌ Error during push notification registration", error);
    return null;
  }
}