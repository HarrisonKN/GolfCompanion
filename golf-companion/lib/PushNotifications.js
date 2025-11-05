import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { supabase } from "@/components/supabase";

export async function registerForPushNotificationsAsync(userId) {
  if (!Device.isDevice) {
    alert("Must use physical device for Push Notifications");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    alert("Permission not granted for notifications");
    return;
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log("Push token:", token);

  const { error } = await supabase
    .from("profiles")
    .update({ expo_push_token: token })
    .eq("id", userId);

  if (error) {
    console.error("❌ Failed to save token to Supabase", error);
  } else {
    console.log("✅ Push token saved to Supabase:", token);
  }

  return token;
}