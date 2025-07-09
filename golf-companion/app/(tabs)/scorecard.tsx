import ScoreEntryModal from '@/components/ScoreEntryModal';
import React, { useState } from 'react';
import {
    Button,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ScorecardScreen() {
  const holeCount = 18;

  const [players, setPlayers] = useState([
    { name: 'Player 1', scores: Array(holeCount).fill('') },
  ]);

  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  // Remove Players
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    playerIndex: number;
    holeIndex: number;
  } | null>(null);

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newPlayer = { name: newPlayerName, scores: Array(holeCount).fill('') };
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setAddPlayerModalVisible(false);
  };

  const removePlayer = (index: number) => {
    const updatedPlayers = [...players];
    updatedPlayers.splice(index, 1);
    setPlayers(updatedPlayers);
  };

  return (
    <View style={styles.container}>
      {/* ------------ STICKY HEADER Row ------------- */}
      <View style={[styles.headerRow, styles.stickyHeader]}>
        <View style={styles.cell}>
          <Text style={styles.holeCellText}>Hole</Text>
        </View>
        {players.map((player, idx) => (
          <View key={idx} style={styles.cellWithRemove}>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text
              style={styles.removeBtn}
              onPress={() => setConfirmRemoveIndex(idx)}
            >
              ✕
            </Text>
          </View>
        ))}
      </View>

      {/* ------------ SCROLLABLE Table Body ------------- */}
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        style={styles.scrollBody}
      >
        <View style={styles.table}>
          {/* Score Rows */}
          {Array.from({ length: holeCount }).map((_, holeIndex) => (
            <View key={holeIndex} style={styles.row}>
              <View style={styles.cell}>
                <Text style={styles.holeCellText}>{holeIndex + 1}</Text>
              </View>
              {players.map((player, playerIndex) => (
                <TouchableOpacity
                  key={playerIndex}
                  style={styles.cellInput}
                  onPress={() => {
                    setSelectedCell({ playerIndex, holeIndex });
                    setScoreModalVisible(true);
                  }}
                >
                  <Text
                    style={{
                      color: player.scores[holeIndex] ? '#EEE' : '#888',
                      textAlign: 'center',
                      fontSize: 14,
                    }}
                  >
                    {player.scores[holeIndex] || 'Tap'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Add Player Button */}
      <TouchableOpacity
        onPress={() => setAddPlayerModalVisible(true)}
        style={styles.addPlayerButton}
      >
        <Text style={styles.addPlayerButtonText}>Add Player</Text>
      </TouchableOpacity>

      {/* Add Player Modal */}
      <Modal visible={addPlayerModalVisible} transparent animationType="slide">
        <View style={styles.modalView}>
          <Text style={styles.modalText}>Enter Player Name:</Text>
          <TextInput
            placeholder="Name"
            placeholderTextColor="#FFFFFF"
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            style={styles.modalInput}
          />
          <Button title="Add" onPress={addPlayer} />
          <Button title="Cancel" onPress={() => setAddPlayerModalVisible(false)} />
        </View>
      </Modal>

      {/* Remove Player Modal */}
      <Modal
        visible={confirmRemoveIndex !== null}
        transparent
        animationType="slide"
      >
        <View style={styles.modalView}>
          <Text style={styles.modalText}>
            Are you sure you want to remove this player?
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: '#e53935' }]}
              onPress={() => {
                if (confirmRemoveIndex !== null) {
                  removePlayer(confirmRemoveIndex);
                }
                setConfirmRemoveIndex(null);
              }}
            >
              <Text style={styles.confirmButtonText}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: '#555' }]}
              onPress={() => setConfirmRemoveIndex(null)}
            >
              <Text style={styles.confirmButtonText}>No</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Score Entry Modal */}
      <ScoreEntryModal
        visible={scoreModalVisible}
        onClose={() => setScoreModalVisible(false)}
        onSave={(score, putts) => {
          if (selectedCell) {
            const { playerIndex, holeIndex } = selectedCell;
            const newPlayers = [...players];
            newPlayers[playerIndex].scores[holeIndex] = `${score} / ${putts}`;
            setPlayers(newPlayers);
            setSelectedCell(null);
          }
        }}
      />
    </View>
  );
}

// ------------------- STYLES -------------------------
const styles = StyleSheet.create({
  // ------------ TABLE Styling ----------------------------
  container: { flex: 1, padding: 0, backgroundColor: '#040D12' },
  table: {
    flexDirection: 'column',
    backgroundColor: '#2A2A2A',
    padding: 0,
    borderRadius: 8,
    marginTop: 0, // Remove extra margin now that header is separate
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
  },
  headerRow: { flexDirection: 'row' },
  stickyHeader: {
    flexDirection: 'row',
    marginTop:50,
    backgroundColor: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    alignSelf: 'center', // 👈 this centers it horizontally
    zIndex: 1,
  },
  scrollBody: {
    marginTop: 0, // Adjust this to match header height if needed
  },
  row: { flexDirection: 'row' },
  cell: {
    backgroundColor: '#333',
    padding: 8,
    borderWidth: 1,
    borderColor: '#444',
    minWidth: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  holeCellText: {
    color: '#FFF',
    fontWeight: '600',
  },
  cellInput: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 12,
    marginVertical: 2,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    minWidth: 80,
    maxWidth: 80,
    justifyContent: 'center',
  },
  cellWithRemove: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#444',
    minWidth: 80,
    paddingHorizontal: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  // ---------------- Add Player Styling ----------------
  playerName: {
    flex: 1,
    textAlign: 'left',
    color: '#fff',
  },
  addPlayerButton: {
    backgroundColor: '#2979FF',
    paddingVertical: 14,
    margin: 16,
    borderRadius: 8,
  },
  addPlayerButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
  modalView: {
    marginTop: 200,
    marginHorizontal: 20,
    backgroundColor: '#1e1e1e',
    padding: 20,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#555',
    backgroundColor: '#333',
    color: '#eee',
    padding: 10,
    marginVertical: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  modalText: {
    color: '#ffffff',
    fontSize: 18,
    marginBottom: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center', // Center horizontally
  },
  // ---------------- Remove Player Styling ----------------
  removeBtn: {
    color: 'red',
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 8,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 16,
  },
});
