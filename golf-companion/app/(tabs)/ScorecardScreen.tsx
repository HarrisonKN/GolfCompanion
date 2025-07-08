import React, { useState } from 'react';
import { View, Text, Button, ScrollView, TextInput, Modal, StyleSheet } from 'react-native';

export default function ScorecardScreen() {
  const holeCount = 18;
  const [players, setPlayers] = useState([{ name: 'Player 1', scores: Array(holeCount).fill('') }]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    const newPlayer = { name: newPlayerName, scores: Array(holeCount).fill('') };
    setPlayers([...players, newPlayer]);
    setNewPlayerName('');
    setModalVisible(false);
  };

  const removePlayer = (index: number) => {
  const updatedPlayers = [...players];
  updatedPlayers.splice(index, 1);
  setPlayers(updatedPlayers);
};

  const updateScore = (playerIndex: number, holeIndex: number, value: string) => {
    const newPlayers = [...players];
    newPlayers[playerIndex].scores[holeIndex] = value;
    setPlayers(newPlayers);
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal contentContainerStyle={styles.scrollContainer}>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={styles.cell}>Hole</Text>
            {players.map((player, idx) => (
            <View key={idx} style={styles.cellWithRemove}>
              <Text style={styles.playerName}>{player.name}</Text>
              <Text style={styles.removeBtn} onPress={() => removePlayer(idx)}>✕</Text>
            </View>
          ))}
          </View>

          {Array.from({ length: holeCount }).map((_, holeIndex) => (
            <View key={holeIndex} style={styles.row}>
              <Text style={styles.cell}>{holeIndex + 1}</Text>
              {players.map((player, playerIndex) => (
                <TextInput
                  key={playerIndex}
                  style={styles.cellInput}
                  keyboardType="numeric"
                  value={player.scores[holeIndex]}
                  onChangeText={(value) => updateScore(playerIndex, holeIndex, value)}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <Button title="Add Player" onPress={() => setModalVisible(true)} />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalView}>
          <Text>Enter Player Name:</Text>
          <TextInput
            placeholder="Name"
            placeholderTextColor="#FFFFFF"
            value={newPlayerName}
            onChangeText={setNewPlayerName}
            style={styles.modalInput}
          />
          <Button title="Add" onPress={addPlayer} />
          <Button title="Cancel" onPress={() => setModalVisible(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 0, backgroundColor: '#040D12' },
  table: { flexDirection: 'column',
    backgroundColor: '#6B6B6B',
    padding: 0,
    borderRadius: 0,
    marginTop: 30,

    // 👇 Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,

    // 👇 Elevation for Android
    elevation: 10,
  },
  headerRow: { flexDirection: 'row', backgroundColor: '#6B6B6B' },
  row: { flexDirection: 'row'},
  cell: {
     padding: 0, 
     borderWidth: 1, 
     borderColor: '#ccc',
     borderRadius: 0,
     minWidth: 80,
    textAlign: 'center',
     },
  cellInput: {
  backgroundColor: '#1E1E1E',
  color: '#FFFFFF',
  padding: 8,
  minWidth: 80,
  borderWidth: 1,
  borderColor: '#444',
  borderRadius: 0,
  textAlign: 'center',
},
  modalView: {
    marginTop: 200,
    marginHorizontal: 20,
    backgroundColor: '#1e1e1e', // dark gray
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
    backgroundColor: '#333',      // dark input bg
    color: '#eee',                // light text
    padding: 10,
    marginVertical: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  modalText: {
  color: '#fffffF',
  fontSize: 18,
  marginBottom: 10,
  fontWeight: '600',
  textAlign: 'center',
},
scrollContainer: {
  flexGrow: 1,
  justifyContent: 'center',
},
cellWithRemove: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderWidth: 1,
  borderColor: '#ccc',
  minWidth: 80,
  paddingHorizontal: 5,
  paddingVertical: 8,
  borderRadius: 0,
  backgroundColor: '#6B6B6B',
},

playerName: {
  flex: 1,
  textAlign: 'left',
},

removeBtn: {
  color: 'red',
  fontWeight: 'bold',
  paddingHorizontal: 6,
},
});
