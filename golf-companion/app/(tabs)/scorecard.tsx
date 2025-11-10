// ------------------- NOTES AND UPDATES -----------------
{/* 
  I removed the bottom buttons being fixed to the bottom of the screen, and now it moves with the scorecard so as it expands, 
  the buttons stay just below it.
*/}

// ------------------- IMPORTS -------------------------

import { useAuth } from '@/components/AuthContext';
import { useCourse } from '@/components/CourseContext';
import ScoreEntryModal from '@/components/ScoreEntryModal';
import { supabase } from "@/components/supabase";
import { useTheme } from "@/components/ThemeContext";
import * as MediaLibrary from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState, useRef } from 'react';
import {
  Alert,
  Button,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { captureRef } from 'react-native-view-shot';

// ------------------- CONSTANTS & TYPES -------------------------

// You can adjust this value for your needs
const holeCount = 18;
const CELL_WIDTH = 54;

type Course = {
  id: string;
  name: string;
  par_values: number[] | null; // allow null from DB
};

type PlayerRow = { id?: string; name: string; scores: string[] };

type CourseDropdownItem = { label: string; value: string } | { label: string; value: 'add_course' };

// ------------------- SCORECARD LOGIC -------------------------

function classifyScore(score: string, par: number | null): 'birdie' | 'par' | 'bogey' | undefined {
  if (par === null || par === undefined) return undefined;
  const [scoreStr] = score.split('/');
  const parsedScore = parseInt(scoreStr);
  if (!Number.isFinite(parsedScore) || !Number.isFinite(par)) return undefined;

  if (parsedScore < par) return 'birdie';
  if (parsedScore === par) return 'par';
  if (parsedScore > par) return 'bogey';
  return undefined;
}

// ------------------- SCORECARD LOGIC -------------------------

export default function Scorecard() {
  const { palette } = useTheme();
  const { user } = useAuth();

  // Dropdown state
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseItems, setCourseItems] = useState<CourseDropdownItem[]>([]);
  const [courseOpen, setCourseOpen] = useState(false);

  // 📣 missing modal state
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);

  // 📣 pull in the shared course‐ID state instead of a local one
  const { selectedCourse, setSelectedCourse } = useCourse();

  const [parValues, setParValues] = useState<(number | null)[]>(Array(holeCount).fill(null));

  const [players, setPlayers] = useState<PlayerRow[]>([]);

  const [addPlayerModalVisible, setAddPlayerModalVisible] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ playerIndex: number; holeIndex: number } | null>(null);

  const [saveModalVisible, setSaveModalVisible] = useState(false);

  // Birdie animation state
  const [showBirdieAnimation, setShowBirdieAnimation] = useState(false);
  // Animation refs for birdie emoji
  const birdieAnim = useRef(new Animated.Value(0)).current;
  const birdieLeft = useRef(new Animated.Value(Math.random() * 200 - 100)).current;

  // grab courseId layerId from the URL
  const { courseId, playerNames, playerIds, newGame, gameId } = useLocalSearchParams();

  const isNewGame = String(Array.isArray(newGame) ? newGame[0] : newGame || '') === '1';



  // Initialize players from Start Game route param (names -> empty scores)
  useEffect(() => {
    if (!playerNames) return;
    try {
      const rawNames = Array.isArray(playerNames) ? playerNames[0] : playerNames;
      const names = JSON.parse(String(rawNames)) as string[];
  
      let ids: (string | undefined)[] = [];
      try {
        const rawIds = Array.isArray(playerIds) ? playerIds[0] : playerIds;
        ids = rawIds ? (JSON.parse(String(rawIds)) as string[]) : [];
      } catch {}
  
      if (Array.isArray(names) && names.length) {
        setPlayers(
          names.map((n, i) => ({
            id: ids[i], // may be undefined for manual players
            name: n,
            scores: Array(holeCount).fill(''),
          }))
        );
      }
    } catch (e) {
      console.warn('Invalid player params', e);
    }
  }, [playerNames, playerIds]);

  useEffect(() => {
    if (courseId && typeof courseId === 'string') setSelectedCourse(courseId);
  }, [courseId]);

  // On new game: clear any previous pending scores for these players on this course and reset UI
  useEffect(() => {
    const wipePendingScores = async () => {
      if (!isNewGame) return;
      // reset UI rows to blanks (in case anything was there)
      setPlayers(prev => prev.map(p => ({ ...p, scores: Array(holeCount).fill('') })));

      try {
        const raw = Array.isArray(playerIds) ? playerIds[0] : playerIds;
        const ids = raw ? (JSON.parse(String(raw)) as string[]) : (user?.id ? [user.id] : []);
        if (!selectedCourse || !ids?.length) return;

        // delete any per-hole rows for this course and these players
        const { error } = await supabase
          .from('scores')
          .delete()
          .eq('course_id', selectedCourse)
          .in('player_id', ids);
        if (error) console.warn('Delete old scores failed:', error.message);
      } catch (e) {
        console.warn('Reset scores parse error:', e);
      }
    };
    wipePendingScores();
  }, [isNewGame, playerIds, selectedCourse, user?.id]);

  // Ensure a default player only when none were passed/initialized and not a new game
  useEffect(() => {
    const fetchAndSetPlayer = async () => {
      if (!user || !selectedCourse || players.length > 0 || playerNames || isNewGame) return;
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
      const fullName = data?.full_name || '';
      const firstName = fullName.trim().split(' ')[0] || user.email?.split('@')[0] || 'You';
      setPlayers([{ name: firstName, scores: Array(holeCount).fill('') }]);
    };
    fetchAndSetPlayer();
  }, [user, selectedCourse, players.length, playerNames, isNewGame]);

  // Do not pull old per-hole rows on a new game
  useFocusEffect(
    React.useCallback(() => {
      if (!user || !selectedCourse || isNewGame) return;
      (async () => {
        const { data: scoreData, error: fetchError } = await supabase
          .from('scores')
          .select('hole_number, score, putts')
          .eq('player_id', user.id)
          .eq('course_id', selectedCourse)
          .order('hole_number');

        if (fetchError) {
          console.error('Error fetching scores', fetchError);
          return;
        }
        if (!scoreData || scoreData.length === 0) return;

        setPlayers(prev => {
          const existing = prev[0] || { name: user?.email || 'You', scores: Array(holeCount).fill('') };
          const merged = [...existing.scores];
          for (const row of scoreData) {
            const idx = (row.hole_number ?? 1) - 1;
            if (idx >= 0 && idx < holeCount) merged[idx] = `${row.score ?? ''}/${row.putts ?? ''}`.trim();
          }
          return [{ ...existing, scores: merged }, ...prev.slice(1)];
        });
      })();
    }, [user, selectedCourse, isNewGame])
  );

  //---------------HOOKS---------------------------------
  // Birdie detection effect
  useEffect(() => {
    if (!selectedCell) return;
    const latestScore = players[selectedCell.playerIndex]?.scores[selectedCell.holeIndex];
    const cls = classifyScore(latestScore, parValues[selectedCell.holeIndex]);
    if (cls === 'birdie') {
      setShowBirdieAnimation(true);
      birdieAnim.setValue(0);
      birdieLeft.setValue(Math.random() * 200 - 100);
      Animated.timing(birdieAnim, {
        toValue: -200,
        duration: 2000 + Math.random() * 1000,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      }).start(() => setShowBirdieAnimation(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  useEffect(() => {
    // If we navigated in with a courseId param, set it on mount
    if (courseId && typeof courseId === 'string') {
      setSelectedCourse(courseId);
    }
  }, [courseId]);

  // Ensure a default player for the logged-in user from Supabase profile
  useEffect(() => {
    const fetchAndSetPlayer = async () => {
      if (!user || !selectedCourse || players.length > 0) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const fullName = data?.full_name || '';
      const firstName = fullName.trim().split(' ')[0] || user.email?.split('@')[0] || 'You';

      setPlayers([{ name: firstName, scores: Array(holeCount).fill('') }]);
    };

    fetchAndSetPlayer();
  }, [user, selectedCourse, players.length]);

  // Fetch courses from Supabase
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data, error } = await supabase
          .from('GolfCourses')
          .select('id, name, par_values')
          .order('name');

        if (error) throw error;

        const mapped = (data || []).map((c: Course) => ({ label: c.name, value: c.id }));
        setCourses(data || []);
        setCourseItems([
          ...mapped,
          { label: '+ Add new course…', value: 'add_course' as const },
        ] as CourseDropdownItem[]);
      } catch (err: any) {
        console.error('Error fetching courses', err);
        Alert.alert('Error', 'Unable to load courses');
      }
    };
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!selectedCourse) return;

    const course = courses.find(c => c.id === selectedCourse);

    // Fallback to 18x par-4 if null/invalid
    const fallback = Array(holeCount).fill(4);
    const values = Array.isArray(course?.par_values) ? course.par_values : fallback;

    // Normalize to exactly 18 entries
    const normalized =
      values.length >= holeCount
        ? values.slice(0, holeCount)
        : values.concat(Array(holeCount - values.length).fill(4));

    setParValues(normalized);
  }, [selectedCourse, courses]);

    // Reset player scores when the selected course changes
  useEffect(() => {
    if (players.length > 0) {
      setPlayers(prev =>
        prev.map(p => ({
          ...p,
          scores: Array(holeCount).fill(''),
        }))
      );
    }
  }, [selectedCourse]);

  //----------------Sync & Clear pending “scores” rows---------------
  // Whenever this screen is focused, grab any recently-entered hole scores,
  // show them in your table, then delete them from Supabase.
  // ------------------- Sync & Clear pending “scores” rows ---------------
useFocusEffect(
  React.useCallback(() => {
    if (!user || !selectedCourse) return;
    (async () => {
      // 1️⃣ pull in the raw rows, including id
      const { data: scoreData, error: fetchError } = await supabase
        .from('scores')
        .select('hole_number, score, putts')
        .eq('player_id', user.id)
        .eq('course_id', selectedCourse)
        .order('hole_number');

      if (fetchError) {
        console.error('Error fetching scores', fetchError);
        return;
      }

      // 2️⃣ if nothing new, do not overwrite UI
      if (!scoreData || scoreData.length === 0) return;

      // 3️⃣ merge into existing players[0].scores
      setPlayers(prev => {
        const existing = prev[0] || { name: user?.email || 'You', scores: Array(holeCount).fill('') };
        // copy the current first player's scores (or default blanks)
        const merged = [...existing.scores];

        for (const row of scoreData) {
          const idx = (row.hole_number ?? 1) - 1;
          if (idx >= 0 && idx < holeCount) {
            // overlay each fetched hole_number
            const scoreStr = `${row.score ?? ''}/${row.putts ?? ''}`;
            merged[idx] = scoreStr.trim();
          }
        }

        return [{ ...existing, scores: merged }, ...prev.slice(1)];
      });

      // NOTE: We are NOT deleting here anymore; you can purge rows elsewhere after saving round
    })();
  }, [user, selectedCourse])
);

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    setPlayers([...players, { name: newPlayerName.trim(), scores: Array(holeCount).fill('') }]);
    setNewPlayerName('');
    setAddPlayerModalVisible(false);
  };

  const removePlayer = (index: number) => {
    const updatedPlayers = [...players];
    updatedPlayers.splice(index, 1);
    setPlayers(updatedPlayers);
  };

  const openScoreModal = (playerIndex: number, holeIndex: number) => {
    setSelectedCell({ playerIndex, holeIndex });
    setScoreModalVisible(true);
  };

  const updateScore = (playerIndex: number, holeIndex: number, value: string) => {
    const updatedPlayers = [...players];
    updatedPlayers[playerIndex].scores[holeIndex] = value;
    setPlayers(updatedPlayers);
  };

  const calculateInOutTotals = (scores: string[]) => {
    const parseScore = (s: string) => {
      const [scoreStr, puttsStr] = s.split('/').map(v => v?.trim());
      return {
        score: Number.isFinite(parseInt(scoreStr)) ? parseInt(scoreStr) : 0,
        putts: Number.isFinite(parseInt(puttsStr)) ? parseInt(puttsStr) : 0
      };
    };

    const firstNine = scores.slice(0, 9).map(parseScore);
    const backNine  = scores.slice(9, 18).map(parseScore);

    const inScore   = firstNine.reduce((a, b) => a + b.score, 0);
    const outScore  = backNine.reduce((a, b) => a + b.score, 0);
    const totalScore = inScore + outScore;

    return { inScore, outScore, totalScore };
  };

  const persistHoleScore = async (playerId: string, holeIndex: number, value: string) => {
    if (!selectedCourse) return;
    const { score, putts } = parseScoreString(value);
    const hole_number = holeIndex + 1;

    // Prefer game_id uniqueness
    if (gameId) {
      const gid = Array.isArray(gameId) ? gameId[0] : gameId;
      const { error } = await supabase
        .from('scores')
        .upsert(
          [{ game_id: gid, player_id: playerId, course_id: selectedCourse, hole_number, score, putts, created_by: user?.id }],
          { onConflict: 'game_id,player_id,hole_number' }
        );
      if (error) console.warn('persistHoleScore (game) failed:', error);
    } else {
      const { error } = await supabase
        .from('scores')
        .upsert(
          [{ player_id: playerId, course_id: selectedCourse, hole_number, score, putts, created_by: user?.id }],
          { onConflict: 'player_id,course_id,hole_number' }
        );
      if (error) console.warn('persistHoleScore (course) failed:', error);
    }
  };

  const saveScorecardToSupabase = async () => {
    try {
      // Build round payload
      const roundData = {
        user_id: user?.id,
        course_name: courses.find(c => c.id === selectedCourse
        )?.name || 'Unknown Course',
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
        course_id: selectedCourse,
      };

      const { error } = await supabase.from('golf_rounds').insert(roundData);

      if (error) {
        Alert.alert('Upload Failed', error.message);
      } else {
        Alert.alert('Success', 'Scorecard uploaded to your account!');
        setSaveModalVisible(false);
        // Clear scores for all players after successful save
        setPlayers(prev =>
          prev.map(p => ({
            ...p,
            scores: Array(holeCount).fill(''),
          }))
        );
      }
    } catch (e: any) {
      let message = 'Unknown error';
      if (e instanceof Error) {
        message = e.message;
      }
      Alert.alert('Error', 'Failed to save scorecard: ' + message);
    }
  };

  const saveScorecardAsImage = async () => {
    try {
      // Ask for Photos/Media permission
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'We need access to your photos to save the scorecard.');
        return;
      }

      // Ensure the ref is available
      if (!scorecardRef.current) {
        Alert.alert('Error', 'Scorecard not ready to capture.');
        return;
      }

      // Capture the scorecard area as PNG
      const uri = await captureRef(scorecardRef, {
        format: 'png',
        quality: 1,
      });

      // Save to media library (optionally create album)
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('Scorecards', asset, false);

      Alert.alert('Saved', 'Scorecard saved to your Photos.');

      // Optional: share the image
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (err) {
      console.error('Error saving image', err);
      Alert.alert('Error', 'Failed to save the scorecard image.');
    }
  };

  const onSave = async () => {
    // Decide whether to save to Supabase or as Image
    setSaveModalVisible(true);
  };

  const onConfirmSave = async () => {
    // Example: Save to Supabase first, then optionally as image
    await saveScorecardToSupabase();
  };

  const scorecardRef = React.useRef<View>(null);

  // ------------------- SCORECARD UI -------------------------
  return (
    <View style={[styles(palette).gradientBg, { paddingBottom: 80 }]}>
      {/* Birdie Emoji Animation */}
      {showBirdieAnimation && (
        <Animated.View style={{
          position: 'absolute',
          bottom: 100,
          left: '50%',
          transform: [
            { translateX: birdieLeft },
            { translateY: birdieAnim },
          ],
          zIndex: 9999,
        }}>
          <Text style={{
            fontSize: 40,
            opacity: 0.9,
          }}>
            🐦‍⬛
          </Text>
        </Animated.View>
      )}
      {/* Scorecard Title */}
      <View style={styles(palette).topHeader}>
        <View style={styles(palette).scorecardTitleWrap}>
          <Text style={styles(palette).scorecardTitle}>Scorecard</Text>
        </View>
      </View>

      {/* Course Dropdown */}
      <View style={styles(palette).dropdownCard}>
        <DropDownPicker
          placeholder="Select a course…"
          open={courseOpen}
          value={selectedCourse as any}
          items={courseItems as any}
          setOpen={setCourseOpen}
          setValue={setSelectedCourse as any}
          setItems={setCourseItems as any}
          onChangeValue={(v) => {
            if (v === 'add_course') {
              // Open the create-course flow instead of selecting this pseudo item
              setCourseOpen(false);
              // Clear selection so the field doesn't show 'add_course'
              setSelectedCourse(null as any);
              setShowAddCourseModal(true);
            }
          }}
          style={styles(palette).dropdown}
          dropDownContainerStyle={[styles(palette).dropdownContainer, {zIndex: 3000}]}
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
                    <Text style={styles(palette).headerText}>{i + 1}</Text>
                  </View>
                ))}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).headerText}>IN</Text>
                </View>
                {Array.from({ length: 9 }).map((_, i) => (
                  <View key={i + 9} style={styles(palette).headerHoleCell}>
                    <Text style={styles(palette).headerText}>{i + 10}</Text>
                  </View>
                ))}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).headerText}>OUT</Text>
                </View>
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).headerText}>TOTAL</Text>
                </View>
                <View style={styles(palette).headerEmptyCell} />
              </View>

              {/* Divider */}
              <View style={styles(palette).headerSubDivider} />

              {/* Header Row: Par Values */}
              <View style={styles(palette).headerRow}>
                <View style={styles(palette).headerNameCell}>
                  <Text style={styles(palette).headerText}>Par</Text>
                </View>
                {parValues.slice(0, 9).map((par, i) => (
                  <View key={i} style={styles(palette).headerCell}>
                    <Text style={styles(palette).headerText}>{par !== null && par !== undefined ? par : '-'}</Text>
                  </View>
                ))}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).headerText}>
                    {parValues.slice(0, 9).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)}
                  </Text>
                </View>
                {parValues.slice(9, 18).map((par, i) => (
                  <View key={i + 9} style={styles(palette).headerCell}>
                    <Text style={styles(palette).headerText}>{par !== null && par !== undefined ? par : '-'}</Text>
                  </View>
                ))}
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).headerText}>
                    {parValues.slice(9, 18).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)}
                  </Text>
                </View>
                <View style={styles(palette).headerInOutCell}>
                  <Text style={styles(palette).headerText}>
                    {parValues.reduce((a, b) => (a ?? 0) + (b ?? 0), 0)}
                  </Text>
                </View>
                <View style={styles(palette).headerEmptyCell} />
              </View>
            </View>

            {/* --- Players Section --- */}
            {players.map((player, playerIndex) => {
              const { inScore, outScore, totalScore } = calculateInOutTotals(player.scores);
              return (
                <View key={playerIndex} style={styles(palette).playerCard}>
                  <View style={styles(palette).row}>
                    {/* Name */}
                    <View style={styles(palette).nameCell}>
                      <Text style={styles(palette).playerNameText}>{player.name}</Text>
                    </View>

                    {/* Holes 1-9 */}
                    {player.scores.slice(0, 9).map((score: string, holeIndex: number) => {
                      const cls = classifyScore(score, parValues[holeIndex]);
                      const [scoreStr, puttsStr] = score.split('/');
                      return (
                        <TouchableOpacity
                          key={holeIndex}
                          style={styles(palette).cellTouchable}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedCell({ playerIndex, holeIndex });
                            setScoreModalVisible(true);
                          }}
                        >
                          <View style={[
                            styles(palette).cell,
                            (holeIndex % 2 === 1) && styles(palette).cellAlt,
                            cls === 'birdie' && styles(palette).birdieCell,
                            cls === 'par' && styles(palette).parCell,
                            cls === 'bogey' && styles(palette).bogeyCell
                          ]}>
                            <Text style={styles(palette).cellText}>{scoreStr || 'Tap'}</Text>
                            {puttsStr !== undefined && (
                              <Text style={styles(palette).puttText}>{puttsStr}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* IN column */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{inScore}</Text>
                    </View>

                    {/* Holes 10-18 */}
                    {player.scores.slice(9, 18).map((score: string, holeIndex: number) => {
                      const cls = classifyScore(score, parValues[holeIndex + 9]);
                      const [scoreStr, puttsStr] = score.split('/');
                      return (
                        <TouchableOpacity
                          key={holeIndex + 9}
                          style={styles(palette).cellTouchable}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedCell({ playerIndex, holeIndex: holeIndex + 9 });
                            setScoreModalVisible(true);
                          }}
                        >
                          <View style={[
                            styles(palette).cell,
                            (holeIndex % 2 === 1) && styles(palette).cellAlt,
                            cls === 'birdie' && styles(palette).birdieCell,
                            cls === 'par' && styles(palette).parCell,
                            cls === 'bogey' && styles(palette).bogeyCell
                          ]}>
                            <Text style={styles(palette).cellText}>{scoreStr || 'Tap'}</Text>
                            {puttsStr !== undefined && (
                              <Text style={styles(palette).puttText}>{puttsStr}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

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
            style={[styles(palette).saveButton, styles(palette).smallButton,]}
            activeOpacity={0.85}
          >
            <Text style={styles(palette).saveButtonText}>Save</Text>
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
            <TouchableOpacity style={styles(palette).confirmButton} onPress={addPlayer}>
              <Text style={styles(palette).confirmButtonText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(palette).cancelButton} onPress={() => setAddPlayerModalVisible(false)}>
              <Text style={styles(palette).confirmButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirm Remove Player Modal */}
      <Modal visible={confirmRemoveIndex !== null} transparent animationType="fade">
        <View style={styles(palette).modalBackdrop}>
          <View style={styles(palette).modalView}>
            <Text style={styles(palette).modalText}>Remove this player?</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button
                title="Remove"
                color={palette.error}
                onPress={() => {
                  if (confirmRemoveIndex !== null) {
                    removePlayer(confirmRemoveIndex);
                    setConfirmRemoveIndex(null);
                  }
                }}
              />
              <Button title="Cancel" onPress={() => setConfirmRemoveIndex(null)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Modal */}
      <Modal visible={saveModalVisible} transparent animationType="slide">
        <View style={styles(palette).modalBackdrop}>
          <View style={styles(palette).modalView}>
            <Text style={styles(palette).modalText}>Save Options:</Text>
            <TouchableOpacity style={styles(palette).confirmButton} onPress={onConfirmSave}>
              <Text style={styles(palette).confirmButtonText}>Save to Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(palette).cancelButton} onPress={saveScorecardAsImage}>
              <Text style={styles(palette).confirmButtonText}>Save as Image</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles(palette).cancelButton} onPress={() => setSaveModalVisible(false)}>
              <Text style={styles(palette).confirmButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add Course Modal */}
      <Modal visible={showAddCourseModal} transparent animationType="fade" onRequestClose={() => setShowAddCourseModal(false)}>
        <View style={styles(palette).modalBackdrop}>
          <View style={styles(palette).modalView}>
            <Text style={styles(palette).modalText}>Add Course</Text>
            <Text style={{ color: palette.white, opacity: 0.7, marginBottom: 8 }}>Coming soon</Text>
            <Button title="Close" onPress={() => setShowAddCourseModal(false)} />
          </View>
        </View>
      </Modal>

      {/* Score Entry Modal Component */}
      <ScoreEntryModal
        visible={scoreModalVisible}
        onClose={() => setScoreModalVisible(false)}
        score={
          selectedCell && players[selectedCell.playerIndex]
            ? parseScoreString(players[selectedCell.playerIndex].scores[selectedCell.holeIndex]).score
            : 0
        }
        putts={
          selectedCell && players[selectedCell.playerIndex]
            ? parseScoreString(players[selectedCell.playerIndex].scores[selectedCell.holeIndex]).putts
            : 0
        }
        onSave={async (score, putts) => {
          if (!selectedCell) return;
          const value = `${score}/${putts}`;
          updateScore(selectedCell.playerIndex, selectedCell.holeIndex, value);

          const pid = players[selectedCell.playerIndex]?.id;
          if (pid) {
            await persistHoleScore(pid, selectedCell.holeIndex, value);
            // Course View listens to Realtime on 'scores' and will refresh automatically
          }
          setScoreModalVisible(false);
        }}
      />
    </View>
  );
}

// ------------------- SCORECARD UTILS -------------------------

function parseScoreString(s: string): { score: number; putts: number } {
  const [scoreStr, puttsStr] = s.split('/');
  const score = Number.isFinite(Number(scoreStr)) ? parseInt(scoreStr) || 0 : 0;
  const putts = Number.isFinite(Number(puttsStr)) ? parseInt(puttsStr) || 0 : 0;
  return { score, putts };
}

// ------------------- SCORECARD STYLING -------------------------
const styles = (palette: any) => StyleSheet.create({
  gradientBg: {
    flex: 1,
    backgroundColor: palette.background,
    padding: 16,
  },
  topHeader: {
    paddingTop: 38,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scorecardTitleWrap: {
    backgroundColor: palette.primary,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  scorecardTitle: {
  color: palette.white,
  fontSize: 28,
  fontWeight: '800',
  letterSpacing: 0.5,
  textAlign: 'center',
  textShadowColor: 'transparent',
  },
  titleUnderline: {
    width: 120,
    height: 3,
    backgroundColor: 'transparent',
    borderRadius: 2,
    marginTop: 6,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  horizontalScroll: {
    flexGrow: 0,
    width: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  tableContainer: {
  backgroundColor: palette.white,
  borderRadius: 16,
  padding: 12,
  marginVertical: 12,
  borderWidth: 1,
  borderColor: '#00000012',
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,
  overflow: 'hidden',
  minWidth: 900,
  },
  headerUnified: {
  backgroundColor: palette.primary,
  borderRadius: 12,
  borderWidth: 0,
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
    backgroundColor: '#FFFFFF33',
    opacity: 1,
    marginVertical: 0,
    borderRadius: 1,
  },
  headerRow: {
  flexDirection: 'row', alignItems: 'center',
  },
  headerCell: {
  backgroundColor: 'transparent',
  minWidth: CELL_WIDTH,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderRightWidth: 1,
  borderColor: '#FFFFFF33',
  flex: 1,
  },
  headerHoleCell: {
  backgroundColor: 'transparent',
  minWidth: CELL_WIDTH,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderRightWidth: 1,
  borderColor: '#FFFFFF33',
  flex: 1,
  },
  headerNameCell: {
  backgroundColor: 'transparent',
  width: 120,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderRightWidth: 1,
  borderColor: '#FFFFFF33',
  },
  headerInOutCell: {
  backgroundColor: 'transparent',
  minWidth: CELL_WIDTH,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderRightWidth: 1,
  borderColor: '#FFFFFF33',
  flex: 1,
  },
  headerEmptyCell: {
    width: 40,
    height: 40,
    backgroundColor: 'transparent',
  },
  row: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: palette.white,
  borderBottomWidth: 1,
  borderBottomColor: '#0000000D',
  },
  nameCell: {
  backgroundColor: palette.primary,
  width: 120,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderTopLeftRadius: 12,
  borderBottomLeftRadius: 12,
  borderTopRightRadius: 0,
  borderBottomRightRadius: 0,
  marginHorizontal: 0,
  borderWidth: 0,
  },
  cell: {
  backgroundColor: 'transparent',
  minWidth: CELL_WIDTH,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderRightWidth: 1,
  borderColor: '#00000012',
  flex: 1,
  position: 'relative', // <-- this enables the absolute child
  },
  cellTouchable: {
    minWidth: CELL_WIDTH,
    height: 40,
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  cellText: {
  color: palette.textDark,
  fontSize: 15,
  textAlign: 'center',
  fontWeight: '500',
  letterSpacing: 0.2,
  },
  playerCard: {
    backgroundColor: 'transparent',
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
  backgroundColor: 'transparent',
  minWidth: CELL_WIDTH,
  height: 40,
  justifyContent: 'center',
  alignItems: 'center',
  borderRightWidth: 1,
  borderColor: '#00000012',
  flex: 1,
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
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.third,
  },
  addPlayerButtonText: {
    color: palette.white,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: palette.primary,
    paddingVertical: 18,
    paddingHorizontal: 56,
    borderRadius: 28,
    shadowColor: palette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: palette.third,
  },
  saveButtonText: {
    color: palette.white,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22,33,62,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalView: {
    backgroundColor: palette.grey,
    borderRadius: 18,
    padding: 20,
    width: '85%',
    maxWidth: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  modalInput: {
    backgroundColor: palette.background,
    color: palette.black,
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
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius:999,
    alignItems: 'center',
    marginVertical: 6,
  },
  cancelButton: {
    backgroundColor: '#555',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    marginVertical: 6,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dropdownCard: {
  backgroundColor: palette.white,
  borderRadius: 16,
  paddingHorizontal: 12,
  paddingVertical: 6,
  marginTop: 12,
  borderWidth: 1,
  borderColor: '#0000001A',
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
  zIndex:3000,
},
  dropdown: {
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  minHeight: 44,
  marginTop: 0,
  },
  dropdownContainer: {
  backgroundColor: palette.white,
  borderColor: '#0000001A',
  borderWidth: 1,
  borderRadius: 12,
  },
  placeholder: {
  color: palette.textLight,
  fontWeight: '600',
  },
  text: {
  color: palette.textDark,
  },
  listItemLabel: {
  color: palette.textDark,
  },
  smallButton: {
    flex: 0,
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  puttText: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    fontSize: 10,
    color: palette.secondary,
  },
  cellAlt: {
    backgroundColor: '#f7f7f7',
  },
  birdieCell: {
    backgroundColor: '#d4fcd4', // light green
  },
  parCell: {
    backgroundColor: '#e0e0e0', // neutral grey
  },
  bogeyCell: {
    backgroundColor: '#fde0e0', // light red
  },
});



