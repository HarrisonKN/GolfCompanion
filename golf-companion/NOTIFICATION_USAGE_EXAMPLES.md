// NOTIFICATION USAGE EXAMPLES
// How to use the notification system in your app

// ============================================
// Example 1: Send a Friend Request Notification
// ============================================
import { notifyFriendRequest } from '@/lib/NotificationTriggers';

async function sendFriendRequest(userId: string, friendId: string) {
  // Insert friend request into database
  await supabase.from('friend_requests').insert({
    requester_user_id: userId,
    requested_user_id: friendId,
    status: 'pending'
  });

  // Notify the recipient
  const myName = 'John Doe';
  await notifyFriendRequest(friendId, myName);
  // Recipient will see: "Friend Request from John Doe"
}

// ============================================
// Example 2: Send a Game Invite Notification
// ============================================
import { notifyGameInvite } from '@/lib/NotificationTriggers';

async function invitePlayersToGame(
  myId: string,
  playerIds: string[],
  gameId: string,
  courseName: string
) {
  const myName = 'Jane Smith';
  
  // Send invitation to each player
  for (const playerId of playerIds) {
    if (playerId !== myId) { // Don't send to yourself
      await notifyGameInvite(playerId, myName, courseName, gameId);
      // Recipient will see: "⛳ Game Invite from Jane Smith"
      //                      "Jane Smith invited you to play at Pebble Beach"
    }
  }
}

// ============================================
// Example 3: Send a Group Invite Notification
// ============================================
import { notifyGroupInvite } from '@/lib/NotificationTriggers';

async function inviteFriendToGroup(
  myId: string,
  friendId: string,
  groupId: string,
  groupName: string
) {
  // Insert invitation into database
  await supabase.from('hubroom_invites').insert({
    group_id: groupId,
    invited_user_id: friendId,
    inviter_user_id: myId,
    status: 'pending'
  });

  // Notify the friend
  const myName = 'Mike Johnson';
  await notifyGroupInvite(friendId, myName, groupName, groupId);
  // Recipient will see: "🎭 Group Invite from Mike Johnson"
  //                     "Mike Johnson invited you to join \"Golf Buddies\""
}

// ============================================
// Example 4: Send a Group Message Notification
// ============================================
import { notifyGroupMessage } from '@/lib/NotificationTriggers';

async function sendGroupMessage(
  myId: string,
  groupId: string,
  groupName: string,
  message: string
) {
  // Save message to database
  await supabase.from('voice_messages').insert({
    group_id: groupId,
    user_id: myId,
    text: message
  });

  // Notify other group members
  const myName = 'Sarah Williams';
  const messagePreview = message.substring(0, 50);
  
  // Get all group members except sender
  const { data: members } = await supabase
    .from('voice_group_members')
    .select('user_id')
    .eq('group_id', groupId)
    .neq('user_id', myId);

  // Send notification to each member
  for (const member of members || []) {
    await notifyGroupMessage(
      member.user_id,
      myName,
      groupName,
      messagePreview,
      groupId
    );
    // Recipient will see: "💬 Message in Golf Buddies"
    //                     "Sarah Williams: Hey everyone, let's play tomorrow!"
  }
}

// ============================================
// Example 5: Send Custom Notification
// ============================================
import { notifyUser } from '@/lib/NotificationTriggers';

async function sendCustomNotification(
  recipientId: string,
  title: string,
  message: string,
  navigationScreen: string
) {
  await notifyUser(recipientId, title, message, {
    screen: navigationScreen,
    type: 'custom'
  });
}

// Example usage:
// await sendCustomNotification(
//   'user-id-123',
//   '🏆 Achievement Unlocked!',
//   'You shot a birdie on hole 5!',
//   'scorecard'
// );

// ============================================
// Example 6: Send Multiple Notifications
// ============================================
import { notifyGameInvite } from '@/lib/NotificationTriggers';

async function notifyGameParticipants(
  participantIds: string[],
  inviterName: string,
  courseName: string,
  gameId: string
) {
  // Send to all participants in parallel
  const notifications = participantIds.map(id =>
    notifyGameInvite(id, inviterName, courseName, gameId)
  );

  try {
    await Promise.all(notifications);
    console.log('✅ All notifications sent');
  } catch (error) {
    console.error('⚠️ Some notifications failed to send:', error);
    // App continues - notifications are not critical
  }
}

// ============================================
// Example 7: Error Handling Pattern
// ============================================
async function safeSendNotification(
  recipientId: string,
  title: string,
  message: string
) {
  try {
    await notifyUser(recipientId, title, message);
    console.log('✅ Notification sent successfully');
  } catch (error) {
    // Log the error but don't crash the app
    console.error('⚠️ Failed to send notification:', error);
    // The main app operation (like creating a game) continues
    // Notifications are nice-to-have, not critical
  }
}

// ============================================
// Example 8: Conditional Notifications
// ============================================
async function invitePlayerIfNotFriend(
  myId: string,
  targetPlayerId: string,
  gameId: string,
  courseName: string
) {
  // Check if already friends
  const { data: friendship } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', myId)
    .eq('friend_id', targetPlayerId)
    .single();

  if (friendship) {
    // Send game invite directly
    const myName = 'Player Name';
    await notifyGameInvite(targetPlayerId, myName, courseName, gameId);
  } else {
    // Send friend request first
    const { error } = await supabase
      .from('friend_requests')
      .insert({
        requester_user_id: myId,
        requested_user_id: targetPlayerId,
        status: 'pending'
      });

    if (!error) {
      const myName = 'Player Name';
      await notifyFriendRequest(targetPlayerId, myName);
    }
  }
}

// ============================================
// COMMON PATTERNS
// ============================================

// Pattern 1: Notify after successful database operation
async function pattern1_NotifyAfterInsert() {
  const { error } = await supabase
    .from('friend_requests')
    .insert(data);

  if (!error) {
    // Only notify if database operation succeeded
    await notifyFriendRequest(recipientId, senderName);
  }
}

// Pattern 2: Silent failure for notifications
async function pattern2_SilentFailure() {
  try {
    await notifyUser(id, title, message);
  } catch (error) {
    // Log but don't throw - app continues
    console.warn('Notification failed:', error);
  }
}

// Pattern 3: Batch notifications
async function pattern3_BatchNotifications(userIds: string[]) {
  const promises = userIds.map(id =>
    notifyGameInvite(id, inviterName, courseName, gameId)
      .catch(err => console.warn(`Failed for ${id}:`, err))
  );
  await Promise.allSettled(promises);
}

// Pattern 4: Include context in payload
async function pattern4_ContextualPayload() {
  await notifyGameInvite(playerId, inviterName, courseName, gameId);
  // The payload automatically includes:
  // - screen: 'gameModes'
  // - gameId, courseName (for deep linking)
  // - type: 'game_invite' (for analytics)
}

// ============================================
// DO's AND DON'Ts
// ============================================

// ✅ DO:
// - Send notifications for important user interactions
// - Include relevant navigation data (gameId, groupId, etc.)
// - Handle notification errors gracefully
// - Test notifications with TestNotifications component
// - Use descriptive titles and messages

// ❌ DON'T:
// - Let notification failures crash your app
// - Send duplicate notifications (debounce if needed)
// - Send notifications without user consent (implement settings later)
// - Assume all users want all notification types
// - Send notifications for non-user-initiated events (use realtime instead)

// ============================================
// DEBUGGING
// ============================================

// 1. Check FCM token is saved:
// Go to Account → Show Tests → See "Current FCM Token"

// 2. Send test notification:
// Account → Show Tests → Select friend → Send Test Notification

// 3. Check notification logs:
// Monitor console for messages like:
// - "📤 Sending notification to user..."
// - "✅ Notification sent successfully"
// - "❌ Error sending notification"

// 4. Verify database entries:
// Supabase Dashboard → Tables → Check relevant table (friend_requests, etc.)
