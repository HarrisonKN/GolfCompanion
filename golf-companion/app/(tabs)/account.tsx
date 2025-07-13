// ------------------- IMPORTS -------------------------
import React, { useEffect, useState, useRef } from 'react';
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase, testSupabaseConnection } from '@/components/supabase';
import { useAuth } from '@/components/AuthContext';

// ------------------- TYPES -------------------------
type UserProfile = {
  full_name: string | null;
  email: string | null;
  handicap: number | null;
  rounds_played: number | null;
  average_score: number | null;
  last_round_course_name: string | null;
  last_round_date: string | null;
  last_round_score: number | null;
};

// ------------------- ACCOUNTS LOGIC -------------------------
export default function AccountsScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const mountedRef = useRef(true);

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
          router.replace(path);
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

  // Use useFocusEffect to handle screen focus properly
  useFocusEffect(
    React.useCallback(() => {
      if (!authLoading && !user && !isRedirecting) {
        console.log('No user found, redirecting to login');
        safeNavigate('/login'); //should prevent crash and just make a redirect
        return;
      }

      if (!authLoading && user && isMounted) {
        fetchProfile();
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
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headerTitle}>
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

      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText style={styles.infoLabel}>Name</ThemedText>
        <ThemedText style={styles.infoText}>{profile.full_name || 'N/A'}</ThemedText>

        <ThemedText style={styles.infoLabel}>Email</ThemedText>
        <ThemedText style={styles.infoText}>{profile.email || 'N/A'}</ThemedText>

        <View style={styles.separator} />

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Golf Stats
        </ThemedText>

        <ThemedText style={styles.infoLabel}>Handicap Index</ThemedText>
        <ThemedText style={styles.infoText}>
          {profile.handicap !== null ? profile.handicap.toFixed(1) : 'N/A'}
        </ThemedText>

        <ThemedText style={styles.infoLabel}>Rounds Played</ThemedText>
        <ThemedText style={styles.infoText}>
          {profile.rounds_played !== null ? profile.rounds_played.toString() : 'N/A'}
        </ThemedText>

        <ThemedText style={styles.infoLabel}>Average Score</ThemedText>
        <ThemedText style={styles.infoText}>
          {profile.average_score !== null ? profile.average_score.toFixed(1) : 'N/A'}
        </ThemedText>

        <View style={styles.separator} />

        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Last Round
        </ThemedText>

        <ThemedText style={styles.infoLabel}>Course</ThemedText>
        <ThemedText style={styles.infoText}>{profile.last_round_course_name || 'N/A'}</ThemedText>

        <ThemedText style={styles.infoLabel}>Date</ThemedText>
        <ThemedText style={styles.infoText}>{profile.last_round_date || 'N/A'}</ThemedText>

        <ThemedText style={styles.infoLabel}>Score</ThemedText>
        <ThemedText style={styles.infoText}>
          {profile.last_round_score !== null ? profile.last_round_score.toString() : 'N/A'}
        </ThemedText>
      </ScrollView>
    </View>
  );
}


// ------------------- STYLING -------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
  headerTitle: {
    fontSize: 28,
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
    backgroundColor: '#6B7280',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});