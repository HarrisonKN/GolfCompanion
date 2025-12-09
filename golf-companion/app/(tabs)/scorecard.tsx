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
import { useMemo } from 'react';
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
  Image,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import { captureRef } from 'react-native-view-shot';

// ---- Color Utilities ----
function lighten(color: string, amount: number): string {
  // Works for HEX colors like #000000
  try {
    const hex = color.replace("#", "");
    const num = parseInt(hex, 16);

    const r = Math.min(255, ((num >> 16) & 0xff) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return color; // fallback if palette color isn't hex
  }
}

// ------------------- CONSTANTS & TYPES -------------------------

// You can adjust this value for your needs
const holeCount = 18;
const CELL_WIDTH = 54;

type Course = {
  id: string;
  name: string;
  par_values: number[] | null; // allow null from DB
};

type PlayerRow = { id?: string; name: string; avatar_url?: string | null; scores: string[] };

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
  const [selectedCell, setSelectedCell] = useState<{ playerIndex?: number; teamId?: string; teamNumber?: number; holeIndex: number } | null>(null);
  const [teamScores, setTeamScores] = useState<Record<string, string[]>>({});
  const [viewMode, setViewMode] = useState<'table' | 'chips'>('chips');

  const [saveModalVisible, setSaveModalVisible] = useState(false);

  // Birdie animation state
  const [showBirdieAnimation, setShowBirdieAnimation] = useState(false);
  // Animation refs for birdie emoji
  const birdieAnim = useRef(new Animated.Value(0)).current;
  const birdieLeft = useRef(new Animated.Value(Math.random() * 200 - 100)).current;

  // grab courseId layerId from the URL
  const { courseId, playerNames, playerIds, playerAvatars, newGame, gameId, teams: teamParam, gameMode } = useLocalSearchParams();

  const scrambleTeams = useMemo(() => {
    if (!teamParam) return null;
    try {
      const raw = JSON.parse(String(teamParam));
      if (!Array.isArray(raw)) return null;

      return raw.map((t: any, idx: number) => ({
        team_number:
          typeof t.team_number === 'number'
            ? t.team_number
            : typeof t.id === 'number'
            ? t.id
            : idx + 1,
        name: t.name ?? `Team ${idx + 1}`,
        players: Array.isArray(t.players) ? t.players : [],
      }));
    } catch {
      return null;
    }
  }, [teamParam]);

  const isScramble = gameMode === 'scramble';
  const [dbTeams, setDbTeams] = useState<any[]>([]);

  const isNewGame = String(Array.isArray(newGame) ? newGame[0] : newGame || '') === '1';

  //Troubleshooting
useEffect(() => {
  console.log("teamParam:", teamParam);
  console.log("scrambleTeams RAW:", scrambleTeams);
  console.log("dbTeams:", dbTeams);
}, [teamParam, scrambleTeams, dbTeams]);


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

      let avatars: (string | null)[] = [];
      try {
        const rawAv = Array.isArray(playerAvatars) ? playerAvatars[0] : playerAvatars;
        avatars = rawAv ? (JSON.parse(String(rawAv)) as (string | null)[]) : [];
      } catch {}

      if (Array.isArray(names) && names.length) {
        setPlayers(
          names.map((n, i) => {
            const raw = (n || '').toString().trim();
            const firstName = raw.split(' ')[0] || raw || 'Player';
            return {
              id: ids[i], // may be undefined for manual players
              name: firstName,
              avatar_url: avatars[i] || null,
              scores: Array(holeCount).fill(''),
            };
          })
        );
      }
    } catch (e) {
      console.warn('Invalid player params', e);
    }
  }, [playerNames, playerIds, playerAvatars]);

  useEffect(() => {
  if (!isScramble) return;

  const gid = Array.isArray(gameId) ? gameId[0] : gameId;
  if (!gid) return;

  (async () => {
    const { data, error } = await supabase
      .from("game_teams")
      .select("*")
      .eq("game_id", gid);

    if (!error && data) {
      setDbTeams(data);
    } else {
      console.warn("Failed to load game_teams:", error);
    }
  })();
}, [isScramble, gameId]);

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

  //------REFRESH PAR VALUES ON PAGE REFRESH FOR ADDNG COURSES --------
    useFocusEffect(
    React.useCallback(() => {
      if (!selectedCourse) return;

      (async () => {
        const { data, error } = await supabase
          .from("GolfCourses")
          .select("par_values")
          .eq("id", selectedCourse)
          .single();

        if (error) {
          console.error("Error fetching par values:", error);
          return;
        }

        if (data?.par_values && Array.isArray(data.par_values)) {
          // Ensure it’s always exactly 18 entries
          const normalized = [...data.par_values];
          while (normalized.length < holeCount) normalized.push(4);
          setParValues(normalized.slice(0, holeCount));
        }
      })();
    }, [selectedCourse])
  );

  //---------------HOOKS---------------------------------
  // Birdie detection effect
  useEffect(() => {
    if (!selectedCell) return;
    const latestScore =
    selectedCell.playerIndex !== undefined
      ? players[selectedCell.playerIndex]?.scores[selectedCell.holeIndex]
      : '';
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
  // show them in your table (players or teams), then delete them from Supabase.
  // ------------------- Sync & Clear pending “scores” rows ---------------
  useFocusEffect(
    React.useCallback(() => {
      if (!selectedCourse) return;

      // Scramble mode: sync team-based scores using team_id + game_id
      if (isScramble && scrambleTeams && scrambleTeams.length > 0) {
        (async () => {
          const gid = Array.isArray(gameId) ? gameId[0] : gameId;
          if (!gid || dbTeams.length === 0) return;

          const teamIds = scrambleTeams
            .map((t: any) => {
              const realTeam = dbTeams.find(dt => dt.team_number === t.team_number);
              return realTeam?.id || t.team_id || null;
            })
            .filter((id): id is string => !!id);
          if (teamIds.length === 0) return;

          const { data: scoreData, error: fetchError } = await supabase
            .from('scores')
            .select('team_id, hole_number, score, putts')
            .eq('game_id', gid)
            .in('team_id', teamIds)
            .eq('course_id', selectedCourse)
            .order('hole_number');

          if (fetchError) {
            console.error('Error fetching team scores', fetchError);
            return;
          }

          const initial: Record<string, string[]> = {};
          for (const tid of teamIds) {
            initial[tid] = Array(holeCount).fill('');
          }

          if (scoreData) {
            for (const row of scoreData) {
              const tid = row.team_id as string | null;
              if (!tid || !initial[tid]) continue;
              const idx = (row.hole_number ?? 1) - 1;
              if (idx >= 0 && idx < holeCount) {
                const value = `${row.score ?? ''}/${row.putts ?? ''}`.trim();
                initial[tid][idx] = value;
              }
            }
          }

          setTeamScores(initial);
        })();
      } else {
        // Stroke/solo mode: sync per-player scores using player_id
        if (players.length === 0) return;

        (async () => {
          const playerIdsList = players
            .map(p => p.id || user?.id || null)
            .filter((id): id is string => !!id);

          if (playerIdsList.length === 0) {
            console.warn("⚠ No valid player IDs found for solo sync");
            return;
          }

          const { data: scoreData, error: fetchError } = await supabase
            .from('scores')
            .select('player_id, hole_number, score, putts')
            .in('player_id', playerIdsList as string[])
            .eq('course_id', selectedCourse)
            .order('hole_number');

          if (fetchError) {
            console.error('Error fetching scores', fetchError);
            return;
          }

          if (!scoreData || scoreData.length === 0) return;

          setPlayers(prev => {
            const updated = prev.map(p => ({ ...p, scores: [...p.scores] }));

            for (const row of scoreData) {
              const playerIndex = updated.findIndex(pl => pl.id === row.player_id);
              if (playerIndex >= 0) {
                const idx = (row.hole_number ?? 1) - 1;
                if (idx >= 0 && idx < holeCount) {
                  const scoreStr = `${row.score ?? ''}/${row.putts ?? ''}`.trim();
                  updated[playerIndex].scores[idx] = scoreStr;
                }
              }
            }

            return updated;
          });
        })();
      }
    }, [selectedCourse, players, isScramble, scrambleTeams, gameId, dbTeams])
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

  const persistTeamHoleScore = async (teamId: string, holeIndex: number, value: string) => {
    if (!selectedCourse) return;
    const { score, putts } = parseScoreString(value);
    const hole_number = holeIndex + 1;
    const gid = Array.isArray(gameId) ? gameId[0] : gameId;
    if (!gid) return; // scramble games should always have a game_id

    const { error } = await supabase
      .from('scores')
      .upsert(
        [{ game_id: gid, team_id: teamId, player_id: null, course_id: selectedCourse, hole_number, score, putts, created_by: user?.id }],
        { onConflict: 'game_id,team_id,hole_number' }
      );

    if (error) console.warn('persistTeamHoleScore failed:', error);
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

  // Determine the currently selected score string for the modal (player or team cell)
  const selectedScoreString = (() => {
    if (!selectedCell) return '';

    // Team-based cell in scramble mode
    if (selectedCell.teamId && teamScores[selectedCell.teamId]) {
      const arr = teamScores[selectedCell.teamId];
      return arr[selectedCell.holeIndex] || '';
    }

    // Player-based cell
    if (selectedCell.playerIndex !== undefined && selectedCell.playerIndex !== null) {
      const p = players[selectedCell.playerIndex];
      if (p && p.scores[selectedCell.holeIndex] !== undefined) {
        return p.scores[selectedCell.holeIndex];
      }
    }

    return '';
  })();

  const selectedParsed = parseScoreString(selectedScoreString);

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
        <Text
          style={{
            color: palette.textLight,
            fontSize: 18,
            fontWeight: '700',
            letterSpacing: 0.5,
            marginTop: -2,
            marginBottom: 0,
            textAlign: 'center',
          }}
        >
          {(() => {
            const course = courses.find(c => c.id === selectedCourse);
            const totalPar = parValues.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);
            return `${course?.name || ''} — Par ${totalPar}`;
          })()}
        </Text>
      </View>
      <View style={styles(palette).divider} />

      {/* Course Dropdown */}
     {/* <View style={styles(palette).dropdownCard}>
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
      </View> */}

      {/* Scorecard Table - Glassy Card */}
      {/* Scorecard Table - Glassy Card */}
<View style={styles(palette).cardWrapper}>
  {viewMode === 'table' ? (
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
                <Text style={styles(palette).headerText}>
                  {par !== null && par !== undefined ? par : '-'}
                </Text>
              </View>
            ))}
            <View style={styles(palette).headerInOutCell}>
              <Text style={styles(palette).headerText}>
                {parValues.slice(0, 9).reduce((a, b) => (a ?? 0) + (b ?? 0), 0)}
              </Text>
            </View>
            {parValues.slice(9, 18).map((par, i) => (
              <View key={i + 9} style={styles(palette).headerCell}>
                <Text style={styles(palette).headerText}>
                  {par !== null && par !== undefined ? par : '-'}
                </Text>
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
        {
          // 1) SCRAMBLE MODE WITH TEAMS → show one row per team, scores from teamScores
          isScramble && scrambleTeams && scrambleTeams.length > 0 ? (
            scrambleTeams.map((team: any, teamIndex: number) => {
              const realTeam = dbTeams.find(t => t.team_number === team.team_number);
              const teamId = realTeam?.id; // UUID from database
              const scoresForTeam = teamScores[teamId] || Array(holeCount).fill('');
              const { inScore, outScore, totalScore } = calculateInOutTotals(scoresForTeam);

              return (
                <View key={teamIndex} style={styles(palette).playerCard}>
                  <View style={styles(palette).row}>
                    {/* Team Display */}
                    <View style={styles(palette).nameCell}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {team.players.map((pid: string, i: number) => {
                          const pIndex = players.findIndex(pl => pl.id === pid);
                          if (pIndex === -1) return null;
                          const p = players[pIndex];
                          return (
                            <Image
                              key={pid}
                              source={p.avatar_url ? { uri: p.avatar_url } : undefined}
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 18,
                                marginLeft: i === 0 ? 0 : -10,
                                borderWidth: 2,
                                borderColor: '#fff',
                              }}
                            />
                          );
                        })}
                      </View>

                      <Text
                        style={{
                          color: palette.white,
                          fontWeight: '700',
                          marginTop: 4,
                        }}
                      >
                        {realTeam?.name ?? team.name ?? `Team ${team.team_number}`}
                      </Text>
                    </View>

                    {/* Scramble Cells 1–9 */}
                    {scoresForTeam.slice(0, 9).map((val, holeIdx) => {
                      const [scoreStr, puttsStr] = (val || '').split('/');
                      const cls = classifyScore(val || '', parValues[holeIdx]);
                      return (
                        <TouchableOpacity
                          key={holeIdx}
                          style={styles(palette).cellTouchable}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedCell({ teamId, teamNumber: team.team_number, holeIndex: holeIdx });
                            setScoreModalVisible(true);
                          }}
                        >
                          <View
                            style={[
                              styles(palette).cell,
                              holeIdx % 2 === 1 && styles(palette).cellAlt,
                              cls === 'birdie' && styles(palette).birdieCell,
                              cls === 'par' && styles(palette).parCell,
                              cls === 'bogey' && styles(palette).bogeyCell,
                            ]}
                          >
                            <Text style={styles(palette).cellText}>{scoreStr || 'Tap'}</Text>
                            {puttsStr !== undefined && puttsStr !== '' && (
                              <Text style={styles(palette).puttText}>{puttsStr}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* IN total for team */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{inScore}</Text>
                    </View>

                    {/* Scramble Cells 10–18 */}
                    {scoresForTeam.slice(9, 18).map((val, holeIdx) => {
                      const absoluteHole = holeIdx + 9;
                      const [scoreStr, puttsStr] = (val || '').split('/');
                      const cls = classifyScore(val || '', parValues[absoluteHole]);
                      return (
                        <TouchableOpacity
                          key={absoluteHole}
                          style={styles(palette).cellTouchable}
                          activeOpacity={0.7}
                          onPress={() => {
                            setSelectedCell({ teamId, teamNumber: team.team_number, holeIndex: absoluteHole });
                            setScoreModalVisible(true);
                          }}
                        >
                          <View
                            style={[
                              styles(palette).cell,
                              holeIdx % 2 === 1 && styles(palette).cellAlt,
                              cls === 'birdie' && styles(palette).birdieCell,
                              cls === 'par' && styles(palette).parCell,
                              cls === 'bogey' && styles(palette).bogeyCell,
                            ]}
                          >
                            <Text style={styles(palette).cellText}>{scoreStr || 'Tap'}</Text>
                            {puttsStr !== undefined && puttsStr !== '' && (
                              <Text style={styles(palette).puttText}>{puttsStr}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* OUT and TOTAL for team */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{outScore}</Text>
                    </View>
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{totalScore}</Text>
                    </View>

                    {/* Remove button left as-is */}
                    <View style={styles(palette).removeCell}>
                      <Text style={styles(palette).removeText}>✕</Text>
                    </View>
                  </View>
                </View>
              );
            })

          // 2) SOLO MODE (default) → full table rows
          ) : (
            players.map((player, playerIndex) => {
              const { inScore, outScore, totalScore } = calculateInOutTotals(player.scores);
              return (
                <View key={playerIndex} style={styles(palette).playerCard}>
                  <View style={styles(palette).row}>
                    {/* Name + Avatar */}
                    <View style={styles(palette).nameCell}>
                      <View
                        style={{
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                        }}
                      >
                        {player.avatar_url ? (
                          <Image
                            source={{ uri: player.avatar_url }}
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                          />
                        ) : (
                          <View
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 20,
                              backgroundColor: palette.third,
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                color: palette.white,
                                fontWeight: '700',
                                fontSize: 12,
                              }}
                            >
                              {player.name?.[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>
                        )}

                        <Text style={styles(palette).playerNameText}>{player.name}</Text>
                      </View>
                    </View>

                    {/* HOLES 1–9 */}
                    {player.scores.slice(0, 9).map((score, holeIndex) => {
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
                          <View
                            style={[
                              styles(palette).cell,
                              holeIndex % 2 === 1 && styles(palette).cellAlt,
                              cls === 'birdie' && styles(palette).birdieCell,
                              cls === 'par' && styles(palette).parCell,
                              cls === 'bogey' && styles(palette).bogeyCell,
                            ]}
                          >
                            <Text style={styles(palette).cellText}>{scoreStr || 'Tap'}</Text>
                            {puttsStr !== undefined && (
                              <Text style={styles(palette).puttText}>{puttsStr}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* IN */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{inScore}</Text>
                    </View>

                    {/* HOLES 10–18 */}
                    {player.scores.slice(9, 18).map((score, holeIndex) => {
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
                          <View
                            style={[
                              styles(palette).cell,
                              holeIndex % 2 === 1 && styles(palette).cellAlt,
                              cls === 'birdie' && styles(palette).birdieCell,
                              cls === 'par' && styles(palette).parCell,
                              cls === 'bogey' && styles(palette).bogeyCell,
                            ]}
                          >
                            <Text style={styles(palette).cellText}>{scoreStr || 'Tap'}</Text>
                            {puttsStr !== undefined && (
                              <Text style={styles(palette).puttText}>{puttsStr}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}

                    {/* OUT */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{outScore}</Text>
                    </View>

                    {/* TOTAL */}
                    <View style={styles(palette).inOutCell}>
                      <Text style={styles(palette).cellText}>{totalScore}</Text>
                    </View>

                    {/* REMOVE */}
                    <TouchableOpacity
                      style={styles(palette).removeCell}
                      onPress={() => setConfirmRemoveIndex(playerIndex)}
                    >
                      <Text style={styles(palette).removeText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )
        }
      </View>
    </ScrollView>
  ) : (
    <ScrollView
      style={styles(palette).chipScroll}
      contentContainerStyle={styles(palette).chipScrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles(palette).chipTableContainer} ref={scorecardRef}>
        {isScramble && scrambleTeams && scrambleTeams.length > 0
          ? scrambleTeams.map((team: any, teamIndex: number) => {
              const realTeam = dbTeams.find(t => t.team_number === team.team_number);
              const teamId = realTeam?.id;
              const scoresForTeam = teamScores[teamId] || Array(holeCount).fill('');
              const { inScore, outScore, totalScore } = calculateInOutTotals(scoresForTeam);

              return (
                <View key={teamIndex} style={styles(palette).chipPlayerCard}>
                  <View style={styles(palette).chipHeaderRow}>
                    <View style={styles(palette).chipHeaderLeft}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: -6 }}>
                        {team.players.map((pid: string, i: number) => {
                          const pIndex = players.findIndex(pl => pl.id === pid);
                          if (pIndex === -1) return null;
                          const p = players[pIndex];
                          return (
                            <Image
                              key={pid}
                              source={p.avatar_url ? { uri: p.avatar_url } : undefined}
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                marginLeft: i === 0 ? 0 : -14,
                                borderWidth: 2,
                                borderColor: '#fff',
                              }}
                            />
                          );
                        })}
                      </View>
                      <Text style={styles(palette).chipPlayerName}>
                        {realTeam?.name ?? team.name ?? `Team ${team.team_number}`}
                      </Text>
                    </View>

                    <View style={styles(palette).chipHeaderTotals}>
                      <Text style={styles(palette).chipHeaderTotalsText}>IN {inScore}</Text>
                      <Text style={styles(palette).chipHeaderTotalsText}>OUT {outScore}</Text>
                      <Text style={styles(palette).chipHeaderTotalsText}>TOTAL {totalScore}</Text>
                    </View>
                  </View>

                  <View style={styles(palette).chipGrid}>
                    {scoresForTeam.map((val, holeIndex) => {
                      const cls = classifyScore(val, parValues[holeIndex]);
                      const [scoreStr, puttsStr] = (val || '').split('/');
                      return (
                        <TouchableOpacity
                          key={holeIndex}
                          style={styles(palette).chipCellTouchable}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedCell({ teamId, teamNumber: team.team_number, holeIndex });
                            setScoreModalVisible(true);
                          }}
                        >
                          <View
                            style={[
                              styles(palette).chip,
                              cls === 'birdie' && styles(palette).chipBirdie,
                              cls === 'par' && styles(palette).chipPar,
                              cls === 'bogey' && styles(palette).chipBogey,
                            ]}
                          >
                            <Text style={styles(palette).chipText}>
                              {scoreStr || String(holeIndex + 1)}
                            </Text>
                            {puttsStr ? (
                              <Text
                                style={{
                                  position: 'absolute',
                                  bottom: 4,
                                  right: 5,
                                  fontSize: 8,
                                  color: palette.textLight,
                                  opacity: 0.8,
                                  fontWeight: '600',
                                }}
                              >
                                {puttsStr}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })
          : players.map((player, playerIndex) => {
              const { inScore, outScore, totalScore } = calculateInOutTotals(player.scores);
              return (
                <View key={playerIndex} style={styles(palette).chipPlayerCard}>
                  <View style={styles(palette).chipHeaderRow}>
                    <View style={styles(palette).chipHeaderLeft}>
                      {player.avatar_url ? (
                        <Image
                          source={{ uri: player.avatar_url }}
                          style={{ width: 40, height: 40, borderRadius: 20 }}
                        />
                      ) : (
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: palette.third,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <Text
                            style={{
                              color: palette.white,
                              fontWeight: '700',
                              fontSize: 12,
                            }}
                          >
                            {player.name?.[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>
                      )}
                      <Text style={styles(palette).chipPlayerName}>{player.name}</Text>
                    </View>

                    <View style={styles(palette).chipHeaderTotals}>
                      <Text style={styles(palette).chipHeaderTotalsText}>IN {inScore}</Text>
                      <Text style={styles(palette).chipHeaderTotalsText}>OUT {outScore}</Text>
                      <Text style={styles(palette).chipHeaderTotalsText}>TOTAL {totalScore}</Text>
                    </View>
                  </View>

                  <View style={styles(palette).chipGrid}>
                    {player.scores.map((score, holeIndex) => {
                      const cls = classifyScore(score, parValues[holeIndex]);
                      const [scoreStr, puttsStr] = score.split('/');
                      return (
                        <TouchableOpacity
                          key={holeIndex}
                          style={styles(palette).chipCellTouchable}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedCell({ playerIndex, holeIndex });
                            setScoreModalVisible(true);
                          }}
                        >
                          <View
                            style={[
                              styles(palette).chip,
                              cls === 'birdie' && styles(palette).chipBirdie,
                              cls === 'par' && styles(palette).chipPar,
                              cls === 'bogey' && styles(palette).chipBogey,
                            ]}
                          >
                            <Text style={styles(palette).chipText}>
                              {scoreStr || String(holeIndex + 1)}
                            </Text>
                            {puttsStr ? (
                              <Text
                                style={{
                                  position: 'absolute',
                                  bottom: 4,
                                  right: 5,
                                  fontSize: 8,
                                  color: palette.textLight,
                                  opacity: 0.8,
                                  fontWeight: '600',
                                }}
                              >
                                {puttsStr}
                              </Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}
      </View>
    </ScrollView>
  )}
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
        score={selectedParsed.score}
        putts={selectedParsed.putts}
        onSave={async (score, putts) => {
          if (!selectedCell) return;
          const value = `${score}/${putts}`;

          // Team-based cell in scramble mode
          if (selectedCell.teamId) {
            // Resolve a guaranteed valid teamId
            let resolvedTeamId = selectedCell.teamId;

            if (!resolvedTeamId && scrambleTeams && dbTeams.length > 0) {
              const match = dbTeams.find(t => t.team_number === selectedCell.teamNumber);
              if (match?.id) resolvedTeamId = match.id;
            }

            if (resolvedTeamId) {
              const holeIndex = selectedCell.holeIndex;

              // Update local UI immediately
              setTeamScores(prev => {
                const existing = prev[resolvedTeamId] || Array(holeCount).fill('');
                const next = [...existing];
                next[holeIndex] = value;
                return { ...prev, [resolvedTeamId]: next };
              });

              await persistTeamHoleScore(resolvedTeamId, holeIndex, value);
            }
          }
          // Player-based cell (stroke/solo mode)
          else if (selectedCell.playerIndex !== undefined && selectedCell.playerIndex !== null) {
            const pIndex = selectedCell.playerIndex;
            updateScore(pIndex, selectedCell.holeIndex, value);

            // ALWAYS resolve a valid playerId for Supabase writes
            const pid = players[pIndex]?.id || user?.id;

            if (pid) {
              await persistHoleScore(pid, selectedCell.holeIndex, value);
              // Course View listens to Realtime on 'scores' and will refresh automatically
            }
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
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 4,
    alignSelf: 'center',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  scorecardTitle: {
    color: palette.textLight,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.3)',
    textShadowRadius: 6,
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
    borderRadius: 32,
    overflow: 'hidden',
  },
  horizontalScroll: {
    flexGrow: 0,
    width: '100%',
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  tableContainer: {
  backgroundColor: palette.background,
  padding: 24,
  marginVertical: 12,
  marginBottom: 8,
  minWidth: 900,
  borderRadius: 32,
  borderWidth: 0,
  borderColor: 'transparent',
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
  overflow: 'hidden',
},
  headerUnified: {
    backgroundColor: palette.background,
    borderRadius: 24,
    borderWidth: 0,
    borderColor: 'transparent',
    marginBottom: 12,
    overflow: 'hidden',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  headerCell: {
    backgroundColor: 'transparent',
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    flex: 1,
  },
  headerHoleCell: {
    backgroundColor: 'transparent',
    minWidth: CELL_WIDTH,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
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
    borderColor: 'rgba(255,255,255,0.25)',
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
  backgroundColor: 'transparent',
  borderBottomWidth: 0,
  borderBottomColor: '#0000000D',
  height: 60,
  },
  nameCell: {
    backgroundColor: lighten(palette.background, 15),
    minWidth: 120,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    marginHorizontal: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
  },
  cell: {
    backgroundColor: lighten(palette.background, 18),
    minWidth: CELL_WIDTH,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0,
    borderColor: 'transparent',
    flex: 1,
    position: 'relative',
    borderRadius: 14,
  },
  cellTouchable: {
    minWidth: CELL_WIDTH,
    height: 70,
    flex: 1,
    borderRadius: 0,
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
    backgroundColor: lighten(palette.background, 8),
    borderRadius: 20,
    marginVertical: 8,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    height: 70,
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
    backgroundColor: lighten(palette.background, 12),
    minWidth: CELL_WIDTH,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 0,
    borderColor: 'transparent',
    flex: 1,
  },
  emptyCell: {
    width: 40,
    height: 70,
    backgroundColor: 'transparent',
  },
  removeCell: {
    width: 40,
    height: 70,
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
    shadowColor: palette.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 45,
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
    shadowColor: palette.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 45,
  },
  saveButtonText: {
    color: palette.white,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: palette.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    shadowColor: palette.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 45,
    marginBottom: 24,
  },
  modalView: {
    backgroundColor: palette.white,
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
    backgroundColor: palette.black,
    color: palette.black,
    padding: 16,
    marginVertical: 14,
    borderRadius: 10,
    fontSize: 17,
  },
  modalText: {
    color: palette.textDark,
    fontSize: 22,
    marginBottom: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: palette.primary,
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
  shadowColor: palette.shadow,
  shadowOpacity: 0.35,
  shadowRadius: 32,
  elevation: 45,
  marginBottom: 24,
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
  borderColor: palette.black,
  borderWidth: 1,
  borderRadius: 12,
  },
  placeholder: {
  color: palette.textLight,
  fontWeight: '600',
  },
  text: {
  color: palette.textLight,
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
  divider: {
  width: '90%',
  height: 1,
  backgroundColor: palette.textLight,
  alignSelf: 'center',
  marginTop: 4,
},
  // --- Compact chip layout styles ---
  chipScroll: {
    width: '100%',
    marginTop: 12,
  },
  chipScrollContent: {
    paddingBottom: 16,
  },
  chipTableContainer: {
    width: '100%',
    maxWidth: 900,
    alignSelf: 'center',
  },
  chipPlayerCard: {
    backgroundColor: lighten(palette.background, 10),
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginVertical: 6,
    borderWidth: 0,
    borderColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  chipHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chipHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipPlayerName: {
    color: palette.textLight,
    fontWeight: '800',
    fontSize: 16,
  },
  chipHeaderTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipHeaderTotalsText: {
    color: palette.textLight,
    fontSize: 12,
    fontWeight: '600',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 0,
  },
  chipCellTouchable: {
  width: '11%',      // ensures exactly 9 per row
  aspectRatio: 1,
  justifyContent: 'center',
  alignItems: 'center',
  marginVertical: 4, // vertical spacing only
},
  chip: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lighten(palette.background, 20),
  },
  chipText: {
    color: palette.textLight,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  chipBirdie: {
    backgroundColor: '#d4fcd4',
  },
  chipPar: {
    backgroundColor: '#e0e0e0',
  },
  chipBogey: {
    backgroundColor: '#fde0e0',
  },
});



