// lib/analytics.ts
// Firebase Analytics setup for tracking user behavior and app metrics
import analytics from '@react-native-firebase/analytics';

/**
 * Initialize Firebase Analytics
 * Call this once at app startup
 */
export async function initializeAnalytics() {
  try {
    // Enable analytics collection (required for analytics data to be sent to Firebase)
    await analytics().setAnalyticsCollectionEnabled(true);
    console.log('✅ Firebase Analytics initialized');
  } catch (error) {
    console.warn('⚠️ Failed to initialize analytics:', error);
  }
}

/**
 * Track when a user signs up
 */
export async function trackSignup(userId: string, method?: string) {
  try {
    await analytics().logSignUp({
      method: method || 'email',
    });
    await analytics().setUserId(userId);
    console.log('📊 Signup tracked:', { userId, method });
  } catch (error) {
    console.warn('⚠️ Failed to track signup:', error);
  }
}

/**
 * Track when a user logs in
 */
export async function trackLogin(userId: string, method?: string) {
  try {
    await analytics().logLogin({
      method: method || 'email',
    });
    await analytics().setUserId(userId);
    console.log('📊 Login tracked:', { userId, method });
  } catch (error) {
    console.warn('⚠️ Failed to track login:', error);
  }
}

/**
 * Track when a user logs out
 */
export async function trackLogout() {
  try {
    // Clear user ID when logging out
    await analytics().setUserId(null);
    await analytics().logEvent('logout', {
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Logout tracked');
  } catch (error) {
    console.warn('⚠️ Failed to track logout:', error);
  }
}

/**
 * Track when a game is started
 */
export async function trackGameStarted(
  gameId: string,
  courseId: string,
  courseName: string,
  gameMode: string
) {
  try {
    await analytics().logEvent('game_started', {
      game_id: gameId,
      course_id: courseId,
      course_name: courseName,
      game_mode: gameMode,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Game started tracked:', { gameId, courseName, gameMode });
  } catch (error) {
    console.warn('⚠️ Failed to track game started:', error);
  }
}

/**
 * Track when a score is submitted
 */
export async function trackScoreSubmitted(
  gameId: string,
  courseId: string,
  score: number,
  scoreType: 'under' | 'par' | 'over'
) {
  try {
    await analytics().logEvent('score_submitted', {
      game_id: gameId,
      course_id: courseId,
      score: score,
      score_type: scoreType,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Score submitted tracked:', { gameId, score, scoreType });
  } catch (error) {
    console.warn('⚠️ Failed to track score submitted:', error);
  }
}

/**
 * Track when a game is completed/finished
 */
export async function trackGameCompleted(
  gameId: string,
  courseId: string,
  finalScore: number,
  durationMinutes: number
) {
  try {
    await analytics().logEvent('game_completed', {
      game_id: gameId,
      course_id: courseId,
      final_score: finalScore,
      duration_minutes: durationMinutes,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Game completed tracked:', { gameId, finalScore, durationMinutes });
  } catch (error) {
    console.warn('⚠️ Failed to track game completed:', error);
  }
}

/**
 * Track when multiplayer/group functionality is used
 */
export async function trackGroupActivity(
  activityType: 'group_created' | 'group_joined' | 'group_left',
  groupId: string,
  groupSize?: number
) {
  try {
    await analytics().logEvent('group_activity', {
      activity_type: activityType,
      group_id: groupId,
      group_size: groupSize || 0,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Group activity tracked:', { activityType, groupId });
  } catch (error) {
    console.warn('⚠️ Failed to track group activity:', error);
  }
}

/**
 * Track when voice/audio features are used
 */
export async function trackVoiceFeatureUsed(
  featureType: 'voice_chat_started' | 'voice_chat_ended' | 'voice_command_used'
) {
  try {
    await analytics().logEvent('voice_feature_used', {
      feature_type: featureType,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Voice feature tracked:', featureType);
  } catch (error) {
    console.warn('⚠️ Failed to track voice feature:', error);
  }
}

/**
 * Track when Spotify integration is used
 */
export async function trackSpotifyIntegration(action: 'connected' | 'disconnected' | 'playlist_created') {
  try {
    await analytics().logEvent('spotify_integration', {
      action,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Spotify integration tracked:', action);
  } catch (error) {
    console.warn('⚠️ Failed to track spotify integration:', error);
  }
}

/**
 * Track notification engagement
 */
export async function trackNotificationEngagement(
  action: 'received' | 'opened' | 'dismissed',
  notificationType: string
) {
  try {
    await analytics().logEvent('notification_engagement', {
      action,
      notification_type: notificationType,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Notification engagement tracked:', { action, notificationType });
  } catch (error) {
    console.warn('⚠️ Failed to track notification engagement:', error);
  }
}

/**
 * Track when a screen/view is viewed (for custom page tracking)
 */
export async function trackScreenView(screenName: string, screenClass?: string) {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
    console.log('📊 Screen view tracked:', screenName);
  } catch (error) {
    console.warn('⚠️ Failed to track screen view:', error);
  }
}

/**
 * Track app crashes/errors
 */
export async function trackError(errorMessage: string, errorCode?: string) {
  try {
    await analytics().logEvent('app_error', {
      error_message: errorMessage,
      error_code: errorCode || 'unknown',
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Error tracked:', { errorMessage, errorCode });
  } catch (error) {
    console.warn('⚠️ Failed to track error:', error);
  }
}

/**
 * Track custom event with flexible properties
 */
export async function trackCustomEvent(eventName: string, properties?: Record<string, any>) {
  try {
    await analytics().logEvent(eventName, {
      ...(properties || {}),
      timestamp: new Date().toISOString(),
    });
    console.log('📊 Custom event tracked:', { eventName, properties });
  } catch (error) {
    console.warn('⚠️ Failed to track custom event:', error);
  }
}
