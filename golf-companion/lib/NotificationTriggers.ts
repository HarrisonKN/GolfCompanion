// lib/NotificationTriggers.ts
// Helper functions to send notifications for user interactions
import { sendNotificationToUser, NotificationPayload } from './sendNotification';

/**
 * Send friend request notification
 */
export async function notifyFriendRequest(
  recipientUserId: string,
  requesterName: string
) {
  try {
    await sendNotificationToUser(
      recipientUserId,
      `Friend Request from ${requesterName}`,
      `${requesterName} sent you a friend request. View in Account tab.`,
      {
        screen: 'account',
        type: 'friend_request',
      }
    );
    console.log(`✅ Friend request notification sent to ${recipientUserId}`);
  } catch (error) {
    console.error('❌ Error sending friend request notification:', error);
  }
}

/**
 * Send friend request accepted notification
 */
export async function notifyFriendRequestAccepted(
  recipientUserId: string,
  acceptorName: string
) {
  try {
    await sendNotificationToUser(
      recipientUserId,
      `Friend Request Accepted`,
      `${acceptorName} accepted your friend request!`,
      {
        screen: 'account',
        type: 'friend_request_accepted',
      }
    );
    console.log(`✅ Friend request accepted notification sent to ${recipientUserId}`);
  } catch (error) {
    console.error('❌ Error sending friend request accepted notification:', error);
  }
}

/**
 * Send game invite notification
 */
export async function notifyGameInvite(
  recipientUserId: string,
  inviterName: string,
  courseName: string,
  gameId: string
) {
  try {
    await sendNotificationToUser(
      recipientUserId,
      `⛳ Game Invite from ${inviterName}`,
      `${inviterName} invited you to play at ${courseName}`,
      {
        screen: 'gameModes',
        gameId,
        courseName,
        type: 'game_invite',
      }
    );
    console.log(`✅ Game invite notification sent to ${recipientUserId}`);
  } catch (error) {
    console.error('❌ Error sending game invite notification:', error);
  }
}

/**
 * Send hubRoom group invite notification
 */
export async function notifyGroupInvite(
  recipientUserId: string,
  inviterName: string,
  groupName: string,
  groupId: string
) {
  try {
    await sendNotificationToUser(
      recipientUserId,
      `🎭 Group Invite from ${inviterName}`,
      `${inviterName} invited you to join "${groupName}"`,
      {
        screen: 'account', // Takes them to pending invites
        type: 'group_invite',
        groupId,
        groupName,
      }
    );
    console.log(`✅ Group invite notification sent to ${recipientUserId}`);
  } catch (error) {
    console.error('❌ Error sending group invite notification:', error);
  }
}

/**
 * Send hubRoom message notification
 */
export async function notifyGroupMessage(
  recipientUserId: string,
  senderName: string,
  groupName: string,
  messagePreview: string,
  groupId: string
) {
  try {
    await sendNotificationToUser(
      recipientUserId,
      `💬 Message in ${groupName}`,
      `${senderName}: ${messagePreview.substring(0, 50)}${messagePreview.length > 50 ? '...' : ''}`,
      {
        screen: 'hubRoom',
        groupId,
        type: 'group_message',
      }
    );
    console.log(`✅ Group message notification sent to ${recipientUserId}`);
  } catch (error) {
    console.error('❌ Error sending group message notification:', error);
  }
}

/**
 * Send game scorecard update notification
 * (e.g., when a player posts their score)
 */
export async function notifyScoreUpdate(
  recipientUserIds: string[],
  playerName: string,
  score: number,
  gameId: string,
  courseName: string
) {
  try {
    for (const userId of recipientUserIds) {
      await sendNotificationToUser(
        userId,
        `📊 Score Update`,
        `${playerName} posted a score of ${score} at ${courseName}`,
        {
          screen: 'scorecard',
          gameId,
          type: 'score_update',
        }
      );
    }
    console.log(`✅ Score update notifications sent to ${recipientUserIds.length} users`);
  } catch (error) {
    console.error('❌ Error sending score update notification:', error);
  }
}

/**
 * Send game completion notification
 * (when all players complete the round)
 */
export async function notifyGameComplete(
  recipientUserIds: string[],
  gameId: string,
  winner: string | null,
  courseName: string
) {
  try {
    const title = winner ? `🏆 ${winner} Won!` : '✅ Game Complete!';
    const body = `Game at ${courseName} is complete. Check your scorecard for results.`;

    for (const userId of recipientUserIds) {
      await sendNotificationToUser(
        userId,
        title,
        body,
        {
          screen: 'scorecard',
          gameId,
          type: 'game_complete',
        }
      );
    }
    console.log(`✅ Game completion notifications sent to ${recipientUserIds.length} users`);
  } catch (error) {
    console.error('❌ Error sending game complete notification:', error);
  }
}

/**
 * Send generic user notification
 */
export async function notifyUser(
  recipientUserId: string,
  title: string,
  body: string,
  payload?: Partial<NotificationPayload>
) {
  try {
    await sendNotificationToUser(recipientUserId, title, body, payload);
    console.log(`✅ Notification sent to ${recipientUserId}`);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}
