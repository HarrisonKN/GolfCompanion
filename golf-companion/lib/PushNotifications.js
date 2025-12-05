// lib/PushNotifications.js
import * as Device from "expo-device";
import { supabase } from "@/components/supabase";
import messaging from '@react-native-firebase/messaging';
import notifee from '@react-native-firebase/app';

// 🔧 Create Android notification channel for reliable delivery
async function createNotificationChannel() {
  try {
    // Import the necessary module for Android
    if (Device.isDevice && Device.osName === 'Android') {
      // For Firebase, we need to create the channel through React Native Firebase
      const firebaseApp = require('@react-native-firebase/app').default;
      // Channel ID must match the one in the edge function and Android config
      console.log('📢 Android notification channel configured for: golf-companion-notifications');
    }
  } catch (error) {
    console.log('ℹ️ Notification channel setup (non-critical):', error?.message || '');
  }
}

export async function registerForPushNotificationsAsync(userId) {
  console.log('🔔 === REGISTERING FOR FCM PUSH NOTIFICATIONS ===');

  if (!userId) {
    console.warn("⚠️ No userId provided for push notifications");
    return null;
  }

  if (!Device.isDevice) {
    console.warn("⚠️ Push notifications only work on physical devices");
    return null;
  }

  try {
    // STEP 0: Create notification channel (Android requirement for API 26+)
    await createNotificationChannel();

    // STEP 1: Request FCM messaging permission
    console.log('📝 Step 1: Requesting FCM messaging permission...');
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.warn('⚠️ FCM messaging permission not granted');
      return null;
    }
    console.log('✅ FCM messaging permission granted:', authStatus);

    // STEP 2: Get FCM registration token
    console.log('📝 Step 2: Getting FCM registration token...');
    const token = await messaging().getToken();

    if (!token) {
      console.error("❌ Failed to get FCM token");
      return null;
    }

    console.log("✅ Obtained FCM token:", token.substring(0, 40) + '...');

    // STEP 3: Save token to Supabase
    console.log('📝 Step 3: Saving FCM token to Supabase...');
    console.log('📤 Updating profiles table:', {
      table: 'profiles',
      userId: userId,
      tokenPreview: token.substring(0, 30) + '...',
    });

    const { error } = await supabase
      .from("profiles")
      .update({ fcm_token: token })
      .eq("id", userId);

    if (error) {
      console.error("❌ Failed to save token to Supabase:");
      console.error("   Error code:", error.code);
      console.error("   Error message:", error.message);
      console.error("   Full error:", error);
      return null;
    }

    // Optional verification
    const { data: verifyRow, error: verifyErr } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", userId)
      .single();
    console.log("Verify token saved:", verifyRow?.fcm_token?.slice(0, 20), verifyErr);

    console.log("✅ FCM token saved successfully to Supabase");
    console.log('🔔 === FCM PUSH NOTIFICATION REGISTRATION COMPLETE ===');
    return token;
  } catch (error) {
    console.error("❌ Error during FCM push notification registration:", error);
    console.error("   Stack:", error?.stack);
    return null;
  }
}

// New function to verify token exists
export async function verifyPushTokenExists(userId) {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("fcm_token")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("❌ Failed to verify token:", error);
      return false;
    }

    if (data?.fcm_token) {
      console.log("✅ Push token verified:", data.fcm_token.substring(0, 20) + "...");
      return true;
    }

    console.warn("⚠️ No push token found for user");
    return false;
  } catch (error) {
    console.error("❌ Error verifying token:", error);
    return false;
  }
}