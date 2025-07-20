// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from "@/components/ThemeContext";
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, Dimensions, Text, TextInput } from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import { MaterialIcons } from '@expo/vector-icons';

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
  const [friends, setFriends] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [findFriendsModalVisible, setFindFriendsModalVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const { palette } = useTheme();

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

  useEffect(() => {
    const fetchFriends = async () => {
      const { data } = await supabase
        .from('friends')
        .select('friend_id, profiles(full_name)')
        .eq('user_id', user.id);
      setFriends(data || []);
    };
    fetchFriends();
  }, [user]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .ilike('full_name', `%${search.trim()}%`); // or use .ilike('email', `%${search.trim()}%`)
    setSearchResults(data || []);
  };

  // Add friend handler
  const handleAddFriend = async (friendId: string) => {
    if (!user || !friendId) return;
    try {
      // Prevent adding yourself
      if (user.id === friendId) {
        Alert.alert('Cannot add yourself as a friend.');
        return;
      }
      // Check if already friends
      const { data: existing } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', friendId)
        .single();
      if (existing) {
        Alert.alert('Already friends with this user.');
        return;
      }
      // Add friend
      const { error } = await supabase
        .from('friends')
        .insert({ user_id: user.id, friend_id: friendId });
      if (error) throw error;
      Alert.alert('Friend added!');
      setFindFriendsModalVisible(false);
      // Optionally refresh friends list
      const { data } = await supabase
        .from('friends')
        .select('friend_id, profiles(full_name)')
        .eq('user_id', user.id);
      setFriends(data || []);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add friend.');
    }
  };

  // Early returns for loading and error states
  if (!isMounted || authLoading || isRedirecting) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles(palette).loadingText}>
          {isRedirecting ? 'Redirecting...' : 'Loading...'}
        </ThemedText>
      </View>
    );
  }

  // If no user after auth loads, don't render anything (navigation will happen)
  // this prevents rendering the screen if user is not authenticated causing potential crash
  if (!user) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles(palette).loadingText}>Redirecting to login...</ThemedText>
      </View>
    );
  }

  // Show loading while fetching profile
  if (loading) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles(palette).loadingText}>Loading profile...</ThemedText>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ThemedText style={styles(palette).errorText}>⚠️ {error}</ThemedText>
        <Pressable onPress={handleRetry} style={styles(palette).retryButton}>
          <ThemedText style={styles(palette).retryButtonText}>Retry</ThemedText>
        </Pressable>
        <Pressable onPress={() => safeNavigate('/login')} style={styles(palette).loginButton}>
          <ThemedText style={styles(palette).loginButtonText}>Go to Login</ThemedText>
        </Pressable>
      </View>
    );
  }

  // Show message if no profile (shouldn't happen with auto-creation)
  if (!profile) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ThemedText style={styles(palette).errorText}>No profile found</ThemedText>
        <Pressable onPress={handleRetry} style={styles(palette).retryButton}>
          <ThemedText style={styles(palette).retryButtonText}>Try Again</ThemedText>
        </Pressable>
      </View>
    );
  }

  // Only render profile if everything is loaded and valid

// ------------------- ACCOUNTS UI -------------------------
  return (
    <ScrollView style={styles(palette).screen} contentContainerStyle={{ paddingBottom: SCREEN_HEIGHT * 0.10 }}>
      {/* Smaller Header */}
      <View style={styles(palette).headerSmall}>
        <ThemedText type="title" style={styles(palette).headerTitleSmall}>
          Your Account
        </ThemedText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            style={({ pressed }) => [
              styles(palette).logoutButton,
              pressed && styles(palette).logoutButtonPressed,
            ]}
            onPress={handleLogout}
          >
            <ThemedText style={styles(palette).logoutButtonText}>Logout</ThemedText>
          </Pressable>
          <Pressable
            style={styles(palette).settingsButton}
            onPress={() => router.push('../settings')}
          >
            <MaterialIcons size={28} name="settings" color={palette.grey} />
          </Pressable>
        </View>
      </View>

      {/* Account Description */}
      <View style={styles(palette).accountDescContainer}>
        {/* Avatar placeholder */}
        <View style={styles(palette).avatarCircle}>
          <ThemedText style={styles(palette).avatarText}>
            {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
          </ThemedText>
        </View>
        <View style={{ marginLeft: 16 }}>
          <ThemedText style={styles(palette).accountName}>{profile.full_name ?? 'Unknown User'}</ThemedText>
          <ThemedText style={styles(palette).accountEmail}>{profile.email ?? ''}</ThemedText>
        </View>
      </View>

      <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
        Golf Stats
      </ThemedText>
      <View style={styles(palette).statsGrid}>
        <StatTile label="Handicap" value={profile.handicap?.toFixed(1) ?? 'N/A'} />
        <StatTile label="Rounds" value={profile.rounds_played?.toString() ?? 'N/A'} />
        <StatTile label="Avg Score" value={profile.average_score?.toFixed(1) ?? 'N/A'} />
        <StatTile label="Best Score" value={profile.best_score?.toString() ?? 'N/A'} />
        <StatTile label="Fairways Hit" value={profile.fairways_hit?.toString() ?? 'N/A'} />
        <StatTile label="Putts/Round" value={profile.putts_per_round?.toString() ?? 'N/A'} />
      </View>

      <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
        Round History
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={320}
        decelerationRate="fast"
        style={styles(palette).roundsScroll}
        contentContainerStyle={styles(palette).roundsContainer}
      >
        {rounds.length === 0 ? (
          <ThemedText style={styles(palette).infoText}>No rounds played yet.</ThemedText>
        ) : (
          rounds.map((round) => (
            <View key={round.id} style={styles(palette).roundTile}>
              <ThemedText style={styles(palette).roundCourse}>{round.course_name}</ThemedText>
              <ThemedText style={styles(palette).roundDate}>{round.date}</ThemedText>
              <ThemedText style={styles(palette).roundScore}>Score: {round.score}</ThemedText>
              <ThemedText style={styles(palette).roundStat}>Fairways: {round.fairways_hit ?? 'N/A'}</ThemedText>
              <ThemedText style={styles(palette).roundStat}>GIR: {round.greens_in_reg ?? 'N/A'}</ThemedText>
              <ThemedText style={styles(palette).roundStat}>Putts: {round.putts ?? 'N/A'}</ThemedText>
              {/* Show scorecard if available */}
              {round.scorecard && (
                <TouchableOpacity onPress={() => openScorecardModal(round.scorecard!)} activeOpacity={0.7}>
                  <ScrollView
                    horizontal
                    style={{ marginTop: 12, maxHeight: 130 }}
                    contentContainerStyle={{ flexGrow: 1 }}
                  >
                    <ScrollView>
                      <View style={[styles(palette).scorecardTable, { alignSelf: 'center' }]}>
                        {(() => {
                          try {
                            const scorecard = JSON.parse(round.scorecard ?? JSON.stringify(selectedScorecard));
                            const maxHoles = Math.max(...scorecard.map((player: any) => player.scores.length), 18);
                            const parseScore = (text: string) => parseInt((text || '').split('/')[0]?.trim()) || 0;

                            return (
                              <>
                                {/* Header Row */}
                                <View style={styles(palette).scorecardRow}>
                                  <View style={styles(palette).scorecardCellPlayerHeader}>
                                    <ThemedText style={styles(palette).scorecardHeaderText}>Hole</ThemedText>
                                  </View>
                                  {/* Holes 1-9 */}
                                  {[...Array(9)].map((_, idx) => (
                                    <View key={idx} style={styles(palette).scorecardCellHeader}>
                                      <ThemedText style={styles(palette).scorecardHeaderText}>{idx + 1}</ThemedText>
                                    </View>
                                  ))}
                                  {/* IN */}
                                  <View style={styles(palette).scorecardCellHeader}>
                                    <ThemedText style={styles(palette).scorecardHeaderText}>IN</ThemedText>
                                  </View>
                                  {/* Holes 10-18 */}
                                  {[...Array(9)].map((_, idx) => (
                                    <View key={idx + 9} style={styles(palette).scorecardCellHeader}>
                                      <ThemedText style={styles(palette).scorecardHeaderText}>{idx + 10}</ThemedText>
                                    </View>
                                  ))}
                                  {/* OUT */}
                                  <View style={styles(palette).scorecardCellHeader}>
                                    <ThemedText style={styles(palette).scorecardHeaderText}>OUT</ThemedText>
                                  </View>
                                  {/* TOTAL */}
                                  <View style={styles(palette).scorecardCellHeader}>
                                    <ThemedText style={styles(palette).scorecardHeaderText}>Total</ThemedText>
                                  </View>
                                </View>
                                {/* Player Rows */}
                                {scorecard.map((player: any, idx: number) => {
                                  const inScore = player.scores.slice(0, 9).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                                  const outScore = player.scores.slice(9, 18).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                                  const totalScore = inScore + outScore;
                                  return (
                                    <View key={idx} style={styles(palette).scorecardRow}>
                                      <View style={styles(palette).scorecardCellPlayer}>
                                        <ThemedText style={styles(palette).scorecardPlayerText}>{player.name}</ThemedText>
                                      </View>
                                      {/* Holes 1-9 */}
                                      {[...Array(9)].map((_, hIdx) => (
                                        <View key={hIdx} style={styles(palette).scorecardCell}>
                                          <ThemedText style={styles(palette).scorecardScoreText}>
                                            {player.scores[hIdx] || '-'}
                                          </ThemedText>
                                        </View>
                                      ))}
                                      {/* IN */}
                                      <View style={styles(palette).scorecardCell}>
                                        <ThemedText style={styles(palette).scorecardScoreText}>{inScore}</ThemedText>
                                      </View>
                                      {/* Holes 10-18 */}
                                      {[...Array(9)].map((_, hIdx) => (
                                        <View key={hIdx + 9} style={styles(palette).scorecardCell}>
                                          <ThemedText style={styles(palette).scorecardScoreText}>
                                            {player.scores[hIdx + 9] || '-'}
                                          </ThemedText>
                                        </View>
                                      ))}
                                      {/* OUT */}
                                      <View style={styles(palette).scorecardCell}>
                                        <ThemedText style={styles(palette).scorecardScoreText}>{outScore}</ThemedText>
                                      </View>
                                      {/* TOTAL */}
                                      <View style={styles(palette).scorecardCell}>
                                        <ThemedText style={styles(palette).scorecardScoreText}>{totalScore}</ThemedText>
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
            <View style={[styles(palette).scorecardTable, { alignSelf: 'center', marginTop: 20 }]}>
              {(() => {
                try {
                  const scorecard = JSON.parse(JSON.stringify(selectedScorecard));
                  const maxHoles = Math.max(...scorecard.map((player: any) => player.scores.length), 18);
                  const parseScore = (text: string) => parseInt((text || '').split('/')[0]?.trim()) || 0;

                  return (
                    <>
                      {/* Header Row */}
                      <View style={styles(palette).scorecardRow}>
                        <View style={styles(palette).scorecardCellPlayerHeader}>
                          <ThemedText style={styles(palette).scorecardHeaderText}>Player</ThemedText>
                        </View>
                        {/* Holes 1-9 */}
                        {[...Array(9)].map((_, idx) => (
                          <View key={idx} style={styles(palette).scorecardCellHeader}>
                            <ThemedText style={styles(palette).scorecardHeaderText}>{idx + 1}</ThemedText>
                          </View>
                        ))}
                        {/* IN */}
                        <View style={styles(palette).scorecardCellHeader}>
                          <ThemedText style={styles(palette).scorecardHeaderText}>IN</ThemedText>
                        </View>
                        {/* Holes 10-18 */}
                        {[...Array(9)].map((_, idx) => (
                          <View key={idx + 9} style={styles(palette).scorecardCellHeader}>
                            <ThemedText style={styles(palette).scorecardHeaderText}>{idx + 10}</ThemedText>
                          </View>
                        ))}
                        {/* OUT */}
                        <View style={styles(palette).scorecardCellHeader}>
                          <ThemedText style={styles(palette).scorecardHeaderText}>OUT</ThemedText>
                        </View>
                        {/* TOTAL */}
                        <View style={styles(palette).scorecardCellHeader}>
                          <ThemedText style={styles(palette).scorecardHeaderText}>Total</ThemedText>
                        </View>
                      </View>
                      {/* Player Rows */}
                      {scorecard.map((player: any, idx: number) => {
                        const inScore = player.scores.slice(0, 9).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                        const outScore = player.scores.slice(9, 18).reduce((sum: number, val: string) => sum + parseScore(val), 0);
                        const totalScore = inScore + outScore;
                        return (
                          <View key={idx} style={styles(palette).scorecardRow}>
                            <View style={styles(palette).scorecardCellPlayer}>
                              <ThemedText style={styles(palette).scorecardPlayerText}>{player.name}</ThemedText>
                            </View>
                            {/* Holes 1-9 */}
                            {[...Array(9)].map((_, hIdx) => (
                              <View key={hIdx} style={styles(palette).scorecardCell}>
                                <ThemedText style={styles(palette).scorecardScoreText}>
                                  {player.scores[hIdx] || '-'}
                                </ThemedText>
                              </View>
                            ))}
                            {/* IN */}
                            <View style={styles(palette).scorecardCell}>
                              <ThemedText style={styles(palette).scorecardScoreText}>{inScore}</ThemedText>
                            </View>
                            {/* Holes 10-18 */}
                            {[...Array(9)].map((_, hIdx) => (
                              <View key={hIdx + 9} style={styles(palette).scorecardCell}>
                                <ThemedText style={styles(palette).scorecardScoreText}>
                                  {player.scores[hIdx + 9] || '-'}
                                </ThemedText>
                              </View>
                            ))}
                            {/* OUT */}
                            <View style={styles(palette).scorecardCell}>
                              <ThemedText style={styles(palette).scorecardScoreText}>{outScore}</ThemedText>
                            </View>
                            {/* TOTAL */}
                            <View style={styles(palette).scorecardCell}>
                              <ThemedText style={styles(palette).scorecardScoreText}>{totalScore}</ThemedText>
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
      <View>
      <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
        My Friends
      </ThemedText>
        {friends.length === 0 ? (
          <ThemedText style={styles(palette).infoText}>No friends found.</ThemedText>
        ) : (
          friends.map(f => (
            <View key={f.friend_id} style={{ marginBottom: 8 }}>
              <ThemedText style={styles(palette).accountName}>{f.profiles?.full_name}</ThemedText>
            </View>
          ))
        )}
        {/* Add friend UI */}
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <Pressable
            style={styles(palette).createButton}
            onPress={() => setFindFriendsModalVisible(true)}
          >
            <ThemedText style={styles(palette).createButtonText}>Find Friends</ThemedText>
          </Pressable>
        </View>
        <Modal visible={findFriendsModalVisible} transparent animationType="slide" onRequestClose={() => setFindFriendsModalVisible(false)}>
          <View style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.3)'
          }}>
            <View style={{
              backgroundColor: palette.white,
              padding: 24,
              borderRadius: 16,
              width: '80%',
              alignItems: 'center'
            }}>
              <ThemedText style={{ fontSize: 18, fontWeight: '700', marginBottom: 12, color: palette.black }}>Find Friends</ThemedText>
              <TextInput
                style={{
                  width: '100%',
                  borderWidth: 1,
                  borderColor: palette.primary,
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 16,
                  color: palette.textDark,
                  backgroundColor: palette.background,
                }}
                placeholder="Search by name or email"
                placeholderTextColor={palette.textLight}
                value={search}
                onChangeText={setSearch}
              />
              <Pressable
                style={styles(palette).createButton}
                onPress={handleSearch}
              >
                <ThemedText style={styles(palette).createButtonText}>Search</ThemedText>
              </Pressable>
              {searchResults.map(u => (
                <Pressable key={u.id} onPress={() => handleAddFriend(u.id)}>
                  <ThemedText style={{color: palette.black}}>{u.full_name} ({u.email})</ThemedText>
                </Pressable>
              ))}
              <Pressable
                style={[styles(palette).leaveButton, { marginTop: 12 }]}
                onPress={() => setFindFriendsModalVisible(false)}
              >
                <ThemedText style={styles(palette).leaveButtonText}>Close</ThemedText>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}

// StatTile component for grid
function StatTile({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles(palette).statTile}>
      <ThemedText style={styles(palette).statLabel}>{label}</ThemedText>
      <ThemedText style={styles(palette).statValue}>{value}</ThemedText>
    </View>
  );
}

// ------------------- STYLING -------------------------
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = (palette: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
    marginTop: SCREEN_HEIGHT * 0.04,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SCREEN_WIDTH * 0.05,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    paddingVertical: SCREEN_HEIGHT * 0.04,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
    backgroundColor: palette.white,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 10,
    marginTop: SCREEN_HEIGHT * 0.05,
  },
  headerSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: SCREEN_HEIGHT * 0.015,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
    backgroundColor: palette.white,
  },
  headerTitle: {
    fontSize: SCREEN_WIDTH * 0.07,
    fontWeight: '700',
    color: palette.primary,
  },
  headerTitleSmall: {
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: '700',
    color: palette.primary,
  },
  logoutButton: {
    backgroundColor: palette.error,
    paddingHorizontal: SCREEN_WIDTH * 0.04,
    paddingVertical: SCREEN_HEIGHT * 0.01,
    borderRadius: 20,
  },
  logoutButtonPressed: {
    backgroundColor: "#B91C1C",
  },
  logoutButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: SCREEN_WIDTH * 0.04,
  },
  container: {
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    paddingVertical: SCREEN_HEIGHT * 0.04,
  },
  sectionTitle: {
    paddingTop: SCREEN_HEIGHT * 0.015,
    marginHorizontal: SCREEN_WIDTH * 0.05,
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: '700',
    marginBottom: SCREEN_HEIGHT * 0.015,
    color: palette.primary,
  },
  infoLabel: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: palette.textLight,
    marginTop: SCREEN_HEIGHT * 0.025,
    fontWeight: '600',
  },
  infoText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: palette.textDark,
    marginTop: SCREEN_HEIGHT * 0.01,
    paddingLeft: SCREEN_WIDTH * 0.05,
  },
  separator: {
    height: 1,
    backgroundColor: palette.grey,
    marginVertical: SCREEN_HEIGHT * 0.04,
  },
  loadingText: {
    marginTop: SCREEN_HEIGHT * 0.015,
    textAlign: 'center',
    color: palette.textLight,
  },
  errorText: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: palette.error,
    textAlign: 'center',
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  retryButton: {
    backgroundColor: palette.primary,
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 12,
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  retryButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: SCREEN_WIDTH * 0.045,
  },
  loginButton: {
    backgroundColor: palette.third,
    paddingVertical: SCREEN_HEIGHT * 0.015,
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    borderRadius: 12,
  },
  loginButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: SCREEN_WIDTH * 0.045,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: SCREEN_WIDTH * 0.05,
    marginTop: SCREEN_HEIGHT * 0.025,
    marginBottom: SCREEN_HEIGHT * 0.015,
  },
  statTile: {
    width: SCREEN_WIDTH * 0.28,
    backgroundColor: palette.secondary,
    borderRadius: 12,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.015,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: palette.textLight,
    fontWeight: '600',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  statValue: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: palette.primary,
    fontWeight: '700',
  },
  roundsScroll: {
    marginTop: SCREEN_HEIGHT * 0.015,
    marginBottom: SCREEN_HEIGHT * 0.025,
  },
  roundsContainer: {
    paddingHorizontal: SCREEN_WIDTH * 0.025,
    paddingVertical: SCREEN_HEIGHT * 0.01,
  },
  roundTile: {
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_HEIGHT * 0.40,
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: SCREEN_WIDTH * 0.045,
    marginRight: SCREEN_WIDTH * 0.05,
    shadowColor: palette.black,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roundCourse: {
    fontSize: SCREEN_WIDTH * 0.045,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  roundDate: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: palette.textLight,
    marginBottom: SCREEN_HEIGHT * 0.008,
  },
  roundScore: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: palette.error,
    fontWeight: '700',
    marginBottom: SCREEN_HEIGHT * 0.008,
  },
  roundStat: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: palette.textDark,
    marginBottom: SCREEN_HEIGHT * 0.002,
  },
  scorecardTable: {
    flexDirection: 'column',
  },
  scorecardRow: {
    flexDirection: 'row',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  scorecardCellPlayerHeader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.grey,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
  },
  scorecardCellHeader: {
    width: SCREEN_WIDTH * 0.11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.grey,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  scorecardHeaderText: {
    fontSize: SCREEN_WIDTH * 0.03,
    fontWeight: '700',
    color: palette.primary,
  },
  scorecardCellPlayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.secondary,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
  },
  scorecardCell: {
    width: SCREEN_WIDTH * 0.11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.secondary,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  scorecardPlayerText: {
    fontSize: SCREEN_WIDTH * 0.03,
    fontWeight: '600',
    color: palette.textDark,
  },
  scorecardScoreText: {
    fontSize: SCREEN_WIDTH * 0.03,
    fontWeight: '600',
    color: palette.textDark,
  },
  accountDescContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: SCREEN_HEIGHT * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
    backgroundColor: palette.white,
  },
  avatarCircle: {
    width: SCREEN_WIDTH * 0.15,
    height: SCREEN_WIDTH * 0.15,
    borderRadius: (SCREEN_WIDTH * 0.15) / 2,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: palette.white,
    fontSize: SCREEN_WIDTH * 0.07,
    fontWeight: '700',
  },
  accountName: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '700',
    color: palette.primary,
  },
  accountEmail: {
    fontSize: SCREEN_WIDTH * 0.04,
    color: palette.textLight,
  },
  createButton: {
    backgroundColor: palette.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 18,
  },
  leaveButton: {
    backgroundColor: palette.error,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 20,
    marginBottom: 8,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 18,
  },
  settingsButton: {
    backgroundColor: palette.background,
    padding: 8,
    borderRadius: 20,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});