# 🔔 FCM Push Notifications - Implementation Guide

## Overview
This project uses **Firebase Cloud Messaging (FCM)** for all push notifications. We have completely removed `expo-notifications` dependencies and use native FCM throughout.

---

## 📁 Key Files

### Client-Side (React Native)

#### 1. **`lib/PushNotifications.js`**
- **Purpose**: Register FCM tokens on user login
- **Key Functions**:
  - `registerForPushNotificationsAsync(userId)` - Gets FCM token and saves to database
  - `verifyPushTokenExists(userId)` - Checks if user has a valid token
- **Dependencies**: `@react-native-firebase/messaging`, `expo-device`

#### 2. **`lib/sendNotification.ts`**
- **Purpose**: Client-side helper to invoke the Supabase edge function
- **Key Functions**:
  - `sendNotificationToUser(userId, title, body, data?)` - Send to single user
  - `sendNotificationToMultipleUsers(userIds[], title, body, data?)` - Send to multiple users
- **Usage Example**:
```typescript
import { sendNotificationToUser } from '@/lib/sendNotification';

await sendNotificationToUser(
  friendId,
  '⛳ Game Invitation',
  'Join me for a round!',
  { 
    route: 'gameModes',
    gameId: '123',
    courseId: '456'
  }
);
```

#### 3. **`app/_layout.tsx`**
- **Purpose**: Root-level FCM notification handlers
- **Handles**:
  - Foreground notifications (`messaging().onMessage`)
  - Background tap notifications (`messaging().onNotificationOpenedApp`)
  - Quit state notifications (`messaging().getInitialNotification`)
- **Navigation**: Automatically routes users based on `data.route` in notification payload

#### 4. **`app/(tabs)/_layout.tsx`**
- **Purpose**: Registers FCM token on login
- **Flow**: When user signs in → calls `registerForPushNotificationsAsync(userId)`

#### 5. **`components/TestNotifications.tsx`** ✨ NEW
- **Purpose**: Complete testing UI for notifications
- **Features**:
  - Self-test (send to yourself)
  - Friend selector
  - Multiple test types (simple, game invite, friend request)
  - Token verification
  - Token refresh
- **Location**: Integrated into Account screen under "🧪 Test Notifications"

---

### Server-Side (Supabase Edge Functions)

#### 1. **`supabase/functions/pushNotification/index.ts`**
- **Purpose**: Main FCM notification sender
- **Endpoint**: `POST /pushNotification`
- **Request Body**:
```typescript
{
  userId?: string,      // Look up token from database
  token?: string,       // Or provide token directly
  title: string,
  body: string,
  data?: {              // Custom data for navigation/handling
    route?: string,
    gameId?: string,
    courseId?: string,
    [key: string]: string
  }
}
```
- **Authentication**: Uses Google service account for FCM v1 API
- **Required Secrets**:
  - `FIREBASE_SERVICE_ACCOUNT` (JSON)
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

#### 2. **`supabase/functions/initializeUserToken/index.ts`**
- **Purpose**: Initialize user token (if needed separately)
- **Endpoint**: `POST /initializeUserToken`
- **Request Body**:
```typescript
{
  userId: string,
  deviceToken: string
}
```

---

## 🔄 Notification Flow

### 1. **User Registration/Login**
```
User logs in
  → app/(tabs)/_layout.tsx detects auth
  → Calls registerForPushNotificationsAsync(userId)
  → Gets FCM token from Firebase
  → Saves to profiles.fcm_token in database
```

### 2. **Sending a Notification**
```
Client calls sendNotificationToUser()
  → Invokes Supabase edge function
  → Edge function looks up user's FCM token
  → Edge function calls FCM API with token
  → FCM delivers notification to device
```

### 3. **Receiving a Notification**

**Foreground (app open):**
```
FCM → messaging().onMessage
  → Logs to console
  → Can show custom in-app UI
```

**Background (app minimized):**
```
FCM → System shows notification
User taps → messaging().onNotificationOpenedApp
  → Parses data.route
  → Navigates to appropriate screen
```

**Quit State (app closed):**
```
FCM → System shows notification
User taps → Opens app
  → messaging().getInitialNotification
  → Parses data.route
  → Navigates to appropriate screen
```

---

## 🧪 Testing Notifications

### Using the Test UI (Recommended)

1. **Navigate to Account Tab**
2. **Scroll to "🧪 Test Notifications" section**
3. **Click "Show Tests"**
4. **Test Options**:
   - **Self Test**: Send notification to yourself
   - **Friend Tests**: Select a friend and send various test types
   - **Token Management**: Verify and refresh your FCM token

### Test Notification Types

| Type | Title | Data Payload | Expected Behavior |
|------|-------|--------------|-------------------|
| Simple | 🧪 Test Notification | `{ testType: 'simple' }` | Basic notification |
| Game Invite | ⛳ Game Invitation | `{ route: 'gameModes', gameId, courseId, courseName }` | Opens game screen |
| Friend Request | 👋 Friend Request | `{ route: 'account' }` | Opens account screen |

### Manual Testing (Console)

```javascript
// In your component
import { sendNotificationToUser } from '@/lib/sendNotification';

await sendNotificationToUser(
  'user-id-here',
  'Test Title',
  'Test Body',
  { custom: 'data' }
);
```

---

## 🔧 Troubleshooting

### Token Not Saving
**Symptoms**: Notifications not received, "No FCM token" errors

**Solutions**:
1. Check console logs for FCM registration errors
2. Use Test UI → "Verify in DB" to check database
3. Use Test UI → "Refresh Token" to get new token
4. Ensure `google-services.json` is present in `android/app/`
5. Check Supabase RLS policies allow token updates

### Notifications Not Received
**Checklist**:
- [ ] User has FCM token in database (check with Test UI)
- [ ] Notification was sent successfully (check edge function logs)
- [ ] Device has network connection
- [ ] App has notification permissions
- [ ] Firebase project ID matches `google-services.json`

### Navigation Not Working After Tap
**Check**:
1. `data.route` is correctly set in notification payload
2. Route exists in app router (`/gameModes`, `/account`, etc.)
3. Required params are included (gameId, courseId, etc.)
4. `_layout.tsx` handler includes the route case

### Edge Function Errors
**Common Issues**:
- Missing `FIREBASE_SERVICE_ACCOUNT` secret
- Invalid service account JSON
- Incorrect FCM token format
- User not found in database

**Check Logs**:
```bash
supabase functions logs pushNotification
```

---

## 📊 Database Schema

### `profiles` Table
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  full_name TEXT,
  email TEXT,
  fcm_token TEXT,  -- FCM registration token
  -- other fields...
);
```

**Important**: Ensure RLS policies allow users to update their own `fcm_token`:
```sql
CREATE POLICY "Users can update their own fcm_token"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

---

## 🚀 Production Deployment

### Prerequisites
1. Firebase project with Cloud Messaging enabled
2. Service account JSON with messaging permissions
3. Supabase project with edge functions enabled

### Setup Steps

1. **Add Supabase Secrets**:
```bash
supabase secrets set FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
supabase secrets set SUPABASE_URL='https://your-project.supabase.co'
supabase secrets set SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'
```

2. **Deploy Edge Functions**:
```bash
supabase functions deploy pushNotification
supabase functions deploy initializeUserToken
```

3. **Verify Android Build**:
- Ensure `google-services.json` is in `android/app/`
- Build number and version match `app.json`
- FCM dependencies in `android/app/build.gradle`

4. **Test Production**:
- Use Test UI to send notifications
- Check Supabase edge function logs
- Verify tokens are being saved

---

## 🔐 Security Notes

1. **FCM Tokens**:
   - Tokens are device-specific
   - Tokens can expire/rotate - app handles refresh
   - Never expose service account JSON in client code

2. **Edge Function Security**:
   - Uses service role key (server-side only)
   - Validates user IDs before sending
   - Rate limiting recommended for production

3. **RLS Policies**:
   - Users can only update their own tokens
   - Friends can read each other's tokens (for game invites)

---

## 📝 Code Patterns

### Sending Notifications in Game Invites

```typescript
// gameModes.tsx
import { sendNotificationToUser } from '@/lib/sendNotification';

const inviteFriends = async (gameId: string, friendIds: string[]) => {
  for (const friendId of friendIds) {
    await sendNotificationToUser(
      friendId,
      '⛳ Game Invitation',
      `You've been invited to a game!`,
      {
        route: 'gameModes',
        gameId: gameId,
        courseId: courseData.id,
        courseName: courseData.name,
        isJoiningExistingGame: '1'
      }
    );
  }
};
```

### Handling Custom Routes

```typescript
// app/_layout.tsx
const handleNotificationNavigation = (data: any) => {
  if (data.route === 'customRoute') {
    router.push({
      pathname: '/customRoute',
      params: {
        customParam: data.customParam
      }
    });
  }
};
```

---

## 🎯 Best Practices

1. **Always include meaningful data**:
   - Add `route` for navigation
   - Include IDs for data fetching
   - Add `timestamp` for debugging

2. **Test thoroughly**:
   - Use Test UI during development
   - Test all notification types
   - Test on physical devices (not emulators)

3. **Handle errors gracefully**:
   - Catch notification sending errors
   - Provide user feedback
   - Log errors for debugging

4. **Monitor in production**:
   - Check edge function logs regularly
   - Monitor token refresh rate
   - Track notification delivery success

---

## 📚 References

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase](https://rnfirebase.io/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## 🆘 Support

If you encounter issues:
1. Check the Test UI diagnostics
2. Review console logs (client and edge function)
3. Verify database token entry
4. Check Firebase console for messaging stats

**Last Updated**: December 2024
**FCM Version**: v1 API (HTTP/JSON)
