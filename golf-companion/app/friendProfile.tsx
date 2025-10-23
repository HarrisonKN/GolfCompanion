import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Dimensions, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from "@/components/ThemeContext";
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/components/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FriendProfile = {
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
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
};

export default function FriendProfileScreen() {
  const { friendId, friendName, friendEmail } = useLocalSearchParams<{
    friendId: string;
    friendName: string;
    friendEmail: string;
  }>();
  
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [rounds, setRounds] = useState<RoundHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const fetchFriendProfile = async () => {
    try {
      // Fetch friend's profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          full_name,
          email,
          avatar_url,
          handicap,
          rounds_played,
          average_score,
          last_round_course_name,
          last_round_date,
          last_round_score
        `)
        .eq('id', friendId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch friend's recent rounds (limit to 10 for performance)
      const { data: roundsData, error: roundsError } = await supabase
        .from('golf_rounds')
        .select('id, course_name, date, score, fairways_hit, greens_in_reg, putts')
        .eq('user_id', friendId)
        .order('date', { ascending: false })
        .limit(10);

      if (roundsError) throw roundsError;
      setRounds(roundsData || []);

    } catch (error) {
      console.error('Error fetching friend profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (friendId) {
      fetchFriendProfile();
    }
  }, [friendId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFriendProfile();
  };

  if (loading) {
    return (
      <ThemedView style={[styles(palette).screen, styles(palette).centerContent]}>
        <ActivityIndicator size="large" color={palette.primary} />
        <ThemedText style={styles(palette).loadingText}>Loading profile...</ThemedText>
      </ThemedView>
    );
  }

  if (!profile) {
    return (
      <ThemedView style={[styles(palette).screen, styles(palette).centerContent]}>
        <ThemedText style={styles(palette).errorText}>Profile not found</ThemedText>
        <Pressable onPress={() => router.back()} style={styles(palette).backButton}>
          <ThemedText style={styles(palette).backButtonText}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles(palette).screen, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[palette.primary]}
          tintColor={palette.primary}
        />
      }
    >
      {/* Header */}
      <View style={styles(palette).header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles(palette).backButtonSmall,
            pressed && { backgroundColor: palette.grey, transform: [{ scale: 0.95 }] }
          ]}
        >
          <ThemedText style={styles(palette).backButtonText}>← Back</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles(palette).headerTitle}>
          Friend Profile
        </ThemedText>
        <View style={{ width: 60 }} />
      </View>

      {/* Friend Info */}
      <View style={styles(palette).profileContainer}>
        <View style={styles(palette).avatarCircle}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: `${profile.avatar_url}?t=${Date.now()}` }}
              style={{ width: 60, height: 60, borderRadius: 30 }}
              resizeMode="cover"
            />
          ) : (
            <ThemedText style={styles(palette).avatarText}>
              {profile.full_name ? profile.full_name[0].toUpperCase() : '?'}
            </ThemedText>
          )}
        </View>
        <View style={{ marginLeft: 16 }}>
          <ThemedText style={styles(palette).profileName}>
            {profile.full_name || 'Unknown User'}
          </ThemedText>
          <ThemedText style={styles(palette).profileEmail}>
            {profile.email || ''}
          </ThemedText>
        </View>
      </View>

      {/* Golf Stats */}
      <View style={styles(palette).section}>
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
      </View>

      {/* Recent Rounds */}
      <View style={styles(palette).section}>
        <ThemedText type="subtitle" style={styles(palette).sectionTitle}>
          Recent Rounds
        </ThemedText>
        {rounds.length === 0 ? (
          <ThemedText style={styles(palette).infoText}>No rounds played yet.</ThemedText>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles(palette).roundsScroll}
            contentContainerStyle={styles(palette).roundsContainer}
          >
            {rounds.map((round) => (
              <View key={round.id} style={styles(palette).roundTile}>
                <ThemedText style={styles(palette).roundCourse}>{round.course_name}</ThemedText>
                <ThemedText style={styles(palette).roundDate}>{round.date}</ThemedText>
                <ThemedText style={styles(palette).roundScore}>Score: {round.score}</ThemedText>
                <ThemedText style={styles(palette).roundStat}>Fairways: {round.fairways_hit ?? 'N/A'}</ThemedText>
                <ThemedText style={styles(palette).roundStat}>GIR: {round.greens_in_reg ?? 'N/A'}</ThemedText>
                <ThemedText style={styles(palette).roundStat}>Putts: {round.putts ?? 'N/A'}</ThemedText>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

// StatTile component
function StatTile({ label, value }: { label: string; value: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles(palette).statTile}>
      <ThemedText style={styles(palette).statLabel}>{label}</ThemedText>
      <ThemedText style={styles(palette).statValue}>{value}</ThemedText>
    </View>
  );
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = (palette: any) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.grey,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.primary,
  },
  backButtonSmall: {
    backgroundColor: palette.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: palette.primary,
    fontWeight: '700',
    fontSize: 16,
  },
  profileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: palette.white,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: palette.white,
    fontSize: 24,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: palette.primary,
  },
  profileEmail: {
    fontSize: 16,
    color: palette.textLight,
    marginTop: 4,
  },
  section: {
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.primary,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: 20,
  },
  statTile: {
    width: SCREEN_WIDTH * 0.28,
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: palette.textLight,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 16,
    color: palette.primary,
    fontWeight: '700',
  },
  roundsScroll: {
    marginTop: 8,
  },
  roundsContainer: {
    paddingHorizontal: 20,
  },
  roundTile: {
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roundCourse: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 4,
  },
  roundDate: {
    fontSize: 14,
    color: palette.textLight,
    marginBottom: 8,
  },
  roundScore: {
    fontSize: 16,
    color: palette.error,
    fontWeight: '700',
    marginBottom: 8,
  },
  roundStat: {
    fontSize: 14,
    color: palette.textDark,
    marginBottom: 2,
  },
  infoText: {
    fontSize: 16,
    color: palette.textLight,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: palette.textLight,
  },
  errorText: {
    fontSize: 16,
    color: palette.error,
    textAlign: 'center',
    marginBottom: 20,
  },
});