// lib/PushNotifications.js
import * as Device from "expo-device";
import * as Notifications from 'expo-notifications';
import { supabase } from "@/components/supabase";
import messaging from '@react-native-firebase/messaging';
import { setupAndroidNotificationChannel } from './NotificationService';

// 🔧 Create Android notification channel for reliable delivery with heads-up display
// This MUST match the channel_id in the edge function: 'golf-companion-alerts'
async function createNotificationChannel() {
  try {
    if (Device.isDevice && Device.osName === 'Android') {
      // Create the channel before registering for token
      // This ensures FCM recognizes the channel when messages arrive
      await setupAndroidNotificationChannel();
      console.log('✅ Android notification channel created and ready');
    }
  } catch (error) {
    // Channel creation is non-critical, as Firebase creates a default one
    console.log('ℹ️ Notification channel setup (non-critical):', error?.message || '');
  }
}

/**
 * Request user permission for push notifications (both OS-level and FCM)
 * This follows the pattern from Firebase FCM v1 setup guide
 */
async function requestUserPermission() {
  console.log('📝 Requesting user permission for push notifications...');
  
  try {
    // Request FCM messaging permission (iOS-specific but harmless on Android)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('✅ FCM Authorization status:', authStatus);
      return true;
    } else {
      console.warn('⚠️ FCM messaging permission not granted');
      return false;
    }
  } catch (error) {
    console.error('❌ Error requesting FCM permission:', error);
    return false;
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
    // STEP 0: Create notification channel FIRST (Android requirement for API 26+)
    // This must happen before requesting permissions or getting tokens
    await createNotificationChannel();

    // STEP 1: Request OS notification permission (Android 13+)
    console.log('📝 Step 1: Requesting OS notification permission...');
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('⚠️ Notification permission denied at OS level');
      return null;
    }

    // STEP 2: Request FCM messaging permission using the dedicated function
    console.log('📝 Step 2: Requesting FCM messaging permission...');
    const hasPermission = await requestUserPermission();
    if (!hasPermission) {
      console.warn('⚠️ FCM messaging permission not granted');
      return null;
    }

    // STEP 3: Get FCM registration token
    console.log('📝 Step 3: Getting FCM registration token...');
    const token = await messaging().getToken();

    if (!token) {
      console.error("❌ Failed to get FCM token");
      return null;
    }

    console.log("✅ Obtained FCM token:", token.substring(0, 40) + '...');

    // STEP 4: Save token to Supabase
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