// ------------------- IMPORTS -------------------------

import ScoreEntryModal from '@/components/ScoreEntryModal';
import React, { useState, useEffect } from 'react';
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
  Alert
} from 'react-native';
import { supabase } from "@/components/supabase";
import DropDownPicker from "react-native-dropdown-picker";
import { useAuth } from '@/components/AuthContext';
import { router } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { useTheme } from "@/components/ThemeContext";
import { useFocusEffect, useLocalSearchParams } from 'expo-router';


// ------------------- CONSTANTS & TYPES -------------------------
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

  const { user } = useAuth();
  const displayName =
  user?.user_metadata?.full_name
  || user?.email
  || "You"
  
  const { palette } = useTheme();

  // Dropdown state
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseItems, setCourseItems] = useState<CourseDropdownItem[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);

  const [parValues, setParValues] = useState<number[]>(Array(holeCount).fill(0));

  const [players, setPlayers] = useState<any[]>([]);

  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ playerIndex: number; holeIndex: number } | null>(null);

  const [modalScore, setModalScore] = useState(0);
  const [modalPutts, setModalPutts] = useState(0);

  const [saveModalVisible, setSaveModalVisible] = useState(false);

  const scorecardRef = React.useRef<View>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  // grab courseId layerId from the URL
  const { courseId, playerId } = useLocalSearchParams<{
    courseId?: string;
    playerId?: string;
  }>();


  //---------------HOOKS---------------------------------
  // Fetch courses from Supabase
  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("GolfCourses")
        .select("id, name, total_par, par_values")
        .order("name", { ascending: true });
      console.log("Courses data:", data, "Error:", error);
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

  // Update par values when course changes
  useEffect(() => {
    if (!selectedCourseId) return;
    const course = courses.find((c) => c.id === selectedCourseId);
    if (course && Array.isArray(course.par_values)) {
      setParValues(course.par_values);
    } else {
      setParValues(Array(holeCount).fill(4)); // fallback
    }
  }, [selectedCourseId, courses]);

  //----------------Syncing Scorecard and Courseview Logic--------
  //  Whenever this screen is focused, reload hole-by-hole scores:
    useFocusEffect(
      React.useCallback(() => {
        if (!playerId || !courseId) return;
        (async () => {
          // fetch all the saved scores for this user+course
          const { data: scoreData, error } = await supabase
            .from('scores')
            .select('hole_number, score, putts')
            .eq('player_id', playerId)
            .eq('course_id', courseId)
            .order('hole_number');

          if (error) {
            console.error('Error loading scores:', error.message);
            return;
          }

          // Turn that into an array of "X / Y" strings, one per hole
          const row = Array(holeCount)
            .fill('')
            .map((_, i) => {
              const rec = scoreData!.find(r => r.hole_number === i + 1);
              return rec ? `${rec.score} / ${rec.putts}` : '';
            });

          // If you only ever show 1 player ("You"), overwrite players:
          setPlayers([{ name: players[0]?.name || 'You', scores: row }]);
          
          // *Optionally* auto‐select the course dropdown too:
          if (courseId !== selectedCourseId) {
            setSelectedCourseId(courseId);
          }
        })();
      }, [playerId, courseId])
    );

    useEffect(() => {
    if (courseId && courseId !== selectedCourseId) {
      setSelectedCourseId(courseId);
    }
    }, [courseId]);

    useEffect(() => {
  if (user && fullName !== null && players.length === 0) {
    //use this section to display only first name of user
      const first =
      fullName.split(' ')[0] ||
      user.email!.split('@')[0] ||
      'You';
    setPlayers([{ name: first, scores: Array(holeCount).fill('') }]);
  }
  }, [user, fullName]);

    
    //use below to show users full name
    /*setPlayers([{
    name: displayName, scores: Array(holeCount).fill("") }]);
  }
}, [user, displayName]);*/


//replaced with below needed to change logic to be able to first name
  /*useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (error) {
        console.error("Error loading profile:", error.message);
        setFullName("");
      } else if (data?.full_name) {
        setFullName(data.full_name);
      }
    };
    //fetchProfile();
  }, [user]);*/

  // 2) fetch their real full_name out of your profiles table
useEffect(() => {
  if (!user) return;
  (async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    if (error) {
      console.error('failed to load profile', error.message);
      // mark as “done” but empty
      setFullName('');
    } else {
      // either their full_name or empty string
      setFullName(data.full_name || '');
    }
  })();
}, [user]);

  // Add/remove player logic
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

  const uploadScorecard = async () => {
    if (!user) {
      Alert.alert(
        'Login Required',
        'You must be logged in to upload your scorecard.',
        [
          {
            text: 'Go to Login',
            onPress: () => router.replace('/login'),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    // Prepare round data
    const roundData = {
      user_id: user.id,
      course_name: courses.find(c => c.id === selectedCourseId)?.name || 'Unknown Course',
      date: new Date().toISOString().slice(0, 10),
      score: players[0] ? players[0].scores.reduce((sum: number, val: string) => {
        const score = parseInt(val.split('/')[0]?.trim()) || 0;
        return sum + score;
      }, 0) : null,
      fairways_hit: null, // You can add logic to calculate these if you track them
      greens_in_reg: null,
      putts: players[0] ? players[0].scores.reduce((sum: number, val: string) => {
        const putts = parseInt(val.split('/')[1]?.trim()) || 0;
        return sum + putts;
      }, 0) : null,
      scorecard: JSON.stringify(players), // Save the full scorecard for later retrieval
      course_id: selectedCourseId,
    };

    const { error } = await supabase.from('golf_rounds').insert(roundData);

    if (error) {
      Alert.alert('Upload Failed', error.message);
    } else {
      Alert.alert('Success', 'Scorecard uploaded to your account!');
      setSaveModalVisible(false);
    }
  };

  const saveScorecardAsImage = async () => {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow media library access to save images.');
        return;
      }

      // Capture the view as an image
      const uri = await captureRef(scorecardRef, {
        format: 'png',
        quality: 1,
      });

      // Save to gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Golf Scorecards', asset, false);

      // Optionally, share the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }

      Alert.alert('Success', 'Scorecard saved to your gallery!');
    } catch (err) {
      let message = 'Unknown error';
      if (err instanceof Error) {
        message = err.message;
      }
      Alert.alert('Error', 'Failed to save scorecard: ' + message);
    }
  };

  // ------------------- SCORECARD UI -------------------------
  return (
    <View style={[styles(palette).gradientBg, { paddingBottom: 80 }]}>
      {/* Scorecard Title */}
      <View style={styles(palette).topHeader}>
        <Text style={styles(palette).scorecardTitle}>Scorecard</Text>
        <View style={styles(palette).titleUnderline} />
      </View>

      {/* Course Dropdown */}
      <View style={{ marginBottom: 16 }}>
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={selectedCourseId}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={setSelectedCourseId}
          setItems={setCourseItems}
          style={styles(palette).dropdown}
          dropDownContainerStyle={styles(palette).dropdownContainer}
          placeholderStyle={styles(palette).placeholder}
          textStyle={styles(palette).text}
          listItemLabelStyle={styles(palette).listItemLabel}
          zIndex={2000}
        />
      </View>

      {/* Scorecard Table - Glassy Card */}
      <View style={styles(palette).cardWrapper}>
        <ScrollView
          horizontal
          style={styles(palette).horizontalScroll}
          contentContainerStyle={{ minWidth: Dimensions.get('window').width + 400 }}
          showsHorizontalScrollIndicator={false}
        >
          <View style={styles(palette).tableContainer} ref={scorecardRef}>
            {/* --- Combined Header Section --- */}
            <View style={styles(palette).headerUnified}>
              {/* Header Row: Hole Numbers */}
              <View style={styles(palette).headerRow}>
                <View style={styles(palette).headerNameCell}>
                  <Text style={styles(palette).headerText}>Hole</Text>
                </View>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i} style={styles(palette).headerHoleCell}>
                    <Text style={styles(palette).cellText}>{i + 1}</Text>
                  </View>
                ))}
                <View style={styles(palette).headerInOutCell}><Text style={styles(palette).cellText}>IN</Text></View>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i + 9} style={styles(palette).headerHoleCell}>
                    <Text style={styles(palette).cellText}>{i + 10}</Text>
                  </View>
                ))}
                <View style={styles(palette).headerInOutCell}><Text style={styles(palette).cellText}>OUT</Text></View>
                <View style={styles(palette).headerInOutCell}><Text style={styles(palette).cellText}>Total</Text></View>
                <View style={styles(palette).headerEmptyCell} />
              </View>
              {/* Divider between Hole and Par */}
              <View style={styles(palette).headerSubDivider} />
              {/* Par Row */}
              <View style={styles(palette).headerRow}>
                <View style={styles(palette).headerNameCell}>
                  <Text style={styles(palette).headerText}>Par</Text>
                </View>
                {/* Holes 1-9 */}
                {parValues.slice(0, 9).map((par, i) => (
                  <View key={i} style={styles(palette).headerCell}>
                    <Text style={styles(palette).cellText}>{par}</Text>
                  </View>
                ))}
                {/* IN */}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).cellText}>
                    {parValues.slice(0, 9).reduce((sum, val) => sum + val, 0)}
                  </Text>
                </View>
                {/* Holes 10-18 */}
                {parValues.slice(9, 18).map((par, i) => (
                  <View key={i + 9} style={styles(palette).headerCell}>
                    <Text style={styles(palette).cellText}>{par}</Text>
                  </View>
                ))}
                {/* OUT */}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).cellText}>
                    {parValues.slice(9, 18).reduce((sum, val) => sum + val, 0)}
                  </Text>
                </View>
                {/* TOTAL */}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).cellText}>
                    {parValues.reduce((sum, val) => sum + val, 0)}
                  </Text>
                </View>
                <View style={styles(palette).headerEmptyCell} />
              </View>
            </View>
            {/* --- End Combined Header Section --- */}

            {/* Divider between header and player rows */}
            <View style={styles(palette).headerDivider} />

            {/* Player Rows */}
            {players.map((player, playerIndex) => {
              const parseScore = (text: string) =>
                parseInt(text.split('/')[0]?.trim()) || 0;

              const inScore = player.scores.slice(0, 9).reduce((sum: number, val: string) => sum + parseScore(val), 0);
              const outScore = player.scores.slice(9, 18).reduce((sum: number, val: string) => sum + parseScore(val), 0);
              const totalScore = inScore + outScore;

              return (
                <View key={playerIndex} style={styles(palette).playerCard}>
                  <View style={styles(palette).row}>
                    <View style={styles(palette).nameCell}>
                      <Text style={styles(palette).playerNameText}>{player.name}</Text>
                    </View>
                    {/* Holes 1-9 */}
                    {player.scores.slice(0, 9).map((score: string, holeIndex: number) => (
                      <TouchableOpacity
                        key={holeIndex}
                        style={styles(palette).cellTouchable}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedCell({ playerIndex, holeIndex });
                          setScoreModalVisible(true);
                        }}
                      >
                        <View style={styles(palette).cell}>
                          <Text
                            style={styles(palette).cellText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {score || 'Tap'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* IN column */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{inScore}</Text>
                    </View>
                    {/* Holes 10-18 */}
                    {player.scores.slice(9, 18).map((score: string, holeIndex: number) => (
                      <TouchableOpacity
                        key={holeIndex + 9}
                        style={styles(palette).cellTouchable}
                        activeOpacity={0.7}
                        onPress={() => {
                          setSelectedCell({ playerIndex, holeIndex: holeIndex + 9 });
                          setScoreModalVisible(true);
                        }}
                      >
                        <View style={styles(palette).cell}>
                          <Text
                            style={styles(palette).cellText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                          >
                            {score || 'Tap'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* OUT column */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{outScore}</Text>
                    </View>
                    {/* TOTAL column */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{totalScore}</Text>
                    </View>
                    {/* Remove player button */}
                    <TouchableOpacity
                      style={styles(palette).removeCell}
                      onPress={() => setConfirmRemoveIndex(playerIndex)}
                    >
                      <Text style={styles(palette).removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Add Player Button - floating */}
      <View style={styles(palette).addPlayerButtonContainer}>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <TouchableOpacity
            onPress={() => setAddPlayerModalVisible(true)}
            style={[styles(palette).addPlayerButton, styles(palette).smallButton]}
            activeOpacity={0.85}
          >
            <Text style={styles(palette).addPlayerButtonText}>+ Add Player</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSaveModalVisible(true)}
            style={[styles(palette).addPlayerButton, styles(palette).smallButton,]}
            activeOpacity={0.85}
          >
            <Text style={styles(palette).addPlayerButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Player Modal */}
      <Modal visible={addPlayerModalVisible} transparent animationType="slide">
        <View style={styles(palette).modalBackdrop}>
          <View style={styles(palette).modalView}>
            <Text style={styles(palette).modalText}>Enter Player Name:</Text>
            <TextInput
              placeholder="Name"
              placeholderTextColor={palette.white}
              value={newPlayerName}
              onChangeText={setNewPlayerName}
              style={styles(palette).modalInput}
            />
            <Button title="Add" onPress={addPlayer} color={palette.secondary} />
            <Button title="Cancel" onPress={() => setAddPlayerModalVisible(false)} color={palette.third} />
          </View>
        </View>
      </Modal>

      {/* Remove Player Modal */}
      <Modal
        visible={confirmRemoveIndex !== null}
        transparent
        animationType="slide"
      >
        <View style={styles(palette).modalBackdrop}>
          <View style={styles(palette).modalView}>
            <Text style={styles(palette).modalText}>
              Are you sure you want to remove this player?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity
                style={[styles(palette).confirmButton, { backgroundColor: '#e53935' }]}
                onPress={() => {
                  if (confirmRemoveIndex !== null) {
                    removePlayer(confirmRemoveIndex);
                  }
                  setConfirmRemoveIndex(null);
                }}
              >
                <Text style={styles(palette).confirmButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles(palette).confirmButton, { backgroundColor: '#555' }]}
                onPress={() => setConfirmRemoveIndex(null)}
              >
                <Text style={styles(palette).confirmButtonText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Save Scorecard Modal */}
      <Modal visible={saveModalVisible} transparent animationType="slide">
        <View style={styles(palette).modalBackdrop}>
          <View style={styles(palette).modalView}>
            <Text style={styles(palette).modalText}>Save Scorecard</Text>
            <TouchableOpacity
              style={[styles(palette).confirmButton, styles(palette).smallButton, { marginBottom: 12 }]}
              onPress={uploadScorecard}
            >
              <Text style={styles(palette).confirmButtonText}>Upload to Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles(palette).confirmButton, styles(palette).smallButton]}
              onPress={saveScorecardAsImage}
            >
              <Text style={styles(palette).confirmButtonText}>Save as Image</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles(palette).confirmButton, styles(palette).smallButton, { backgroundColor: '#555', marginTop: 12 }]}
              onPress={() => setSaveModalVisible(false)}
            >
              <Text style={styles(palette).confirmButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Score Entry Modal */}
      <ScoreEntryModal
        visible={scoreModalVisible}
        onClose={() => setScoreModalVisible(false)}
        score={modalScore}
        putts={modalPutts}
        onScoreChange={setModalScore}
        onPuttsChange={setModalPutts}
        onSave={(score, putts) => {
          if (selectedCell) {
            const { playerIndex, holeIndex } = selectedCell;
            const newPlayers = [...players];
            newPlayers[playerIndex].scores[holeIndex] = `${score} / ${putts}`;
            setPlayers(newPlayers);
            setSelectedCell(null);
            setModalScore(0);
            setModalPutts(0);
          }
          setScoreModalVisible(false);
        }}
      />
    </View>
  );
}

// ------------------- SCORECARD STYLING -------------------------
const styles = (palette: any) => StyleSheet.create({
  gradientBg: {
    flex: 1,
    backgroundColor: palette.scorecardBackground,
    padding: 16,
  },
  topHeader: {
    paddingTop: 38,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scorecardTitle: {
    color: palette.white,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: palette.primary,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  titleUnderline: {
    width: 120,
    height: 4,
    backgroundColor: palette.primary,
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
    backgroundColor: palette.secondary,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginVertical: 12,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: palette.primary,
    minWidth: 900,
  },
  headerUnified: {
    backgroundColor: palette.primary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.primary,
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerDivider: {
    height: 1,
    backgroundColor: palette.primary,
    marginVertical: 8,
  },
  headerSubDivider: {
    height: 2,
    backgroundColor: palette.primary,
    opacity: 0.7,
    marginVertical: 0,
    borderRadius: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCell: {
    backgroundColor: palette.primary,
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: palette.third,
    flex: 1,
  },
  headerHoleCell: {
    backgroundColor: palette.third,
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: palette.primary,
    flex: 1,
  },
  headerNameCell: {
    backgroundColor: palette.primary,
    width: 120,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: palette.primary,
  },
  headerInOutCell: {
    backgroundColor: palette.third,
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: palette.primary,
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
    color: palette.white,
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  playerCard: {
    backgroundColor: palette.background,
    borderRadius: 18,
    marginVertical: 8,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.secondary
  },
  nameCell: {
    backgroundColor: palette.primary,
    width: 120,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  playerNameText: {
    color: palette.white,
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0.5,
  },
  headerText: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 1,
  },
  inOutCell: {
    backgroundColor: palette.third,
    width: 54,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    marginHorizontal: 1,
    borderWidth: 1,
    borderColor: palette.third,
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
    backgroundColor: palette.primary,
    borderRadius: 10,
    marginLeft: 4,
    borderWidth: 1,
    borderColor: palette.third,
  },
  removeText: {
    color: palette.error,
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
    paddingBottom: 40,
  },
  addPlayerButton: {
    backgroundColor: palette.primary,
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 28,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 12,
  },
  addPlayerButtonText: {
    color: palette.white,
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
    backgroundColor: palette.primary,
    padding: 32,
    borderRadius: 20,
    elevation: 12,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    minWidth: 280,
    borderWidth: 1,
    borderColor: palette.primary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: palette.primary,
    backgroundColor: palette.third,
    color: palette.white,
    padding: 16,
    marginVertical: 14,
    borderRadius: 10,
    fontSize: 17,
  },
  modalText: {
    color: palette.white,
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
    backgroundColor: palette.secondary,
  },
  confirmButtonText: {
    color: palette.white,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 17,
  },
  cell: {
    backgroundColor: palette.primary,
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: palette.third,
    flex: 1,
  },
  dropdown: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
    minHeight: 44,
    marginTop: 8,
  },
  dropdownContainer: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  placeholder: {
    color: palette.white,
    fontWeight: '600',
  },
  text: {
    color: palette.white,
  },
  listItemLabel: {
    color: palette.white,
  },
  smallButton: {
    flex: 0,
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
});