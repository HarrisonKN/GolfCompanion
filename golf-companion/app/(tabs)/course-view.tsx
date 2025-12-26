// ------------------- NOTES AND UPDATES -----------------
{/* 

I added , well removed, the scoreboard when there is no course selected,

and changed the look of the scoreboard, so now all players should fit on 1 row,
Everything has been scaled to fit 4 players, will need to add extra conditions to allow for more players in the future.

Also changed the finish button to an icon, so that there wasnt such a jump in size and text of the top header,


*/}
// ------------------- IMPORTS -------------------------
import { useAuth } from "@/components/AuthContext";
import { useCourse } from "@/components/CourseContext";
import { supabase, testSupabaseConnection } from "@/components/supabase";
import { useTheme } from "@/components/ThemeContext";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import haversine from "haversine-distance";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Button,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  StyleProp, 
  ViewStyle,
  InteractionManager, 
  Easing 
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import type { LatLng } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';

// ------------------- STEP OVERLAY COMPONENT -------------------------
function StepOverlay({ visible, message, onConfirm, onCancel, confirmButtons }: {
  visible: boolean;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmButtons?: boolean;
}) {
  const { palette } = useTheme();
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{
        flex: 1,
        backgroundColor: palette.background,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 3000,
      }}>
        <View style={{
          minWidth: 220,
          backgroundColor: palette.background,
          borderRadius: 20,
          paddingVertical: 24,
          paddingHorizontal: 32,
          alignItems: "center",
          elevation: 10,
        }}>
          <Text style={{
            color: palette.textLight,
            fontWeight: "bold",
            fontSize: 18,
            textAlign: "center"
          }}>
            {message}
          </Text>
          {confirmButtons && (
            <View style={{ flexDirection: "row", marginTop: 24, gap: 18 }}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [{ backgroundColor: palette.primary, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, marginRight: 8, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: palette.textLight, fontWeight: "bold", fontSize: 16 }}>No</Text>
              </Pressable>
              <Pressable
                onPress={onConfirm}
                style={({ pressed }) => [{ backgroundColor: "#fff", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: "#111", fontWeight: "bold", fontSize: 16 }}>Yes</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ------------------- TYPES -------------------------
type Course = {
  id: string;
  name: string;
  par_values: number[] | null;
};

type Hole = {
  id: string;
  course_id: string;
  hole_number: number;
  par: number | null;
  yardage: number | null;
  tee_latitude: number | null;
  tee_longitude: number | null;
  fairway_latitude: number | null;
  fairway_longitude: number | null;
  green_latitude: number | null;
  green_longitude: number | null;
};

type ScoreboardItem = {
  player_id: string | null;
  team_id: string | null; 
  name: string;
  avatar_url?: string | null;
  strokes: number;
  toPar: number;
  holesPlayed: number;
};

type PlayerRow = {
  id: string;
  name: string;
  avatar_url?: string | null;
};

type FriendLocation = {
  user_id: string;
  course_id: string | null;
  hole_number: number | null;
  latitude: number;
  longitude: number;
  updated_at: string;
  name: string;
  avatar_url: string | null;
};

// ------------------- GEO HELPERS (pure; OK at module scope) -------------------------
// Bearing in degrees from point A -> B (0..360)
function bearingDeg(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
) {
  const φ1 = (from.latitude * Math.PI) / 180;
  const φ2 = (to.latitude * Math.PI) / 180;
  const Δλ = ((to.longitude - from.longitude) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  // normalize to 0..360
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// shift a lat/lon some meters along the inverse of a heading (used to lift tee higher)
function nudgeAlongHeading(
  center: { latitude: number; longitude: number },
  headingDeg: number,
  metersBack: number // positive moves camera back toward tee
) {
  const R = 6378137;
  const rad = (headingDeg * Math.PI) / 180;
  const dNorth = -metersBack * Math.cos(rad); // negative = back toward tee
  const dEast = -metersBack * Math.sin(rad);

  const newLat = center.latitude + (dNorth / R) * (180 / Math.PI);
  const newLon =
    center.longitude +
    (dEast / (R * Math.cos((center.latitude * Math.PI) / 180))) *
      (180 / Math.PI);
  return { latitude: newLat, longitude: newLon };
}
//---------------------------------------------------------------
const COMPACT_H = 36;

export default function CourseViewScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<any>>();
  // Declare states first (always in the same order)
  const [location, setLocation] =
    useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [selectedHoleNumber, setSelectedHoleNumber] = useState<number | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [holeOpen, setHoleOpen] = useState(false);
  const [courseItems, setCourseItems] = useState<any[]>([]);
  const [holeItems, setHoleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [droppedPins, setDroppedPins] = useState<{ latitude: number; longitude: number }[]>([]);
  const [distanceToPin, setDistanceToPin] = useState<number | null>(null);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [newCourseName, setNewCourseName] = useState("");
  // Add missing states for floating distance banners
  const [teeFairwayY, setTeeFairwayY] = useState<number | null>(null);
  const [fairwayGreenY, setFairwayGreenY] = useState<number | null>(null);
  // Trigger banner update when camera flight completes
  const [triggerBannerUpdate, setTriggerBannerUpdate] = useState(0);
  const [scoreboard, setScoreboard] = useState<ScoreboardItem[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  // --- PATCH: Track resolved gameId for reactivity ---
  const [resolvedGameId, setResolvedGameId] = useState<string | null>(null);
  const refreshScoreboardRef = useRef<null | (() => void)>(null);
  // Scoreboard scale (percentage, persisted)
  const [sbScalePct, setSbScalePct] = useState<number>(100); // 100% default
  const sbScale = sbScalePct / 100;
  const mul = React.useCallback((n: number) => Math.max(1, Math.round(n * sbScale)), [sbScale]);

  // --- Hole entry modal state (NEW) ---
  const [holeEntryStep, setHoleEntryStep] = useState(0);
  const [holeEntryData, setHoleEntryData] = useState<{
    par: number | null;
    yardage: number | null;
    green: LatLng | null;
    fairway: LatLng | null;
    tee: LatLng | null;
  }>({
    par: null,
    yardage: null,
    green: null,
    fairway: null,
    tee: null,
  });
  const [entryPromptVisible, setEntryPromptVisible] = useState(false);
  const [inputValue, setInputValue] = useState("");
  // New: step prompt overlay for hole entry flow
  const [stepPromptMessage, setStepPromptMessage] = useState<string | null>(null);
  const [stepPromptConfirm, setStepPromptConfirm] = useState<null | (() => void)>(null);
  const [stepPromptCancel, setStepPromptCancel] = useState<null | (() => void)>(null);
  const [showStepConfirm, setShowStepConfirm] = useState<boolean>(false);

  const { user } = useAuth();
  const { palette } = useTheme();
  const S = React.useMemo(() => styles(palette), [palette]);
  const { courseId, playerIds, gameId, teams } = useLocalSearchParams<{ courseId?: string; playerIds?: string; gameId?: string; teams?: string }>();
  const router = useRouter();
  const { selectedCourse, setSelectedCourse } = useCourse();



    // ============================================================================
  // MULTIPLAYER CONTEXT RESOLUTION (GAME + PARTICIPANTS)
  // ----------------------------------------------------------------------------
  // Why this exists:
  // - Invitee devices sometimes open CourseView without a `gameId` route param
  //   and/or with stale AsyncStorage values.
  // - If we rely on route params alone, CourseView can load the wrong game or none.
  // - We resolve a reliable `resolvedGameId` and then load participants from
  //   `game_participantsv2` (status=accepted) and hydrate UI `players[]` from `profiles`.
  //
  // What it does:
  // 1) Build candidate gameIds from: route param -> AsyncStorage -> recent accepted games
  // 2) Validate candidates by checking they have accepted participants
  // 3) Set `resolvedGameId` as the single source of truth for multiplayer
  // 4) If CourseView has no course selected (invitee edge case), derive course_id
  //    from `golf_rounds` using the resolved gameId
  //
  // NOTE:
  // - `players[]` is UI-only (avatars/names). Scoreboard calculations should not
  //   depend on it (race conditions). Scoreboard uses DB participants directly.
  // ============================================================================
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // --- Robust gameId resolver (invitee-safe + validated) ---
      const gidFromParams = Array.isArray(gameId) ? gameId[0] : gameId;
      let gidFromStorage: string | null = null;
      try {
        const raw = await AsyncStorage.getItem("currentGamePlayers");
        if (raw) {
          try { gidFromStorage = JSON.parse(raw)?.gameId ?? null; } catch {}
        }
      } catch {}

      const candidates: string[] = [];
      if (gidFromParams) candidates.push(String(gidFromParams));
      if (gidFromStorage && !candidates.includes(String(gidFromStorage))) candidates.push(String(gidFromStorage));

      // If we still have no candidates, pull a few recent accepted games for this user
      if (candidates.length === 0 && user?.id) {
        const { data: recent, error: recentErr } = await supabase
          .from("game_participantsv2")
          .select("game_id")
          .eq("user_id", user.id)
          .eq("status", "accepted")
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentErr) {
          console.warn("❌ [CourseView] failed to derive recent gameIds from participants", recentErr);
        } else {
          for (const r of recent || []) {
            const g = (r as any).game_id ? String((r as any).game_id) : null;
            if (g && !candidates.includes(g)) candidates.push(g);
          }
        }
      }

      if (candidates.length === 0) {
        console.warn("❌ [CourseView] could not resolve any gameId candidates");
        return;
      }

      // Validate candidates by ensuring the game has accepted participants.
      // This prevents stale AsyncStorage gameIds (the exact bug you're hitting).
      let gid: string | null = null;
      for (const c of candidates) {
        const { data: partsCheck, error: partsErr } = await supabase
          .from("game_participantsv2")
          .select("user_id")
          .eq("game_id", c)
          .eq("status", "accepted")
          .limit(1);

        if (partsErr) {
          console.warn("❌ [CourseView] participants check failed for candidate", c, partsErr);
          continue;
        }

        if (partsCheck && partsCheck.length > 0) {
          gid = c;
          break;
        }
      }

      if (!gid) {
        // Second pass: AsyncStorage may be stale. Pull a few recent accepted games for this user and validate them.
        if (user?.id) {
          const { data: recent, error: recentErr } = await supabase
            .from("game_participantsv2")
            .select("game_id")
            .eq("user_id", user.id)
            .eq("status", "accepted")
            .order("created_at", { ascending: false })
            .limit(10);

          if (recentErr) {
            console.warn("❌ [CourseView] failed to load recent games for validation", recentErr);
          } else {
            const recentIds = (recent || [])
              .map((r: any) => (r?.game_id ? String(r.game_id) : null))
              .filter(Boolean) as string[];

            for (const c of recentIds) {
              // skip already-checked stale candidates
              if (candidates.includes(c)) continue;

              const { data: partsCheck, error: partsErr } = await supabase
                .from("game_participantsv2")
                .select("user_id")
                .eq("game_id", c)
                .eq("status", "accepted")
                .limit(1);

              if (partsErr) {
                console.warn("❌ [CourseView] participants check failed for recent game", c, partsErr);
                continue;
              }

              if (partsCheck && partsCheck.length > 0) {
                gid = c;
                break;
              }
            }
          }
        }
      }

      if (!gid) {
        console.warn("❌ [CourseView] no valid gameId found (storage/params stale + recent validation failed)", candidates);
        return;
      }

      // Avoid extra rerenders when gid hasn't changed
      setResolvedGameId(prev => (prev === gid ? prev : gid));

      // If invitee navigated here without courseId selected, derive it from the round/game record
      if (!selectedCourse && !courseId) {
        try {
          const { data: roundRow, error: roundErr } = await supabase
            .from("golf_rounds")
            .select("course_id")
            .eq("id", gid)
            .single();

          if (roundErr) {
            console.warn("❌ [CourseView] failed to derive course_id from golf_rounds", roundErr);
          } else if (roundRow?.course_id) {
            console.log("🧭 [CourseView] derived course_id from round:", roundRow.course_id);
            setSelectedCourse(roundRow.course_id);
          }
        } catch (e) {
          console.warn("❌ [CourseView] derive course_id exception", e);
        }
      }

      console.log("🎬 [CourseView] loading participants for game:", gid);

      // 1) Load participants (authoritative membership)
      const { data: participants, error } = await supabase
        .from("game_participantsv2")
        .select("user_id")
        .eq("game_id", gid)
        .eq("status", "accepted");

      // STEP 2: Sanity log after loading participants
      console.log("👥 [CourseView] participants rows:", participants);

      if (cancelled) return;

      if (error || !participants || participants.length === 0) {
        console.warn("❌ [CourseView] no participants found", error);
        return;
      }

      const userIds = participants.map((p: any) => p.user_id).filter(Boolean);

      // 2) Load profiles for those participants
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      if (cancelled) return;

      if (pErr || !profiles) {
        console.warn("❌ [CourseView] failed to load profiles", pErr);
        return;
      }

      // 3) Normalize to PlayerRow[] (first name + avatar)
      const rows: PlayerRow[] = (profiles as any[]).map((p: any) => ({
        id: p.id,
        name: (p.full_name || "").trim().split(" ")[0] || "Player",
        avatar_url: p.avatar_url ?? null,
      }));

      console.log("✅ [CourseView] loaded players:", rows);
      setPlayers(rows);
      // STEP 3: Sanity log after setting players
      console.log("🧠 [CourseView] players state set to:", rows.map(r => r.id));
      // Ensure scoreboard refreshes once participants are known
      refreshScoreboardRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [gameId, user?.id]);

  const mountedRef = useRef(true);
  const mapRef = useRef<MapView | null>(null);

  const lastFlewCourseRef = useRef<string | null>(null);

  // Cache for friend profile info
  const profileCache = useRef<Map<string, { full_name: string; avatar_url: string | null }>>(new Map()).current;

  // --- animated crossfade overlay for hole transitions (our addition) ---
  const transitionOpacity = useRef(new Animated.Value(0)).current;
  const switchingCourseRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [MapLoaded, setMapLoaded] = useState(false);
  const didInitialNavRef = useRef(false);

  // --- safe-area + dynamic map padding (our addition) ---
  const insets = useSafeAreaInsets();
  const [topPadPx, setTopPadPx] = useState(0); // space covered by dropdown stack
  const [scoreH, setScoreH] = useState(0); // measured height of score overlay
  const [actionsH, setActionsH] = useState(0); // measured height of action buttons
  // --- Friend Live Locations ---
  const [friendLocations, setFriendLocations] = useState<FriendLocation[]>([]);

  // your styles use these bottoms in px; keep in sync with styles:
  const SCORE_BOTTOM = 75;
  const ACTIONS_BOTTOM = 120;

  // cloud animation for course selection
  const { width: W } = Dimensions.get("window");

  // cloud overlay state
  const [cloudsOn, setCloudsOn] = useState(false);
  const cloudLeftX = useRef(new Animated.Value(-W)).current; // off-screen left
  const cloudRightX = useRef(new Animated.Value(W)).current; // off-screen right
  const cloudOpacity = useRef(new Animated.Value(0)).current;

  // we’ll call this from the course-change effect to open the clouds
  const openCloudsRef = useRef<null | (() => void)>(null);

  // durations
  const FLY_MS = 900;
  const CLOUD_CLOSE_MS = 320;
  const CLOUD_OPEN_MS = 700;

  //Menu ui 
  const LABEL_CLEARANCE = 24;
  const ACTION_SIZE = 44;      // your S.fabAction size
  const ACTION_GAP  = 30;      // space between buttons
  const ACTION_SPACING = ACTION_SIZE + ACTION_GAP; // 58

  // --- scoring state (unchanged) ---
  const [score, setScore] = useState<number>(0);
  const [putts, setPutts] = useState<number>(0);

  // show/hide the score panel (start hidden as you asked)
  const [scoreVisible, setScoreVisible] = useState(false);

  // --- Player score modal state ---
  const [scoreModalVisible, setScoreModalVisible] = useState(false);
  const [activePlayer, setActivePlayer] = useState<ScoreboardItem | null>(null);
  const [activeTeam, setActiveTeam] = useState<any | null>(null);
  const [tempScore, setTempScore] = useState(0);
  const [tempPutts, setTempPutts] = useState(0);

  // speed-dial open/close
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

  //my position button 
  const [buttonPressed, setButtonPressed] = useState(false);

  const toggleFab = () => {
    const to = fabOpen ? 0 : 1;
    setFabOpen(!fabOpen);
    Animated.spring(fabAnim, {
      toValue: to,
      useNativeDriver: true,
      friction: 7,
      tension: 90,
    }).start();
  };

  // animated positions for the two actions
  const actionScoreY = fabAnim.interpolate({
  inputRange: [0, 1],
  outputRange: [0, -ACTION_SPACING],        // first action up one step
  });

  const actionLocY = fabAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -(ACTION_SPACING * 2)],  // second action up two steps
  });
  //const actionLocY   = fabAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -140] });
  const rotateZ      = fabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "45deg"] });

  // compute the bottom padding we need (max of visible stacks)
  const bottomPadPx = Math.max(
    (scoreVisible ? SCORE_BOTTOM + (scoreH || 0) : 0),
    ACTIONS_BOTTOM + (actionsH || 0)
  );

  // Safe state update to avoid changing state after the component is unmounted
  const safeSetState = (setter: any, value: any) => {
    if (mountedRef.current) {
      setter(value);
    }
  };

  // Toast alerts for user login on course view - fall back to alert for ios
  const showMessage = (msg: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert(msg);
    }
  };
  const ArrowDown = ({ style }: { style: StyleProp<ViewStyle> }) => (
    <View style={[style, S.iconCompact]}>
      <Text style={S.iconText}>▾</Text>
    </View>
  );

  const ArrowUp = ({ style }: { style: StyleProp<ViewStyle> }) => (
    <View style={[style, S.iconCompact]}>
      <Text style={S.iconText}>▴</Text>
    </View>
  );




  // ---------- animated cover helper (our addition) ---------- no longer used
  function runHoleTransition(
    cb: () => void,
    opts: { fadeInMs?: number; fadeOutMs?: number } = {}
  ) {
    const { fadeInMs = 180, fadeOutMs = 900 } = opts; // fade out matches flight
    Animated.timing(transitionOpacity, {
      toValue: 0,
      duration: fadeInMs,
      useNativeDriver: true,
    }).start(() => {
      cb(); // do camera prep here (fit/orient)
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: fadeOutMs, // reveal during the camera flight
        useNativeDriver: true,
      }).start();
    });
  }

  // ----- cloud animation helper ----------------
  function closeCloudsThen(cb: () => void) {
    setCloudsOn(true);
    cloudOpacity.setValue(1);
    cloudLeftX.setValue(-W);
    cloudRightX.setValue(W);

    Animated.parallel([
      Animated.timing(cloudLeftX, {
        toValue: 0,
        duration: CLOUD_CLOSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cloudRightX, {
        toValue: 0,
        duration: CLOUD_CLOSE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => cb());
  }
  openCloudsRef.current = () => {
    Animated.parallel([
      Animated.timing(cloudLeftX, {
        toValue: -W,
        duration: CLOUD_OPEN_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cloudRightX, {
        toValue: W,
        duration: CLOUD_OPEN_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cloudOpacity, {
        toValue: 0,
        delay: 300,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => setCloudsOn(false));
  };

  // ---------- oriented fly-to-hole (our addition) ----------
  // Improved hole fly helper: first fit, then rotate/pitch
  function flyHole(mapRef: { current: MapView | null }, hole: Hole, duration = 900) {
    if (!mapRef.current) return;
    const tee = hole.tee_latitude != null && hole.tee_longitude != null
      ? { latitude: hole.tee_latitude, longitude: hole.tee_longitude }
      : null;
    const green = hole.green_latitude != null && hole.green_longitude != null
      ? { latitude: hole.green_latitude, longitude: hole.green_longitude }
      : null;
    if (!tee || !green) return;

    // Fit both points with UI padding
    try {
      mapRef.current.fitToCoordinates([tee, green], {
        edgePadding: {
          top: topPadPx + 40,
          bottom: bottomPadPx + 40,
          left: 60,
          right: 60,
        },
        animated: true,
      });
    } catch {}

    // After fit, rotate and adjust zoom/altitude
    setTimeout(() => {
      orientedFlyToHole(mapRef, hole, duration);
    }, 400);
  }

  // Center on a hole ignoring tee/green orientation
  function centerOnHole(hole: Hole, duration = 700) {
    if (!mapRef.current) return;

    const pts: { latitude: number; longitude: number }[] = [];
    if (hole.tee_latitude != null && hole.tee_longitude != null)
      pts.push({ latitude: hole.tee_latitude, longitude: hole.tee_longitude });
    if (hole.fairway_latitude != null && hole.fairway_longitude != null)
      pts.push({ latitude: hole.fairway_latitude, longitude: hole.fairway_longitude });
    if (hole.green_latitude != null && hole.green_longitude != null)
      pts.push({ latitude: hole.green_latitude, longitude: hole.green_longitude });

    if (!pts.length) return;

    const avg = pts.reduce(
      (a, p) => ({ latitude: a.latitude + p.latitude, longitude: a.longitude + p.longitude }),
      { latitude: 0, longitude: 0 }
    );
    const center = {
      latitude: avg.latitude / pts.length,
      longitude: avg.longitude / pts.length,
    };

    // Zoom heuristic: prefer yardage if present; else default
    const y = typeof hole.yardage === 'number' ? hole.yardage : 0;
    if (Platform.OS === 'ios') {
      const altitude = y ? Math.max(140, Math.min(900, y * 0.75 + 140)) : 420;
      mapRef.current.animateCamera({ center, altitude, pitch: 0, heading: 0 }, { duration });
    } else {
      let zoom = y ? 19.0 - Math.log2(Math.max(60, y) / 130) : 17.6;
      zoom = Math.max(16.0, Math.min(19.5, zoom));
      mapRef.current.animateCamera({ center, zoom, pitch: 0, heading: 0 }, { duration });
    }
  }

  // Tighter altitude/zoom heuristics
  async function orientedFlyToHole(
    mapRef: { current: MapView | null },
    hole: Hole,
    flightMs = 900
  ) {
    if (!mapRef.current) return;
    const tee = hole.tee_latitude != null && hole.tee_longitude != null
      ? { latitude: hole.tee_latitude, longitude: hole.tee_longitude }
      : null;
    const green = hole.green_latitude != null && hole.green_longitude != null
      ? { latitude: hole.green_latitude, longitude: hole.green_longitude }
      : null;
    if (!tee || !green) return;

    const heading = bearingDeg(tee, green);
    const meters = haversine(
      { lat: tee.latitude, lon: tee.longitude },
      { lat: green.latitude, lon: green.longitude }
    );

    // Midpoint + slight backward nudge
    const mid = {
      latitude: (tee.latitude + green.latitude) / 2,
      longitude: (tee.longitude + green.longitude) / 2,
    };
    const center = nudgeAlongHeading(mid, heading, Math.min(25, Math.max(10, meters * 0.06)));

    if (Platform.OS === "ios") {
      // Narrower altitude window
      let altitude = Math.max(140, Math.min(750, meters * 0.72 + 120));
      mapRef.current.animateCamera(
        { center, heading, pitch: 38, altitude },
        { duration: flightMs }
      );
    } else {
      // Zoom: shorter holes closer
      let zoom = 19.2 - Math.log2(Math.max(50, meters) / 110); // 110m baseline
      zoom = Math.max(16.5, Math.min(19.5, zoom));
      mapRef.current.animateCamera(
        { center, heading, pitch: 38, zoom },
        { duration: flightMs }
      );
    }
  }

  // ------------------- SCORE SUBMIT -------------------------
  const handleEnter = async () => {
    if (!user) {
      showMessage("Please sign in before recording scores.");
      return;
    }
    const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);
    if (!selectedHole) {
      showMessage("Please select a hole first.");
      return;
    }

    // Resolve gameId for score inserts.
    // NOTE: Multiplayer paths should prefer `resolvedGameId` (single source of truth).
    // This block is kept for solo compatibility BUT WILL PROBABLY BE REMOVED.
    let gid = Array.isArray(gameId) ? gameId[0] : gameId;
    if (!gid) {
      const raw = await AsyncStorage.getItem('currentGamePlayers');
      if (raw) { try { gid = JSON.parse(raw)?.gameId; } catch {} }
    }

    console.log("👉 Inserting score:", {
      player_id: user.id,
      course_id: selectedCourse,
      game_id: gid ?? null,
      hole_number: selectedHole.hole_number,
      score,
      putts,
    });

    setLoading(true);
    try {
      // Use upsert so the same hole can be edited
      await handleEnter();
    } catch (err: any) {
      console.error("Unexpected error:", err);
      showMessage(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- INIT & DATA FETCH -------------------------
  // Only test Supabase connection; no location fetching here
  const initializeApp = async () => {
    try {
      setLoading(true);
      setConnectionError(null);

      // Supabase connection
      const connectionTest = await Promise.race([
        testSupabaseConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 10000)
        ),
      ]);
      if (!connectionTest) throw new Error("Supabase connection failed.");
    } catch (error: any) {
      setConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("🧭 Initializing location services on mount...");
    initializeApp();
  }, []);

  // Load previously saved location from AsyncStorage on mount
  useEffect(() => {
    const loadSavedLocation = async () => {
      try {
        const raw = await AsyncStorage.getItem("lastKnownLocation");
        if (raw) {
          const coords = JSON.parse(raw);
          setLocation({ coords, timestamp: Date.now() } as Location.LocationObject);
          setRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
          console.log("📍 Loaded saved location:", coords);
        } else {
          console.log("⚠️ No saved location found in storage");
        }
      } catch (e) {
        console.error("❌ Failed to load saved location:", e);
      }
    };
    loadSavedLocation();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from("GolfCourses")
        .select("*")
        .order("name");
      if (error) throw error;
      setCourses(data || []);
      setCourseItems([
        ...(data || []).map((course) => ({
          label: course.name,
          value: course.id,
        })),
        { label: "Add a course", value: "add_course" },
      ]);
    } catch (error: any) {
      setConnectionError(`Course fetch error: ${error.message}`);
    }
  };

  const fetchHoles = async () => {
    if (!selectedCourse) return;
    try {
      const { data, error } = await supabase
        .from("holes")
        .select("*")
        .eq("course_id", selectedCourse)
        .order("hole_number");
      if (error) throw error;
      setHoles(data || []);
      setHoleItems(
        (data || []).map((hole) => ({
          label: `Hole ${hole.hole_number}`,
          value: hole.hole_number,
        }))
      );
      // Pars just loaded/changed -> recompute toPar
      refreshScoreboardRef.current?.();
    } catch (error: any) {
      setConnectionError(`Hole fetch error: ${error.message}`);
    }
  };

  // Add course
  const handleConfirmAddCourse = async () => {
    try {
      setLoading(true);
      // Insert new course into Supabase (other columns will default to null)
      const { data, error } = await supabase
        .from("GolfCourses")
        .insert({ name: newCourseName, par_values: Array(18).fill(0) })
        .select();
      if (error) throw error;
      const added = data![0];

      // Update local courses list and dropdown items
      safeSetState(setCourses, (prev: Course[]) => [...prev, added]);
      safeSetState(setCourseItems, (prev: any[]) => [
        ...prev.filter((item) => item.value !== "add_course"),
        { label: added.name, value: added.id },
        { label: "Add a course", value: "add_course" },
      ]);

      // Select the new course & prepare placeholder holes
      safeSetState(setSelectedCourse, added.id);
      safeSetState(setSelectedHoleNumber, null);

      // insert 18 empty holes into DB using the new course ID
      const { data: newHoles, error: holesError } = await supabase
        .from("holes")
        .insert(
          Array.from({ length: 18 }, (_, i) => ({
            course_id: added.id,
            hole_number: i + 1,
          }))
        )
        .select();
      if (holesError) throw holesError;

      // update local holes and holeItems
      safeSetState(setHoles, newHoles || []);
      safeSetState(
        setHoleItems,
        (newHoles || []).map((h) => ({
          label: `Hole ${h.hole_number}`,
          value: h.hole_number,
        }))
      );
    } catch (error: any) {
      setConnectionError(`Add course error: ${error.message}`);
    } finally {
      setLoading(false);
      setShowAddCourseModal(false);
      setNewCourseName("");
    }
  };

  // ------------------- NEW HANDLERS FOR TEE/FAIRWAY/GREEN -------------------------
  const handleAddTeeBox = async () => {
    const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);
    if (!selectedHole) return;
    setLoading(true);
    try {
      // fetch fresh location
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const { error } = await supabase
        .from("holes")
        .update({
          tee_latitude: current.coords.latitude,
          tee_longitude: current.coords.longitude,
        })
        .eq("id", selectedHole.id);
      if (error) throw error;
      await fetchHoles(); // refetch so UI + DB stay in sync
    } catch (err: any) {
      setConnectionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFairwayTarget = async () => {
    const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);
    if (!selectedHole) return;
    setLoading(true);
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const { error } = await supabase
        .from("holes")
        .update({
          fairway_latitude: current.coords.latitude,
          fairway_longitude: current.coords.longitude,
        })
        .eq("id", selectedHole.id);
      if (error) throw error;
      await fetchHoles();
    } catch (err: any) {
      setConnectionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddGreen = async () => {
    const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);
    if (!selectedHole) return;
    setLoading(true);
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const { error } = await supabase
        .from("holes")
        .update({
          green_latitude: current.coords.latitude,
          green_longitude: current.coords.longitude,
        })
        .eq("id", selectedHole.id);
      if (error) throw error;
      await fetchHoles();
    } catch (err: any) {
      setConnectionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  //------------------------USE STATE HOOKS---------------------------
  //------------------------SYNC URL → STATE---------------------------
  // whenever someone navigates here with ?courseId=XXX, select it
  useEffect(() => {
    if (courseId && courseId !== selectedCourse) {
      setSelectedCourse(courseId);
      setSelectedHoleNumber(null);
    }
  }, [courseId]);

  // Fetch courses when the component is mounted and connection is good
  useEffect(() => {
    if (!connectionError) fetchCourses();
  }, [connectionError]);

  // Fetch holes when a course is selected
  useEffect(() => {
    if (selectedCourse)
      switchingCourseRef.current = true;
      fetchHoles();
  }, [selectedCourse]);

  // --- Live Friend Location Subscription ---
  useEffect(() => {
    if (!selectedCourse) return;

    const loadFriends = async () => {
      const { data } = await supabase
        .from("friend_locations")
        .select("*")
        .eq("course_id", selectedCourse);
      if (data) {
        const enriched: FriendLocation[] = [];
        const rows = data as any[];
        for (const row of rows) {
          const uid: string = row.user_id;
          let prof = profileCache.get(uid);
          if (!prof) {
            const { data: fetched } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", uid)
              .single();
            prof = {
              full_name: fetched?.full_name ?? "Friend",
              avatar_url: fetched?.avatar_url ?? null,
            };
            profileCache.set(uid, prof);
          }
          enriched.push({
            user_id: uid,
            course_id: row.course_id ?? null,
            hole_number: row.hole_number ?? null,
            latitude: row.latitude,
            longitude: row.longitude,
            updated_at: row.updated_at,
            name: prof.full_name,
            avatar_url: prof.avatar_url,
          });
        }
        setFriendLocations(enriched);
      }
    };
    loadFriends();

    const channel = supabase
      .channel("friend_locations_channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_locations" },
        async (payload) => {
          const row: any = payload.new;
          const uid: string = row.user_id;
          let prof = profileCache.get(uid);
          if (!prof) {
            const { data: fetched } = await supabase
              .from("profiles")
              .select("full_name, avatar_url")
              .eq("id", uid)
              .single();
            prof = {
              full_name: fetched?.full_name ?? "Friend",
              avatar_url: fetched?.avatar_url ?? null,
            };
            profileCache.set(uid, prof);
          }

          const enriched: FriendLocation = {
            user_id: uid,
            course_id: row.course_id ?? null,
            hole_number: row.hole_number ?? null,
            latitude: row.latitude,
            longitude: row.longitude,
            updated_at: row.updated_at,
            name: prof.full_name,
            avatar_url: prof.avatar_url,
          };

          setFriendLocations((prev) => {
            const without = prev.filter((f) => f.user_id !== enriched.user_id);
            return [...without, enriched];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCourse]);

  const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);

  useEffect(() => {
    if (holes.length > 0 && selectedHoleNumber === null) {
      setSelectedHoleNumber(holes[0].hole_number);
    }
  }, [holes]);

  useEffect(() => {
    if (!MapLoaded || !mapRef.current || !selectedCourse) return;

    // Only run immediately after a course is selected (you raise the cover there)
    if (!switchingCourseRef.current) return;

    // Prefer Hole 1; fall back to first hole available
    const hole1 = holes.find(h => h.hole_number === 1) || holes[0];
    if (!hole1) return;

    const hasTee   = hole1.tee_latitude  != null && hole1.tee_longitude  != null;
    const hasGreen = hole1.green_latitude!= null && hole1.green_longitude!= null;

    // Make sure Hole 1 is selected; if not, select it and wait for next run
    if (selectedHoleNumber !== hole1.hole_number) {
      setSelectedHoleNumber(hole1.hole_number);
      return;
    }

    // If no coords yet, just drop the cover and bail
    if (!hasTee || !hasGreen) {
      Animated.timing(transitionOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => { switchingCourseRef.current = false; });
      return;
    }

    // Avoid double-running for the same course
    if (lastFlewCourseRef.current === selectedCourse) return;

    // Defer until markers are on screen, then fly and reveal
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        orientedFlyToHole(mapRef, hole1, 900);
        Animated.timing(transitionOpacity, {
          toValue: 0,      // reveal during the flight
          duration: 900,
          useNativeDriver: true,
        }).start(() => {
          switchingCourseRef.current = false;
          lastFlewCourseRef.current = selectedCourse;
        });
      });
    });
  }, [MapLoaded, selectedCourse, holes, selectedHoleNumber]);

  // Hole change → fit + rotate tee→green (our addition)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !selectedHole) return;

    if (switchingCourseRef.current) return;

    const hasTee =
      selectedHole.tee_latitude != null && selectedHole.tee_longitude != null;
    const hasGreen =
      selectedHole.green_latitude != null && selectedHole.green_longitude != null;

    if (!hasTee || !hasGreen) return; // wait until pins are there

    orientedFlyToHole(mapRef, selectedHole, 900);
    Animated.timing(new Animated.Value(0), {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(() => {
      setTriggerBannerUpdate((v) => v + 1);
    });
  }, [
    mapReady,
    selectedHole?.id,
    selectedHole?.tee_latitude,
    selectedHole?.tee_longitude,
    selectedHole?.green_latitude,
    selectedHole?.green_longitude,
  ]);

  // Clear dropped pins when a new hole is selected
  useEffect(() => {
    setDroppedPins([]);
  }, [selectedHoleNumber]);

  // Calculate and set teeFairwayY and fairwayGreenY based on screen midpoints
  useEffect(() => {
    const updateYPositions = async () => {
      if (!mapRef.current || !selectedHole) {
        console.log("Map or selected hole not ready");
        return;
      }

      console.log("MapLoaded:", MapLoaded);
      console.log("Tee → Fairway lat/lon:", selectedHole?.tee_latitude, selectedHole?.fairway_latitude);
      console.log("Fairway → Green lat/lon:", selectedHole?.fairway_latitude, selectedHole?.green_latitude);

      if (
        selectedHole.tee_latitude != null &&
        selectedHole.tee_longitude != null &&
        selectedHole.fairway_latitude != null &&
        selectedHole.fairway_longitude != null
      ) {
        const mid = {
          latitude: (selectedHole.tee_latitude + selectedHole.fairway_latitude) / 2,
          longitude: (selectedHole.tee_longitude + selectedHole.fairway_longitude) / 2,
        };

        setTimeout(async () => {
          const point = await mapRef.current!.pointForCoordinate(mid);
          console.log("Tee→Fairway screen point:", point);
          setTeeFairwayY(point.y - 20);
        }, 300);
      }

      if (
        selectedHole.green_latitude != null &&
        selectedHole.green_longitude != null &&
        selectedHole.fairway_latitude != null &&
        selectedHole.fairway_longitude != null
      ) {
        const mid = {
          latitude: (selectedHole.green_latitude + selectedHole.fairway_latitude) / 2,
          longitude: (selectedHole.green_longitude + selectedHole.fairway_longitude) / 2,
        };

        setTimeout(async () => {
          const point = await mapRef.current!.pointForCoordinate(mid);
          console.log("Fairway→Green screen point:", point);
          setFairwayGreenY(point.y - 20);
        }, 300);
      }
    };

    updateYPositions();
  }, [
    selectedHole?.tee_latitude,
    selectedHole?.tee_longitude,
    selectedHole?.fairway_latitude,
    selectedHole?.fairway_longitude,
    selectedHole?.green_latitude,
    selectedHole?.green_longitude,
    MapLoaded,
    triggerBannerUpdate, // ← ensure banners update after hole is loaded
  ]);

  // Dropping pins around course function to show shots according to players position
  const handleDropPin = async () => {
    if (!location) return;

    const newPin = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    setDroppedPins((prevPins) => [...prevPins, newPin]);
  };

  // Calculate distance to pin using haversine
  useEffect(() => {
    let calculatedDistance: number | null = null;

    const userCoords = location
      ? { lat: location.coords.latitude, lon: location.coords.longitude }
      : null;

    let targetCoords: { lat: number; lon: number } | null = null;

    if (droppedPins.length > 0) {
      const lastPin = droppedPins[droppedPins.length - 1];
      targetCoords = { lat: lastPin.latitude, lon: lastPin.longitude };
    } else if (selectedHole?.green_latitude && selectedHole?.green_longitude) {
      targetCoords = {
        lat: selectedHole.green_latitude,
        lon: selectedHole.green_longitude,
      };
    }

    if (userCoords && targetCoords) {
      calculatedDistance = haversine(userCoords, targetCoords);
    }

    setDistanceToPin(calculatedDistance);
  }, [location, selectedHole, droppedPins]);

  // Build a map for quick par lookup (use holes first, then course.par_values)
  const courseParArray = React.useMemo(
    () => courses.find(c => c.id === selectedCourse)?.par_values ?? null,
    [courses, selectedCourse]
  );

  const parByHole = React.useMemo(() => {
    const m = new Map<number, number>();
    for (const h of holes) {
      if (h.par != null) m.set(h.hole_number, h.par);
    }
    if (courseParArray && courseParArray.length) {
      for (let i = 0; i < courseParArray.length; i++) {
        const holeNo = i + 1;
        const par = courseParArray[i];
        if (!m.has(holeNo) && typeof par === 'number') m.set(holeNo, par);
      }
    }
    return m;
  }, [holes, courseParArray]);
// ============================================================================
// SCOREBOARD REFRESH (BOTTOM OVERLAY)
// ----------------------------------------------------------------------------
// Source of truth:
// - Multiplayer: participant IDs come from `game_participantsv2` for `resolvedGameId`
// - Solo: participant IDs fall back to the signed-in user
//
// Fetch strategy:
// - Reads `scores` for either:
//   - game_id = resolvedGameId (multiplayer)
//   - course_id = selectedCourse AND game_id IS NULL (solo)
// - Ignores team rows for this path (team_id IS NULL)
//
// Why DB participants (not `players[]` state):
// - `players[]` hydrates asynchronously from profiles and can be briefly empty.
// - Using DB participants removes invitee/host race conditions and stale closures.
// ============================================================================
// Fetch and compute scoreboard (today, for selected course)
const refreshScoreboard = React.useCallback(async () => {
    if (!selectedCourse) return;

    // Use resolvedGameId instead of re-resolving
    const gid = resolvedGameId;

    // If we're in a multiplayer flow but gid hasn't resolved yet, wait.
    if ((gameId || resolvedGameId) && !gid) {
      console.log("⏳ [CourseView] Waiting for resolvedGameId before building scoreboard");
      return;
    }

    // Resolve baseIds (authoritative: DB participants for multiplayer)
    let baseIds: string[] = [];

        // Multiplayer: always derive participant IDs from DB (invitee-safe).
    if (gid) {
      const { data: parts, error: partErr } = await supabase
        .from('game_participantsv2')
        .select('user_id')
        .eq('game_id', gid)
        .eq('status', 'accepted');

      if (partErr) {
        console.warn('❌ [CourseView] failed to load game participants for scoreboard', partErr);
        return;
      }

      baseIds = (parts || []).map((p: any) => p.user_id).filter(Boolean);

      if (baseIds.length === 0) {
        console.warn('⏳ [CourseView] no participants found for game', gid);
        return;
      }
    } else if (user?.id) {
      // Solo play fallback
      baseIds = [user.id];
    }

    // Fetch scores (SOLO-aligned: player rows only; same uniqueness as modal)
    // - If gid exists: only rows for that game_id
    // - Else: only course_id rows from today with game_id null
    // - Always ignore team rows (team_id must be null)
    let rows: { player_id: string; hole_number: number; score: number | null; putts: number | null }[] = [];
    try {
      let q = supabase
        .from('scores')
        .select('player_id, hole_number, score, putts, game_id, course_id, team_id, inserted_at')
        .is('team_id', null)
        .not('player_id', 'is', null);

      if (gid) {
        q = q.eq('game_id', gid);
      } else {
        q = q
          .eq('course_id', selectedCourse)
          .is('game_id', null);
      }

      if (baseIds.length > 0) {
        q = q.in('player_id', baseIds);
      }

      const { data, error } = await q;
      if (error) throw error;

      rows = (data || []).map((r: any) => ({
        player_id: String(r.player_id),
        hole_number: Number(r.hole_number),
        score: r.score ?? null,
        putts: r.putts ?? null,
      }));
    } catch (e) {
      console.warn('Scoreboard fetch error:', e);
    }

    // Build per-player per-hole map (SOLO only)
    const rowsByPlayer = new Map<string, Map<number, number>>();
    for (const r of rows) {
      if (r.score == null) continue;
      if (!r.player_id) continue;
      if (!rowsByPlayer.has(r.player_id)) rowsByPlayer.set(r.player_id, new Map());
      rowsByPlayer.get(r.player_id)!.set(r.hole_number, r.score);
    }

    const items = baseIds.map(pid => {
      const holeMap = rowsByPlayer.get(pid) ?? new Map<number, number>();
      let strokes = 0;
      let parSum = 0;
      let holesPlayed = 0;
      let holesWithPar = 0;

      for (const [holeNo, sc] of holeMap.entries()) {
        // Always count strokes/holes for any entered score
        strokes += sc;
        holesPlayed++;

        const par = parByHole.get(holeNo);
        if (Number.isFinite(par)) {
          parSum += par!;
          holesWithPar++;
        }
      }

      return {
        team_id: null,
        player_id: pid,
        name: 'Unknown',
        avatar_url: null,
        strokes,
        // Only compute toPar when we have par info; otherwise keep it neutral
        toPar: holesWithPar ? strokes - parSum : 0,
        holesPlayed,
      };
    });

    // Profiles
    if (baseIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', baseIds.filter(Boolean));
      const profMap = new Map((profiles || []).map((p: any) => [p.id, { name: p.full_name ?? 'Unknown', avatar_url: p.avatar_url }]));
      for (const item of items) {
        const p = profMap.get(item.player_id);
        if (p) { item.name = p.name; item.avatar_url = p.avatar_url ?? null; }
      }
    }

    items.sort((a, b) => a.toPar - b.toPar || b.holesPlayed - a.holesPlayed);
    setScoreboard(items);
  }, [selectedCourse, parByHole, playerIds, resolvedGameId, user?.id, gameId]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('sbScalePct');
        const n = raw ? parseInt(raw, 10) : NaN;
        if (!Number.isNaN(n) && n >= 60 && n <= 180) setSbScalePct(n);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('sbScalePct', String(sbScalePct)).catch(() => {});
  }, [sbScalePct]);

    // ---- Refresh triggers ----
  // We refresh on screen focus and tab presses so CourseView stays in sync with
  // Scorecard.tsx and realtime score updates.
  useFocusEffect(React.useCallback(() => { refreshScoreboard(); }, [refreshScoreboard]));
  useEffect(() => {
    const unsub = navigation.addListener('tabPress', () => { refreshScoreboard(); });
    return unsub;
  }, [navigation, refreshScoreboard]);

   // ---- Realtime score subscription ----
  // Subscribes to `scores` changes for:
  // - game_id = resolvedGameId (multiplayer)
  // - otherwise course_id = selectedCourse (solo)
  // Uses refreshScoreboardRef to avoid stale closures.
  useEffect(() => {
    let active = true;
    (async () => {
      const gid = resolvedGameId;
      if (!active || !selectedCourse) return;
      const channel = supabase
        .channel(`scores_live_${gid ?? selectedCourse}`)
        .on(
          "postgres_changes",
          gid
            ? { event: "*", schema: "public", table: "scores", filter: `game_id=eq.${gid}` }
            : { event: "*", schema: "public", table: "scores", filter: `course_id=eq.${selectedCourse}` },
          () => {
            console.log("🔁 [CourseView] score change detected → refreshing scoreboard");
            refreshScoreboardRef.current?.();
          }
        )
        .subscribe();
      return () => supabase.removeChannel(channel);
    })();
    return () => { active = false; };
  }, [selectedCourse, resolvedGameId, refreshScoreboard]);

  // Ensure initialization on mount
  useFocusEffect(
    React.useCallback(() => {
      refreshScoreboard();
    }, [refreshScoreboard])
  );

  // 🔄 Always refresh scoreboard whenever CourseView becomes active.
  // This ensures score changes from scorecard.tsx instantly update CourseView totals.
  useFocusEffect(
    React.useCallback(() => {
      console.log("🔄 CourseView focused → forcing scoreboard refresh");
      refreshScoreboardRef.current?.(); // always run the latest version
    }, [])
  );

  // Keep the callable ref updated
  useEffect(() => {
    refreshScoreboardRef.current = () => { refreshScoreboard(); };
  }, [refreshScoreboard]);

  // When multiplayer context resolves (game + course), refresh the scoreboard
  useEffect(() => {
    if (!selectedCourse) return;
    if (!resolvedGameId && gameId) return;
    refreshScoreboardRef.current?.();
  }, [selectedCourse, resolvedGameId, gameId]);

  // If pars load/change later, recompute toPar
  useEffect(() => {
    refreshScoreboardRef.current?.();
  }, [parByHole]);
  useEffect(() => {
    const unsub = navigation.addListener('tabPress', () => {
      refreshScoreboard();
    });
    return unsub;
  }, [navigation, refreshScoreboard]);

  useEffect(() => {
    refreshScoreboard();
  }, [selectedCourse, playerIds, refreshScoreboard]);
  
  // Reset initial nav when course changes so we can fly again
  useEffect(() => {
    didInitialNavRef.current = false;
  }, [selectedCourse]);

  //Call on startup to get location + region
  useEffect(() => {
    initializeApp();
  }, []);
  
  // Initial auto navigation: if course selected → Hole 1; else user location
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (didInitialNavRef.current) return;

    if (selectedCourse) {
      if (!holes.length) return; // wait for holes
      const hole1 = holes.find(h => h.hole_number === 1) || holes[0];
      if (!hole1) return;

      // Ensure Hole 1 is selected first
      if (selectedHoleNumber !== hole1.hole_number) {
        setSelectedHoleNumber(hole1.hole_number);
        return; // re-run after selection
      }

      // Just center on the hole (no tee/green requirement)
      centerOnHole(hole1, 750);
      didInitialNavRef.current = true;
      return;
    }

    // No course → user location
    if (!selectedCourse && location) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 700);
      didInitialNavRef.current = true;
    }
  }, [mapReady, selectedCourse, holes, selectedHoleNumber, location, topPadPx, bottomPadPx]);
  
  
  // Reset flag when course changes
  useEffect(() => {
    didInitialNavRef.current = false;
  }, [selectedCourse]);

  // Initial + when course/holes change
  useEffect(() => {
    const id = setInterval(() => refreshScoreboard(), 5000);
    return () => clearInterval(id);
  }, [refreshScoreboard]);

  // Realtime updates when scores change for this course
  useEffect(() => {
    if (!selectedCourse) return;
    const channel = supabase
      .channel(`scores_live_${selectedCourse}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `course_id=eq.${selectedCourse}` },
        () => refreshScoreboard()
      )
      .subscribe();
  
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCourse, refreshScoreboard]);
  // ------------------- Save hole data to Supabase (helper for modal flow) -------------------------
  const saveHoleDataToSupabase = async (data = holeEntryData) => {
    const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);
    if (!selectedHole) return;

    const { par, yardage, tee, fairway, green } = data as {
      par: number | null;
      yardage: number | null;
      tee: LatLng | null;
      fairway: LatLng | null;
      green: LatLng | null;
    };
    // Log tee data before update
    console.log("Saving tee data:", tee);
    // Ensure all keys match exact lowercase column names in Supabase
    const { error } = await supabase
      .from("holes")
      .update({
        par: par,
        yardage: yardage,
        tee_latitude: tee?.latitude,
        tee_longitude: tee?.longitude,
        fairway_latitude: fairway?.latitude,
        fairway_longitude: fairway?.longitude,
        green_latitude: green?.latitude,
        green_longitude: green?.longitude,
      })
      .eq("id", selectedHole.id);
    if (error) {
      setStepPromptMessage("Error: " + error.message);
      setShowStepConfirm(false);
      setTimeout(() => setStepPromptMessage(null), 2000);
    } else {
      setStepPromptMessage("Saved!\nHole data saved.");
      setShowStepConfirm(false);
      setTimeout(() => setStepPromptMessage(null), 1200);
      await fetchHoles(); // refresh
      // After fetching holes, zoom/refresh map to show the new hole if tee and green exist
      if (mapRef.current && tee && green) {
        const yardageVal = typeof yardage === "number" ? yardage : 0;
        const heading = bearingDeg(tee, green);
        const t = 0.5;
        const mid = {
          latitude: tee.latitude + (green.latitude - tee.latitude) * t,
          longitude: tee.longitude + (green.longitude - tee.longitude) * t,
        };
        const center = nudgeAlongHeading(mid, heading, 20);
        if (Platform.OS === "ios") {
          let altitude = Math.max(200, Math.min(1000, yardageVal * 0.9 + 160));
          mapRef.current.animateCamera(
            { center, heading, pitch: 40, altitude },
            { duration: 900 }
          );
        } else {
          let zoom = 18.6 - Math.log2(Math.max(60, yardageVal) / 150);
          zoom = Math.max(16.2, Math.min(19, zoom));
          mapRef.current.animateCamera(
            { center, heading, pitch: 40, zoom },
            { duration: 900 }
          );
        }
      }
      // --- NEW: sync par into GolfCourses.par_values (18-int array) ---
      try {
        console.log('Updating course:', selectedCourse, 'hole', selectedHole?.hole_number, 'par', par);
        // Only attempt when we have a valid par and the selected hole number
        if (typeof par === 'number' && selectedHole?.hole_number && selectedCourse) {
          // Fetch the latest par_values for this course (fallback to 18 zeros)
          const { data: courseRow } = await supabase
            .from('GolfCourses')
            .select('par_values')
            .eq('id', selectedCourse)
            .single();

          let current: number[] = Array.isArray(courseRow?.par_values)
            ? [...courseRow!.par_values]
            : Array(18).fill(0);

          // Ensure length 18
          if (current.length !== 18) current = Array(18).fill(0).map((v, i) => current[i] ?? 0);

          const idx = Math.max(0, Math.min(17, selectedHole.hole_number - 1));
          current[idx] = par;

          console.log("🧩 Calling update_par_value with:", {
            course_id: selectedCourse,
            hole_index: idx,
            new_par: par
          });

          const { error: upErr } = await supabase.rpc('update_par_value', {
            course_id: selectedCourse,
            hole_index: idx,
            new_par: par
          });

          if (!upErr) {
            // keep local state in sync so UI reflects immediately
            setCourses(prev => prev.map(c => c.id === selectedCourse ? { ...c, par_values: current } as any : c));
          } else {
            console.warn('Failed to update par_values on course:', upErr);
          }
        }
      } catch (syncErr) {
        console.warn('par_values sync error:', syncErr);
      }
      // --- END NEW ---
    }
    setHoleEntryStep(0);
    setEntryPromptVisible(false);
  };

  // ---- Scramble teams loaded from AsyncStorage ----
  const [scrambleTeams, setScrambleTeams] = useState<any[] | null>(null);

  useEffect(() => {
    const loadTeams = async () => {
      try {
        const saved = await AsyncStorage.getItem("scrambleTeams");
        if (saved) {
          setScrambleTeams(JSON.parse(saved));
        }
      } catch (e) {
        console.warn("Failed to load scrambleTeams", e);
      }
    };
    loadTeams();
  }, []);

  // Fetch scramble teams from Supabase when gameId changes
  useEffect(() => {
    const loadTeamsFromDB = async () => {
      try {
        let gid = Array.isArray(gameId) ? gameId[0] : gameId;
        if (!gid) {
          const raw = await AsyncStorage.getItem("currentGamePlayers");
          if (raw) {
            try { gid = JSON.parse(raw)?.gameId; } catch {}
          }
        }
        if (!gid) return;

        const { data, error } = await supabase
          .from("game_teams")
          .select("*")
          .eq("game_id", gid)
          .order("team_number");

        if (!error && data) {
          const formatted = data.map(t => ({
            id: t.id,
            team_id: t.id,
            team_number: t.team_number,
            name: t.name,
           players: Array.isArray(t.players)
            ? (t.players.filter((p: any): p is string => typeof p === "string") as string[])
            : []
          }));
          setScrambleTeams(formatted);
        }
      } catch (err) {
        console.warn("Failed to load teams from DB:", err);
      }
    };

    loadTeamsFromDB();
  }, [gameId]);

    // Decide if this screen should behave in scramble mode
  const isScrambleMode = React.useMemo(() => {
    // If the route has a teams param, this is definitely scramble
    if (teams) {
      try {
        const raw = Array.isArray(teams) ? teams[0] : teams;
        const parsed = JSON.parse(String(raw));
        if (Array.isArray(parsed) && parsed.length > 0) return true;
      } catch {
        // Non-JSON but present → still treat as scramble
        return true;
      }
    }

    // Fallback: if we actually loaded teams with players
    if (scrambleTeams && Array.isArray(scrambleTeams)) {
      return scrambleTeams.some(
        (t: any) => Array.isArray(t.players) && t.players.length > 0
      );
    }

    return false;
  }, [teams, scrambleTeams]);

  useEffect(() => {
  if (!isScrambleMode && scrambleTeams && scrambleTeams.length > 0) {
    console.log("🧹 Clearing stale scrambleTeams (stroke play)");
    setScrambleTeams(null);
  }
}, [isScrambleMode]);

    const showTeamScoreboard =
  isScrambleMode === true &&
  scrambleTeams != null &&
  Array.isArray(scrambleTeams) &&
  scrambleTeams.some(
    (t: any) => Array.isArray(t.players) && t.players.length > 0
  );

  // ------------------- COURSE VIEW UI -------------------------
  return (
    <View style={S.container}>
      <Modal visible={showAddCourseModal} transparent animationType="slide">
        <View style={S.modalContainer}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>Add New Course</Text>
            <TextInput
              style={S.modalInput}
              placeholder="Course name"
              value={newCourseName}
              onChangeText={setNewCourseName}
            />
            <View style={S.modalButtons}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowAddCourseModal(false);
                  setNewCourseName("");
                }}
              />
              <Button
                title="Add"
                onPress={handleConfirmAddCourse}
                disabled={!newCourseName.trim()}
              />
            </View>
          </View>
        </View>
      </Modal>
      {/* Top overlay (course + hole dropdowns). We measure its height to set map top padding */}
      <View
        style={[S.overlayContainer, { paddingTop: insets.top }]}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout;
          setTopPadPx(Math.max(0, y + height + 8));
        }}
      >
        <View style={{ alignItems: "center", justifyContent: "center", width: "100%" }}>
          <View style={S.bannerContainer}>
            {/* EDIT HERE and change the entire pressable below*/}
            <Pressable
              onPress={() => {
                const currentIdx = holes.findIndex(h => h.hole_number === selectedHoleNumber);
                const prev = holes[currentIdx - 1];
                if (prev) setSelectedHoleNumber(prev.hole_number);
              }}
              style={({ pressed }) => [S.arrowButton, pressed && S.arrowButtonPressed]}
              disabled={holes.findIndex(h => h.hole_number === selectedHoleNumber) <= 0}
            >
              {holes.findIndex(h => h.hole_number === selectedHoleNumber) > 0 ? (
                <Text style={S.arrowText}>‹</Text>
              ) : (
                <Text style={[S.arrowText, { opacity: 0.2 }]}>‹</Text>
              )}
            </Pressable>

            {/* EDIT THIS IN IF YOU WANT TO HAVE A WRAP-AROUND NAVIGATION FOR HOLES, so at hole 1 you can go to the last hole

              <Pressable
              onPress={() => {
                const currentIdx = holes.findIndex(h => h.hole_number === selectedHoleNumber);
                const prev = holes[currentIdx - 1];
                if (prev) {
                  setSelectedHoleNumber(prev.hole_number);
                } else if (holes.length > 0) {
                  // wrap to last hole
                  setSelectedHoleNumber(holes[holes.length - 1].hole_number);
                }
              }}
              style={({ pressed }) => [S.arrowButton, pressed && S.arrowButtonPressed]}
              disabled={holes.length === 0}
            >
              <Text style={S.arrowText}>‹</Text>
            </Pressable>
            */}

            <View style={S.bannerTextContainer}>
              <Text style={S.bannerCourse}>
                {courses.find(c => c.id === selectedCourse)?.name ?? ""}
              </Text>
              {!!selectedHole && (
                <Text style={S.bannerInfo}>
                  Hole {selectedHole.hole_number}  •  Par {selectedHole.par ?? "--"}  •{" "}
                  {selectedHole.tee_latitude != null &&
                  selectedHole.tee_longitude != null &&
                  selectedHole.green_latitude != null &&
                  selectedHole.green_longitude != null
                    ? `${Math.round(
                        haversine(
                          {
                            lat: selectedHole.tee_latitude,
                            lon: selectedHole.tee_longitude,
                          },
                          {
                            lat: selectedHole.green_latitude,
                            lon: selectedHole.green_longitude,
                          }
                        )
                      )} m`
                    : "-- m"}
                </Text>
              )}
              {distanceToPin !== null && (
                <Text style={S.bannerInfo}>
                  Distance to Pin: {distanceToPin?.toFixed(0)} m
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => {
                const currentIdx = holes.findIndex(h => h.hole_number === selectedHoleNumber);
                const next = holes[currentIdx + 1];

                if (next) {
                  setSelectedHoleNumber(next.hole_number);
                  return;
                }

                // last hole → finish confirmation
                setStepPromptMessage("Finish round?\nThis will show the scorecard.");
                setShowStepConfirm(true);
                setStepPromptConfirm(() => async () => {
                  setShowStepConfirm(false);
                  setStepPromptMessage(null);

                  // Resolve gameId
                  let gid = Array.isArray(gameId) ? gameId[0] : gameId;
                  if (!gid) {
                    const raw = await AsyncStorage.getItem("currentGamePlayers");
                    if (raw) {
                      try { gid = JSON.parse(raw)?.gameId; } catch {}
                    }
                  }

                  // ✅ Mark round as completed
                  if (gid) {
                    const { error: roundErr } = await supabase
                      .from("golf_rounds")
                      .update({ status: "completed" })
                      .eq("id", gid);

                    if (roundErr) {
                      console.warn("Failed to mark round completed:", roundErr);
                    } else {
                      console.log("🏁 Round marked as completed:", gid);
                    }
                  }

                  // Stop sharing location
                  if (user?.id) {
                    const { error: flErr } = await supabase
                      .from("friend_locations")
                      .delete()
                      .eq("user_id", user.id);
                    if (flErr) {
                      console.warn("Error clearing friend location", flErr);
                    }
                  }

                  // Navigate to scorecard
                  if (selectedCourse) {
                    router.push({
                      pathname: "/(tabs)/scorecard",
                      params: {
                        gameId: gid ?? undefined,
                        courseId: selectedCourse,
                      },
                    });
                  } else {
                    showMessage("Missing course to show scorecard.");
                  }
                });
                setStepPromptCancel(() => () => {
                  setShowStepConfirm(false);
                  setStepPromptMessage(null);
                });
              }}
              style={({ pressed }) => [S.arrowButton, pressed && S.arrowButtonPressed]}
              disabled={holes.length === 0}
              accessibilityLabel={
                holes.findIndex(h => h.hole_number === selectedHoleNumber) < holes.length - 1
                  ? "Next hole"
                  : "Finish round"
              }
            >
              {holes.findIndex(h => h.hole_number === selectedHoleNumber) < holes.length - 1 ? (
                <Text style={S.arrowText}>›</Text>
              ) : (
                // same size as arrows to avoid layout shift
                <Text style={S.FinishText}>🏁</Text>
              )}
            </Pressable>
          </View>

        </View>
      </View>

      {/* Player score entry modal */}
      <Modal visible={scoreModalVisible} transparent animationType="fade">
        <View style={S.modalContainer}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>
              {activePlayer ? `Enter score for ${activePlayer.name}` : "Enter Score"}
            </Text>

            <View style={S.statControl}>
              <Text style={S.statLabel}>Score</Text>
              <Pressable onPress={() => setTempScore((s) => s + 1)} style={S.button}>
                <Text style={S.buttonText}>＋</Text>
              </Pressable>
              <Text style={S.statValue}>{tempScore}</Text>
              <Pressable onPress={() => setTempScore((s) => Math.max(0, s - 1))} style={S.button}>
                <Text style={S.buttonText}>－</Text>
              </Pressable>
            </View>

            <View style={S.statControl}>
              <Text style={S.statLabel}>Putts</Text>
              <Pressable onPress={() => setTempPutts((p) => p + 1)} style={S.button}>
                <Text style={S.buttonText}>＋</Text>
              </Pressable>
              <Text style={S.statValue}>{tempPutts}</Text>
              <Pressable onPress={() => setTempPutts((p) => Math.max(0, p - 1))} style={S.button}>
                <Text style={S.buttonText}>－</Text>
              </Pressable>
            </View>

            <View style={S.modalButtons}>
              <Button title="Cancel" onPress={() => setScoreModalVisible(false)} />
              <Button
                title="Enter"
                onPress={async () => {
                  if (!selectedHoleNumber) return;
                  const selectedHole = holes.find(h => h.hole_number === selectedHoleNumber);
                  if (!selectedHole) return;

                  // IMPORTANT: Always use resolvedGameId in multiplayer.
                  // If game_id is missing/null, inserts will hit the SOLO unique constraint
                  // (player_id, course_id, hole_number) and can throw duplicate key errors.
                  const gid = resolvedGameId ?? (Array.isArray(gameId) ? gameId[0] : gameId) ?? null;

                  let payload: any = {
                    course_id: selectedCourse!,
                    hole_number: selectedHole.hole_number,
                    score: tempScore,
                    putts: tempPutts,
                    created_by: user?.id ?? null,
                    game_id: gid ?? null,
                  };

                  // TEAM scoring
                  if (activeTeam) {
                    payload.team_id = activeTeam.team_id;
                    payload.player_id = null;
                  }
                  // PLAYER scoring
                  else if (activePlayer) {
                    payload.player_id = activePlayer.player_id;
                    payload.team_id = null;
                  }
                  else {
                    return;
                  }

                  // correct conflict rule depending on game or not
                  const onConflict = gid
                    ? (activeTeam
                        ? "team_id,game_id,hole_number"
                        : "player_id,game_id,hole_number")
                    : (activeTeam
                        ? "team_id,course_id,hole_number"
                        : "player_id,course_id,hole_number");
                  
                  console.log("SCORES PAYLOAD:", payload);

                  const { error } = await supabase
                    .from("scores")
                    .upsert([payload], { onConflict })
                    .select();
                    console.log("SCORES ERROR:", error);

                  if (error) {
                    showMessage(`Error saving score: ${error.message}`);
                    return;
                  }

                  await refreshScoreboardRef.current?.();
                  setScoreModalVisible(false);
                  setActiveTeam(null);
                  setActivePlayer(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <MapView
        provider={PROVIDER_GOOGLE}
        ref={mapRef}
        style={{ flex: 1 }}
        initialRegion={
          region || {
            latitude: -37.8136,
            longitude: 144.9631,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        }
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={false}
        mapType="hybrid"
        onMapReady={() => setMapReady(true)}
        onMapLoaded={() => setMapLoaded(true)}
        paddingAdjustmentBehavior="always"
        // NOTE: dynamic padding so holes always fit above/below UI
        mapPadding={{
          top: Math.max(topPadPx, 0),
          bottom: Math.max(bottomPadPx, 0),
          left: 16,
          right: 16,
        }}
        onDoublePress={(e) => {
          const coord = e.nativeEvent.coordinate;
          // Step 3: Place Tee Box
          if (holeEntryStep === 3) {
            setHoleEntryData(prev => ({ ...prev, tee: coord }));
            setHoleEntryStep(4);
            setStepPromptMessage("Place Fairway\nDouble-tap the fairway location on the map.");
            setShowStepConfirm(false);
            setTimeout(() => setStepPromptMessage(null), 1800);
          }
          // Step 4: Place Fairway
          else if (holeEntryStep === 4) {
            setHoleEntryData(prev => ({ ...prev, fairway: coord }));
            setHoleEntryStep(5);
            setStepPromptMessage("Place Green\nDouble-tap the green location on the map.");
            setShowStepConfirm(false);
            setTimeout(() => setStepPromptMessage(null), 1800);
          }
          // Step 5: Place Green
          else if (holeEntryStep === 5) {
            const latLng: LatLng = {
              latitude: coord.latitude,
              longitude: coord.longitude,
            };
            const updatedData = { ...holeEntryData, green: latLng };
            setHoleEntryData(updatedData);
            setHoleEntryStep(6);
            setStepPromptMessage(`Green Marker Set\nLat: ${latLng.latitude}, Lon: ${latLng.longitude}`);
            setShowStepConfirm(false);
            setTimeout(() => {
              setStepPromptMessage("Save this hole?");
              setShowStepConfirm(true);
              setStepPromptConfirm(() => () => {
                setStepPromptMessage(null);
                setShowStepConfirm(false);
                saveHoleDataToSupabase(updatedData);
              });
              setStepPromptCancel(() => () => {
                setStepPromptMessage(null);
                setShowStepConfirm(false);
                setHoleEntryStep(1);
              });
            }, 1200);
          }
        }}
      >
        {/* Friend Live Location Markers */}
        {friendLocations
          .filter((f) => f.user_id !== user?.id)
          .map((f) => (
          <Marker
            key={`friend-${f.user_id}`}
            coordinate={{
              latitude: f.latitude,
              longitude: f.longitude,
            }}
            title={f.name || "Friend"}
            description={`Hole ${f.hole_number ?? "?"}`}
          >
            <Image
              source={f.avatar_url ? { uri: f.avatar_url } : require("@/assets/images/defaultAvatar.png")}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: "white",
              }}
            />
          </Marker>
        ))}
        {selectedHole?.tee_latitude != null &&
          selectedHole?.tee_longitude != null && (
            <Marker
              coordinate={{
                latitude: selectedHole.tee_latitude,
                longitude: selectedHole.tee_longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              title={`Hole ${selectedHole.hole_number} Tee`}
            >
              <Image
                source={require("@/assets/images/TeePng.png")}
                style={{ width: 30, height: 30}}
                resizeMode="contain"
              />
            </Marker>
          )}

        {/* Green marker */}
        {selectedHole?.green_latitude != null &&
          selectedHole?.green_longitude != null && (
            <Marker
              coordinate={{
                latitude: selectedHole.green_latitude,
                longitude: selectedHole.green_longitude,
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              title={`Hole ${selectedHole.hole_number} Green`}
            >
              <Image  
                source={require("@/assets/images/FlagPng.png")}
                style={{ width: 30, height: 30 }}
                resizeMode="contain"
              />
            </Marker>
          )}

        {/* Fairway marker (draggable) */}
        {selectedHole?.tee_latitude != null &&
          selectedHole?.tee_longitude != null &&
          selectedHole?.green_latitude != null &&
          selectedHole?.green_longitude != null && (
            <Marker
              coordinate={{
                latitude:
                  selectedHole?.fairway_latitude ??
                  (selectedHole?.tee_latitude + selectedHole?.green_latitude) / 2,
                longitude:
                  selectedHole?.fairway_longitude ??
                  (selectedHole?.tee_longitude + selectedHole?.green_longitude) / 2,
              }}
              draggable
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                const updated = holes.map((h) =>
                  h.id === selectedHole?.id
                    ? { ...h, fairway_latitude: latitude, fairway_longitude: longitude }
                    : h
                );
                setHoles(updated);
              }}
              onDrag={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                const updated = holes.map((h) =>
                  h.id === selectedHole?.id
                    ? { ...h, fairway_latitude: latitude, fairway_longitude: longitude }
                    : h
                );
                setHoles(updated);
              }}
              anchor={{ x: 0.5, y: 0.5 }}
              title={`Hole ${selectedHole?.hole_number} Fairway`}
            >
              <Image
                source={require("@/assets/images/FTPng.png")}
                style={{ width: 30, height: 30 }}
                resizeMode="contain"
              />
            </Marker>
          )}

        {/* Tee → Fairway polyline */}
        {selectedHole?.tee_latitude != null &&
          selectedHole?.tee_longitude != null &&
          selectedHole?.fairway_latitude != null &&
          selectedHole?.fairway_longitude != null && (
            <Polyline
              coordinates={[
                {
                  latitude: selectedHole.tee_latitude,
                  longitude: selectedHole.tee_longitude,
                },
                {
                  ...nudgeAlongHeading(
                    { latitude: selectedHole.fairway_latitude, longitude: selectedHole.fairway_longitude },
                    bearingDeg(
                      { latitude: selectedHole.tee_latitude, longitude: selectedHole.tee_longitude },
                      { latitude: selectedHole.fairway_latitude, longitude: selectedHole.fairway_longitude }
                    ),
                    15
                  )
                },
              ]}
              strokeColor="#FFFFFF"
              strokeWidth={2}
              lineDashPattern={[6, 4]}
            />
          )}

        {/* Fairway → Green polyline */}
        {selectedHole?.fairway_latitude != null &&
          selectedHole?.fairway_longitude != null &&
          selectedHole?.green_latitude != null &&
          selectedHole?.green_longitude != null && (
            <Polyline
              coordinates={[
                {
                  ...nudgeAlongHeading(
                    { latitude: selectedHole.fairway_latitude, longitude: selectedHole.fairway_longitude },
                    bearingDeg(
                      { latitude: selectedHole.green_latitude, longitude: selectedHole.green_longitude },
                      { latitude: selectedHole.fairway_latitude, longitude: selectedHole.fairway_longitude }
                    ),
                    15
                  )
                },
                {
                  latitude: selectedHole.green_latitude,
                  longitude: selectedHole.green_longitude,
                },
              ]}
              strokeColor="#FFFFFF"
              strokeWidth={2}
              lineDashPattern={[6, 4]}
            />
          )}
        {/* Tee→(Fairway)→Green polyline */}
        {selectedHole?.tee_latitude != null &&
          selectedHole?.tee_longitude != null &&
          selectedHole?.green_latitude != null &&
          selectedHole?.green_longitude != null && (
            <Polyline
              coordinates={[
                {
                  latitude: selectedHole.tee_latitude,
                  longitude: selectedHole.tee_longitude,
                },
                ...(selectedHole.fairway_latitude != null &&
                selectedHole.fairway_longitude != null
                  ? [
                      {
                        latitude: selectedHole.fairway_latitude,
                        longitude: selectedHole.fairway_longitude,
                      },
                    ]
                  : []),
                {
                  latitude: selectedHole.green_latitude,
                  longitude: selectedHole.green_longitude,
                },
              ]}
              strokeColor="#FFFFFF"
              strokeWidth={2}
            />
          )}

        {/* Dropped pins and connecting lines (unchanged) */}
        {droppedPins.map((pin, index) => (
          <Marker
            key={`shot-${index}`}
            coordinate={pin}
            pinColor="orange"
            title={`Shot ${index + 1}`}
          />
        ))}

        {selectedHole && droppedPins.length >= 1 && (
          <Polyline
            coordinates={[
              {
                latitude: selectedHole.tee_latitude ?? 0,
                longitude: selectedHole.tee_longitude ?? 0,
              },
              droppedPins[0],
            ]}
            strokeColor="rgba(30, 144, 255, 0.5)"
            strokeWidth={2}
            lineDashPattern={[10, 5]}
          />
        )}

        {selectedHole &&
          droppedPins.length > 1 &&
          droppedPins.slice(1).map((pin, idx) => (
            <Polyline
              key={`line-${idx}`}
              coordinates={[droppedPins[idx], pin]}
              strokeColor="rgba(30, 144, 255, 0.5)"
              strokeWidth={2}
              lineDashPattern={[10, 5]}
            />
          ))}
      </MapView>

      {/* Distance banners for Tee→Fairway and Fairway→Green, anchored by screen Y of midpoint */}
      {/* {teeFairwayY != null && (
        <View style={[S.distanceBannerContainer, { top: teeFairwayY }]}>
          <View style={S.distanceBanner}>
            <Text style={S.distanceBannerText}>
              {selectedHole?.tee_latitude != null &&
              selectedHole?.tee_longitude != null &&
              selectedHole?.fairway_latitude != null &&
              selectedHole?.fairway_longitude != null
                ? Math.round(
                    haversine(
                      {
                        lat: selectedHole.tee_latitude,
                        lon: selectedHole.tee_longitude,
                      },
                      {
                        lat: selectedHole.fairway_latitude,
                        lon: selectedHole.fairway_longitude,
                      }
                    )
                  )
                : "--"}{" "}
              m
            </Text>
          </View>
        </View>
      )}
      {fairwayGreenY != null && (
        <View style={[S.distanceBannerContainer, { top: fairwayGreenY }]}>
          <View style={S.distanceBanner}>
            <Text style={S.distanceBannerText}>
              {selectedHole?.fairway_latitude != null &&
              selectedHole?.fairway_longitude != null &&
              selectedHole?.green_latitude != null &&
              selectedHole?.green_longitude != null
                ? Math.round(
                    haversine(
                      {
                        lat: selectedHole.fairway_latitude,
                        lon: selectedHole.fairway_longitude,
                      },
                      {
                        lat: selectedHole.green_latitude,
                        lon: selectedHole.green_longitude,
                      }
                    )
                  )
                : "--"}{" "}
              m
            </Text>
          </View>
        </View>
      )} */}

      {/* Distance banners for Tee→Fairway and Fairway→Green, positioned by map screen coords */}
      {teeFairwayY != null && (
        <View style={[S.distanceBannerContainer, { top: teeFairwayY, left: 10 }]}>
          <View style={S.distanceBanner}>
            <Text style={S.distanceBannerText}>
              {selectedHole?.tee_latitude != null &&
              selectedHole?.tee_longitude != null &&
              selectedHole?.fairway_latitude != null &&
              selectedHole?.fairway_longitude != null
                ? `${Math.round(
                    haversine(
                      {
                        lat: selectedHole.tee_latitude,
                        lon: selectedHole.tee_longitude,
                      },
                      {
                        lat: selectedHole.fairway_latitude,
                        lon: selectedHole.fairway_longitude,
                      }
                    )
                  )} m`
                : "--"}
            </Text>
          </View>
        </View>
      )}

      {fairwayGreenY != null && (
        <View style={[S.distanceBannerContainer, { top: fairwayGreenY, left: 10 }]}>
          <View style={S.distanceBanner}>
            <Text style={S.distanceBannerText}>
              {selectedHole?.fairway_latitude != null &&
              selectedHole?.fairway_longitude != null &&
              selectedHole?.green_latitude != null &&
              selectedHole?.green_longitude != null
                ? `${Math.round(
                    haversine(
                      {
                        lat: selectedHole.fairway_latitude,
                        lon: selectedHole.fairway_longitude,
                      },
                      {
                        lat: selectedHole.green_latitude,
                        lon: selectedHole.green_longitude,
                      }
                    )
                  )} m`
                : "--"}
            </Text>
          </View>
        </View>
      )}

      {/* Score overlay (hidden until opened from FAB) */}
      {!!selectedHole && scoreVisible && (
        <View
          style={[S.scoreOverlay, { zIndex: 2000 }]}
          // NOTE: measure overlay to compute bottom map padding
          onLayout={(e) => setScoreH(e.nativeEvent.layout.height)}
        >
          <View style={S.statControl}>
            <Text style={S.statLabel}>Score</Text>
            <Pressable onPress={() => setScore((s) => s + 1)} style={S.button}>
              <Text style={S.buttonText}>＋</Text>
            </Pressable>
            <Text style={S.statValue}>{score}</Text>
            <Pressable onPress={() => setScore((s) => Math.max(0, s - 1))} style={S.button}>
              <Text style={S.buttonText}>－</Text>
            </Pressable>
          </View>

          <View style={S.statControl}>
            <Text style={S.statLabel}>Putts</Text>
            <Pressable onPress={() => setPutts((p) => p + 1)} style={S.button}>
              <Text style={S.buttonText}>＋</Text>
            </Pressable>
            <Text style={S.statValue}>{putts}</Text>
            <Pressable onPress={() => setPutts((p) => Math.max(0, p - 1))} style={S.button}>
              <Text style={S.buttonText}>－</Text>
            </Pressable>
          </View>

          <Pressable
            style={S.enterButton}
            onPress={() => {
              // Reuse the modal-based enter flow
              setActivePlayer({
                team_id: null,
                player_id: user?.id ?? "",
                name: "You",
                avatar_url: null,
                strokes: 0,
                toPar: 0,
                holesPlayed: 0,
              });
              setTempScore(score);
              setTempPutts(putts);
              setScoreModalVisible(true);
            }}
          >
            <Text style={S.enterText}>Enter</Text>
          </Pressable>
        </View>
      )}


      {/* Drop Pin button removed per instructions; handleDropPin still available for internal use. */}

      {/* Action Buttons for New Holes */}
      {selectedHole &&
        !(
          selectedHole.par &&
          selectedHole.yardage &&
          selectedHole.tee_latitude &&
          selectedHole.tee_longitude &&
          selectedHole.fairway_latitude &&
          selectedHole.fairway_longitude &&
          selectedHole.green_latitude &&
          selectedHole.green_longitude
        ) && (
          <View
            style={S.actionButtonsContainer}
            // NOTE: measure action stack to compute bottom map padding
            onLayout={(e) => setActionsH(e.nativeEvent.layout.height)}
          >
            <Pressable
              onPress={() => {
                setHoleEntryStep(1);
                setInputValue("");
                setEntryPromptVisible(true);
              }}
              android_ripple={{ color: palette.secondary }}
              hitSlop={8}
              style={({ pressed }) => [
                S.actionButton,
                pressed && S.actionButtonPressed,
              ]}
            >
              <Text style={S.actionButtonText}>Enter Hole Info</Text>
            </Pressable>
          </View>
        )}

      {/* Modal for hole info entry */}
      <Modal visible={entryPromptVisible} transparent animationType="fade">
        <View style={S.modalContainer}>
          <View style={S.modalContent}>
            <Text style={S.modalTitle}>
              {holeEntryStep === 1 ? "Enter Par" : holeEntryStep === 2 ? "Enter Yardage" : ""}
            </Text>
            <TextInput
              style={S.modalInput}
              keyboardType="numeric"
              value={inputValue}
              onChangeText={setInputValue}
              placeholder="e.g. 3"
            />
            <View style={S.modalButtons}>
              <Button title="Cancel" onPress={() => {
                setHoleEntryStep(0);
                setEntryPromptVisible(false);
                setHoleEntryData({ par: null, yardage: null, green: null, fairway: null, tee: null });
              }} />
              <Button title="Next" onPress={() => {
                const val = parseInt(inputValue);
                if (isNaN(val)) {
                  setStepPromptMessage("Invalid number");
                  setShowStepConfirm(false);
                  setTimeout(() => setStepPromptMessage(null), 1200);
                  return;
                }
                if (holeEntryStep === 1) {
                  setHoleEntryData(prev => ({ ...prev, par: val }));
                  setInputValue("");
                  setHoleEntryStep(2);
                } else if (holeEntryStep === 2) {
                  setHoleEntryData(prev => ({ ...prev, yardage: val }));
                  setEntryPromptVisible(false);
                  setHoleEntryStep(3);
                  setStepPromptMessage("Place Tee\nDouble-tap the tee location on the map.");
                  setShowStepConfirm(false);
                  setTimeout(() => setStepPromptMessage(null), 1800);
                }
              }} />
            </View>
          </View>
        </View>
      </Modal>
      
     {/* Scoreboard moved to bottom of the screen */}
      {scoreboard.length > 0 && (
        <View
          style={[
            S.sbContainer,
            {
              position: "absolute",
              bottom: insets.bottom + 50,
              alignSelf: "center",
              width: `${Math.min(92, Math.max(50, Math.round(70 * sbScale)))}%`,
              minHeight: mul(70),
              zIndex: 4000,
              backgroundColor: palette.background,
              paddingVertical: mul(6),
              paddingBottom: insets.bottom - 20,
              borderRadius: mul(12),
            },
          ]}
        >
          <View style={S.sbGrid}>
            {showTeamScoreboard ? (
              scrambleTeams!
              .filter((team: any) => Array.isArray(team.players) && team.players.length > 0)
              .map((team: any, idx: number) => {
                const sbTeam = scoreboard.find((s: any) => s.team_id === team.team_id);

                const strokes = sbTeam?.strokes ?? 0;
                const toPar = sbTeam?.toPar ?? 0;
                const toParDisplay = toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;

                const members = (team.players || [])
                  .map((pid: string) => scoreboard.find((p: any) => p.player_id === pid))
                  .filter(Boolean) as any[];

                const combinedName = members
                  .map(m => (m.name || "").split(" ")[0])
                  .join(" & ");

                return (
                  <Pressable
                    key={`team-${idx}`}
                    style={S.sbTile}
                    onPress={() => {
                      setActiveTeam({
                        team_id: team.team_id,
                        name: combinedName,
                        players: members.map(m => m.player_id),
                      });
                      setTempScore(0);
                      setTempPutts(0);
                      setScoreModalVisible(true);
                    }}
                  >
                    <View style={{ flexDirection: "row" }}>
                      {members.slice(0, 2).map((m: any, i: number) =>
                        m.avatar_url ? (
                          <Image
                            key={i}
                            source={{ uri: m.avatar_url }}
                            style={[
                              S.sbAvatarCircleImg,
                              { marginLeft: i === 0 ? 0 : -12, borderWidth: 2, borderColor: "#111" },
                            ]}
                          />
                        ) : (
                          <View
                            key={i}
                            style={[
                              S.sbAvatarCircle,
                              { marginLeft: i === 0 ? 0 : -12, borderWidth: 2, borderColor: "#111" },
                            ]}
                          >
                            <Text style={S.sbAvatarCircleText}>
                              {(m.name || "").trim().slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                        )
                      )}
                    </View>

                    <Text style={S.sbPlayerName} numberOfLines={1}>
                      {combinedName || team.name || `Team ${idx + 1}`}
                    </Text>

                    <Text style={S.sbScoreText}>
                      {strokes} ({toParDisplay})
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              players.map((pl: PlayerRow) => {
                const sb = scoreboard.find(s => s.player_id === pl.id);

                const first = pl.name || "Player";
                const initials = first.slice(0, 1).toUpperCase();
                const total = sb?.strokes ?? 0;
                const toPar = sb?.toPar ?? 0;
                const toParDisplay =
                  toPar === 0 ? "E" : toPar > 0 ? `+${toPar}` : `${toPar}`;


                return (
                  <View key={pl.id} style={S.sbTile}>
                    <Pressable
                      onPress={() => {
                        if (!sb) return;
                        setActivePlayer(sb);
                        setTempScore(0);
                        setTempPutts(0);
                        setScoreModalVisible(true);
                      }}
                    >
                      {pl.avatar_url ? (
                        <Image source={{ uri: pl.avatar_url }} style={S.sbAvatarCircleImg} />
                      ) : (
                        <View style={S.sbAvatarCircle}>
                          <Text style={S.sbAvatarCircleText}>{initials}</Text>
                        </View>
                      )}
                    </Pressable>
                    <Text style={S.sbPlayerName} numberOfLines={1}>
                      {first}
                    </Text>
                    <Text style={S.sbScoreText}>
                      {total} ({toParDisplay})
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      )}
            
      {/* Small Find My Location button */}
      <Pressable
        onPressIn={() => setButtonPressed(true)}
        onPressOut={() => setButtonPressed(false)}
        onPress={async () => {
          try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== "granted") {
              console.warn("Permission to access location was denied");
              return;
            }
            const current = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            if (mapRef.current && current) {
              mapRef.current.animateToRegion({
                latitude: current.coords.latitude,
                longitude: current.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }
            setLocation(current); // ✅ update location state so blue dot refreshes
          } catch (e) {
            console.warn("Could not get current location", e);
          }
        }}
        style={{
          position: "absolute",
          bottom: insets.bottom + 50,
          left: 10,
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: buttonPressed ? palette.background : palette.background, // darker when pressed
          transform: [{ scale: buttonPressed ? 0.9 : 1 }], // scale effect
          alignItems: "center",
          justifyContent: "center",
          zIndex: 5000,
          elevation: 5,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 18 }}>📍</Text>
      </Pressable>


      {/* Step overlay for hole entry steps */}
      <StepOverlay
        visible={!!stepPromptMessage}
        message={stepPromptMessage || ""}
        onConfirm={stepPromptConfirm || undefined}
        onCancel={stepPromptCancel || undefined}
        confirmButtons={showStepConfirm}
      />

      {/* ---------- Fade overlay for hole transitions (our addition) ---------- */}
            <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: palette.background,
          opacity: transitionOpacity,
        }}
      />
    </View>  
  );        
}          

// ------------------- UI Styling -------------------------
// --- Merge scramble team info with scoreboard totals ---

const styles = (palette: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: palette.background },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: palette.background,
      paddingBottom: 20,
      paddingTop: 20,
    },
    loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: palette.textLight,
    },
    errorText: {
      color: palette.error,
      fontSize: 16,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 10,
      padding: 10,
      backgroundColor: palette.primary,
      borderRadius: 8,
    },
    retryButtonText: {
      color: palette.white,
      fontWeight: "700",
    },

    overlayContainer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      width: "100%",  
      alignItems: "center",
      zIndex: 10,
    },

    dropdown: {
      backgroundColor: palette.third,
      borderColor: palette.primary,
      marginBottom: 8,
    },
    dropdownContainer: {
      backgroundColor: palette.secondary,
      borderColor: palette.primary,
    },
    placeholder: { color: palette.textLight },
    text: { color: palette.textDark },
    listItemLabel: { color: palette.textDark },

    //-------Pin Button Styling -----
    pinButton: {
      position: "absolute",
      bottom: 80,
      left: 20,
      backgroundColor: "#111",
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      zIndex: 1000,
      elevation: 5,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    pinButtonText: {
      color: palette.white,
      fontWeight: "bold",
      fontSize: 14,
    },

    //---------Distance Overlay Styling ------
    distanceOverlay: {
      position: "absolute",
      top: 105,
      right: 50,
      backgroundColor: palette.third,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      zIndex: 999,
    },
    distanceText: {
      color: palette.white,
      fontWeight: "bold",
      fontSize: 14,
    },

    //-------Score UI ------
    scoreOverlay: {
      position: "absolute",
      bottom: 75, // NOTE: used in dynamic padding calc
      right: 75,
      //backgroundColor: palette.secondary,
      backgroundColor: "#111",
      padding: 16,
      borderRadius: 20,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 6,
    },
    statControl: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    statLabel: {
      width: 50,
      fontWeight: "600",
      color: palette.white,
    },
    button: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: palette.white,
      justifyContent: "center",
      alignItems: "center",
      marginHorizontal: 4,
    },
    buttonText: {
      color: palette.black,
      fontSize: 18,
      lineHeight: 18,
    },
    statValue: {
      width: 24,
      textAlign: "center",
      color: palette.white,
    },
    enterButton: {
      marginTop: 4,
      backgroundColor: palette.white,
      paddingVertical: 6,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    enterText: {
      color: palette.black,
      fontWeight: "700",
    },

    //---------Add course styling -------
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalContent: {
      width: "80%",
      backgroundColor: palette.primary || "#fff",
      padding: 20,
      borderRadius: 8,
    },
    modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
    modalInput: {
      borderWidth: 1,
      borderColor: palette.primary || "#ccc",
      padding: 10,
      marginBottom: 10,
      borderRadius: 4,
    },
    modalButtons: { flexDirection: "row", justifyContent: "space-between" },

    actionButtonsContainer: {
      flexDirection: "column",
      justifyContent: "space-between",
      borderRadius: 8,
      position: "absolute",
      bottom: 200,
      left: 10,
      width: "30%",
      alignSelf: "center",
      zIndex: 2000,
      elevation: 20,
      pointerEvents: "box-none",
    },
    actionButton: {
      //backgroundColor: palette.primary,
      backgroundColor: palette.background,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginBottom: 8,
      elevation: 4,
    },
    actionButtonPressed: {
      opacity: 0.6, // dim when pressed
    },
    actionButtonText: {
      color: palette.textLight,
      fontWeight: "600",
      textAlign: "center",
    },

    // ---- new my location button (legacy FAB, kept if needed) ------
    fab: {
      position: "absolute",
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: palette.primary,
      alignItems: "center",
      justifyContent: "center",
      zIndex: 2500,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    fabLabel: {
      color: palette.white,
      fontSize: 20,
      fontWeight: "700",
    },

    //---------UI CHANGES FOR BOTTOM RIGHT CONTROL PANEL------
    fabContainer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 3000,
      width: "100%",
      height: "100%",
      pointerEvents: "box-none",
    },
    fabMain: {
      position: "absolute",
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: "#111",
      alignItems: "center",
      justifyContent: "center",
      elevation: 8,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      right: 16,
      bottom: 16,
    },
    fabMainIcon: {
      color: palette.white,
      fontSize: 28,
      fontWeight: "800",
      lineHeight: 28,
    },
    fabActionWrap: {
      position: "absolute",
      alignItems: "center",
      right: 16,
    },
    fabAction: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "#111",
      alignItems: "center",
      justifyContent: "center",
      elevation: 5,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
    },
    fabActionIcon: {
      color: palette.white,
      fontSize: 18,
      fontWeight: "700",
    },
    fabActionLabel: {
      marginTop: 6,
      //backgroundColor: palette.secondary,
      backgroundColor: '#111',
      color: palette.white,
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderRadius: 6,
      fontSize: 12,
    },

    //---------Making Smaller Dropdown bars at the top  --------
    dropdownCompact: {
  height: COMPACT_H,
  minHeight: COMPACT_H,
  paddingVertical: 0,
  borderRadius: 8,
  width:200,
},
containerCompact: {
  height: COMPACT_H,     // ensures the wrapper measures smaller too
},
textCompact: {
  fontSize: 14,
  lineHeight: 18,
  color: palette.textLight,
},
placeholderCompact: {
  fontSize: 14,
  lineHeight: 18,
  color: palette.textLight,
},
iconCompact: {           // keeps the caret vertically centered in shorter height
  height: COMPACT_H,
  justifyContent: "center",
},
iconText: { 
  fontSize: 12, 
  color: palette.textLight },

  distanceBannerContainer: {
    position: "absolute",
    top: 100,
    left: 10,
    backgroundColor: "transparent",
    zIndex: 1000,
  },
  distanceBanner: {
    backgroundColor: palette.background,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    elevation: 5,
  },
  distanceBannerText: {
    color: palette.textLight,
    fontWeight: "bold",
    fontSize: 18,
  },
    // Banner styles
    bannerContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: palette.background,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      elevation: 5,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      marginHorizontal: 16,
    },
    bannerTextContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      color: palette.textLight,
      backgroundColor: palette.background,
    },
    bannerCourse: {
      fontSize: 16,
      fontWeight: "600",
      color: palette.textLight,
    },
    bannerInfo: {
      fontSize: 14,
      color: palette.textLight,
      marginTop: 2,
    },
    arrowButton: {
      padding: 12,
      color: palette.textLight
    },
    arrowButtonPressed: {
      opacity: 0.6,
    },
    arrowText: {
      fontSize: 20,
      fontWeight: "bold",
      color: palette.textLight,
    },
    FinishText: {
      fontSize: 16,
      fontWeight: "bold",
      color: palette.textLight,
    },
    sbContainer: {
      marginTop: 10,
      backgroundColor: palette.background,
      paddingHorizontal: 6,
      paddingVertical: 8,
      borderRadius: 14,
      width: "92%",
      alignSelf: "center",
    },
    sbEmpty: {
      color: palette.textLight,
      textAlign: "center",
      paddingVertical: 6,
    },
    sbChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      backgroundColor: palette.background,
    },
    sbGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      backgroundColor: palette.background,
    },
    sbTile: {
      width: "25%",        // <-- responsive, fits 4 players
      alignItems: "center",
      marginVertical: 3,
      marginHorizontal: 0, // tighter spacing keeps layout clean
      backgroundColor: palette.background,
    },
    sbAvatarCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: palette.secondary,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    sbAvatarCircleImg: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "#222",
    },
    sbAvatarCircleText: {
      color: palette.white,
      fontWeight: "700",
      fontSize: 12,
    },
    sbPlayerName: {
      marginTop: 4,
      color: palette.textLight,
      fontWeight: "600",
      fontSize: 11,
      textAlign: "center",
      maxWidth: 150,
    },
    sbScoreText: {
      marginTop: 6,
      color: palette.textLight,
      fontWeight: "700",
      fontSize: 12,
    },
    sbAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: palette.secondary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
      overflow: "hidden",
    },
    sbAvatarImg: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginRight: 10,
      backgroundColor: "#222",
    },
    sbAvatarText: {
      color: palette.white,
      fontWeight: "700",
      fontSize: 12,
    },
    sbInfo: { flex: 1 },
    sbName: { color: palette.white, fontWeight: "600" },
    sbHoles: { color: palette.textLight, fontSize: 12, marginTop: 2 },
    sbBadge: {
      minWidth: 36,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 10,
      alignItems: "center",
    },
    sbBadgeText: { color: palette.textLight, fontWeight: "700" },
    sbBadgeUnder: { backgroundColor: "#16a34a" }, // under par = green
    sbBadgeOver: { backgroundColor: "#ef4444" },  // over par = red
    sbBadgeEven: { backgroundColor: "#4b5563" },  // even = gray
  });

      