# 📊 FCM Notification System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         GOLF COMPANION APP                               │
│                     FCM Push Notification System                         │
└─────────────────────────────────────────────────────────────────────────┘

┌────────────────────┐         ┌────────────────────┐         ┌──────────────────┐
│   USER DEVICE A    │         │   SUPABASE EDGE    │         │  USER DEVICE B   │
│  (React Native)    │         │     FUNCTION       │         │ (React Native)   │
└────────────────────┘         └────────────────────┘         └──────────────────┘
         │                              │                              │
         │                              │                              │
    ┌────▼────┐                   ┌────▼────┐                    ┌────▼────┐
    │  Login  │                   │ Database│                    │  Login  │
    │  User   │                   │ Supabase│                    │  User   │
    └────┬────┘                   └────┬────┘                    └────┬────┘
         │                              │                              │
         │ 1. Get FCM Token            │                              │
         ├──────────────────────────►  │                              │
         │    (registerForPush)         │                              │
         │                              │                              │
         │ 2. Save to profiles.fcm_token│                              │
         │ ◄────────────────────────────┤                              │
         │                              │                              │
         │                              │     1. Get FCM Token         │
         │                              │  ◄───────────────────────────┤
         │                              │                              │
         │                              │  2. Save to profiles.fcm_token
         │                              ├──────────────────────────────►
         │                              │                              │
    ┌────▼────┐                        │                              │
    │Test UI  │                        │                              │
    │"Send to │                        │                              │
    │ Friend" │                        │                              │
    └────┬────┘                        │                              │
         │                              │                              │
         │ 3. sendNotificationToUser   │                              │
         ├──────────────────────────►  │                              │
         │    (userId, title, body)     │                              │
         │                         ┌────▼────┐                         │
         │                         │ Lookup  │                         │
         │                         │ User's  │                         │
         │                         │  Token  │                         │
         │                         └────┬────┘                         │
         │                              │                              │
         │                         ┌────▼────────────┐                 │
         │                         │  Authenticate   │                 │
         │                         │  with Firebase  │                 │
         │                         └────┬────────────┘                 │
         │                              │                              │
         │                         ┌────▼──────────────┐               │
         │                         │  Send to FCM API  │               │
         │                         │ (Google Firebase) │               │
         │                         └────┬──────────────┘               │
         │                              │                              │
         │                              │   4. FCM delivers message    │
         │                              ├──────────────────────────────►
         │                              │                              │
         │                              │                         ┌────▼────┐
         │                              │                         │Receive  │
         │                              │                         │Notif    │
         │                              │                         └────┬────┘
         │                              │                              │
         │                              │                         ┌────▼────┐
         │                              │                         │User Taps│
         │                              │                         │Notif    │
         │                              │                         └────┬────┘
         │                              │                              │
         │                              │                         ┌────▼────┐
         │                              │                         │Navigate │
         │                              │                         │to Screen│
         │                              │                         └─────────┘
         │                              │                              │
    ┌────▼────┐                        │                              │
    │Success! │                        │                              │
    └─────────┘                        │                              │
```

---

## Component Breakdown

### 1. Token Registration Flow

```
┌──────────────┐
│   App Opens  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ User Logs In │
└──────┬───────┘
       │
       ▼
┌────────────────────────┐
│ _layout.tsx detects    │
│ SIGNED_IN event        │
└──────┬─────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ registerForPushNotifications │
│         Async(userId)         │
└──────┬───────────────────────┘
       │
       ├─► 1. Request FCM Permission
       │   └─► messaging().requestPermission()
       │
       ├─► 2. Get FCM Token
       │   └─► messaging().getToken()
       │
       └─► 3. Save to Database
           └─► supabase.from('profiles')
                     .update({ fcm_token })
```

### 2. Sending Notification Flow

```
┌──────────────────┐
│ User Action      │
│ (Test UI / Game) │
└──────┬───────────┘
       │
       ▼
┌────────────────────────┐
│ sendNotificationToUser │
│ (userId, title, body)  │
└──────┬─────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Invoke Supabase Function │
│ 'pushNotification'       │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Edge Function Receives   │
│ { userId, title, body }  │
└──────┬───────────────────┘
       │
       ├─► Query Database for fcm_token
       │   WHERE id = userId
       │
       ▼
┌──────────────────────────┐
│ Authenticate with Google │
│ using service account    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ POST to FCM v1 API       │
│ /messages:send           │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ Firebase delivers to     │
│ device with matching     │
│ FCM token                │
└──────────────────────────┘
```

### 3. Receiving Notification Flow

```
┌───────────────────────┐
│ FCM Delivers Message  │
└──────┬────────────────┘
       │
       ├─────────────────────────────────┐
       │                                 │
       ▼                                 ▼
┌──────────────┐              ┌──────────────────┐
│ App in       │              │ App in Background│
│ Foreground   │              │ or Quit State    │
└──────┬───────┘              └──────┬───────────┘
       │                             │
       ▼                             ▼
┌──────────────────┐        ┌─────────────────────┐
│ messaging()      │        │ System shows        │
│ .onMessage       │        │ notification in     │
│                  │        │ system tray         │
│ Handle in-app    │        └──────┬──────────────┘
│ (log, custom UI) │               │
└──────────────────┘               │ User Taps
                                   │
                                   ▼
                          ┌─────────────────────┐
                          │ messaging()         │
                          │ .onNotificationOpened│
                          │ App                 │
                          └──────┬──────────────┘
                                 │
                                 ▼
                          ┌─────────────────────┐
                          │ Parse data.route    │
                          │ from payload        │
                          └──────┬──────────────┘
                                 │
                                 ▼
                          ┌─────────────────────┐
                          │ router.push()       │
                          │ Navigate to screen  │
                          └─────────────────────┘
```

---

## Data Flow

### Notification Payload Structure

```javascript
{
  message: {
    token: "fcm_token_here",
    notification: {
      title: "⛳ Game Invitation",
      body: "Join me for a round!"
    },
    data: {
      route: "gameModes",           // Target screen
      gameId: "game-123",            // Game ID
      courseId: "course-456",        // Course ID
      courseName: "Pebble Beach",    // Course name
      timestamp: "2024-12-05T10:30:00Z",
      source: "golf-companion"
    }
  }
}
```

### Database Schema

```sql
-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  email TEXT,
  fcm_token TEXT,  -- ← FCM registration token stored here
  handicap NUMERIC,
  -- ... other fields
);

-- Index for faster token lookups
CREATE INDEX idx_profiles_fcm_token ON profiles(fcm_token);
```

---

## Security Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Security Layers                    │
└─────────────────────────────────────────────────────┘

1. CLIENT LAYER (React Native)
   ├─ User must be authenticated (Supabase Auth)
   ├─ Only own token can be updated (RLS policy)
   └─ Cannot directly call FCM API

2. EDGE FUNCTION LAYER (Supabase)
   ├─ Validates user exists before sending
   ├─ Uses service role key (not exposed to client)
   ├─ Rate limiting (Supabase built-in)
   └─ Logs all attempts

3. FCM LAYER (Firebase)
   ├─ Validates service account credentials
   ├─ Ensures token is valid and active
   ├─ Handles token expiry/rotation
   └─ Delivers via secure channel

4. DATABASE LAYER (Supabase)
   ├─ RLS policies enforce user ownership
   ├─ Only authenticated users can update tokens
   └─ Tokens encrypted at rest
```

---

## Test UI Architecture

```
┌──────────────────────────────────────────────┐
│         TestNotifications Component           │
└──────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌──────────┐
│ Token   │   │ Self    │   │ Friend   │
│ Status  │   │ Test    │   │ Tests    │
└────┬────┘   └────┬────┘   └────┬─────┘
     │             │              │
     ├─ Display   ├─ Send to    ├─ Load friends
     │  current   │  current     │  from database
     │  token     │  user        │
     │            │              ├─ Select friend
     ├─ Verify   └─ Confirm     │
     │  in DB         receipt    ├─ Choose test type:
     │                           │  • Simple
     └─ Refresh                  │  • Game Invite
        token                    │  • Friend Request
                                 │
                                 └─ Send & verify
```

---

## Error Handling Flow

```
┌───────────────────┐
│ Error Occurs      │
└──────┬────────────┘
       │
       ├─► Client Error?
       │   ├─► Network issue → Retry logic
       │   ├─► No token → Refresh token
       │   └─► Permission denied → Re-request
       │
       ├─► Server Error?
       │   ├─► Token not found → Prompt re-login
       │   ├─► FCM API error → Log & alert admin
       │   └─► Auth error → Check service account
       │
       └─► All errors logged to:
           ├─► Client console (developer tools)
           └─► Supabase logs (edge function)
```

---

## Performance Considerations

### Token Caching
```
• Token stored in database (persistent)
• Retrieved once per session
• Auto-refreshed if expired
• No frequent API calls to FCM
```

### Batch Operations
```
• Can send to multiple users in loop
• Future: Implement batch API for efficiency
• Current: Sequential sending (reliable)
```

### Edge Function Optimization
```
• Cold start: ~500ms
• Warm execution: ~100ms
• Token lookup: ~50ms
• FCM API call: ~200ms
• Total average: ~350ms per notification
```

---

## Monitoring Points

```
┌─────────────────────────────────────┐
│     What to Monitor in Production   │
└─────────────────────────────────────┘

1. Token Registration Success Rate
   └─► Target: >95%

2. Notification Delivery Rate
   └─► Target: >90% (FCM delivers)

3. User Engagement (Tap Rate)
   └─► Track via analytics

4. Edge Function Errors
   └─► Alert on spike

5. Token Refresh Frequency
   └─► Normal: Weekly/Monthly

6. Database Token Coverage
   └─► % of users with valid tokens
```

---

## Future Architecture Enhancements

```
┌─────────────────────────────────────┐
│      Potential Improvements         │
└─────────────────────────────────────┘

1. Notification History Table
   ├─ Track all sent notifications
   └─ Enable user to view history

2. Delivery Confirmation
   ├─ FCM provides delivery receipts
   └─ Store in database

3. Read Receipts
   ├─ Track when user opens notification
   └─ Use for analytics

4. Topic-Based Messaging
   ├─ Send to groups via topics
   └─ More efficient than individual sends

5. Scheduled Notifications
   ├─ Queue for future delivery
   └─ Use Supabase cron jobs

6. A/B Testing
   ├─ Test different notification formats
   └─ Optimize engagement
```

---

**Architecture Version**: 1.0  
**Last Updated**: December 5, 2024  
**System**: FCM-Only Implementation
