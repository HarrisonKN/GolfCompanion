// EXAMPLE: How to integrate analytics into your game flow
// This file shows example implementations - copy/adapt these patterns to your actual game code

import { 
  trackGameStarted, 
  trackScoreSubmitted, 
  trackGameCompleted,
  trackGroupActivity,
  trackVoiceFeatureUsed,
  trackCustomEvent 
} from '@/lib/analytics';

/**
 * EXAMPLE 1: Track game start
 * Add this when user creates/starts a new game
 */
export async function exampleStartGame(gameId: string, courseId: string, courseName: string) {
  try {
    // Your game creation logic...
    console.log('Starting game:', gameId);
    
    // Track the game start
    await trackGameStarted(gameId, courseId, courseName, 'stroke_play');
    
    // Continue with game flow...
  } catch (error) {
    console.error('Error in game start:', error);
  }
}

/**
 * EXAMPLE 2: Track score submission
 * Add this when user submits a score for a hole
 */
export async function exampleSubmitScore(
  gameId: string,
  courseId: string, 
  holeNumber: number,
  score: number,
  par: number
) {
  try {
    // Your score saving logic...
    console.log(`Hole ${holeNumber}: Score ${score} on par ${par}`);
    
    // Determine if score is under/par/over
    let scoreType: 'under' | 'par' | 'over' = 'over';
    if (score < par) scoreType = 'under';
    else if (score === par) scoreType = 'par';
    
    // Track the score submission
    await trackScoreSubmitted(gameId, courseId, score, scoreType);
    
    // Save to database, update UI, etc...
  } catch (error) {
    console.error('Error submitting score:', error);
  }
}

/**
 * EXAMPLE 3: Track game completion
 * Add this when user finishes all 18 holes
 */
export async function exampleCompleteGame(
  gameId: string,
  courseId: string,
  finalScore: number,
  startTime: Date,
  endTime: Date
) {
  try {
    // Calculate duration
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    
    // Your game completion logic (save to DB, show results screen, etc)...
    console.log(`Game completed! Score: ${finalScore}, Time: ${durationMinutes} min`);
    
    // Track the game completion
    await trackGameCompleted(gameId, courseId, finalScore, durationMinutes);
    
    // Continue with post-game flow...
  } catch (error) {
    console.error('Error completing game:', error);
  }
}

/**
 * EXAMPLE 4: Track group/multiplayer activity
 * Add this when users create, join, or leave groups
 */
export async function exampleGroupActivity(
  action: 'group_created' | 'group_joined' | 'group_left',
  groupId: string,
  groupSize?: number
) {
  try {
    console.log(`Group activity: ${action}`);
    
    // Track the group activity
    await trackGroupActivity(action, groupId, groupSize);
    
    // Update UI, database, etc...
  } catch (error) {
    console.error('Error tracking group activity:', error);
  }
}

/**
 * EXAMPLE 5: Track voice feature usage
 * Add this when voice chat or voice commands are used
 */
export async function exampleVoiceFeature() {
  try {
    // Track voice chat started
    await trackVoiceFeatureUsed('voice_chat_started');
    
    // Start voice chat...
    console.log('Voice chat started');
    
    // Later, when voice chat ends:
    // await trackVoiceFeatureUsed('voice_chat_ended');
  } catch (error) {
    console.error('Error tracking voice feature:', error);
  }
}

/**
 * EXAMPLE 6: Track custom events
 * For any analytics needs not covered by built-in functions
 */
export async function exampleCustomEvent() {
  try {
    // Track achievement unlocked
    await trackCustomEvent('achievement_unlocked', {
      achievement_id: 'first_hole_in_one',
      achievement_name: 'Hole in One',
      rarity: 'rare',
    });
    
    // Track feature usage
    await trackCustomEvent('tutorial_completed', {
      tutorial_name: 'game_basics',
      steps_completed: 5,
      total_steps: 5,
      time_spent_minutes: 8,
    });
    
    // Track app preferences
    await trackCustomEvent('settings_changed', {
      setting_name: 'notification_sound',
      old_value: 'enabled',
      new_value: 'disabled',
    });
  } catch (error) {
    console.error('Error tracking custom event:', error);
  }
}

/**
 * EXAMPLE 7: Integration in a complete game flow
 */
export class GameManager {
  private gameId: string = '';
  private courseId: string = '';
  private courseName: string = '';
  private startTime: Date = new Date();
  private scores: number[] = [];

  async initializeGame(gameId: string, courseId: string, courseName: string) {
    this.gameId = gameId;
    this.courseId = courseId;
    this.courseName = courseName;
    this.startTime = new Date();
    
    // Track game start
    await trackGameStarted(gameId, courseId, courseName, 'stroke_play');
    console.log('Game initialized and tracked');
  }

  async recordHoleScore(holeNumber: number, score: number, par: number) {
    this.scores.push(score);
    
    // Determine score type
    let scoreType: 'under' | 'par' | 'over' = 'over';
    if (score < par) scoreType = 'under';
    else if (score === par) scoreType = 'par';
    
    // Track score submission
    await trackScoreSubmitted(this.gameId, this.courseId, score, scoreType);
    console.log(`Hole ${holeNumber} recorded: ${score}`);
  }

  async finishGame() {
    const finalScore = this.scores.reduce((a, b) => a + b, 0);
    const endTime = new Date();
    const durationMinutes = Math.round((endTime.getTime() - this.startTime.getTime()) / 60000);
    
    // Track game completion
    await trackGameCompleted(this.gameId, this.courseId, finalScore, durationMinutes);
    console.log('Game finished and completion tracked');
    
    return {
      gameId: this.gameId,
      finalScore,
      durationMinutes,
    };
  }
}

/**
 * Usage example:
 * 
 * // In your game screen
 * const game = new GameManager();
 * await game.initializeGame('game123', 'course456', 'Pebble Beach');
 * 
 * // For each hole played
 * await game.recordHoleScore(1, 4, 4); // Par 4, scored 4
 * await game.recordHoleScore(2, 5, 4); // Par 4, scored 5
 * // ... etc
 * 
 * // When game ends
 * const results = await game.finishGame();
 */
