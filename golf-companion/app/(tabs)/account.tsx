// ------------------- IMPORTS -------------------------
import React, { useEffect, useState } from 'react';
import { View, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/components/supabase';


// ------------------- THING -------------------------
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


// ------------------- Account Logic -------------------------
export default function AccountsScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user profile and golf data
  const fetchProfile = async () => {
    try {
      setLoading(true);

      const user = supabase.auth.getUser();
      const { data: userData, error: userError } = await user;
      if (userError || !userData.user) {
        router.replace('/login');
        return;
      }

      // Get user ID
      const userId = userData.user.id;

      // Fetch profile info from 'profiles' table
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
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);
    } catch (error: any) {
      Alert.alert('Error loading profile', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert('Logout failed', error.message);
    else router.replace('/login');
  };

  if (loading) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ThemedText style={{ fontSize: 16, color: '#EF4444' }}>Failed to load profile.</ThemedText>
        <Pressable onPress={fetchProfile} style={styles.reloadButton}>
          <ThemedText style={styles.reloadButtonText}>Try Again</ThemedText>
        </Pressable>
      </View>
    );
  }


  // ------------------- UI Setup -------------------------
  return (
    <View style={styles.screen}>
      {/* Header with title and logout button */}
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

      {/* Scrollable content */}
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
          {profile.rounds_played !== null ? profile.rounds_played : 'N/A'}
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
          {profile.last_round_score !== null ? profile.last_round_score : 'N/A'}
        </ThemedText>
      </ScrollView>
    </View>
  );
}


// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
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
    // subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    zIndex: 10,
  },
  headerTitle: {
    marginTop: 10,
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
  reloadButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
  },
  reloadButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
});
