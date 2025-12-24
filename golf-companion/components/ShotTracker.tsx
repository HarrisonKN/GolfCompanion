import { useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, ScrollView, TextInput, Modal } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { supabase } from './supabase';
import { useTheme } from './ThemeContext';

type Shot = {
  id?: string;
  shot_number: number;
  club: string;
  distance_yards?: number;
  result: 'fairway' | 'rough' | 'bunker' | 'water' | 'green' | 'hole';
  notes?: string;
};

const CLUBS = [
  'Driver', '3W', '5W', '7W',
  '2H', '3H', '4H', '5H',
  '3i', '4i', '5i', '6i', '7i', '8i', '9i',
  'PW', 'GW', 'SW', 'LW',
  'Putter'
];

const RESULTS = [
  { value: 'fairway', label: 'Fairway', icon: '🟢' },
  { value: 'rough', label: 'Rough', icon: '🟡' },
  { value: 'bunker', label: 'Bunker', icon: '🟤' },
  { value: 'water', label: 'Water', icon: '💧' },
  { value: 'green', label: 'Green', icon: '🎯' },
  { value: 'hole', label: 'Hole!', icon: '⛳' },
];

export function ShotTracker({ roundId, hole }: { roundId: string; hole: number }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedClub, setSelectedClub] = useState('Driver');
  const [selectedResult, setSelectedResult] = useState<Shot['result']>('fairway');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const { palette } = useTheme();

  useEffect(() => {
    loadShots();
  }, [roundId, hole]);

  const loadShots = async () => {
    const { data, error } = await supabase
      .from('shot_tracking')
      .select('*')
      .eq('round_id', roundId)
      .eq('hole', hole)
      .order('shot_number', { ascending: true });

    if (error) {
      console.error('Error loading shots:', error);
      return;
    }

    setShots(data || []);
  };

  const addShot = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newShot = {
      round_id: roundId,
      user_id: user.id,
      hole,
      shot_number: shots.length + 1,
      club: selectedClub,
      distance_yards: distance ? parseInt(distance) : null,
      result: selectedResult,
      notes: notes || null,
    };

    const { error } = await supabase
      .from('shot_tracking')
      .insert(newShot);

    if (error) {
      console.error('Error adding shot:', error);
      return;
    }

    // Reset form
    setDistance('');
    setNotes('');
    setModalVisible(false);
    
    // Reload shots
    loadShots();
  };

  const deleteShot = async (shotId: string) => {
    const { error } = await supabase
      .from('shot_tracking')
      .delete()
      .eq('id', shotId);

    if (error) {
      console.error('Error deleting shot:', error);
      return;
    }

    loadShots();
  };

  return (
    <ThemedView style={styles(palette).container}>
      <View style={styles(palette).header}>
        <ThemedText type="subtitle">Shot Tracker - Hole {hole}</ThemedText>
        <Pressable
          onPress={() => setModalVisible(true)}
          style={styles(palette).addButton}
        >
          <ThemedText style={styles(palette).addButtonText}>+ Add Shot</ThemedText>
        </Pressable>
      </View>

      <ScrollView style={styles(palette).shotList}>
        {shots.length === 0 ? (
          <ThemedText style={styles(palette).emptyText}>
            No shots recorded yet. Tap "Add Shot" to start tracking!
          </ThemedText>
        ) : (
          shots.map((shot, idx) => (
            <View key={shot.id || idx} style={styles(palette).shotItem}>
              <View style={styles(palette).shotInfo}>
                <ThemedText style={styles(palette).shotNumber}>
                  Shot {shot.shot_number}
                </ThemedText>
                <ThemedText style={styles(palette).shotDetails}>
                  {shot.club}
                  {shot.distance_yards && ` • ${shot.distance_yards} yds`}
                </ThemedText>
                <View style={styles(palette).resultBadge}>
                  <ThemedText>
                    {RESULTS.find(r => r.value === shot.result)?.icon} {shot.result}
                  </ThemedText>
                </View>
                {shot.notes && (
                  <ThemedText style={styles(palette).shotNotes}>{shot.notes}</ThemedText>
                )}
              </View>
              <Pressable
                onPress={() => shot.id && deleteShot(shot.id)}
                style={styles(palette).deleteButton}
              >
                <ThemedText style={styles(palette).deleteText}>✕</ThemedText>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Shot Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles(palette).modalOverlay}>
          <View style={styles(palette).modalContent}>
            <ThemedText type="subtitle" style={{ marginBottom: 16 }}>
              Record Shot {shots.length + 1}
            </ThemedText>

            {/* Club Selection */}
            <ThemedText style={styles(palette).label}>Select Club</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles(palette).clubScroll}
            >
              {CLUBS.map(club => (
                <Pressable
                  key={club}
                  onPress={() => setSelectedClub(club)}
                  style={[
                    styles(palette).clubButton,
                    selectedClub === club && styles(palette).clubButtonActive,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles(palette).clubButtonText,
                      selectedClub === club && styles(palette).clubButtonTextActive,
                    ]}
                  >
                    {club}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            {/* Result Selection */}
            <ThemedText style={styles(palette).label}>Result</ThemedText>
            <View style={styles(palette).resultGrid}>
              {RESULTS.map(result => (
                <Pressable
                  key={result.value}
                  onPress={() => setSelectedResult(result.value as Shot['result'])}
                  style={[
                    styles(palette).resultButton,
                    selectedResult === result.value && styles(palette).resultButtonActive,
                  ]}
                >
                  <ThemedText style={styles(palette).resultIcon}>{result.icon}</ThemedText>
                  <ThemedText style={styles(palette).resultLabel}>{result.label}</ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Distance Input */}
            <ThemedText style={styles(palette).label}>Distance (yards) - Optional</ThemedText>
            <TextInput
              style={styles(palette).input}
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
              placeholder="e.g., 250"
              placeholderTextColor={palette.textLight}
            />

            {/* Notes Input */}
            <ThemedText style={styles(palette).label}>Notes - Optional</ThemedText>
            <TextInput
              style={[styles(palette).input, styles(palette).textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes about this shot..."
              placeholderTextColor={palette.textLight}
              multiline
              numberOfLines={3}
            />

            {/* Actions */}
            <View style={styles(palette).modalActions}>
              <Pressable
                onPress={() => setModalVisible(false)}
                style={[styles(palette).modalButton, styles(palette).cancelButton]}
              >
                <ThemedText style={styles(palette).cancelButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={addShot}
                style={[styles(palette).modalButton, styles(palette).saveButton]}
              >
                <ThemedText style={styles(palette).saveButtonText}>Save Shot</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: palette.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: palette.white,
    fontWeight: '600',
  },
  shotList: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    color: palette.textLight,
    marginTop: 32,
  },
  shotItem: {
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: palette.black,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  shotInfo: {
    flex: 1,
  },
  shotNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.primary,
    marginBottom: 4,
  },
  shotDetails: {
    fontSize: 14,
    color: palette.textDark,
    marginBottom: 4,
  },
  resultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: palette.grey + '40',
  },
  shotNotes: {
    fontSize: 12,
    color: palette.textLight,
    fontStyle: 'italic',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  deleteText: {
    fontSize: 18,
    color: palette.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  clubScroll: {
    marginBottom: 8,
  },
  clubButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.grey + '40',
    borderRadius: 8,
    marginRight: 8,
  },
  clubButtonActive: {
    backgroundColor: palette.primary,
  },
  clubButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.textDark,
  },
  clubButtonTextActive: {
    color: palette.white,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  resultButton: {
    width: '30%',
    padding: 12,
    backgroundColor: palette.grey + '40',
    borderRadius: 8,
    alignItems: 'center',
  },
  resultButtonActive: {
    backgroundColor: palette.primary + '20',
    borderWidth: 2,
    borderColor: palette.primary,
  },
  resultIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  resultLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: palette.grey + '20',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: palette.textDark,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: palette.grey + '40',
  },
  cancelButtonText: {
    color: palette.textDark,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: palette.primary,
  },
  saveButtonText: {
    color: palette.white,
    fontWeight: '700',
  },
});