# 🧪 Quick Start: Testing Notifications

## For Immediate Testing

### 1. Open the App
```
npm start
```

### 2. Navigate to Test UI
1. Open app on your device
2. Go to **Account** tab (bottom navigation)
3. Scroll down to **🧪 Test Notifications** section
4. Click **Show Tests** button

### 3. Run Self-Test
1. Click **"Send to Myself"** button
2. Check if notification appears
3. Tap notification to test navigation

### 4. Test with Friends (Optional)
1. Ensure you have friends added in the app
2. Select a friend from the list
3. Choose a test type:
   - **📬 Simple Test** - Basic notification
   - **⛳ Game Invite Test** - Opens game screen
   - **👋 Friend Request Test** - Opens account screen
4. Verify friend receives notification

---

## What to Check

### ✅ Token Status
- In Test UI, check **"Your FCM Token Status"**
- Token should be displayed (60 chars preview)
- Click **"Verify in DB"** to confirm it's saved

### ✅ Self-Test
- Should receive notification within seconds
- Notification should appear in system tray
- Tapping should open app (if closed)

### ✅ Friend Test
- Friend should receive notification
- Friend can tap to navigate (game invites)
- Check console logs for confirmation

---

## Troubleshooting Quick Fixes

### No Token Shown
```
1. Click "Refresh Token" in Test UI
2. Restart the app
3. Log out and log back in
```

### Notification Not Received
```
1. Check device has internet
2. Verify token in database (Test UI → "Verify in DB")
3. Check Supabase function logs:
   supabase functions logs pushNotification
```

### Navigation Not Working
```
1. Ensure app is using latest build
2. Check console logs for errors
3. Verify notification data includes "route" field
```

---

## Console Commands

### View Edge Function Logs
```bash
cd c:\GolfApp\GolfCompanion\supabase
supabase functions logs pushNotification --tail
```

### Deploy Edge Function (After Changes)
```bash
cd c:\GolfApp\GolfCompanion\supabase
supabase functions deploy pushNotification
```

### Build Android APK
```bash
cd c:\GolfApp\GolfCompanion\golf-companion
npm run build:apk
```

---

## Expected Console Logs

### Client-Side (React Native)
```
🔔 === REGISTERING FOR FCM PUSH NOTIFICATIONS ===
📝 Step 1: Requesting FCM messaging permission...
✅ FCM messaging permission granted: 1
📝 Step 2: Getting FCM registration token...
✅ Obtained FCM token: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
📝 Step 3: Saving FCM token to Supabase...
✅ FCM token saved successfully to Supabase
🔔 === FCM PUSH NOTIFICATION REGISTRATION COMPLETE ===
```

### Server-Side (Edge Function)
```
📥 Push notification request received
📋 Request params: { hasUserId: true, hasToken: false, title: "🧪 Test Notification" }
🔍 Looking up FCM token for user: abc-123-def-456
✅ Database query successful. Profiles found: 1
✅ Found FCM token: eyJhbGciOiJSUzI1NiIs...
🔐 Authenticating with Firebase...
✅ Service account loaded for project: golfcompanion-465805
🚀 Preparing to send FCM notification to project: golfcompanion-465805
📤 Sending FCM message: { recipient: "eyJhbGciOiJSUzI1NiIs...", title: "🧪 Test Notification" }
✅ Push notification sent: { messageId: "projects/xxx/messages/yyy" }
```

---

## Common Test Scenarios

### Scenario 1: First Time Setup
```
1. User logs in
2. FCM token automatically registered
3. Go to Test UI
4. Verify token exists
5. Send self-test
6. Confirm notification received
```

### Scenario 2: Game Invitation
```
1. User creates game
2. Selects friends
3. System sends notifications with game data
4. Friends tap notification
5. Friends land on game screen with join prompt
```

### Scenario 3: Token Refresh
```
1. User hasn't logged in for weeks
2. Token may be stale
3. Go to Test UI
4. Click "Refresh Token"
5. New token saved
6. Notifications work again
```

---

## File Locations

### Client Files
- **Test UI**: `components/TestNotifications.tsx`
- **Registration**: `lib/PushNotifications.js`
- **Sender Helper**: `lib/sendNotification.ts`
- **Notification Handlers**: `app/_layout.tsx`

### Server Files
- **Edge Function**: `supabase/functions/pushNotification/index.ts`
- **Config**: `supabase/config.toml`

### Documentation
- **Complete Guide**: `NOTIFICATIONS_GUIDE.md`
- **Migration Summary**: `MIGRATION_SUMMARY.md`
- **This File**: `TESTING_QUICKSTART.md`

---

## Need Help?

1. **Check the logs** (client console + edge function logs)
2. **Use Test UI diagnostics** (verify token, refresh token)
3. **Read full guide** (`NOTIFICATIONS_GUIDE.md`)
4. **Review migration summary** (`MIGRATION_SUMMARY.md`)

---

## Success Indicators

✅ Token displayed in Test UI  
✅ "Verify in DB" shows token exists  
✅ Self-test notification received  
✅ Friend test notification received  
✅ Tapping notification opens app  
✅ Navigation works (game invites)  
✅ Console logs show success messages  

---

**Last Updated**: December 5, 2024  
**System**: Pure FCM (Firebase Cloud Messaging)  
**Status**: ✅ Production Ready
