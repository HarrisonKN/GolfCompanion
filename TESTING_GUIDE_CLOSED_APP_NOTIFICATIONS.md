# Testing Guide: Cross-App Push Notifications (Including Closed App)

## Overview
This guide helps you test notifications that work when:
- ✅ App is in foreground (focus)
- ✅ App is in background (minimized)
- ✅ App is completely closed/killed (not in memory)

## Architecture Overview

### Flow Diagram
```
Friend sends invitation
    ↓
Edge Function (Supabase)
    ↓
Firebase Cloud Messaging (FCM) v1 API
    ↓
Android Device
    ├─ If app is open: OnMessage handler
    ├─ If app is backgrounded: OnNotificationOpenedApp handler
    └─ If app is closed: System tray notification (FCM shows automatically)
                          ↓
                       User taps notification
                          ↓
                    OnNotificationOpenedApp handler
                          ↓
                    handleNotificationNavigation()
                          ↓
                    Correct screen opens with params
```

## Implementation Status

### ✅ Completed Components

1. **Edge Function** (`supabase/functions/pushNotification/index.ts`)
   - ✅ Manual JWT creation (Deno-native Web Crypto API)
   - ✅ FCM v1 API integration
   - ✅ Android-specific configuration:
     - `priority: "high"` - ensures delivery
     - `channel_id: "golf-companion-notifications"` - matches Android channel
     - `sound: "default"` - audio notification
   - ✅ Payload structure:
     - `notification.title` and `notification.body` (shown in tray)
     - `data` object (enables routing when tapped)
     - `timestamp` and `source` metadata

2. **FCM Handlers** (`app/_layout.tsx`)
   - ✅ `messaging().setBackgroundMessageHandler()` - logs when app is closed (logging only, FCM shows notification automatically)
   - ✅ `messaging().onMessage()` - handles foreground notifications
   - ✅ `messaging().onNotificationOpenedApp()` - handles user tapping notification while app backgrounded
   - ✅ `messaging().getInitialNotification()` - handles app launch from notification when app was closed
   - ✅ `handleNotificationNavigation()` - routes to correct screen with params

3. **FCM Token Registration** (`lib/PushNotifications.js`)
   - ✅ Permission request
   - ✅ Token retrieval
   - ✅ Token save to Supabase `profiles.fcm_token`
   - ✅ Verification/logging
   - ✅ Android notification channel setup

4. **Test UI** (`components/TestNotifications.tsx`)
   - ✅ Friend selection
   - ✅ Three notification types:
     - Simple (basic test)
     - Game (with gameId, courseId, courseName params)
     - Friend Request (routes to account screen)

## Testing Steps

### Test 1: Basic Notification (App in Foreground)

**Objective**: Verify notifications appear and foreground handler works

1. Open Golf Companion app
2. Navigate to settings or wherever TestNotifications component is accessible
3. Select a friend from the list
4. Tap "Send Simple Test Notification"
5. **Expected Result**:
   - Console shows: `"📬 FCM Foreground notification:"`
   - Notification appears in system tray (if app allows notifications)
   - Notification data logged to console

---

### Test 2: Notification While App Backgrounded

**Objective**: Verify `onNotificationOpenedApp` handler works

1. Open Golf Companion app
2. Send a test notification to your device (via friend or TestNotifications)
3. While the notification is visible, press home button or app switcher to background the app (DON'T close it)
4. Tap the notification in the system tray
5. **Expected Result**:
   - App comes to foreground
   - Console shows: `"👆 FCM: User tapped notification (background):"`
   - Navigation occurs:
     - Simple: No specific screen
     - Game: Navigates to `gameModes` screen with gameId/courseId params
     - Friend Request: Navigates to `account` screen

---

### Test 3: Notification While App is Completely Closed (🔥 THE CRITICAL TEST)

**Objective**: Verify notifications work when app is not running at all

1. **Close the app completely**:
   - Android: Go to Settings → Apps → Golf Companion → Force Stop
   - OR: Open app switcher, swipe up on Golf Companion to close it

2. **Verify app is not running**:
   - Check app switcher (should not see Golf Companion)
   - You can kill via terminal if needed: `adb shell am force-stop com.yourpackage.golfcompanion`

3. **From a different device or TestNotifications (different user account)**:
   - Send a notification to the closed device
   - **Expected Result - CRITICAL**:
     - Notification appears in Android system tray immediately
     - Title and body are visible
     - Notification is clickable
     - Console shows: `"🛌 FCM Background message (app closed/killed):"`

4. **Test Navigation from Closed State**:
   - Tap the notification while app is still closed
   - **Expected Result**:
     - App launches
     - Console shows: `"🚀 FCM: App opened from quit state by notification:"`
     - Navigation handler executes:
       - Game invite: Opens `gameModes` with gameId param
       - Friend request: Opens `account` screen
       - Simple: Just opens app

---

### Test 4: Cross-Friend Test (Full End-to-End)

**Objective**: Verify friend-to-friend notifications work in all states

**Setup**: You need two devices or two user accounts

1. **Device A** (Receiver):
   - Logged in as User A
   - Leave app closed/killed

2. **Device B** (Sender):
   - Logged in as User B
   - Open TestNotifications component
   - Select User A from friends list
   - Send "Send Game Invite" notification

3. **Device A**:
   - Notification appears in tray
   - Tap notification
   - **Expected**: 
     - App launches
     - Navigates to gameModes screen
     - Game details display correctly (gameId, courseId, courseName from notification)

---

## Debugging Checklist

### If notifications DON'T appear in system tray:

1. **Verify FCM token is registered**:
   - Open app (logs will show token registration)
   - Check console: `"✅ FCM token saved successfully to Supabase"`
   - Database: SELECT fcm_token FROM profiles WHERE id = 'your-user-id'

2. **Verify edge function is deployed**:
   - Test via: `curl -X POST https://your-supabase.functions.supabase.co/pushNotification`
   - Should show success response with messageId

3. **Check Android notification permissions**:
   - Settings → Apps → Golf Companion → Notifications → Should be enabled
   - Android 13+: Grant notification permission when prompted

4. **Verify notification channel exists**:
   - Console should show: `"📢 Android notification channel configured for: golf-companion-notifications"`
   - This matches the channel_id in edge function Android config

5. **Check Firebase project configuration**:
   - `google-services.json` in `/android/app/` should have correct project ID
   - Firebase Console should show notifications arriving

### If notifications appear but navigation doesn't work:

1. **Verify data object in payload**:
   - Check edge function logs for complete messagePayload
   - Should include `data: { route: "gameModes"/"account", gameId, courseId, ...}`

2. **Check handleNotificationNavigation function**:
   - Verify `data.route` matches available screens
   - Game invites should use route: "gameModes"
   - Friend requests should use route: "account"

3. **Verify routing params are passed correctly**:
   - For game: gameId, courseId, courseName, isJoiningExistingGame
   - Check that screen accepts these params

### If only foreground works but not background:

1. **Verify setBackgroundMessageHandler is set**:
   - In `app/_layout.tsx`, should have messaging().setBackgroundMessageHandler()
   - This should be in the initial useEffect

2. **Force stop the app before sending**:
   - Don't just minimize it
   - Use force stop in Settings or adb
   - Check app switcher to confirm it's gone

3. **Wait a few seconds**:
   - FCM delivery can take 1-5 seconds
   - Check system tray for notification

---

## Key Components Reference

### Edge Function Payload Structure
```javascript
{
  message: {
    token: "fcm-device-token",
    notification: {
      title: "Game Invite",
      body: "User invited you to a game"
    },
    data: {
      testType: "game",
      route: "gameModes",
      gameId: "game-123",
      courseId: "course-456",
      courseName: "Pebble Beach",
      timestamp: "2024-01-15T10:30:00Z",
      source: "golf-companion"
    },
    android: {
      priority: "high",
      ttl: "86400s",
      notification: {
        sound: "default",
        channel_id: "golf-companion-notifications",
        click_action: "FLUTTER_NOTIFICATION_CLICK"
      }
    }
  }
}
```

### FCM Handler Execution Order

**App in Foreground**:
1. Message arrives from FCM
2. `onMessage()` fires → console: "📬 FCM Foreground notification"
3. Your custom handling (if any)

**App in Background** (minimized):
1. Message arrives from FCM
2. FCM shows notification in system tray automatically
3. User taps notification
4. `onNotificationOpenedApp()` fires → console: "👆 FCM: User tapped notification (background)"
5. Navigation handler executes

**App Completely Closed/Killed**:
1. Message arrives from FCM
2. FCM shows notification in system tray automatically (no app needed!)
3. `setBackgroundMessageHandler()` fires in the background (app not launched) → console: "🛌 FCM Background message"
4. User taps notification
5. App launches
6. `getInitialNotification()` fires → console: "🚀 FCM: App opened from quit state"
7. Navigation handler executes

---

## Important Notes

- **Android handles notifications automatically**: The system tray notification appears WITHOUT app being open
- **setBackgroundMessageHandler is logging only**: It doesn't prevent the notification from showing, it just logs that a message arrived
- **Navigation happens on tap**: User must tap the notification to trigger navigation
- **Data object is required**: Without it, navigation won't work (notification still shows though)
- **Timestamp and source are metadata**: Added for debugging, not required for functionality
- **High priority + channel_id ensures delivery**: Even on older Android versions with Doze/Battery Optimization

---

## Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Notification appears but navigation doesn't work | Check `data` object in payload and route names in `handleNotificationNavigation()` |
| Notification doesn't appear in tray | Check FCM token registration and notification permissions |
| Foreground works but not background | Force stop app (don't just minimize), verify `onNotificationOpenedApp()` |
| getInitialNotification returns null | Ensure app was killed (not backgrounded) when notification arrived |
| Notification appears but silently (no sound) | Check Android notification settings and `sound: "default"` in edge function |

---

## Next Steps After Testing

1. ✅ All tests pass → Ready to remove TestNotifications from production
2. ✅ Navigation works → Ready for user-facing notifications
3. ✅ Background works → Ready to integrate with real game invitations
4. Implement notification handling in actual game screens (gameModes, account, etc.)
5. Add notification counters/badges if desired
6. Consider implementing notification sounds and vibration patterns
