// NOTIFICATION SYSTEM - QUICK REFERENCE GUIDE

/**
 * ============================================
 * WHAT WAS ADDED
 * ============================================
 * 
 * New Files:
 * - lib/NotificationService.ts       → Core notification handling
 * - lib/NotificationTriggers.ts      → Helper functions for sending notifications
 * - NOTIFICATIONS_INTEGRATION.md      → Complete integration documentation
 * - NOTIFICATION_USAGE_EXAMPLES.md    → Code examples
 * 
 * Updated Files:
 * - app/_layout.tsx                   → Uses NotificationService
 * - app/(tabs)/account.tsx            → Friend request notifications
 * - app/startGame.tsx                 → Game invite notifications
 * - app/hubRoom.tsx                   → Group invite & message notifications
 * - app/(tabs)/golfHub.tsx            → Group invite notifications
 * - lib/PushNotifications.js          → Uses NotificationService
 * - lib/sendNotification.ts           → Clean notification payload
 */

/**
 * ============================================
 * NOTIFICATION TRIGGERS BY FEATURE
 * ============================================
 */

// 1. FRIENDS SYSTEM
// When: User sends friend request
// What: notifyFriendRequest(recipientId, senderName)
// File: app/(tabs)/account.tsx → handleAddFriend()
// Route: account screen

// When: Friend request is accepted
// What: notifyFriendRequestAccepted(recipientId, acceptorName)
// File: app/(tabs)/account.tsx → acceptInvite()
// Route: account screen

// 2. GAMES SYSTEM
// When: User creates game with invites
// What: notifyGameInvite(recipientId, inviterName, courseName, gameId)
// File: app/startGame.tsx → handleBegin()
// Route: gameModes screen (includes gameId)

// 3. GROUPS (HubRoom)
// When: User invites friend to group
// What: notifyGroupInvite(recipientId, inviterName, groupName, groupId)
// File: app/hubRoom.tsx → inviteFriend()
// File: app/(tabs)/golfHub.tsx → inviteFriend()
// Route: account screen (pending invites)

// When: User sends message in group
// What: notifyGroupMessage(recipientId, senderName, groupName, messagePreview, groupId)
// File: app/hubRoom.tsx → sendMessage()
// Route: hubRoom screen (includes groupId)

/**
 * ============================================
 * AVAILABLE FUNCTIONS
 * ============================================
 */

// Friend Requests
notifyFriendRequest(userId: string, requesterName: string)
notifyFriendRequestAccepted(userId: string, acceptorName: string)

// Games
notifyGameInvite(userId: string, inviterName: string, courseName: string, gameId: string)
notifyScoreUpdate(userIds: string[], playerName: string, score: number, gameId: string, courseName: string)
notifyGameComplete(userIds: string[], gameId: string, winner: string | null, courseName: string)

// Groups
notifyGroupInvite(userId: string, inviterName: string, groupName: string, groupId: string)
notifyGroupMessage(userId: string, senderName: string, groupName: string, messagePreview: string, groupId: string)

// Generic
notifyUser(userId: string, title: string, body: string, payload?: NotificationPayload)

/**
 * ============================================
 * NOTIFICATION PAYLOAD STRUCTURE
 * ============================================
 */

interface NotificationPayload {
  screen?: 'scorecard' | 'account' | 'gameModes' | 'home' | 'hubRoom' | 'friendProfile' | 'startGame'
  gameId?: string
  courseId?: string
  courseName?: string
  groupId?: string
  groupName?: string
  type?: string
  [key: string]: any
}

/**
 * ============================================
 * IMPORT STATEMENTS
 * ============================================
 */

// For sending notifications (from anywhere)
import { notifyFriendRequest, notifyGameInvite, ... } from '@/lib/NotificationTriggers'

// For generic user notifications
import { notifyUser } from '@/lib/NotificationTriggers'

// For sending raw notification (low-level)
import { sendNotificationToUser } from '@/lib/sendNotification'

/**
 * ============================================
 * TESTING NOTIFICATIONS
 * ============================================
 */

// In Account screen:
// 1. Tap "Show Tests" button at bottom
// 2. TestNotifications component will appear
// 3. See your current FCM token
// 4. Select a friend and send test notification
// 5. Check if notification appears on their device

/**
 * ============================================
 * ANDROID CONFIGURATION
 * ============================================
 */

// Notification Channel (set automatically on app startup):
// Name: "golf-companion-alerts"
// Importance: MAX (heads-up notifications)
// Sound: enabled
// Vibration: enabled
// Lights: enabled

// Backend: Firebase Cloud Messaging (FCM)
// Service Account: Configured in Supabase
// Cloud Function: supabase/functions/pushNotification

/**
 * ============================================
 * DEEP LINKING
 * ============================================
 */

// When user taps a notification, app opens and navigates to:

// Friend request → Account tab (shows pending requests)
// Game invite → GameModes screen + gameId (preloads game)
// Group invite → Account tab (shows pending invites)
// Group message → HubRoom + groupId (opens group chat)

/**
 * ============================================
 * ERROR HANDLING
 * ============================================
 */

// All notification functions:
// ✅ Handle errors internally
// ✅ Log to console for debugging
// ✅ Don't crash the app if notifications fail
// ✅ Are non-blocking (use try-catch but don't await in critical paths)

// Pattern:
try {
  await notifyGameInvite(...)
} catch (error) {
  console.warn('Notification failed:', error)
  // App continues - game was created successfully
}

/**
 * ============================================
 * INTEGRATION CHECKLIST
 * ============================================
 */

// ✅ Notification service created and working
// ✅ All trigger functions implemented
// ✅ Friend request notifications enabled
// ✅ Game invite notifications enabled
// ✅ Group invite notifications enabled
// ✅ Group message notifications enabled
// ✅ Navigation/deep linking configured
// ✅ Android notification channel configured
// ✅ Error handling in place
// ✅ Test component available
// ✅ Documentation complete

/**
 * ============================================
 * COMMON ISSUES & SOLUTIONS
 * ============================================
 */

// Issue: Notifications not showing
// Check:
// 1. Device has internet connection
// 2. App has notification permission (Android 13+)
// 3. FCM token is saved (check Account → Show Tests)
// 4. Cloud function is deployed (check Supabase)

// Issue: Navigation doesn't work after tap
// Check:
// 1. screen parameter is set in notification payload
// 2. Screen route exists in ROUTE_MAP
// 3. App is fully initialized (not during boot)

// Issue: Duplicate notifications
// Check:
// 1. Function not called twice in same operation
// 2. Realtime subscriptions not conflicting
// 3. No accidental Promise.all duplication

// Issue: FCM token is null
// Check:
// 1. Device has Google Play Services
// 2. App was killed and relaunched
// 3. Try: Account → Show Tests → Refresh Token

/**
 * ============================================
 * FUTURE ENHANCEMENTS
 * ============================================
 */

// Tier 1 (Easy):
// ☐ Notification sound customization
// ☐ Notification badges/counts
// ☐ "Mute notifications" toggle per friend/group
// ☐ Notification history log

// Tier 2 (Medium):
// ☐ Score update notifications (when player posts score)
// ☐ Game completion notifications (when round finishes)
// ☐ Typing indicators in group chat
// ☐ Friend online/offline status

// Tier 3 (Complex):
// ☐ User notification preferences (opt-in/out by type)
// ☐ Scheduled notifications
// ☐ Smart notification delivery (quiet hours)
// ☐ Analytics & tracking (which notifications work best)

/**
 * ============================================
 * PRODUCTION CHECKLIST
 * ============================================
 */

// Before deploying:
// ☐ Test notifications on real Android device
// ☐ Test with app in background
// ☐ Test with app killed/closed
// ☐ Verify deep linking works correctly
// ☐ Check FCM tokens are stored securely
// ☐ Verify error handling doesn't block UX
// ☐ Test with slow network
// ☐ Monitor console for notification errors
// ☐ Get user feedback on notification usefulness
// ☐ Consider privacy implications
