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
    console.log('👆 FCM Notification tapped (background/minimized)');
    if (remoteMessage && remoteMessage.data) {
      // Navigate immediately when user taps notification
      console.log('📲 Navigation data:', remoteMessage.data);
      
      // Ensure we have a screen specified
      const navigationData = remoteMessage.data as NotificationData;
      if (!navigationData.screen && navigationData.type) {
        console.log('🔄 Inferring screen from notification type...');
      }
      
      // Navigate with retry logic for background/minimized states
      navigateWithRetry(router, navigationData);
    }
  });

  // FCM: Handle initial notification on cold start (app was killed)
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('🚀 Cold start notification received:', remoteMessage);
        console.log('🚀 FCM data:', remoteMessage.data);
        
        // Delay to ensure router is ready
        setTimeout(() => {
          navigateWithRetry(router, remoteMessage.data as NotificationData);
        }, 800);
      } else {
        console.log('⚠️ No initial notification found on cold start');
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
  console.log('📊 handleNotificationNavigation called with data:', data);
  
  if (!data) {
    console.log('⚠️ No data provided');
    return;
  }

  // Fallback: infer screen from type when missing
  if (!data.screen && data.type) {
    const inferred = inferScreenFromType(data.type as string);
    if (inferred) {
      console.log(`🧠 Inferred screen '${inferred}' from type '${data.type}'`);
      data.screen = inferred;
    }
  }

  if (!data.screen) {
    console.log('⚠️ No screen specified in notification data, available keys:', Object.keys(data));
    return;
  }

  const route = ROUTE_MAP[data.screen];
  if (!route) {
    console.warn(`⚠️ Unknown screen: ${data.screen}, available routes:`, Object.keys(ROUTE_MAP));
    return;
  }

  console.log(`🧭 Navigating to ${data.screen} (${route}) with data:`, data);

  try {
    if (data.screen === 'gameModes' && data.gameId) {
      // Game invitation with specific gameId
      console.log('🎮 Navigating to gameModes with gameId:', data.gameId);
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
      console.log('📊 Navigating to scorecard with gameId:', data.gameId);
      router.push({
        pathname: route as any,
        params: {
          gameId: data.gameId,
        },
      });
    } else {
      // Simple navigation to route
      console.log(`✅ Simple navigation to ${route}`);
      router.push(route as any);
    }
  } catch (err) {
    console.error('❌ Navigation error:', err);
  }
}

/**
 * Navigate with retry logic for background/minimized/cold start states
 * Ensures router is ready before attempting navigation
 * @param router - Expo Router instance
 * @param data - Notification data containing screen/navigation info
 * @param maxRetries - Number of retry attempts (default: 3)
 */
export async function navigateWithRetry(
  router: ReturnType<typeof useRouter>,
  data: NotificationData,
  maxRetries: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Navigation attempt ${attempt}/${maxRetries}`);
      handleNotificationNavigation(router, data);
      console.log('✅ Navigation succeeded on attempt', attempt);
      return;
    } catch (error) {
      console.warn(`⚠️ Navigation attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delayMs = 300 * attempt;
        console.log(`⏳ Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.error('❌ Navigation failed after', maxRetries, 'attempts');
}

// Best-effort inference for legacy payloads that only send type
function inferScreenFromType(type: string): string | null {
  switch (type) {
    case 'friend_request':
    case 'friend_request_accepted':
    case 'group_invite':
      return 'account';
    case 'group_message':
      return 'hubRoom';
    case 'game_invite':
      return 'gameModes';
    case 'score_update':
      return 'scorecard';
    default:
      return null;
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
