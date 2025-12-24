# Notification Routing Guide - Minimized/Closed App States

## Overview

The notification routing system has been enhanced to reliably handle navigation when the app is in any state:
- **Foreground** - App actively in use
- **Background/Minimized** - App not visible but running
- **Closed/Quit** - App completely terminated

## How It Works

### 1. **Notification Reception**

FCM messages are received by `BackgroundMessageHandler.ts` even when the app is closed. The handler logs the notification but doesn't navigate (no React components available).

### 2. **User Taps Notification**

When user taps the notification in system tray:

#### **Background State** ✅
- `onNotificationOpenedApp()` fires
- Router is available
- **navigateWithRetry()** called with automatic retry logic (3 attempts)
- Exponential backoff: 300ms, 600ms, 900ms between retries

#### **Closed/Quit State** ✅
- App launches fresh
- `getInitialNotification()` checks for pending notification
- Router gets ready (with 3 retry attempts in _layout.tsx)
- Navigation occurs with retry logic (300ms, 600ms, 900ms delays)

### 3. **Navigation Parameters**

The system supports three types of navigation:

#### **Game-Specific Navigation**
```typescript
// Joins a specific game
{
  screen: 'gameModes',
  gameId: 'game123',
  courseId: 'course456',
  courseName: 'Pebble Beach',
  isJoiningExistingGame: '1'
}
```

#### **Scorecard Navigation**
```typescript
// Opens scorecard for a specific game
{
  screen: 'scorecard',
  gameId: 'game123'
}
```

#### **General Navigation**
```typescript
// Navigates to screen (no game context)
{
  screen: 'account'  // or 'home', 'gameModes', etc.
}
```

## Available Routes

The system can navigate to:
- `scorecard` → `/(tabs)/scorecard`
- `account` → `/(tabs)/account`
- `gameModes` → `/gameModes`
- `home` → `/(tabs)/index`
- `hubRoom` → `/hubRoom`
- `friendProfile` → `/friendProfile`
- `startGame` → `/startGame`

## Sending Notifications with Routing Data

### Backend (Supabase Function)

```typescript
// In supabase/functions/pushNotification/index.ts
const messagePayload = {
  message: {
    token: fcmToken,
    notification: {
      title: "Game Invitation",
      body: "Join a game at Pebble Beach",
    },
    data: {
      screen: 'gameModes',           // Where to navigate
      gameId: 'game123',             // Game to join
      courseId: 'course456',         // Course info
      courseName: 'Pebble Beach',    // For display
      // Include custom data here
    },
    // ... Android config
  }
};
```

### Frontend (Sending Function)

```typescript
import { sendNotificationToUser } from '@/lib/sendNotification';

// Invite user to game
await sendNotificationToUser(
  userId,
  'Game Invitation',
  'Join a game at Pebble Beach',
  {
    screen: 'gameModes',
    gameId: 'game123',
    courseId: 'course456',
    courseName: 'Pebble Beach',
    groupId: 'group789',
  }
);
```

## Retry Logic

The system includes automatic retry logic with exponential backoff:

### **navigateWithRetry() Function**
```typescript
// Automatically retries navigation up to 3 times
await navigateWithRetry(router, notificationData, 3);

// With custom retry count
await navigateWithRetry(router, notificationData, 5);
```

**Retry Timeline:**
1. Attempt 1: Immediate
2. Attempt 2: Wait 300ms, then retry
3. Attempt 3: Wait 600ms, then retry
4. Attempt 4: Wait 900ms, then retry
5. Give up: Log error

### **Why Retries?**
- Router may not be ready immediately on cold start
- React Navigation needs time to initialize
- Multiple layers of initialization happening

## Logging & Debugging

All navigation events are logged with emoji prefixes:

```
🚀 Checking for initial notification on cold start...
🎯 Found initial notification on cold start: {gameId: 'game123'}
🔄 Navigation attempt 1/3
⏳ Waiting 300ms before retry...
🔄 Navigation attempt 2/3
📲 Navigation data: {screen: 'gameModes', gameId: 'game123'}
🧭 Navigating to gameModes (/(tabs)/gameModes) with data: {...}
🎮 Navigating to gameModes with gameId: game123
✅ Navigation succeeded on attempt 2
```

**To see these logs:**
1. Open device logs: `adb logcat` (Android)
2. Look for "RN" (React Native) tags
3. Search for emoji prefixes: 🚀, 🎯, ✅, ❌, etc.

## Important Notes

### **Data Requirements**
- Notifications **MUST** include `data` object (not just `notification`)
- `data` must include `screen` parameter for routing
- Without `screen`, app will navigate to home (default)

### **Screen Type Inference**
If `screen` is missing, the system tries to infer it from `type`:
```typescript
if (!data.screen && data.type) {
  // Infer: type 'game_invitation' → screen 'gameModes'
  // Infer: type 'score_update' → screen 'scorecard'
}
```

### **Cold Start vs Background**
- **Cold Start** (app killed): Uses `getInitialNotification()`
- **Background** (app minimized): Uses `onNotificationOpenedApp()`
- Both use same retry/navigation logic

## Testing Navigation

### **Test 1: Foreground Navigation**
1. App is open
2. Send notification
3. User taps notification
4. Should navigate immediately ✅

### **Test 2: Background Navigation**
1. App minimized (background)
2. Send notification
3. Wait 2-3 min for FCM
4. User taps notification
5. Should navigate with retry logic ✅

### **Test 3: Cold Start Navigation**
1. Force close app completely
2. Send notification
3. Wait 2-3 min for FCM
4. User taps notification
5. App launches and navigates ✅

## Troubleshooting

### **Navigation Not Happening?**

1. **Check logs** - Look for emoji-prefixed console logs
2. **Verify data** - Ensure notification includes proper `data` object with `screen`
3. **Check route** - Is `screen` value in ROUTE_MAP?
4. **Wait longer** - FCM can take 2-3 minutes for delivery
5. **Check permissions** - Device notifications must be enabled

### **Navigation Happens But Wrong Screen?**

1. Verify `screen` value in notification data
2. Check ROUTE_MAP has correct route
3. Ensure route path is valid (e.g., `/(tabs)/account`)
4. Test in foreground first

### **App Crashes on Navigation?**

1. Check screen component handles route params
2. Verify params are correct type
3. Check for missing required route params
4. Look for errors in component's `useEffect`

### **Retry Logic Not Working?**

1. Router may not be initialized
2. Check React Navigation setup
3. Verify using async/await with navigateWithRetry
4. Add extra delay before calling navigateWithRetry

## Code Examples

### **Complete Game Invitation Flow**

Backend (Supabase):
```typescript
// When creating game and inviting user
await sendNotificationToUser(
  invitedUserId,
  '⛳ Game Invitation',
  `Join ${senderName}'s game at ${courseName}`,
  {
    screen: 'gameModes',
    gameId: newGame.id,
    courseId: course.id,
    courseName: course.name,
    senderName,
    inviteTime: new Date().toISOString(),
  }
);
```

Frontend (gameModes.tsx):
```typescript
import { useRoute } from '@react-navigation/native';

export default function GameModesScreen() {
  const route = useRoute();
  const { gameId, courseId, courseName, isJoiningExistingGame } = route.params;

  useEffect(() => {
    if (gameId && isJoiningExistingGame === '1') {
      console.log('📬 Navigating from notification invite:', gameId);
      // Auto-join the game
      joinGame(gameId);
    }
  }, [gameId]);

  return (
    // ... game selection UI
  );
}
```

## Files Modified

- `app/_layout.tsx` - Enhanced cold start check with retry logic
- `lib/NotificationService.ts` - Added `navigateWithRetry()` function
- `lib/BackgroundMessageHandler.ts` - Already handles quit state
- `supabase/functions/pushNotification/index.ts` - Already sends data

## Summary

✅ **Foreground**: Immediate navigation via `onMessage` + banner tap
✅ **Background**: Navigation via `onNotificationOpenedApp()` with retries
✅ **Closed/Quit**: Navigation via `getInitialNotification()` with retries
✅ **Retry Logic**: 3 attempts with exponential backoff (300ms, 600ms, 900ms)
✅ **Logging**: Comprehensive emoji-prefixed logs for debugging
✅ **Flexible Routing**: Supports game-specific, general, and type-inferred navigation
