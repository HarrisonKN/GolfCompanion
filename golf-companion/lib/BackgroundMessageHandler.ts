// lib/BackgroundMessageHandler.ts
// CRITICAL: This file MUST be imported at the VERY TOP of the app's entry point (_layout.tsx)
// 
// The setBackgroundMessageHandler() MUST be called at module load time (not inside useEffect or any React component)
// This ensures it's registered BEFORE the app component tree initializes.
// When the app is in quit/closed state, React components don't exist, but this module-level code still runs.
//
// Reference: https://rnfirebase.io/messaging/usage#background--quit-state-messages

import messaging from '@react-native-firebase/messaging';

console.log('⚙️ Setting up FCM background message handler...');

// Register the background message handler at module load time (outside React)
// This is called even when the app is completely closed/killed
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

    // In quit state, we can only do minimal processing.
    // FCM will automatically display the notification in the system tray.
    // We attempt to save to history, but don't fail if it doesn't work.
    
    // Lazily import supabase and history functions only when needed in background handler
    // This avoids initializing React dependencies at module load time
    try {
      const { supabase } = await import('@/components/supabase');
      const { saveNotificationHistory } = await import('./NotificationHistory');
      
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (userId) {
        await saveNotificationHistory(userId, title, body, data || {});
        console.log('✅ Background notification saved to history for user', userId);
      } else {
        console.log('ℹ️ No authenticated user found in background; skipping history save');
      }
    } catch (historyErr) {
      // Silently fail - the notification is still shown in system tray even if we can't save history
      console.warn('⚠️ Failed to save background notification history (this is OK in quit state):', historyErr);
    }

    // Return success - FCM will automatically display the notification in the system tray
    return Promise.resolve();
  } catch (error) {
    console.error('❌ Error handling background message:', error);
    // Still return success - we want FCM to show the notification even if our handler fails
    return Promise.resolve();
  }
});

console.log('✅ FCM background message handler registered');
