# Firebase Analytics Implementation Guide

## Overview

Firebase Analytics has been integrated into the Golf Companion app to track user behavior and engagement metrics. This data will appear in the Firebase Console under **Analytics** > **Dashboard**.

## What's Tracked

### Automatic Events (Firebase Built-in)
- **app_open** - When the app is opened
- **first_open** - First time the app is opened
- **user_engagement** - How long users stay in the app
- **scroll** - User scrolling behavior
- **search** - Search functionality usage
- **click** - Button/element clicks

### Custom Events Implemented

#### Authentication Events
- **sign_up** - User creates a new account
  - Tracked in: `app/signup.tsx`
  - Data: signup method (email)
  
- **login** - User logs in
  - Tracked in: `components/AuthContext.tsx`
  - Data: login method (email)
  
- **logout** - User logs out
  - Tracked in: `components/AuthContext.tsx`

#### Game Events
- **game_started** - User starts a new game
  - Data: game_id, course_id, course_name, game_mode
  
- **score_submitted** - User submits a score
  - Data: game_id, course_id, score, score_type (under/par/over)
  
- **game_completed** - User completes a game
  - Data: game_id, course_id, final_score, duration_minutes

#### Social/Group Events
- **group_activity** - Group-related actions
  - Data: activity_type (group_created/group_joined/group_left), group_id, group_size

#### Feature Usage
- **voice_feature_used** - When voice chat is used
  - Data: feature_type (voice_chat_started/voice_chat_ended/voice_command_used)
  
- **spotify_integration** - When Spotify features are used
  - Data: action (connected/disconnected/playlist_created)
  
- **notification_engagement** - When users interact with notifications
  - Data: action (received/opened/dismissed), notification_type

#### Other Events
- **screen_view** - Track specific screen views
- **app_error** - Track errors/crashes
- **custom_event** - Any custom event with flexible properties

## How to Use Analytics in Your Code

### 1. Import the Analytics Module

```typescript
import { 
  trackGameStarted, 
  trackScoreSubmitted, 
  trackGameCompleted 
} from '@/lib/analytics';
```

### 2. Call Analytics Functions When Events Happen

#### Example: Tracking a Game Start
```typescript
const startGame = async (gameId: string, courseId: string, courseName: string) => {
  // Your game start logic...
  
  // Track the event
  await trackGameStarted(gameId, courseId, courseName, 'stroke_play');
  
  // Continue with game...
};
```

#### Example: Tracking a Completed Game
```typescript
const completeGame = async (gameId: string, finalScore: number, durationMinutes: number) => {
  // Your completion logic...
  
  // Track the event
  await trackGameCompleted(gameId, courseId, finalScore, durationMinutes);
  
  // Continue...
};
```

#### Example: Tracking Voice Feature Usage
```typescript
const startVoiceChat = async () => {
  await trackVoiceFeatureUsed('voice_chat_started');
  // Start voice chat...
};
```

### 3. Custom Events

For any other events not covered by built-in functions:

```typescript
import { trackCustomEvent } from '@/lib/analytics';

// Track a custom event
await trackCustomEvent('feature_name', {
  property1: 'value1',
  property2: 'value2',
  count: 5,
});
```

## Available Analytics Functions

### Authentication
- `trackSignup(userId, method?)` - Track user signup
- `trackLogin(userId, method?)` - Track user login
- `trackLogout()` - Track user logout

### Games
- `trackGameStarted(gameId, courseId, courseName, gameMode)` - Game started
- `trackScoreSubmitted(gameId, courseId, score, scoreType)` - Score submitted
- `trackGameCompleted(gameId, courseId, finalScore, durationMinutes)` - Game completed

### Social
- `trackGroupActivity(activityType, groupId, groupSize?)` - Group activities

### Features
- `trackVoiceFeatureUsed(featureType)` - Voice feature usage
- `trackSpotifyIntegration(action)` - Spotify integration
- `trackNotificationEngagement(action, notificationType)` - Notification interaction

### General
- `trackScreenView(screenName, screenClass?)` - Screen/page view
- `trackError(errorMessage, errorCode?)` - Error/crash tracking
- `trackCustomEvent(eventName, properties?)` - Custom events

## Where to Add Event Tracking

### In Game Flow
Add tracking to:
- `app/startGame.tsx` - Track game_started when user creates/starts a game
- `components/ScoreEntryModal.tsx` - Track score_submitted when scores are recorded
- Game completion screens - Track game_completed when game ends

### In Multiplayer/Group
- Where groups are created/joined/left
- Where multiplayer games are initiated

### In Voice Features
- Where voice chat is started/stopped
- Where voice commands are used

### In Notifications
- Where notifications are received (backend)
- Where notifications are opened by user

## Viewing Analytics in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **golfcompanion-465805**
3. Click **Analytics** in the left sidebar
4. View:
   - **Dashboard** - Overview of all events and user metrics
   - **Events** - Detailed breakdown of each custom event
   - **Users** - User engagement and acquisition
   - **Retention** - How often users return

## Sample Firebase Console Views You'll See

### Dashboard Tab
- Total users and sessions
- Event count
- Engagement metrics
- Top events by frequency

### Events Tab
- List all tracked events with:
  - Number of occurrences
  - User count
  - Average event value
  - Event parameters and their values

### User Properties
- User ID (set during login/signup)
- Custom user properties you can add

## Important Notes

- **Data Appears with Delay**: Firebase Analytics data takes 24-48 hours to fully populate in the console
- **Test Mode**: During development, you can enable "DebugView" in Firebase to see events in real-time
- **User Privacy**: All data is collected in compliance with privacy policies
- **Offline**: Analytics works offline and syncs when connection returns

## Next Steps

1. **Add tracking to game-related code** - Implement game_started, score_submitted, game_completed tracking
2. **Add tracking to multiplayer features** - Implement group_activity tracking
3. **Monitor the Firebase Console** - Check Analytics dashboard after 24-48 hours
4. **Add custom properties** - Set user properties like "experience_level" to segment users better

## Example: Complete Game Flow with Analytics

```typescript
import { trackGameStarted, trackScoreSubmitted, trackGameCompleted } from '@/lib/analytics';

export const playGame = async () => {
  const gameId = generateGameId();
  const courseId = selectedCourse.id;
  const courseName = selectedCourse.name;
  
  // Track game start
  await trackGameStarted(gameId, courseId, courseName, 'stroke_play');
  
  // User plays 18 holes...
  
  // Track scores as they submit them
  for (const hole of holes) {
    await trackScoreSubmitted(gameId, courseId, hole.score, calculateScoreType(hole.score, hole.par));
  }
  
  // Track game completion
  const finalScore = calculateTotalScore();
  const duration = calculateDuration(); // in minutes
  await trackGameCompleted(gameId, courseId, finalScore, duration);
};
```

## Questions or Issues?

If you encounter any issues with analytics:
1. Check browser console for warning messages (prefixed with "⚠️")
2. Verify Firebase credentials are correct in `lib/firebase.ts`
3. Ensure `@react-native-firebase/analytics` is properly installed
4. Check that Analytics Collection is enabled (it is by default in `lib/analytics.ts`)
