// ------------------- IMPORTS -------------------------
import { useAuth } from '@/components/AuthContext';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useTheme } from "@/components/ThemeContext";
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TouchableOpacity, View, Dimensions, Text, TextInput, RefreshControl, StatusBar, Image } from 'react-native';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import { MaterialIcons } from '@expo/vector-icons';
import { PALETTES } from '@/constants/theme';
import { getAppVersion, getBuildInfo } from '@/utils/version';
import * as ImagePicker from 'expo-image-picker';
import { decode as atob } from 'base-64';
import * as FileSystem from 'expo-file-system';
import { TestNotifications } from '@/components/TestNotifications';
import Toast from 'react-native-toast-message';
import { notifyFriendRequest, notifyFriendRequestAccepted } from '@/lib/NotificationTriggers';
import { PerformanceChart } from '@/components/PerformanceChart';
import { ensureMonthlyTournament, autoEnrollInMonthlyTournament, getTournamentLeaderboard } from '@/lib/TournamentService';
import { useRouter } from 'expo-router';

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
  avatar_url: string | null;
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

type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  earnedAt?: string;
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
  const [showTestNotifications, setShowTestNotifications] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingAchievements, setLoadingAchievements] = useState(true);
  const [monthlyChallenge, setMonthlyChallenge] = useState<any>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

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
          {friend.profiles?.avatar_url ? (
            <Image
              source={{ uri: friend.profiles.avatar_url }}
              style={{ width: 32, height: 32, borderRadius: 16 }}
            />
          ) : (
            <ThemedText style={styles(palette).friendAvatarText}>
              {friend.profiles?.full_name ? friend.profiles.full_name[0].toUpperCase() : '?'}
            </ThemedText>
          )}
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

  const handleImageUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission required', 'We need access to your camera roll to upload a profile picture.');
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (pickerResult.canceled || !pickerResult.assets?.length) {
      console.log("User cancelled or no assets returned");
      return;
    }

    const image = pickerResult.assets[0];
    console.log("Selected image:", image);

    const fileExt = image.uri.split('.').pop();
    const filePath = `${user.id}.${fileExt}`;

    try {
      // Debug logging before upload call
      console.log("User ID:", user?.id);
      const session = await supabase.auth.getSession();
      console.log("Supabase session:", session);
      // --- Connectivity test before Supabase upload ---
      try {
        const ping = await fetch("https://emgqdjhbmkjepbjdpnmh.supabase.co");
        console.log("✅ Supabase ping response:", ping.status);
      } catch (err) {
        if (err instanceof Error) {
          console.error("Supabase ping failed:", err.message);
        } else {
          console.error("Supabase ping failed:", String(err));
        }
      }

      // Direct file upload using file URI
      const contentType = image.mimeType ?? `image/${fileExt}`;
      const fileUri = image.uri;

      console.log("Uploading file to Supabase from URI:", fileUri);

      const result = await supabase.storage
        .from("avatars")
        .upload(filePath, {
          uri: fileUri,
          type: contentType,
          name: filePath,
        } as any, {
          upsert: true,
          contentType,
        });

      if (result.error) {
        console.error("Supabase upload failed:", result.error);
        Alert.alert("Upload failed", result.error.message ?? "Unknown error");
        return;
      } else {
        console.log("Upload succeeded:", result.data);
      }

      const { data: publicUrlData } = supabase
        .storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData?.publicUrl ? `${publicUrlData.publicUrl}?v=${Date.now()}` : null;
      console.log("New public URL (with cache-bust):", publicUrl);

      if (!publicUrl) {
        Alert.alert("Error", "Could not retrieve uploaded image URL");
        return;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        Alert.alert('Error updating profile', updateError.message);
        return;
      }

      showToast("Profile picture updated!");
      await fetchProfile(); // refresh profile UI

    } catch (err: any) {
      console.error("Unexpected upload error:", err);
      Alert.alert("Unexpected error", err.message || "Something went wrong");
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
          last_round_score,
          avatar_url
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
      if (authLoading) {
        console.log("⏳ Auth still loading — skipping redirect for now");
        return;
      }

      /*if (!user && !authLoading) { //this was !isRedirecting
        console.log("No user found, redirecting to login");
        safeNavigate('/login');  //comment out for testing
        return;
      }*/

      if (!authLoading && !user) {
        console.log("⚠️ No user yet — waiting for Supabase initialization, skipping redirect");
        return; // don't navigate yet
      }

      // Always fetch latest profile and rounds when focused and user is present
      if (user && isMounted) {
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

  // --- DEBUG: Test Auth UID / RLS ---
  const testUID = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      console.log("🔍 Debug UID:", data?.user?.id, "Error:", error);
      Alert.alert("Debug UID", data?.user?.id ?? "NULL");
    } catch (err) {
      console.error("Debug UID error:", err);
      Alert.alert("Debug UID Error", String(err));
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const fetchFriends = async () => {
      const { data, error } = await supabase
        .from('friends')
        .select('friend_id, profiles:friend_id(full_name, email, avatar_url)')
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

      // 📬 Send notification to recipient
      const requesterName = user.full_name || user.email?.split('@')[0] || 'A user';
      await notifyFriendRequest(friendId, requesterName);
  
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
      .select('friend_id, profiles:friend_id(full_name, email, avatar_url)')
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

  // --- CLEAN AUTH LOADING & REDIRECT LOGIC ---

  // 1. While AuthContext is restoring session
  if (authLoading) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles(palette).loadingText}>Loading...</ThemedText>
      </View>
    );
  }

  // 2. When auth has finished restoring, and no user exists → redirect
  if (!user) {
    safeNavigate("/login");
    return null;
  }

  // 3. If profile fetch is running
  if (loading) {
    return (
      <View style={[styles(palette).screen, styles(palette).centerContent]}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ThemedText style={styles(palette).loadingText}>Loading profile...</ThemedText>
      </View>
    );
  }

  // 4. Error fetching profile
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

  // 5. Profile missing (rare case)
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

  const { fullDisplayVersion } = getAppVersion();
  const buildInfo = getBuildInfo();

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
          <Pressable
            style={[styles(palette).logoutButton, { backgroundColor: palette.primary }]}
            onPress={testUID}
          >
            <ThemedText style={styles(palette).logoutButtonText}>Debug UID</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Condensed Account Info */}
      <View style={styles(palette).accountDescContainer}>
        <Pressable onPress={handleImageUpload} style={styles(palette).avatarCircle}>
          {profile.avatar_url ? (
            <Image
              key={`${profile.avatar_url}-${Date.now()}`} // force re-render
              source={{ uri: `${profile.avatar_url}?t=${Date.now()}` }}
              style={{ width: '100%', height: '100%', borderRadius: 999 }}
              resizeMode="cover"
            />
          ) : (
            <ThemedText style={styles(palette).avatarText}>
              {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
            </ThemedText>
          )}
        </Pressable>
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

      {/* Performance Charts - New Section */}
      {user && (
        <>
          <PerformanceChart userId={user.id} type="score" />
          <PerformanceChart userId={user.id} type="putts" />
          <PerformanceChart userId={user.id} type="fairways" />
        </>
      )}

      {/* Monthly Challenge Card */}
      {monthlyChallenge && (
        <Pressable
          style={styles(palette).monthlyChallengeCard}
          onPress={() =>
            router.push({ pathname: '/tournamentDetails', params: { id: monthlyChallenge.id } } as never)
          }
        >
          <View style={styles(palette).challengeHeader}>
            <ThemedText type="subtitle">🏆 {monthlyChallenge.name}</ThemedText>
            {myRank && (
              <View style={styles(palette).rankBadge}>
                <ThemedText style={styles(palette).rankText}>#{myRank}</ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles(palette).challengeDescription}>
            {monthlyChallenge.description}
          </ThemedText>
          <View style={styles(palette).challengeFooter}>
            <ThemedText style={styles(palette).challengeDate}>
              Ends {new Date(monthlyChallenge.end_date).toLocaleDateString()}
            </ThemedText>
            <ThemedText style={styles(palette).viewLeaderboard}>
              View Leaderboard →
            </ThemedText>
          </View>
        </Pressable>
      )}

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
                    {f.profiles?.avatar_url ? (
                      <Image
                        source={{ uri: f.profiles.avatar_url }}
                        style={{ width: 32, height: 32, borderRadius: 16 }}
                        resizeMode="cover"
                      />
                    ) : (
                      <ThemedText style={styles(palette).friendAvatarText}>
                        {f.profiles?.full_name ? f.profiles.full_name[0].toUpperCase() : '?'}
                      </ThemedText>
                    )}
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

      <SectionDivider />

      {/* Pending Notifications Section */}
      {(pendingInvites.length > 0 || pendingFriendRequests.length > 0) && (
        <>
          <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
            📬 Pending Invitations
          </ThemedText>
          
          {/* Friend Requests */}
          {pendingFriendRequests.map(request => (
            <View key={request.id} style={styles(palette).inviteCard}>
              <View style={styles(palette).inviteHeader}>
                <ThemedText style={styles(palette).inviteTitle}>Friend Request</ThemedText>
              </View>
              <ThemedText style={styles(palette).inviteMessage}>
                Incoming friend request
              </ThemedText>
              <View style={styles(palette).inviteActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles(palette).acceptInviteButton,
                    pressed && { backgroundColor: '#2563EB', transform: [{ scale: 0.95 }] }
                  ]}
                  onPress={async () => {
                    try {
                      const { error: friendsError } = await supabase.from('friends').insert([
                        { user_id: user.id, friend_id: request.requester_user_id },
                        { user_id: request.requester_user_id, friend_id: user.id }
                      ]);

                      if (friendsError) throw friendsError;

                      await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', request.id);
                      
                      const acceptorName = user.full_name || user.email?.split('@')[0] || 'A user';
                      await notifyFriendRequestAccepted(request.requester_user_id, acceptorName);
                      
                      showToast('Friend Added!');
                      setPendingFriendRequests(prev => prev.filter(req => req.id !== request.id));
                      
                      const { data: updatedFriends } = await supabase
                        .from('friends')
                        .select('friend_id, profiles:friend_id(full_name, email, avatar_url)')
                        .eq('user_id', user.id);
                      setFriends(updatedFriends || []);
                      
                    } catch (err) {
                      console.error('Friend acceptance error:', err);
                      showToast('Error adding friend');
                    }
                  }}
                >
                  <ThemedText style={styles(palette).acceptInviteButtonText}>
                    Accept
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles(palette).declineInviteButton,
                    pressed && { backgroundColor: '#B91C1C', transform: [{ scale: 0.95 }] }
                  ]}
                  onPress={async () => {
                    await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', request.id);
                    showToast('Request Declined');
                    setPendingFriendRequests(prev => prev.filter(req => req.id !== request.id));
                  }}
                >
                  <ThemedText style={styles(palette).declineInviteButtonText}>Decline</ThemedText>
                </Pressable>
              </View>
            </View>
          ))}

          {/* Group Invites */}
          {pendingInvites.map(invite => (
            <View key={invite.id} style={styles(palette).inviteCard}>
              <View style={styles(palette).inviteHeader}>
                <ThemedText style={styles(palette).inviteTitle}>Group Invitation</ThemedText>
              </View>
              <ThemedText style={styles(palette).inviteMessage}>
                You've been invited to join "{invite.voice_groups?.name || 'a group'}"
              </ThemedText>
              <View style={styles(palette).inviteActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles(palette).acceptInviteButton,
                    pressed && { backgroundColor: '#2563EB', transform: [{ scale: 0.95 }] }
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

          <SectionDivider />
        </>
      )}
      <SectionDivider />
      
      <View style={styles(palette).appInfoSection}>
        <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
          App Information
        </ThemedText>
        <View style={styles(palette).appInfoContainer}>
          <View style={styles(palette).appInfoRow}>
            <ThemedText style={styles(palette).appInfoLabel}>Version:</ThemedText>
            <ThemedText style={styles(palette).appInfoValue}>{fullDisplayVersion}</ThemedText>
          </View>
          <View style={styles(palette).appInfoRow}>
            <ThemedText style={styles(palette).appInfoLabel}>Platform:</ThemedText>
            <ThemedText style={styles(palette).appInfoValue}>{buildInfo.platform} {buildInfo.platformVersion}</ThemedText>
          </View>
          <View style={styles(palette).appInfoRow}>
            <ThemedText style={styles(palette).appInfoLabel}>Device:</ThemedText>
            <ThemedText style={styles(palette).appInfoValue}>{buildInfo.isDevice ? 'Physical Device' : 'Simulator'}</ThemedText>
          </View>
        </View>
      </View>

      <SectionDivider />

      {/* Test Notifications Section - Bottom of page */}
      <View style={styles(palette).testNotificationsSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText type="subtitle" style={[styles(palette).sectionTitle, { marginHorizontal: 0 }]}>
            🧪 Test Notifications
          </ThemedText>
          <Pressable
            style={[
              styles(palette).testToggleButton,
              { backgroundColor: showTestNotifications ? palette.error : palette.primary }
            ]}
            onPress={() => setShowTestNotifications(!showTestNotifications)}
          >
            <ThemedText style={styles(palette).testToggleButtonText}>
              {showTestNotifications ? 'Hide' : 'Show'}
            </ThemedText>
          </Pressable>
        </View>
        {showTestNotifications && user?.id && (
          <View style={styles(palette).testNotificationsContent}>
            <TestNotifications currentUserId={user.id} palette={palette} />
          </View>
        )}
      </View>
      
    </ScrollView>
    <Toast />
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
    backgroundColor: palette.background,
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
    paddingTop: SCREEN_HEIGHT * 0.04,
    paddingBottom: SCREEN_HEIGHT * 0.01,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.primary + '12',
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  headerTitleSmall: {
    fontSize: SCREEN_WIDTH * 0.05,
    fontWeight: '800',
    color: palette.primary,
    letterSpacing: 0.3,
  },

  accountDescContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.05,
    paddingVertical: SCREEN_HEIGHT * 0.02,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.primary + '12',
    marginBottom: SCREEN_HEIGHT * 0.01,
    shadowColor: palette.primary,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  avatarCircle: {
    width: SCREEN_WIDTH * 0.12,
    height: SCREEN_WIDTH * 0.12,
    borderRadius: (SCREEN_WIDTH * 0.12) / 2,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  avatarText: {
    color: palette.white,
    fontSize: SCREEN_WIDTH * 0.055,
    fontWeight: '800',
  },

  accountName: {
    fontSize: SCREEN_WIDTH * 0.047,
    fontWeight: '800',
    color: palette.primary,
    marginBottom: 3,
    letterSpacing: 0.2,
  },

  accountEmail: {
    fontSize: SCREEN_WIDTH * 0.035,
    color: palette.textLight,
    fontWeight: '500',
  },
  container: {
    paddingHorizontal: SCREEN_WIDTH * 0.08,
    paddingVertical: SCREEN_HEIGHT * 0.04
  },
  sectionTitle: {
    paddingTop: SCREEN_HEIGHT * 0.015,
    marginHorizontal: SCREEN_WIDTH * 0.05,
    fontSize: SCREEN_WIDTH * 0.052,
    fontWeight: '800',
    marginBottom: SCREEN_HEIGHT * 0.015,
    color: palette.primary,
    letterSpacing: 0.3,
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
    backgroundColor: palette.white,
    borderRadius: 14,
    padding: SCREEN_WIDTH * 0.04,
    marginBottom: SCREEN_HEIGHT * 0.015,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.primary + '20',
    shadowColor: palette.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statLabel: {
    fontSize: SCREEN_WIDTH * 0.032,
    color: palette.textLight,
    fontWeight: '600',
    marginBottom: SCREEN_HEIGHT * 0.008,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: SCREEN_WIDTH * 0.048,
    color: palette.primary,
    fontWeight: '800',
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
    borderLeftWidth: 4,
    borderLeftColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  roundCourse: {
    fontSize: SCREEN_WIDTH * 0.048,
    fontWeight: '800',
    color: palette.primary,
    marginBottom: SCREEN_HEIGHT * 0.008,
  },
  roundDate: {
    fontSize: SCREEN_WIDTH * 0.032,
    color: palette.textLight,
    marginBottom: SCREEN_HEIGHT * 0.012,
    fontWeight: '500',
  },
  roundScore: {
    fontSize: SCREEN_WIDTH * 0.045,
    color: palette.primary,
    fontWeight: '800',
    marginBottom: SCREEN_HEIGHT * 0.012,
  },
  roundStat: {
    fontSize: SCREEN_WIDTH * 0.033,
    color: palette.textLight,
    marginBottom: SCREEN_HEIGHT * 0.004,
    fontWeight: '500',
  },
  scorecardTable: {
    flexDirection: 'column',
    color: palette.background
  },
  scorecardRow: {
    flexDirection: 'row',
    marginBottom: SCREEN_HEIGHT * 0.005,
  },
  scorecardCellPlayerHeader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
  },
  scorecardCellHeader: {
    width: SCREEN_WIDTH * 0.11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primary,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
    marginLeft: SCREEN_WIDTH * 0.01,
  },
  scorecardHeaderText: {
    fontSize: SCREEN_WIDTH * 0.03,
    fontWeight: '700',
    color: palette.textDark,
  },
  scorecardCellPlayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.white,
    padding: SCREEN_WIDTH * 0.015,
    borderRadius: 4,
  },
  scorecardCell: {
    width: SCREEN_WIDTH * 0.11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.grey,
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
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  createButtonText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
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
    width: 100,
    height: 110,
    backgroundColor: palette.white,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: palette.primary + '15',
    shadowColor: palette.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    padding:  8,
  },
  friendAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: palette.primary,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  friendAvatarText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 18,
  },
  friendTileName: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.primary,
    textAlign: 'center',
    marginBottom: 3,
    maxWidth: 90,
  },
  friendTileEmail: {
    fontSize: 11,
    color: palette.textLight,
    textAlign: 'center',
    maxWidth: 90,
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: palette.error,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    shadowColor: palette.error,
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  logoutButtonPressed: {
    backgroundColor: '#B91C1C',
    transform: [{ scale: 0.95 }],
  },
  logoutButtonText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  // Add these styles to your existing styles function:


modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.5)',
  justifyContent: 'center',
  alignItems: 'center',
},
modalContainer: {
  backgroundColor: palette.background,
  borderRadius: 24,
  width: '95%',
  height: '85%',
  shadowColor: palette.primary,
  shadowOpacity: 0.15,
  shadowRadius: 20,
  shadowOffset: { width: 0, height: 8 },
  elevation: 10,
  flexDirection: 'column',
},
modalHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingHorizontal: 22,
  paddingVertical: 18,
  borderBottomWidth: 1,
  borderBottomColor: palette.primary + '12',
  flexShrink: 0,
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
  width: 44,
  height: 44,
  borderRadius: 22,
  backgroundColor: palette.primary,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 14,
  shadowColor: palette.primary,
  shadowOpacity: 0.2,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
},
userResultAvatarText: {
  color: palette.white,
  fontSize: 18,
  fontWeight: '800',
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
  fontSize: 22,
  fontWeight: '800',
  color: palette.primary,
  letterSpacing: 0.3,
},
modalCloseButton: {
  padding: 8,
  borderRadius: 10,
  backgroundColor: palette.primary + '10',
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
  minHeight: 400,
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
appInfoSection: {
  marginTop: 24,
  marginBottom: 24,
  paddingHorizontal: 8,
},
appInfoContainer: {
  backgroundColor: palette.white,
  borderRadius: 16,
  padding: 18,
  marginHorizontal: SCREEN_WIDTH * 0.05,
  shadowColor: palette.primary,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
  marginBottom: 24,
  borderWidth: 1,
  borderColor: palette.primary + '15',
},
appInfoRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: palette.grey + '20',
},
appInfoLabel: {
  fontSize: 14,
  color: palette.textLight,
  fontWeight: '600',
  letterSpacing: 0.3,
},
appInfoValue: {
  fontSize: 14,
  color: palette.primary,
  fontWeight: '700',
},
inviteCard: {
  backgroundColor: palette.white,
  padding: 16,
  marginHorizontal: 12,
  marginBottom: 12,
  borderRadius: 16,
  borderLeftWidth: 5,
  borderLeftColor: palette.primary,
  shadowColor: palette.primary,
  shadowOpacity: 0.09,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
},
inviteHeader: {
  marginBottom: 10,
},
inviteTitle: {
  fontSize: 16,
  fontWeight: '800',
  color: palette.primary,
  letterSpacing: 0.3,
},
inviteMessage: {
  fontSize: 14,
  color: palette.textDark,
  marginBottom: 14,
  lineHeight: 21,
  fontWeight: '500',
},
inviteActions: {
  flexDirection: 'row',
  gap: 10,
},
testNotificationsSection: {
  marginTop: 20,
  marginBottom: 24,
  paddingHorizontal: 12,
  backgroundColor: palette.white,
  marginHorizontal: 12,
  borderRadius: 16,
  padding: 16,
  borderLeftWidth: 5,
  borderLeftColor: palette.primary,
  shadowColor: palette.primary,
  shadowOpacity: 0.08,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 3,
},
testToggleButton: {
  paddingHorizontal: 16,
  paddingVertical: 8,
  borderRadius: 10,
  shadowColor: palette.primary,
  shadowOpacity: 0.15,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
},
testToggleButtonText: {
  color: palette.white,
  fontWeight: '700',
  fontSize: 13,
},
testNotificationsContent: {
  marginTop: 14,
  backgroundColor: palette.background,
  borderRadius: 12,
  padding: 14,
  shadowColor: palette.black,
  shadowOpacity: 0.04,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
},
achievementsSection: {
  marginTop: 24,
  marginBottom: 16,
},
achievementsGrid: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 12,
},
achievementBadge: {
  width: (SCREEN_WIDTH - 64) / 2,
  backgroundColor: palette.white,
  borderRadius: 16,
  padding: 16,
  alignItems: 'center',
  shadowColor: palette.black,
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
  borderWidth: 2,
  borderColor: palette.primary,
},
achievementLocked: {
  backgroundColor: palette.grey + '40',
  borderColor: palette.grey,
  opacity: 0.6,
},
achievementIcon: {
  fontSize: 40,
  marginBottom: 8,
},
achievementName: {
  fontSize: 14,
  fontWeight: '700',
  color: palette.primary,
  textAlign: 'center',
  marginBottom: 4,
},
achievementNameLocked: {
  color: palette.textLight,
},
achievementDescription: {
  fontSize: 12,
  color: palette.textDark,
  textAlign: 'center',
  marginBottom: 4,
},
achievementDescriptionLocked: {
  color: palette.textLight,
},
achievementDate: {
  fontSize: 10,
  color: palette.textLight,
  marginTop: 4,
},
monthlyChallengeCard: {
  backgroundColor: palette.white,
  borderRadius: 16,
  padding: 20,
  marginHorizontal: SCREEN_WIDTH * 0.05,
  marginVertical: 16,
  borderLeftWidth: 5,
  borderLeftColor: palette.primary,
  shadowColor: palette.primary,
  shadowOpacity: 0.1,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 4,
},
challengeHeader: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 12,
},
rankBadge: {
  backgroundColor: palette.primary,
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 20,
},
rankText: {
  color: palette.white,
  fontSize: 14,
  fontWeight: '700',
},
challengeDescription: {
  fontSize: 14,
  color: palette.textDark,
  marginBottom: 16,
  lineHeight: 20,
},
challengeFooter: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
},
challengeDate: {
  fontSize: 13,
  color: palette.textLight,
  fontWeight: '500',
},
viewLeaderboard: {
  fontSize: 14,
  color: palette.primary,
  fontWeight: '600',
},
});