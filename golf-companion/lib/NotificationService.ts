// lib/NotificationService.ts
// Centralized notification handling service for FCM
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { supabase } from '@/components/supabase';
import { saveNotificationHistory } from './NotificationHistory';

// Standard notification data structure
export interface NotificationData {
  screen?: string; // Route to navigate to: 'scorecard' | 'account' | 'gameModes' | 'home'
  gameId?: string;
  courseId?: string;
  courseName?: string;
  [key: string]: any; // Allow additional custom data
}

// Navigation mapping
const ROUTE_MAP: Record<string, string> = {
  scorecard: '/(tabs)/scorecard',
  account: '/(tabs)/account',
  gameModes: '/gameModes',
  home: '/(tabs)/index',
  hubRoom: '/hubRoom',
  friendProfile: '/friendProfile',
  startGame: '/startGame',
};

/**
 * Initialize all notification handlers
 * Call this once at app startup in RootLayout
 */
export function initializeNotificationHandlers(
  router: ReturnType<typeof useRouter>,
  onNotificationBannerShow: (title: string, body: string, data: NotificationData) => void
) {
  console.log('🔔 Initializing notification handlers...');

  // Handle local notification tap (when user taps the OS popup we created in onMessage)
  const unsubscribeExpoTap = Notifications.addNotificationResponseReceivedListener(response => {
    const { data } = response.notification.request.content;
    console.log('👆 Local notification tapped (Expo):', data);
    handleNotificationNavigation(router, data);
  });

  // Handle notification tap on cold start (app killed) - gets last notification response
  Notifications.getLastNotificationResponseAsync().then(response => {
    if (response && response.notification && response.notification.request.content.data) {
      console.log('🚀 Cold start from local notification:', response.notification.request.content.data);
      handleNotificationNavigation(router, response.notification.request.content.data);
    }
  });

  // FCM: Handle background message (app closed/killed)
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('🛌 FCM Background message (app closed/killed)');
    // Save to history
    const title = remoteMessage.notification?.title || 'Golf Companion';
    const body = remoteMessage.notification?.body || 'You have a new notification';
    const data = remoteMessage.data;
    await saveNotificationToHistory(title, body, data);
    // Notification delivery and tap handling is automatic via system tray
    // Navigation will be handled when user taps the notification
    return Promise.resolve();
  });

  // FCM: Handle foreground notifications
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    console.log('📬 FCM Foreground message received');
    const title = remoteMessage.notification?.title || 'Golf Companion';
    const body = remoteMessage.notification?.body || 'You have a new notification';
    const data = remoteMessage.data as NotificationData;

    // Save to history
    await saveNotificationToHistory(title, body, data);

    // Also show a local expo notification so user sees a brief OS popup/heads-up
    // This is important for the notification to appear visually in the foreground
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data ?? {},
          // Use the golf-companion-alerts channel for MAX importance (heads-up on Android)
          android: {
            channelId: 'golf-companion-alerts',
          },
        },
        trigger: null, // Show immediately
      });
      console.log('📢 Local notification scheduled for foreground display');
    } catch (err) {
      console.warn('⚠️ Failed to schedule local notification:', err);
    }

    // Show banner for foreground notification
    onNotificationBannerShow(title, body, data);
  });

  // FCM: Handle notification tap (app in background)
  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('👆 FCM Notification tapped (background)');
    if (remoteMessage && remoteMessage.data) {
      handleNotificationNavigation(router, remoteMessage.data as NotificationData);
    }
  });

  // FCM: Handle initial notification on cold start (app was killed)
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('🚀 FCM Cold start notification');
        handleNotificationNavigation(router, remoteMessage.data as NotificationData);
      }
    })
    .catch(err => console.error('❌ Error getting initial notification:', err));

  // Return cleanup function
  return () => {
    console.log('🧹 Cleaning up notification handlers');
    unsubscribeForeground();
    unsubscribeNotificationOpened();
    unsubscribeExpoTap.remove();
  };
}

/**
 * Navigate to the correct screen based on notification data
 */
export function handleNotificationNavigation(
  router: ReturnType<typeof useRouter>,
  data: NotificationData
) {
  if (!data || !data.screen) {
    console.log('⚠️ No navigation data provided');
    return;
  }

  const route = ROUTE_MAP[data.screen];
  if (!route) {
    console.warn(`⚠️ Unknown screen: ${data.screen}`);
    return;
  }

  console.log(`🧭 Navigating to ${data.screen} (${route})`);

  if (data.screen === 'gameModes' && data.gameId) {
    // Game invitation with specific gameId
    router.push({
      pathname: route as any,
      params: {
        gameId: data.gameId,
        courseId: data.courseId || '',
        courseName: data.courseName || '',
        isJoiningExistingGame: '1',
      },
    });
  } else if (data.screen === 'scorecard' && data.gameId) {
    // Scorecard with specific game
    router.push({
      pathname: route as any,
      params: {
        gameId: data.gameId,
      },
    });
  } else {
    // Simple navigation to route
    router.push(route as any);
  }
}

/**
 * Setup Android notification channel for heads-up display
 * Call this during app initialization
 */
export async function setupAndroidNotificationChannel() {
  try {
    // Create channel matching the backend config
    await Notifications.setNotificationChannelAsync('golf-companion-alerts', {
      name: 'Golf Companion Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#609966',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      enableLights: true,
      bypassDnd: false,
      sound: 'default',
    });
    console.log('✅ Android notification channel "golf-companion-alerts" created with MAX importance');
  } catch (error) {
    console.error('⚠️ Error setting up notification channel:', error);
    // Non-critical, Firebase creates a default channel
  }
}

/**
 * Helper function to save notification to history with current user
 */
async function saveNotificationToHistory(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user?.id) {
      await saveNotificationHistory(userData.user.id, title, body, data);
    }
  } catch (err) {
    // Silent fail - don't crash notification handling if history save fails
    console.warn('⚠️ Failed to save notification to history:', err);
  }
}
