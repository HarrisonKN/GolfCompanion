import { View, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/components/ThemeContext';
import { getMyTournaments, getGhostPlacement, Tournament } from '@/lib/TournamentService';
import type { GhostPlacement } from '@/lib/TournamentService';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TournamentsScreen() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [ghostRanks, setGhostRanks] = useState<Record<string, GhostPlacement | null>>({});
  const [loading, setLoading] = useState(true);
  const { palette } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      const data = await getMyTournaments();
      setTournaments(data);

      // Fetch ghost placement per tournament (fire in parallel)
      const entries = await Promise.all(
        data.map(async (t) => [t.id, await getGhostPlacement(t.id)] as const)
      );
      setGhostRanks(Object.fromEntries(entries));
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles(palette).container, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </ThemedView>
    );
  }

  const autoTournaments = tournaments.filter(t => t.is_auto);
  const customTournaments = tournaments.filter(t => !t.is_auto);

  return (
    <ThemedView style={[styles(palette).container, { paddingTop: insets.top }]}>
      <View style={styles(palette).header}>
        <Pressable onPress={() => router.back()} style={styles(palette).backButton}>
          <ThemedText style={styles(palette).backText}>← Back</ThemedText>
        </Pressable>
        <ThemedText type="title">Tournaments</ThemedText>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles(palette).content}>
        {/* Auto Tournaments Section */}
        {autoTournaments.length > 0 && (
          <>
            <View style={styles(palette).sectionHeader}>
              <ThemedText type="subtitle">Monthly Challenges</ThemedText>
              <ThemedText style={styles(palette).sectionSubtext}>
                Automatic competitions - just play and you're in!
              </ThemedText>
            </View>
            {autoTournaments.map((tournament) => (
              <Pressable
                key={tournament.id}
                style={[styles(palette).tournamentCard, styles(palette).autoCard]}
                onPress={() => router.push(`/tournamentDetails?id=${tournament.id}` as any)}
              >
                <View style={styles(palette).autoLabel}>
                  <ThemedText style={styles(palette).autoLabelText}>AUTO</ThemedText>
                </View>
                <ThemedText type="subtitle" style={styles(palette).tournamentName}>
                  {tournament.name}
                </ThemedText>
                {tournament.description && (
                  <ThemedText style={styles(palette).tournamentDesc}>
                    {tournament.description}
                  </ThemedText>
                )}
                <View style={styles(palette).dateRow}>
                  <ThemedText style={styles(palette).dateText}>
                    {new Date(tournament.start_date).toLocaleDateString()} - 
                    {new Date(tournament.end_date).toLocaleDateString()}
                  </ThemedText>
                </View>
                {ghostRanks[tournament.id] && (
                  <View style={styles(palette).ghostRow}>
                    <ThemedText style={styles(palette).ghostLabel}>Your projected rank (not joined):</ThemedText>
                    <ThemedText style={styles(palette).ghostValue}>
                      #{ghostRanks[tournament.id]?.rank} of {(ghostRanks[tournament.id]?.participant_count ?? 0) + 1}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            ))}
          </>
        )}

        {/* Custom Tournaments Section */}
        {customTournaments.length > 0 && (
          <>
            <View style={[styles(palette).sectionHeader, { marginTop: 24 }]}>
              <ThemedText type="subtitle">Custom Tournaments</ThemedText>
              <ThemedText style={styles(palette).sectionSubtext}>
                Competitions you've created or been invited to
              </ThemedText>
            </View>
            {customTournaments.map((tournament) => (
              <Pressable
                key={tournament.id}
                style={styles(palette).tournamentCard}
                onPress={() => router.push(`/tournamentDetails?id=${tournament.id}` as any)}
              >
                <View style={styles(palette).statusBadge}>
                  <ThemedText style={styles(palette).statusText}>
                    {tournament.status.toUpperCase()}
                  </ThemedText>
                </View>
                <ThemedText type="subtitle" style={styles(palette).tournamentName}>
                  {tournament.name}
                </ThemedText>
                {tournament.description && (
                  <ThemedText style={styles(palette).tournamentDesc}>
                    {tournament.description}
                  </ThemedText>
                )}
                <View style={styles(palette).dateRow}>
                  <ThemedText style={styles(palette).dateText}>
                    {new Date(tournament.start_date).toLocaleDateString()} - 
                    {new Date(tournament.end_date).toLocaleDateString()}
                  </ThemedText>
                </View>
                {ghostRanks[tournament.id] && (
                  <View style={styles(palette).ghostRow}>
                    <ThemedText style={styles(palette).ghostLabel}>Your projected rank (not joined):</ThemedText>
                    <ThemedText style={styles(palette).ghostValue}>
                      #{ghostRanks[tournament.id]?.rank} of {(ghostRanks[tournament.id]?.participant_count ?? 0) + 1}
                    </ThemedText>
                  </View>
                )}
              </Pressable>
            ))}
          </>
        )}

        {tournaments.length === 0 && (
          <View style={styles(palette).emptyState}>
            <ThemedText style={styles(palette).emptyText}>
              No tournaments yet. Create one or wait for the monthly challenge!
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push('/createTournament' as any)}
        style={[styles(palette).createButton, { marginBottom: insets.bottom + 16 }]}
      >
        <ThemedText style={styles(palette).createButtonText}>
          + Create Custom Tournament
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
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
  backButton: {
    padding: 8,
  },
  backText: {
    color: palette.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionSubtext: {
    fontSize: 12,
    color: palette.textLight,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textLight,
  },
  tournamentCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: palette.black,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  autoCard: {
    borderWidth: 2,
    borderColor: palette.primary + '40',
    backgroundColor: palette.primary + '05',
  },
  autoLabel: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 8,
  },
  autoLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.white,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: palette.primary + '20',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: palette.primary,
  },
  tournamentName: {
    marginBottom: 8,
  },
  tournamentDesc: {
    color: palette.textLight,
    marginBottom: 12,
  },
  dateRow: {
    borderTopWidth: 1,
    borderTopColor: palette.grey + '40',
    paddingTop: 12,
  },
  dateText: {
    fontSize: 12,
    color: palette.textDark,
  },
  createButton: {
    backgroundColor: palette.primary,
    margin: 16,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    color: palette.white,
    fontSize: 18,
    fontWeight: '700',
  },
  ghostRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  ghostLabel: {
    fontSize: 12,
    color: palette.textLight,
  },
  ghostValue: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.primary,
  },
});