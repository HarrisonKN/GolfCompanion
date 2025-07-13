// ------------------- IMPORTS -------------------------

import ScoreEntryModal from '@/components/ScoreEntryModal';
import React, { useState , useEffect} from 'react';
import {
  Button,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { supabase } from "@/components/supabase";
import DropDownPicker from "react-native-dropdown-picker";

const ACCENT = '#2979FF';
const CELL_WIDTH = 60; // You can adjust this value for your needs


type Course = {
  id: string;
  name: string;
  par_values: number[];
};

type CourseDropdownItem = {
  label: string;
  value: string;
};

// ------------------- SCORECARD LOGIC -------------------------
export default function ScorecardScreen() {
  const holeCount = 18;

  // Dropdown state
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseItems, setCourseItems] = useState<CourseDropdownItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);

  const [parValues, setParValues] = useState<number[]>(Array(holeCount).fill(4));
  

  const [players, setPlayers] = useState([
    { name: 'Player 1', scores: Array(holeCount).fill('') },
  ]);

  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
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

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("GolfCourses")
        .select("id, name, par_values");
  
      if (!error && data) {
        setCourses(data);
        setCourseItems(
          data.map((course) => ({
            label: course.name,
            value: course.id,
          }))
        );
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (course && Array.isArray(course.par_values)) {
      setParValues(course.par_values);
    } else {
      setParValues(Array(holeCount).fill(4)); // fallback
    }
  }, [selectedCourseId, courses]);

  // ------------------- SCORECARD UI -------------------------
  return (
    <View style={styles.gradientBg}>
      {/* Scorecard Title */}
      <View style={styles.topHeader}>
        <Text style={styles.scorecardTitle}>Scorecard</Text>
        <View style={styles.titleUnderline} />
      </View>

      <View style={{ marginBottom: 16 }}>
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={selectedCourseId}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={setSelectedCourseId}
          setItems={setCourseItems}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          placeholderStyle={styles.placeholder}
          textStyle={styles.text}
          listItemLabelStyle={styles.listItemLabel}
          zIndex={2000}
        />
      </View>

      {/* Scorecard Table - Glassy Card */}
      <View style={styles.cardWrapper}>
        <ScrollView
          horizontal
          style={styles.horizontalScroll}
          contentContainerStyle={{ minWidth: Dimensions.get('window').width + 400 }}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles.tableContainer}>
            {/* --- Combined Header Section --- */}
            <View style={styles.headerUnified}>
              {/* Header Row: Hole Numbers */}
              <View style={styles.headerRow}>
                <View style={styles.headerNameCell}>
                  <Text style={styles.headerText}>Hole</Text>
                </View>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i} style={styles.headerHoleCell}>
                    <Text style={styles.cellText}>{i + 1}</Text>
                  </View>
                ))}
                <View style={styles.headerInOutCell}><Text style={styles.cellText}>IN</Text></View>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i + 9} style={styles.headerHoleCell}>
                    <Text style={styles.cellText}>{i + 10}</Text>
                  </View>
                ))}
                <View style={styles.headerInOutCell}><Text style={styles.cellText}>OUT</Text></View>
                <View style={styles.headerInOutCell}><Text style={styles.cellText}>Total</Text></View>
                <View style={styles.headerEmptyCell} />
              </View>
              {/* Divider between Hole and Par */}
              <View style={styles.headerSubDivider} />
              {/* Par Row */}
              <View style={styles.headerRow}>
                <View style={styles.headerNameCell}>
                  <Text style={styles.headerText}>Par</Text>
                </View>
                {/* Holes 1-9 */}
                {parValues.slice(0, 9).map((par, i) => (
                  <View key={i} style={styles.headerCell}>
                    <Text style={styles.cellText}>{par}</Text>
                  </View>
                ))}
                {/* IN */}
                <View style={styles.headerInOutCell}>
                  <Text style={styles.cellText}>
                    {parValues.slice(0, 9).reduce((sum, val) => sum + val, 0)}
                  </Text>
                </View>
                {/* Holes 10-18 */}
                {parValues.slice(9, 18).map((par, i) => (
                  <View key={i + 9} style={styles.headerCell}>
                    <Text style={styles.cellText}>{par}</Text>
                  </View>
                ))}
                {/* OUT */}
                <View style={styles.headerInOutCell}>
                  <Text style={styles.cellText}>
                    {parValues.slice(9, 18).reduce((sum, val) => sum + val, 0)}
                  </Text>
                </View>
                {/* TOTAL */}
                <View style={styles.headerInOutCell}>
                  <Text style={styles.cellText}>
                    {parValues.reduce((sum, val) => sum + val, 0)}
                  </Text>
                </View>
                <View style={styles.headerEmptyCell} />
              </View>
            </View>
            {/* --- End Combined Header Section --- */}

            {/* Divider between header and player rows */}
            <View style={styles.headerDivider} />

            {/* Player Rows */}
            {players.map((player, playerIndex) => {
              const parseScore = (text: string) =>
                parseInt(text.split('/')[0]?.trim()) || 0;

              const inScore = player.scores.slice(0, 9).reduce((sum, val) => sum + parseScore(val), 0);
              const outScore = player.scores.slice(9, 18).reduce((sum, val) => sum + parseScore(val), 0);
              const totalScore = inScore + outScore;

              return (
                <View key={playerIndex} style={styles.playerCard}>
                  <View style={styles.row}>
                    <View style={styles.nameCell}>
                      <Text style={styles.playerNameText}>{player.name}</Text>
                    </View>
                    {/* Holes 1-9 */}
                    {player.scores.slice(0, 9).map((score, holeIndex) => (
                      <TouchableOpacity
                        key={holeIndex}
                        style={styles.cellTouchable}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedCell({ playerIndex, holeIndex });
                          setScoreModalVisible(true);
                        }}
                      >
                        <View style={styles.cell}>
                          <Text
                            style={styles.cellText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {score || 'Tap'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* IN column */}
                    <View style={styles.inOutCell}>
                      <Text style={styles.cellText}>{inScore}</Text>
                    </View>
                    {/* Holes 10-18 */}
                    {player.scores.slice(9, 18).map((score, holeIndex) => (
                      <TouchableOpacity
                        key={holeIndex + 9}
                        style={styles.cellTouchable}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedCell({ playerIndex, holeIndex: holeIndex + 9 });
                          setScoreModalVisible(true);
                        }}
                      >
                        <View style={styles.cell}>
                          <Text
                            style={styles.cellText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {score || 'Tap'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* OUT column */}
                    <View style={styles.inOutCell}>
                      <Text style={styles.cellText}>{outScore}</Text>
                    </View>
                    {/* TOTAL column */}
                    <View style={styles.inOutCell}>
                      <Text style={styles.cellText}>{totalScore}</Text>
                    </View>
                    {/* Remove player button */}
                    <TouchableOpacity
                      style={styles.removeCell}
                      onPress={() => setConfirmRemoveIndex(playerIndex)}
                    >
                      <Text style={styles.removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Add Player Button - floating */}
      <View style={styles.addPlayerButtonContainer}>
        <TouchableOpacity
          onPress={() => setAddPlayerModalVisible(true)}
          style={styles.addPlayerButton}
          activeOpacity={0.85}
        >
          <Text style={styles.addPlayerButtonText}>+ Add Player</Text>
        </TouchableOpacity>
      </View>

      {/* Add Player Modal */}
      <Modal visible={addPlayerModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>Enter Player Name:</Text>
            <TextInput
              placeholder="Name"
              placeholderTextColor="#fff"
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              style={styles.modalInput}
            />
            <Button title="Add" onPress={addPlayer} color={ACCENT} />
            <Button title="Cancel" onPress={() => setAddPlayerModalVisible(false)} color="#555" />
          </View>
        </View>
      </Modal>

      {/* Remove Player Modal */}
      <Modal
        visible={confirmRemoveIndex !== null}
        transparent
        animationType="slide"
      >
        <View style={styles.modalBackdrop}>
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

// ------------------- SCORECARD STYLING -------------------------
const styles = StyleSheet.create({
  gradientBg: {
    flex: 1,
    backgroundColor: '#16213e',
  },
  topHeader: {
    paddingTop: 38,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scorecardTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(41,121,255,0.18)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titleUnderline: {
    width: 120,
    height: 4,
    backgroundColor: ACCENT,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 2,
    opacity: 0.8,
  },
  cardWrapper: {
    marginHorizontal: 0,
    marginBottom: 0,
    marginTop: 12,
  },
  horizontalScroll: {
    flexGrow: 0,
    width: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  tableContainer: {
    backgroundColor: 'rgba(28,61,70,0.92)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginVertical: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#23485c',
    minWidth: 900,
  },
  headerUnified: {
    backgroundColor: '#23485c',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT,
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#23485c',
    marginVertical: 8,
  },
  headerSubDivider: {
    height: 2,
    backgroundColor: ACCENT,
    opacity: 0.7,
    marginVertical: 0,
    borderRadius: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: '#23485c',
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#2e5c7a',
    flex: 1,
  },
  headerHoleCell: {
    backgroundColor: '#29507A',
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#2e5c7a',
    flex: 1,
  },
  headerNameCell: {
    backgroundColor: ACCENT,
    width: 120,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#23485c',
  },
  headerInOutCell: {
    backgroundColor: '#2e5c7a',
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#23485c',
    flex: 1,
  },
  headerEmptyCell: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  cellTouchable: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  cellText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  playerCard: {
    backgroundColor: 'rgba(41,121,255,0.08)',
    borderRadius: 18,
    marginVertical: 8,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#23485c',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameCell: {
    backgroundColor: ACCENT,
    width: 120,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  playerNameText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  headerText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 1,
  },
  inOutCell: {
    backgroundColor: '#23485c',
    width: 54,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: '#2e5c7a',
  },
  emptyCell: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  removeCell: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#23485c',
    borderRadius: 10,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: '#2e5c7a',
  },
  removeText: {
    color: '#e53935',
    fontSize: 18,
    fontWeight: '700',
  },
  addPlayerButtonContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  addPlayerButton: {
    backgroundColor: ACCENT,
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 28,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  addPlayerButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22,33,62,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    backgroundColor: '#23485c',
    padding: 32,
    borderRadius: 20,
    elevation: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    minWidth: 280,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: '#18303d',
    color: '#fff',
    padding: 16,
    marginVertical: 14,
    borderRadius: 10,
    fontSize: 17,
  },
  modalText: {
    color: '#fff',
    fontSize: 22,
    marginBottom: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 16,
    marginHorizontal: 8,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  confirmButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 17,
  },
  cell: {
    backgroundColor: '#23485c',
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: '#2e5c7a',
    flex: 1,
  },
  dropdown: {
    backgroundColor: '#23485c',
    borderColor: ACCENT,
    minHeight: 44,
    marginTop: 8,
  },
  dropdownContainer: {
    backgroundColor: '#23485c',
    borderColor: ACCENT,
  },
  placeholder: {
    color: '#fff',
    fontWeight: '600',
  },
  text: {
    color: '#fff',
  },
  listItemLabel: {
    color: '#fff',
  },
});