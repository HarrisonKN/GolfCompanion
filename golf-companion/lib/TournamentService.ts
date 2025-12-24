import { supabase } from '@/components/supabase';

export type Tournament = {
  id: string;
  name: string;
  description?: string;
  creator_id: string;
  start_date: string;
  end_date: string;
  status: 'open' | 'active' | 'completed';
  is_auto: boolean; // NEW: Mark auto-generated tournaments
  created_at: string;
};

export type TournamentParticipant = {
  id: string;
  tournament_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'declined';
  total_score: number;
  rounds_played: number;
  rank?: number;
};

export type GhostPlacement = {
  rank: number;
  total_score: number;
  rounds_played: number;
  participant_count: number;
};

// NEW: Check and create monthly auto-tournament
export async function ensureMonthlyTournament(): Promise<Tournament | null> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const monthName = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Check if this month's tournament exists
  const { data: existing } = await supabase
    .from('tournaments')
    .select('*')
    .eq('is_auto', true)
    .gte('start_date', monthStart.toISOString().split('T')[0])
    .lte('start_date', monthEnd.toISOString().split('T')[0])
    .single();

  if (existing) return existing;

  // Create it
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name: `${monthName} Challenge`,
      description: `Automatic monthly tournament. Best total score wins!`,
      creator_id: user.id,
      start_date: monthStart.toISOString().split('T')[0],
      end_date: monthEnd.toISOString().split('T')[0],
      status: 'active',
      is_auto: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating auto tournament:', error);
    return null;
  }

  return data;
}

// NEW: Auto-enroll user in monthly tournament
export async function autoEnrollInMonthlyTournament() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const tournament = await ensureMonthlyTournament();
  if (!tournament) return;

  // Check if already enrolled
  const { data: existing } = await supabase
    .from('tournament_participants')
    .select('id')
    .eq('tournament_id', tournament.id)
    .eq('user_id', user.id)
    .single();

  if (existing) return;

  // Auto-enroll with accepted status
  await supabase.from('tournament_participants').insert({
    tournament_id: tournament.id,
    user_id: user.id,
    status: 'accepted',
  });

  console.log('✅ Auto-enrolled in monthly tournament');
}

export async function createTournament(
  name: string,
  description: string,
  startDate: string,
  endDate: string
): Promise<Tournament> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      description,
      creator_id: user.id,
      start_date: startDate,
      end_date: endDate,
      status: 'open',
      is_auto: false, // User-created
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function inviteToTournament(tournamentId: string, friendIds: string[]) {
  const invites = friendIds.map(friendId => ({
    tournament_id: tournamentId,
    user_id: friendId,
    status: 'pending',
  }));

  const { error } = await supabase
    .from('tournament_participants')
    .insert(invites);

  if (error) throw error;

  // Send push notifications
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  for (const friendId of friendIds) {
    try {
      await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/pushNotification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: friendId,
          title: '🏆 Tournament Invitation',
          body: 'You\'ve been invited to join a golf tournament!',
          data: { type: 'tournament_invite', tournamentId },
        }),
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }
}

export async function getMyTournaments(): Promise<Tournament[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tournament_participants')
    .select('tournaments(*)')
    .eq('user_id', user.id)
    .in('status', ['accepted', 'pending']);

  if (error) {
    console.error('Error fetching tournaments:', error);
    return [];
  }

  // Extract tournaments and filter out nulls
  const tournaments = (data ?? [])
    .map((item: any) => item.tournaments)
    .filter((t): t is Tournament => t !== null && typeof t === 'object' && !Array.isArray(t));
  
  // Sort by start_date descending
  tournaments.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  
  return tournaments;
}

export async function respondToInvite(tournamentId: string, accept: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('tournament_participants')
    .update({ status: accept ? 'accepted' : 'declined' })
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getTournamentLeaderboard(tournamentId: string) {
  const { data, error } = await supabase
    .from('tournament_participants')
    .select('*, profiles(full_name, avatar_url)')
    .eq('tournament_id', tournamentId)
    .eq('status', 'accepted')
    .order('total_score', { ascending: true });

  if (error) throw error;
  return data;
}

// NEW: Update tournament scores automatically after a round
export async function updateTournamentScoresAfterRound(roundId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get the round details
  const { data: round } = await supabase
    .from('golf_rounds')
    .select('score, date')
    .eq('id', roundId)
    .single();

  if (!round) return;

  // Find active tournaments that include this date
  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, start_date, end_date')
    .eq('status', 'active')
    .lte('start_date', round.date)
    .gte('end_date', round.date);

  if (!tournaments || tournaments.length === 0) return;

  // Update scores for each tournament
  for (const tournament of tournaments) {
    // Get all user's rounds in tournament date range
    const { data: allRounds } = await supabase
      .from('golf_rounds')
      .select('score')
      .eq('user_id', user.id)
      .gte('date', tournament.start_date)
      .lte('date', tournament.end_date);

    if (!allRounds) continue;

    const totalScore = allRounds.reduce((sum, r) => sum + r.score, 0);
    const roundsPlayed = allRounds.length;

    // Update participant record
    await supabase
      .from('tournament_participants')
      .update({
        total_score: totalScore,
        rounds_played: roundsPlayed,
      })
      .eq('tournament_id', tournament.id)
      .eq('user_id', user.id);
  }

  console.log('✅ Tournament scores updated');
}

// NEW: Get ghost placement in tournament
export async function getGhostPlacement(tournamentId: string): Promise<GhostPlacement | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get tournament window
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('start_date, end_date')
    .eq('id', tournamentId)
    .single();

  if (!tournament) return null;

  // Fetch user rounds in the window
  const { data: myRounds } = await supabase
    .from('golf_rounds')
    .select('score')
    .eq('user_id', user.id)
    .gte('date', tournament.start_date)
    .lte('date', tournament.end_date);

  if (!myRounds || myRounds.length === 0) return null;

  const myTotal = myRounds.reduce((s, r) => s + r.score, 0);
  const myPlayed = myRounds.length;

  // Fetch existing participants
  const { data: participants } = await supabase
    .from('tournament_participants')
    .select('user_id, total_score, rounds_played')
    .eq('tournament_id', tournamentId)
    .eq('status', 'accepted');

  const leaderboard = (participants || []).map(p => ({
    user_id: p.user_id,
    total_score: p.total_score ?? Number.MAX_SAFE_INTEGER,
    rounds_played: p.rounds_played ?? 0,
  }));

  // Add ghost entry
  leaderboard.push({
    user_id: user.id,
    total_score: myTotal,
    rounds_played: myPlayed,
  });

  // Sort ascending by score
  leaderboard.sort((a, b) => (a.total_score ?? 0) - (b.total_score ?? 0));

  const rank = leaderboard.findIndex(e => e.user_id === user.id) + 1;
  return {
    rank,
    total_score: myTotal,
    rounds_played: myPlayed,
    participant_count: leaderboard.length - 1, // exclude ghost
  };
}