// lib/BackgroundMessageHandler.ts
// This file MUST be imported at the very top of the app to set up background message handling
// Background message handler must be registered before the app initializes
import messaging from '@react-native-firebase/messaging';
import { supabase } from '@/components/supabase';
import { saveNotificationHistory } from './NotificationHistory';

console.log('⚙️ Setting up FCM background message handler...');

// This runs even when the app is completely closed/killed
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('🛌 FCM Background message received (app closed/minimized)');
  
  try {
    const title = remoteMessage.notification?.title || 'Golf Companion';
    const body = remoteMessage.notification?.body || 'You have a new notification';
    const data = remoteMessage.data;

    console.log('📌 Background notification details:');
    console.log('   Title:', title);
    console.log('   Body:', body);
    console.log('   Data:', data);

    // Try to resolve the current user and save to history
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (userId) {
        await saveNotificationHistory(userId, title, body, data || {});
        console.log('✅ Background notification saved to history for user', userId);
      } else {
        console.log('ℹ️ No authenticated user found in background; skipping history save');
      }
    } catch (historyErr) {
      console.warn('⚠️ Failed to save background notification history:', historyErr);
    }

    // Return success - FCM will automatically display the notification in the system tray
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Error handling background message:', error);
    return Promise.reject(error);
  }
});

console.log('✅ FCM background message handler registered');
