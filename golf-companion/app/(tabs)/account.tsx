// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from "@/components/ThemeContext";
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, Dimensions, Text, TextInput, RefreshControl, StatusBar } from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import { MaterialIcons } from '@expo/vector-icons';
import { PALETTES } from '@/constants/theme';


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
  const [refreshing, setRefreshing] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [hideInviteBanner, setHideInviteBanner] = useState(false);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<any[]>([]);

  const { palette } = useTheme();
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2000); // Hide after 2 seconds
  }

  // FriendTile component
  function FriendTile({ friend }: { friend: any }) {
    const { palette } = useTheme();
    return (
      <View style={styles(palette).friendTile}>
        <View style={styles(palette).friendAvatarCircle}>
          <ThemedText style={styles(palette).friendAvatarText}>
            {friend.profiles?.full_name ? friend.profiles.full_name[0].toUpperCase() : '?'}
          </ThemedText>
        </View>
        <View style={{ marginLeft: 12 }}>
          <ThemedText style={styles(palette).friendTileName}>{friend.profiles?.full_name ?? 'Unknown'}</ThemedText>
          <ThemedText style={styles(palette).friendTileEmail}>{friend.profiles?.email ?? ''}</ThemedText>
        </View>
      </View>
    );
  }

  function SectionDivider() {
    const { palette } = useTheme();
    return (
      <View style={{
        height: 1,
        backgroundColor: palette.grey,
        marginVertical: 18,
        marginHorizontal: 16,
        opacity: 0.5,
        borderRadius: 1,
      }} />
    );
  }


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
    if (isRedirecting) return;
    try {
      await signOut();
      setIsRedirecting(true);
      safeNavigate('/login');
      // Reset isRedirecting after 2 seconds in case navigation fails
      setTimeout(() => setIsRedirecting(false), 2000);
    } catch (error: any) {
      setIsRedirecting(false);
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
    if (!user?.id) return;
    const fetchFriends = async () => {
      const { data, error } = await supabase
        .from('friends')
        .select('friend_id, profiles:friend_id(full_name, email)')
        .eq('user_id', user.id);
      setFriends(data || []);
    };
    fetchFriends();
  }, [user?.id]);

  const handleSearch = async (searchText: string) => {
    if (!searchText.trim()) {
      setSearchResults([]);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${searchText.trim()}%,email.ilike.%${searchText.trim()}%`)
        .limit(50) // Increased from default to show more users
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      
      console.log('Find Friends Search Query:', { search: searchText.trim(), data });
      setSearchResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  // Add friend handler
  const handleAddFriend = async (friendId: string) => {
    // Prevent adding yourself
    if (user.id === friendId) {
      Alert.alert('Error', 'Cannot add yourself as a friend.');
      return;
    }
  
    try {
      // Check if already requested
      const { data: existing, error: existingError } = await supabase
        .from('friend_requests')
        .select('id')
        .eq('requester_user_id', user.id)
        .eq('requested_user_id', friendId)
        .eq('status', 'pending')
        .single();
  
      if (existing) {
        Alert.alert('Already Sent', 'Friend request already sent to this user.');
        return;
      }
  
      // Check if already friends
      const { data: friendship } = await supabase
        .from('friends')
        .select('id')
        .eq('user_id', user.id)
        .eq('friend_id', friendId)
        .single();
  
      if (friendship) {
        Alert.alert('Already Friends', 'You are already friends with this user.');
        return;
      }
  
      // Send friend request
      const { error } = await supabase.from('friend_requests').insert({
        requester_user_id: user.id,
        requested_user_id: friendId,
        status: 'pending'
      });
  
      if (error) throw error;
  
      Alert.alert(
        'Success!', 
        'Friend request sent successfully!',
        [
          { 
            text: 'OK', 
            onPress: () => {
              setFindFriendsModalVisible(false);
              setSearch('');
              setSearchResults([]);
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert('Error', 'Failed to send friend request. Please try again.');
    }
  };

  // Refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    await fetchRounds();
  
    // Friends
    const { data: friendsData } = await supabase
      .from('friends')
      .select('friend_id, profiles:friend_id(full_name)')
      .eq('user_id', user.id);
    setFriends(friendsData || []);
  
    // Invites
    const { data: invitesData } = await supabase
      .from('hubroom_invites')
      .select('id, group_id, voice_groups(name), inviter_user_id, status')
      .eq('invited_user_id', user.id)
      .eq('status', 'pending');
    setPendingInvites(invitesData || []);
  
    // Friend Requests
    const { data: requestsData } = await supabase
      .from('friend_requests')
      .select('*')
      .eq('requested_user_id', user.id)
      .eq('status', 'pending');
    setPendingFriendRequests(requestsData || []);
  
    setRefreshing(false);
  };

  // Example: Show pending invites for current user
  useEffect(() => {
    const fetchInvites = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('hubroom_invites')
        .select(`
          id, 
          group_id, 
          inviter_user_id, 
          status,
          voice_groups (
            name,
            description
          )
        `)
        .eq('invited_user_id', user.id)
        .eq('status', 'pending');
      setPendingInvites(data || []);
    };
    fetchInvites();
  }, [user?.id]);

  useEffect(() => {
    const fetchFriendRequests = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('requested_user_id', user.id)
        .eq('status', 'pending');
      setPendingFriendRequests(data || []);
    };
    fetchFriendRequests();
  }, [user?.id]);

  const acceptInvite = async (inviteId: string, groupId: string) => {
    try {
      // Add user to group members
      const { error: memberError } = await supabase
        .from('voice_group_members')
        .insert({
          group_id: groupId,
          user_id: user.id,
        });
  
      if (memberError) throw memberError;
  
      // Update invite status
      const { error: inviteError } = await supabase
        .from('hubroom_invites')
        .update({ status: 'accepted' })
        .eq('id', inviteId);
  
      if (inviteError) throw inviteError;
  
      // Get group details for navigation
      const { data: groupData, error: groupError } = await supabase
        .from('voice_groups')
        .select('name, description')
        .eq('id', groupId)
        .single();
  
      if (groupError) throw groupError;
  
      // Remove from pending invites
      setPendingInvites(prev => prev.filter(invite => invite.id !== inviteId));
      
      showToast('Joined group successfully!');
      
      // Navigate to the room after a short delay
      setTimeout(() => {
        router.push({
          pathname: '/hubRoom',
          params: {
            roomId: groupId,
            roomName: groupData?.name || 'Group Chat',
            roomDesc: groupData?.description || ''
          }
        });
      }, 1000);
  
    } catch (error) {
      console.error('Error accepting invite:', error);
      showToast('Error joining group');
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up realtime subscriptions for user:', user.id);

    // Friend requests received
    const friendRequestChannel = supabase
      .channel('public:friend_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friend_requests', filter: `requested_user_id=eq.${user.id}` },
        (payload) => {
          console.log('🔥 NEW FRIEND REQUEST:', payload);
          showToast('New friend request received!');
          setPendingFriendRequests(prev => [...prev, payload.new]);
        }
      )
      .subscribe();

    // Friend request status updates (for when your requests are accepted/declined)
    const friendRequestUpdateChannel = supabase
      .channel('public:friend_requests_updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'friend_requests', filter: `requester_user_id=eq.${user.id}` },
        (payload) => {
          console.log('🔥 FRIEND REQUEST UPDATE:', payload);
          if (payload.new.status === 'accepted') {
            showToast('Friend request accepted!');
          } else if (payload.new.status === 'declined') {
            showToast('Friend request declined');
          }
        }
      )
      .subscribe();

    // Friends added - bidirectional listening
    const friendsChannel = supabase
      .channel('public:friends')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friends', filter: `user_id=eq.${user.id}` },
        async (payload) => {
          console.log('🔥 NEW FRIEND ADDED (as user):', payload);
          const { data: friendProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', payload.new.friend_id)
            .single();
          
          setFriends(prev => [...prev, {
            friend_id: payload.new.friend_id,
            profiles: friendProfile
          }]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'friends', filter: `friend_id=eq.${user.id}` },
        async (payload) => {
          console.log('🔥 SOMEONE ADDED ME AS FRIEND (reverse):', payload);
          // This is when someone accepts YOUR friend request
          // You need to also add them to your friends list
          const { data: friendProfile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', payload.new.user_id)
            .single();
          
          // Check if they're not already in your friends list
          setFriends(prev => {
            const exists = prev.some(f => f.friend_id === payload.new.user_id);
            if (exists) return prev;
            
            return [...prev, {
              friend_id: payload.new.user_id,
              profiles: friendProfile
            }];
          });
          
          showToast('You have a new friend!');
        }
      )
      .subscribe();

    // Group invites
    // Add this to your existing useEffect with realtime subscriptions

// Group invites
const inviteChannel = supabase
.channel('public:hubroom_invites')
.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'hubroom_invites', filter: `invited_user_id=eq.${user.id}` },
  async (payload) => {
    // Fetch group details
    const { data: groupData } = await supabase
      .from('voice_groups')
      .select('name')
      .eq('id', payload.new.group_id)
      .single();
    
    showToast(`Invited to join ${groupData?.name || 'a group'}!`);
    setPendingInvites(prev => [...prev, payload.new]);
  }
)
.on(
  'postgres_changes',
  { event: 'UPDATE', schema: 'public', table: 'hubroom_invites', filter: `invited_user_id=eq.${user.id}` },
  (payload) => {
    setPendingInvites(prev =>
      prev.map(invite => invite.id === payload.new.id ? payload.new : invite)
    );
  }
)
.subscribe();

// Don't forget to add inviteChannel.unsubscribe() in the cleanup function

    return () => {
      console.log('Unsubscribing from realtime channels');
      friendRequestChannel.unsubscribe();
      friendRequestUpdateChannel.unsubscribe();
      friendsChannel.unsubscribe();
      inviteChannel.unsubscribe();
    };
  }, [user?.id]);

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
    <>
    <StatusBar
      barStyle={palette === PALETTES.dark ? "light-content" : "dark-content"}
      backgroundColor={palette.background}
      translucent={false}
    />
    <ScrollView
      style={styles(palette).screen}
      contentContainerStyle={{ paddingBottom: SCREEN_HEIGHT * 0.10 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      {toast && (
        <View style={{
          position: 'absolute',
          top: 60,
          alignSelf: 'center',
          backgroundColor: palette.primary,
          paddingHorizontal: 24,
          paddingVertical: 10,
          borderRadius: 20,
          zIndex: 999,
          shadowColor: palette.black,
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}>
          <ThemedText style={{ color: palette.white, fontWeight: '700', fontSize: 16 }}>{toast}</ThemedText>
        </View>
      )}

      {/* Condensed Header */}
      <View style={styles(palette).headerSmall}>
        <View style={{ flex: 1 }}>
          <ThemedText type="title" style={styles(palette).headerTitleSmall}>
            Your Account
          </ThemedText>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
            <MaterialIcons size={24} name="settings" color={palette.grey} />
          </Pressable>
        </View>
      </View>

      {/* Condensed Account Info */}
      <View style={styles(palette).accountDescContainer}>
        <View style={styles(palette).avatarCircle}>
          <ThemedText style={styles(palette).avatarText}>
            {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
          </ThemedText>
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
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

      <SectionDivider />

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
                            const scorecard = JSON.parse(round.scorecard!);
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

      <SectionDivider />


      <View style={styles(palette).friendsSection}>
        <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
          My Friends
        </ThemedText>
        <Pressable
            style={styles(palette).createButton}
            onPress={() => setFindFriendsModalVisible(true)}
          >
            <ThemedText style={styles(palette).createButtonText}>Find Friends</ThemedText>
          </Pressable>
          {friends.length === 0 ? (
            <ThemedText style={styles(palette).infoText}>No friends found.</ThemedText>
          ) : (
            <View style={styles(palette).friendsGrid}>
              {friends.map(f => (
                <Pressable
                  key={f.friend_id}
                  style={({ pressed }) => [
                    styles(palette).friendTile,
                    pressed && { backgroundColor: palette.secondary, transform: [{ scale: 0.95 }] }
                  ]}
                  onPress={() => {
                    // Navigate to friend's profile
                    router.push({
                      pathname: '/friendProfile',
                      params: {
                        friendId: f.friend_id,
                        friendName: f.profiles?.full_name || 'Unknown',
                        friendEmail: f.profiles?.email || ''
                      }
                    });
                  }}
                >
                  <View style={styles(palette).friendAvatarCircle}>
                    <ThemedText style={styles(palette).friendAvatarText}>
                      {f.profiles?.full_name ? f.profiles.full_name[0].toUpperCase() : '?'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles(palette).friendTileName} numberOfLines={1}>
                    {f.profiles?.full_name ?? 'Unknown'}
                  </ThemedText>
                  <ThemedText style={styles(palette).friendTileEmail} numberOfLines={1}>
                    {f.profiles?.email ?? ''}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        <Modal visible={findFriendsModalVisible} transparent animationType="slide" onRequestClose={() => setFindFriendsModalVisible(false)}>
          <View style={styles(palette).modalOverlay}>
            <View style={styles(palette).modalContainer}>
              {/* Header */}
              <View style={styles(palette).modalHeader}>
                <ThemedText style={styles(palette).modalTitle}>Find Friends</ThemedText>
                <Pressable
                  style={styles(palette).modalCloseButton}
                  onPress={() => setFindFriendsModalVisible(false)}
                >
                  <MaterialIcons name="close" size={24} color={palette.textDark} />
                </Pressable>
              </View>

              {/* Search Input */}
              <View style={styles(palette).searchContainer}>
                <View style={styles(palette).searchInputContainer}>
                  <MaterialIcons name="search" size={20} color={palette.textLight} style={styles(palette).searchIcon} />
                  <TextInput
                    style={styles(palette).searchInput}
                    placeholder="Search by name or email..."
                    placeholderTextColor={palette.textLight}
                    value={search}
                    onChangeText={(text) => {
                      setSearch(text);
                      handleSearch(text); // Search as user types
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {search.length > 0 && (
                    <Pressable
                      style={styles(palette).clearButton}
                      onPress={() => {
                        setSearch('');
                        setSearchResults([]);
                      }}
                    >
                      <MaterialIcons name="clear" size={20} color={palette.textLight} />
                    </Pressable>
                  )}
                </View>
                
                {/* Optional: Show search count */}
                {searchResults.length > 0 && (
                  <ThemedText style={styles(palette).searchResultsCount}>
                    Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
                    {searchResults.length >= 100 ? ' (showing first 100)' : ''}
                  </ThemedText>
                )}
              </View>

              {/* Results List */}
              <View style={styles(palette).resultsContainer}>
                {searchResults.length === 0 ? (
                  <View style={styles(palette).emptyState}>
                    <MaterialIcons name="people-outline" size={48} color={palette.textLight} />
                    <ThemedText style={styles(palette).emptyStateText}>
                      {search.trim() ? 'No users found' : 'Search for friends to connect'}
                    </ThemedText>
                  </View>
                ) : (
                  <ScrollView 
                    style={styles(palette).resultsList}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={styles(palette).resultsListContent}
                    nestedScrollEnabled={true}
                    bounces={true}
                    indicatorStyle={palette === PALETTES.dark ? 'white' : 'black'}
                  >
                    {searchResults.map((user, index) => (
                      <Pressable
                        key={user.id}
                        style={({ pressed }) => [
                          styles(palette).userResultTile,
                          pressed && styles(palette).userResultTilePressed,
                          { 
                            opacity: pressed ? 0.8 : 1,
                            transform: pressed ? [{ scale: 0.98 }] : [{ scale: 1 }]
                          }
                        ]}
                        onPress={() => handleAddFriend(user.id)}
                      >
                        <View style={styles(palette).userResultInfo}>
                          <View style={styles(palette).userResultAvatar}>
                            <ThemedText style={styles(palette).userResultAvatarText}>
                              {user.full_name ? user.full_name[0].toUpperCase() : '?'}
                            </ThemedText>
                          </View>
                          <View style={styles(palette).userResultDetails}>
                            <ThemedText style={styles(palette).userResultName}>
                              {user.full_name || 'Unknown User'}
                            </ThemedText>
                            <ThemedText style={styles(palette).userResultEmail}>
                              {user.email}
                            </ThemedText>
                          </View>
                        </View>
                        <View style={styles(palette).addFriendButton}>
                          <MaterialIcons name="person-add" size={18} color={palette.white} />
                        </View>
                      </Pressable>
                    ))}
                    
                    {/* Bottom padding and end indicator */}
                    <View style={styles(palette).listEnd}>
                      <ThemedText style={styles(palette).listEndText}>
                        {searchResults.length} user{searchResults.length !== 1 ? 's' : ''} found
                      </ThemedText>
                    </View>
                  </ScrollView>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
      {(pendingInvites.length > 0) && !hideInviteBanner && (
        <View style={styles(palette).notificationBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <ThemedText style={styles(palette).notificationText}>
              You have {pendingInvites.length} group invite{pendingInvites.length > 1 ? 's' : ''}!
            </ThemedText>
            <Pressable onPress={() => setHideInviteBanner(true)}>
              <MaterialIcons name="close" size={22} color={palette.white} />
            </Pressable>
          </View>
        </View>
      )}
      {/* If you add friend requests: */}
      {pendingFriendRequests.map(request => (
        <View key={request.id}>
          <ThemedText>Friend request from {request.requester_user_id}</ThemedText>
          <View style={{ flexDirection: 'row' }}>
            <Pressable
              style={styles(palette).acceptInviteButton}
              onPress={async () => {
                try {
                  // Insert friendship in both directions with proper structure
                  const { error: friendsError } = await supabase.from('friends').insert([
                    { user_id: user.id, friend_id: request.requester_user_id },
                    { user_id: request.requester_user_id, friend_id: user.id }
                  ]);

                  if (friendsError) throw friendsError;

                  // Update friend request status
                  await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id);
                  
                  showToast('Friend Added!');
                  
                  // Remove the request from pending list immediately
                  setPendingFriendRequests(prev => prev.filter(req => req.id !== request.id));
                  
                  // Optionally refresh friends list immediately
                  const { data: updatedFriends } = await supabase
                    .from('friends')
                    .select('friend_id, profiles:friend_id(full_name, email)')
                    .eq('user_id', user.id);
                  setFriends(updatedFriends || []);
                  
                } catch (err) {
                  console.error('Friend acceptance error:', err);
                  showToast('Error adding friend');
                }
              }}
            >
              <ThemedText style={styles(palette).acceptInviteButtonText}>Accept Request</ThemedText>
            </Pressable>
            <Pressable
              style={styles(palette).declineInviteButton}
              onPress={async () => {
                await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', request.id);
                Alert.alert('Request Declined', 'Friend request declined.');
                onRefresh();
              }}
            >
              <ThemedText style={styles(palette).declineInviteButtonText}>Decline Request</ThemedText>
            </Pressable>
          </View>
        </View>
      ))}
      {pendingInvites.map(invite => (
        <View key={invite.id} style={{
          backgroundColor: palette.white,
          padding: 16,
          marginHorizontal: 16,
          marginVertical: 8,
          borderRadius: 12,
          shadowColor: palette.primary,
          shadowOpacity: 0.1,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        }}>
          <ThemedText style={{
            fontSize: 16,
            fontWeight: '600',
            color: palette.primary,
            marginBottom: 4
          }}>
            Group Invitation
          </ThemedText>
          <ThemedText style={{
            fontSize: 14,
            color: palette.textDark,
            marginBottom: 12
          }}>
            You've been invited to join "{invite.voice_groups?.name || 'a group'}"
          </ThemedText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={({ pressed }) => [
                styles(palette).acceptInviteButton,
                pressed && { backgroundColor: '#2563EB', transform: [{ scale: 0.95 }] } // Use hardcoded darker blue
              ]}
              onPress={() => acceptInvite(invite.id, invite.group_id)}
            >
              <ThemedText style={styles(palette).acceptInviteButtonText}>
                Accept & Join
              </ThemedText>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles(palette).declineInviteButton,
                pressed && { backgroundColor: '#B91C1C', transform: [{ scale: 0.95 }] }
              ]}
              onPress={async () => {
                await supabase.from('hubroom_invites').update({ status: 'declined' }).eq('id', invite.id);
                showToast('Invite Declined');
                setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
              }}
            >
              <ThemedText style={styles(palette).declineInviteButtonText}>
                Decline
              </ThemedText>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
    </>
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
    marginTop: SCREEN_HEIGHT * 0
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
    paddingVertical: SCREEN_HEIGHT * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
    backgroundColor: palette.white,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 10,
  },
  headerSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingTop: SCREEN_HEIGHT * 0.04, // Move higher up
    paddingBottom: SCREEN_HEIGHT * 0.01, // More condensed
    backgroundColor: palette.white,
    borderBottomWidth: 0, // Remove bottom border for cleaner look
  },

  headerTitleSmall: {
    fontSize: SCREEN_WIDTH * 0.05, // Slightly smaller
    fontWeight: '700',
    color: palette.primary,
  },

  accountDescContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingTop: SCREEN_HEIGHT * 0.005, // Minimal top padding
    paddingBottom: SCREEN_HEIGHT * 0.015, // Reduced bottom padding
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
  },

  avatarCircle: {
    width: SCREEN_WIDTH * 0.12, // Slightly smaller avatar
    height: SCREEN_WIDTH * 0.12,
    borderRadius: (SCREEN_WIDTH * 0.12) / 2,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    color: palette.white,
    fontSize: SCREEN_WIDTH * 0.055, // Smaller text to match smaller avatar
    fontWeight: '700',
  },

  accountName: {
    fontSize: SCREEN_WIDTH * 0.045, // Slightly smaller name
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 2, // Add small margin for better spacing
  },

  accountEmail: {
    fontSize: SCREEN_WIDTH * 0.035, // Smaller email text
    color: palette.textLight,
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
  notificationBanner: {
    backgroundColor: palette.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginVertical: 10,
    alignItems: 'center',
  },
  notificationText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  acceptInviteButton: {
    backgroundColor: palette.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginRight: 4,
  },
  acceptInviteButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
  },
  declineInviteButton: {
    backgroundColor: palette.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginLeft: 4,
  },
  declineInviteButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
  },
  friendsSection: {
    marginTop: 24,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  friendsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  friendTile: {
    width: 90,
    height: 90,
    backgroundColor: palette.white,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: palette.grey,
    shadowColor: palette.primary,
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    padding: 6,
  },
  friendAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendAvatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 16,
  },
  friendTileName: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.primary,
    textAlign: 'center',
    marginBottom: 2,
    maxWidth: 80,
  },
  friendTileEmail: {
    fontSize: 10,
    color: palette.textLight,
    textAlign: 'center',
    maxWidth: 80,
  },
  logoutButton: {
    backgroundColor: palette.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  logoutButtonPressed: {
    backgroundColor: '#B91C1C', // darker red
    transform: [{ scale: 0.95 }],
  },
  logoutButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
  },
  // Add these styles to your existing styles function:

modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
modalContainer: {
  backgroundColor: palette.white,
  borderRadius: 20,
  width: '95%', // Increased from 90% to 95%
  height: '85%', // Changed from maxHeight to fixed height
  shadowColor: palette.black,
  shadowOpacity: 0.15,
  shadowRadius: 15,
  shadowOffset: { width: 0, height: 5 },
  elevation: 8,
  flexDirection: 'column', // Ensure column layout
},
modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderBottomWidth: 1,
  borderBottomColor: palette.grey,
  flexShrink: 0, // Don't shrink this section
},
searchContainer: {
  padding: 20,
  borderBottomWidth: 1,
  borderBottomColor: palette.grey,
  flexShrink: 0, // Don't shrink this section
},
emptyState: {
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 40,
},
resultsList: {
  flex: 1, // Take remaining space
  backgroundColor: 'transparent',
},
resultsListContent: {
  padding: 16, // Reduced from 20 to 16
  paddingBottom: 30, // Reduced from 40 to 30
  flexGrow: 1, // Allow content to grow
},
userResultTile: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: palette.background,
  padding: 10, // Slightly increased for better touch target
  borderRadius: 12,
  marginBottom: 8,
  borderWidth: 1,
  borderColor: palette.grey,
  shadowColor: palette.black,
  shadowOpacity: 0.05,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
},
userResultAvatar: {
  width: 40, // Slightly larger for better visibility
  height: 40,
  borderRadius: 20,
  backgroundColor: palette.primary,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 12,
},
userResultAvatarText: {
  color: palette.white,
  fontSize: 16,
  fontWeight: '700',
},
userResultName: {
  fontSize: 15,
  fontWeight: '600',
  color: palette.textDark,
  marginBottom: 2,
},
userResultEmail: {
  fontSize: 13,
  color: palette.textLight,
},
addFriendButton: {
  backgroundColor: palette.primary,
  width: 36,
  height: 36,
  borderRadius: 18,
  justifyContent: 'center',
  alignItems: 'center',
  shadowColor: palette.primary,
  shadowOpacity: 0.3,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
},
clearButton: {
  padding: 4,
  marginLeft: 8,
},
searchResultsCount: {
  fontSize: 12,
  color: palette.textLight,
  textAlign: 'center',
  marginTop: 8,
  fontWeight: '500',
},
modalTitle: {
  fontSize: 20,
  fontWeight: '700',
  color: palette.primary,
},

modalCloseButton: {
  padding: 8,
  borderRadius: 12,
  backgroundColor: palette.background,
},

searchInputContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: palette.background,
  borderRadius: 12,
  paddingHorizontal: 12,
  marginBottom: 12,
  borderWidth: 1,
  borderColor: palette.grey,
},

searchIcon: {
  marginRight: 8,
},

searchInput: {
  flex: 1,
  paddingVertical: 12,
  fontSize: 16,
  color: palette.textDark,
},

emptyStateText: {
  fontSize: 16,
  color: palette.textLight,
  textAlign: 'center',
  marginTop: 12,
},

userResultInfo: {
  flexDirection: 'row',
  alignItems: 'center',
  flex: 1,
},

userResultDetails: {
  flex: 1,
},

userResultTilePressed: {
  backgroundColor: palette.secondary,
  borderColor: palette.primary,
},

resultsContainer: {
  flex: 1,
  minHeight: 400, // Increased from 300
},

listEnd: {
  paddingVertical: 20,
  alignItems: 'center',
  borderTopWidth: 1,
  borderTopColor: palette.grey,
  marginTop: 10,
},

listEndText: {
  fontSize: 12,
  color: palette.textLight,
  fontStyle: 'italic',
},
});