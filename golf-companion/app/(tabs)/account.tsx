// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import { COLORS } from "@/constants/theme"; //Importing Color themes for consistency
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

// ------------------- TYPES -------------------------
type UserProfile = {
  full_name: string | null;
  email: string | null;
  handicap: number | null;
  rounds_played: number | null;
  average_score: number | null;
  best_score: number | null;
  fairways_hit: number | null;
  putts_per_round: number | null;
  last_round_course_name: string | null;
  last_round_date: string | null;
  last_round_score: number | null;
};

type RoundHistory = {
  id: string;
  course_name: string;
  date: string;
  score: number;
  fairways_hit?: number;
  greens_in_reg?: number;
  putts?: number;
  scorecard?: string;
};

// ------------------- ACCOUNTS LOGIC -------------------------
export default function AccountsScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [rounds, setRounds] = useState<RoundHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const mountedRef = useRef(true);
  const [scorecardModalVisible, setScorecardModalVisible] = useState(false);
  const [selectedScorecard, setSelectedScorecard] = useState<any[]>([]);
  const [selectedMaxHoles, setSelectedMaxHoles] = useState(0);

  // Handle mounting state
  useEffect(() => {
    setIsMounted(true);
    return () => {
      mountedRef.current = false;
      setIsMounted(false);
    };
  }, []);

  // Safe state setter that only updates if component is mounted
  const safeSetState = (setter: any, value: any) => {
    if (mountedRef.current && isMounted) {
      setter(value);
    }
  };

  // Safe navigation helper
  const safeNavigate = (path: string) => {
    if (mountedRef.current && isMounted && !isRedirecting) {
      try {
        setIsRedirecting(true);
        setTimeout(() => {
          router.replace(path as any);
        }, 100);
      } catch (error) {
        console.error('Navigation error:', error);
      }
    }
  };

  const fetchProfile = async () => {
    if (!user || !isMounted) return;

    try {
      safeSetState(setLoading, true);
      safeSetState(setError, null);

      // Test connection first
      const connectionTest = await testSupabaseConnection();
      if (!connectionTest) {
        throw new Error('Unable to connect to database');
      }

      // If connection successful, fetch profile
      console.log('Fetching profile for user:', user.id);

      //All the data fetched from SupaBase
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          full_name,
          email,
          handicap,
          rounds_played,
          average_score,
          last_round_course_name,
          last_round_date,
          last_round_score
        `)
        .eq('id', user.id)
        .single();

      if (profileError) { //If there's an error fetching the profile
        console.error('Profile fetch error:', profileError);
        
        if (profileError.code === 'PGRST116') {
          // No profile found - create one
          console.log('Creating new profile for user:', user.id);
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              full_name: user.user_metadata?.full_name || null,
              email: user.email || null,
              handicap: 0,
              rounds_played: 0,
              average_score: null,
              last_round_course_name: null,
              last_round_date: null,
              last_round_score: null,
            });

          if (insertError) {
            console.error('Profile creation error:', insertError);
            if (insertError.code !== '23505') { // Ignore duplicate key errors
              throw new Error('Failed to create profile: ' + insertError.message);
            }
          }
          // Retry fetching the profile after creation
          return fetchProfile();
        }
        throw new Error('Database error: ' + profileError.message);
      }

      // Successfully fetched profile data and populated page
      console.log('Profile fetched successfully');
      safeSetState(setProfile, profileData);

    } catch (error: any) {
      console.error('Profile fetch error:', error);
      safeSetState(setError, error.message || 'Unknown error occurred');
    } finally {
      safeSetState(setLoading, false);
    }
  };

  const fetchRounds = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('golf_rounds')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      if (error) throw error;
      safeSetState(setRounds, data || []);
    } catch (err) {
      console.error('Round history fetch error:', err);
    }
  };

  const openScorecardModal = (scorecardStr: string) => {
    try {
      const scorecard = JSON.parse(scorecardStr);
      setSelectedScorecard(scorecard);
      setSelectedMaxHoles(Math.max(...scorecard.map((p: any) => p.scores.length)));
      setScorecardModalVisible(true);
    } catch {
      setSelectedScorecard([]);
      setSelectedMaxHoles(0);
      setScorecardModalVisible(false);
    }
  };

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && !user && !isRedirecting) {
        console.log('No user found, redirecting to login');
        safeNavigate('/login');
        return;
      }

      // Always fetch latest profile and rounds when focused and user is present
      if (!authLoading && user && isMounted) {
        fetchProfile();
        fetchRounds();
      }
    }, [user, authLoading, isMounted])
  );

  const handleLogout = async () => {
    if (isRedirecting) return; //this line prevents multiple logout attempts and redirects if already trying to redirect
    try {
      await signOut();
      safeNavigate('/login'); //after signing out, redirect to login
    } catch (error: any) {
      console.error('Logout error:', error);
      Alert.alert('Logout Error', 'An error occurred while logging out');
    }
  };

  const handleRetry = () => {
    if (isRedirecting) return;
    safeSetState(setError, null);
    fetchProfile();
  };

  // Early returns for loading and error states
  if (!isMounted || authLoading || isRedirecting) {
    return (
      <View style={[styles.screen, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles.loadingText}>
          {isRedirecting ? 'Redirecting...' : 'Loading...'}
        </ThemedText>
      </View>
    );
  }

  // If no user after auth loads, don't render anything (navigation will happen)
  // this prevents rendering the screen if user is not authenticated causing potential crash
  if (!user) {
    return (
      <View style={[styles.screen, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles.loadingText}>Redirecting to login...</ThemedText>
      </View>
    );
  }

  // Show loading while fetching profile
  if (loading) {
    return (
      <View style={[styles.screen, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles.loadingText}>Loading profile...</ThemedText>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles.screen, styles.centerContent]}>
        <ThemedText style={styles.errorText}>⚠️ {error}</ThemedText>
        <Pressable onPress={handleRetry} style={styles.retryButton}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </Pressable>
        <Pressable onPress={() => safeNavigate('/login')} style={styles.loginButton}>
          <ThemedText style={styles.loginButtonText}>Go to Login</ThemedText>
        </Pressable>
      </View>
    );
  }

  // Show message if no profile (shouldn't happen with auto-creation)
  if (!profile) {
    return (
      <View style={[styles.screen, styles.centerContent]}>
        <ThemedText style={styles.errorText}>No profile found</ThemedText>
        <Pressable onPress={handleRetry} style={styles.retryButton}>
          <ThemedText style={styles.retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </View>
    );
  }

  // Only render profile if everything is loaded and valid

// ------------------- ACCOUNTS UI -------------------------
  return (
    <View style={styles.screen}>
      {/* Smaller Header */}
      <View style={styles.headerSmall}>
        <ThemedText type="title" style={styles.headerTitleSmall}>
          Your Account
        </ThemedText>
        <Pressable
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={handleLogout}
        >
          <ThemedText style={styles.logoutButtonText}>Logout</ThemedText>
        </Pressable>
      </View>

      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Golf Stats
      </ThemedText>
      {/* Golf Stats Grid */}
      <View style={styles.statsGrid}>
        <StatTile label="Handicap" value={profile.handicap?.toFixed(1) ?? 'N/A'} />
        <StatTile label="Rounds" value={profile.rounds_played?.toString() ?? 'N/A'} />
        <StatTile label="Avg Score" value={profile.average_score?.toFixed(1) ?? 'N/A'} />
        <StatTile label="Best Score" value={profile.best_score?.toString() ?? 'N/A'} />
        <StatTile label="Fairways Hit" value={profile.fairways_hit?.toString() ?? 'N/A'} />
        <StatTile label="Putts/Round" value={profile.putts_per_round?.toString() ?? 'N/A'} />
      </View>

      {/* Swipeable Round History */}
      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Round History
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={320} // width of each tile
        decelerationRate="fast"
        style={styles.roundsScroll}
        contentContainerStyle={styles.roundsContainer}
      >
        {rounds.length === 0 ? (
          <ThemedText style={styles.infoText}>No rounds played yet.</ThemedText>
        ) : (
          rounds.map((round) => (
            <View key={round.id} style={styles.roundTile}>
              <ThemedText style={styles.roundCourse}>{round.course_name}</ThemedText>
              <ThemedText style={styles.roundDate}>{round.date}</ThemedText>
              <ThemedText style={styles.roundScore}>Score: {round.score}</ThemedText>
              <ThemedText style={styles.roundStat}>Fairways: {round.fairways_hit ?? 'N/A'}</ThemedText>
              <ThemedText style={styles.roundStat}>GIR: {round.greens_in_reg ?? 'N/A'}</ThemedText>
              <ThemedText style={styles.roundStat}>Putts: {round.putts ?? 'N/A'}</ThemedText>
              {/* Show scorecard if available */}
              {round.scorecard && (
                <TouchableOpacity onPress={() => openScorecardModal(round.scorecard!)} activeOpacity={0.7}>
                  <ScrollView horizontal style={{ marginTop: 12, maxHeight: 200 }}>
                    <View style={styles.scorecardTable}>
                      {(() => {
                        try {
                          const scorecard = JSON.parse(round.scorecard ?? JSON.stringify(selectedScorecard));
                          const maxHoles = Math.max(...scorecard.map((player: any) => player.scores.length), 18);
                          const parseScore = (text: string) => parseInt((text || '').split('/')[0]?.trim()) || 0;

                          return (
                            <>
                              {/* Header Row */}
                              <View style={styles.scorecardRow}>
                                <View style={styles.scorecardCellPlayerHeader}>
                                  <ThemedText style={styles.scorecardHeaderText}>Player</ThemedText>
                                </View>
                                {/* Holes 1-9 */}
                                {[...Array(9)].map((_, idx) => (
                                  <View key={idx} style={styles.scorecardCellHeader}>
                                    <ThemedText style={styles.scorecardHeaderText}>{idx + 1}</ThemedText>
                                  </View>
                                ))}
                                {/* IN */}
                                <View style={styles.scorecardCellHeader}>
                                  <ThemedText style={styles.scorecardHeaderText}>IN</ThemedText>
                                </View>
                                {/* Holes 10-18 */}
                                {[...Array(9)].map((_, idx) => (
                                  <View key={idx + 9} style={styles.scorecardCellHeader}>
                                    <ThemedText style={styles.scorecardHeaderText}>{idx + 10}</ThemedText>
                                  </View>
                                ))}
                                {/* OUT */}
                                <View style={styles.scorecardCellHeader}>
                                  <ThemedText style={styles.scorecardHeaderText}>OUT</ThemedText>
                                </View>
                                {/* TOTAL */}
                                <View style={styles.scorecardCellHeader}>
                                  <ThemedText style={styles.scorecardHeaderText}>Total</ThemedText>
                                </View>
                              </View>
                              {/* Player Rows */}
                              {scorecard.map((player: any, idx: number) => {
                                const inScore = player.scores.slice(0, 9).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                                const outScore = player.scores.slice(9, 18).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                                const totalScore = inScore + outScore;
                                return (
                                  <View key={idx} style={styles.scorecardRow}>
                                    <View style={styles.scorecardCellPlayer}>
                                      <ThemedText style={styles.scorecardPlayerText}>{player.name}</ThemedText>
                                    </View>
                                    {/* Holes 1-9 */}
                                    {[...Array(9)].map((_, hIdx) => (
                                      <View key={hIdx} style={styles.scorecardCell}>
                                        <ThemedText style={styles.scorecardScoreText}>
                                          {player.scores[hIdx] || '-'}
                                        </ThemedText>
                                      </View>
                                    ))}
                                    {/* IN */}
                                    <View style={styles.scorecardCell}>
                                      <ThemedText style={styles.scorecardScoreText}>{inScore}</ThemedText>
                                    </View>
                                    {/* Holes 10-18 */}
                                    {[...Array(9)].map((_, hIdx) => (
                                      <View key={hIdx + 9} style={styles.scorecardCell}>
                                        <ThemedText style={styles.scorecardScoreText}>
                                          {player.scores[hIdx + 9] || '-'}
                                        </ThemedText>
                                      </View>
                                    ))}
                                    {/* OUT */}
                                    <View style={styles.scorecardCell}>
                                      <ThemedText style={styles.scorecardScoreText}>{outScore}</ThemedText>
                                    </View>
                                    {/* TOTAL */}
                                    <View style={styles.scorecardCell}>
                                      <ThemedText style={styles.scorecardScoreText}>{totalScore}</ThemedText>
                                    </View>
                                  </View>
                                );
                              })}
                            </>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                    </View>
                  </ScrollView>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
      <Modal
        visible={scorecardModalVisible}
        animationType="slide"
        onRequestClose={() => setScorecardModalVisible(false)}
        transparent={false}
      >
        <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 40 }}>
          <Pressable
            onPress={() => setScorecardModalVisible(false)}
            style={{ alignSelf: 'flex-end', padding: 20 }}
          >
            <ThemedText style={{ fontSize: 18, color: '#1E3A8A', fontWeight: '700' }}>Close</ThemedText>
          </Pressable>
          <ScrollView horizontal style={{ flex: 1 }}>
            <View style={[styles.scorecardTable, { alignSelf: 'center', marginTop: 20 }]}>
              {(() => {
                try {
                  const scorecard = JSON.parse(JSON.stringify(selectedScorecard));
                  const maxHoles = Math.max(...scorecard.map((player: any) => player.scores.length), 18);
                  const parseScore = (text: string) => parseInt((text || '').split('/')[0]?.trim()) || 0;

                  return (
                    <>
                      {/* Header Row */}
                      <View style={styles.scorecardRow}>
                        <View style={styles.scorecardCellPlayerHeader}>
                          <ThemedText style={styles.scorecardHeaderText}>Player</ThemedText>
                        </View>
                        {/* Holes 1-9 */}
                        {[...Array(9)].map((_, idx) => (
                          <View key={idx} style={styles.scorecardCellHeader}>
                            <ThemedText style={styles.scorecardHeaderText}>{idx + 1}</ThemedText>
                          </View>
                        ))}
                        {/* IN */}
                        <View style={styles.scorecardCellHeader}>
                          <ThemedText style={styles.scorecardHeaderText}>IN</ThemedText>
                        </View>
                        {/* Holes 10-18 */}
                        {[...Array(9)].map((_, idx) => (
                          <View key={idx + 9} style={styles.scorecardCellHeader}>
                            <ThemedText style={styles.scorecardHeaderText}>{idx + 10}</ThemedText>
                          </View>
                        ))}
                        {/* OUT */}
                        <View style={styles.scorecardCellHeader}>
                          <ThemedText style={styles.scorecardHeaderText}>OUT</ThemedText>
                        </View>
                        {/* TOTAL */}
                        <View style={styles.scorecardCellHeader}>
                          <ThemedText style={styles.scorecardHeaderText}>Total</ThemedText>
                        </View>
                      </View>
                      {/* Player Rows */}
                      {scorecard.map((player: any, idx: number) => {
                        const inScore = player.scores.slice(0, 9).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                        const outScore = player.scores.slice(9, 18).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                        const totalScore = inScore + outScore;
                        return (
                          <View key={idx} style={styles.scorecardRow}>
                            <View style={styles.scorecardCellPlayer}>
                              <ThemedText style={styles.scorecardPlayerText}>{player.name}</ThemedText>
                            </View>
                            {/* Holes 1-9 */}
                            {[...Array(9)].map((_, hIdx) => (
                              <View key={hIdx} style={styles.scorecardCell}>
                                <ThemedText style={styles.scorecardScoreText}>
                                  {player.scores[hIdx] || '-'}
                                </ThemedText>
                              </View>
                            ))}
                            {/* IN */}
                            <View style={styles.scorecardCell}>
                              <ThemedText style={styles.scorecardScoreText}>{inScore}</ThemedText>
                            </View>
                            {/* Holes 10-18 */}
                            {[...Array(9)].map((_, hIdx) => (
                              <View key={hIdx + 9} style={styles.scorecardCell}>
                                <ThemedText style={styles.scorecardScoreText}>
                                  {player.scores[hIdx + 9] || '-'}
                                </ThemedText>
                              </View>
                            ))}
                            {/* OUT */}
                            <View style={styles.scorecardCell}>
                              <ThemedText style={styles.scorecardScoreText}>{outScore}</ThemedText>
                            </View>
                            {/* TOTAL */}
                            <View style={styles.scorecardCell}>
                              <ThemedText style={styles.scorecardScoreText}>{totalScore}</ThemedText>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  );
                } catch {
                  return null;
                }
              })()}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// StatTile component for grid
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </View>
  );
}

// ------------------- STYLING -------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 10,
    marginTop: 40,
  },
  headerSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#fff',
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  headerTitleSmall: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  logoutButtonPressed: {
    backgroundColor: '#B91C1C',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  container: {
    paddingHorizontal: 30,
    paddingVertical: 30,
  },
  sectionTitle: {
    marginHorizontal: 20,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1E40AF',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 18,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 18,
    color: '#111827',
    marginTop: 6,
  },
  separator: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 30,
  },
  loadingText: {
    marginTop: 10,
    textAlign: 'center',
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginBottom: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: COLORS.third,
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  statTile: {
    width: '30%',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    color: '#1E40AF',
    fontWeight: '700',
  },
  roundsScroll: {
    marginTop: 10,
    marginBottom: 20,
  },
  roundsContainer: {
    paddingHorizontal: 10,
  },
  roundTile: {
    width: 300,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginRight: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roundCourse: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E3A8A',
    marginBottom: 4,
  },
  roundDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  roundScore: {
    fontSize: 16,
    color: '#EF4444',
    fontWeight: '700',
    marginBottom: 8,
  },
  roundStat: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  scorecardTable: {
    flexDirection: 'column',
  },
  scorecardRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  scorecardCellPlayerHeader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    padding: 6,
    borderRadius: 4,
  },
  scorecardCellHeader: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E5E7EB',
    padding: 6,
    borderRadius: 4,
    marginLeft: 4,
  },
  scorecardHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  scorecardCellPlayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 6,
    borderRadius: 4,
  },
  scorecardCell: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    padding: 6,
    borderRadius: 4,
    marginLeft: 4,
  },
  scorecardPlayerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  scorecardScoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
});