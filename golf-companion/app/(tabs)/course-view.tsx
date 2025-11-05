// ------------------- IMPORTS -------------------------
import { useAuth } from "@/components/AuthContext";
import { useCourse } from "@/components/CourseContext";
import { supabase, testSupabaseConnection } from "@/components/supabase";
import { useTheme } from "@/components/ThemeContext";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import haversine from "haversine-distance";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Button,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View
} from "react-native";
// ------------------- STEP OVERLAY COMPONENT -------------------------
function StepOverlay({ visible, message, onConfirm, onCancel, confirmButtons }: {
  visible: boolean;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmButtons?: boolean;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.5)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 3000,
      }}>
        <View style={{
          minWidth: 220,
          backgroundColor: "#111",
          borderRadius: 20,
          paddingVertical: 24,
          paddingHorizontal: 32,
          alignItems: "center",
          elevation: 10,
        }}>
          <Text style={{
            color: "#fff",
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
                style={({ pressed }) => [{ backgroundColor: "#444", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, marginRight: 8, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "bold", fontSize: 16 }}>No</Text>
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
import DropDownPicker from "react-native-dropdown-picker";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import type { LatLng } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { InteractionManager, Easing, Dimensions } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

// …

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
  player_id: string;
  name: string;
  avatar_url?: string | null;
  strokes: number;
  toPar: number;
  holesPlayed: number;
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

// ------------------- COURSEVIEW LOGIC -------------------------
export default function CourseViewScreen() {
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

  const { user } = useAuth();
  const { palette } = useTheme();
  const S = React.useMemo(() => styles(palette), [palette]);
  const { courseId, playerIds } = useLocalSearchParams<{ courseId?: string; playerIds?: string }>();
  const router = useRouter();
  const { selectedCourse, setSelectedCourse } = useCourse();

  const mountedRef = useRef(true);
  const mapRef = useRef<MapView | null>(null);

  const lastFlewCourseRef = useRef<string | null>(null);

  // --- animated crossfade overlay for hole transitions (our addition) ---
  const transitionOpacity = useRef(new Animated.Value(0)).current;
  const switchingCourseRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [MapLoaded, setMapLoaded] = useState(false);

  // --- safe-area + dynamic map padding (our addition) ---
  const insets = useSafeAreaInsets();
  const [topPadPx, setTopPadPx] = useState(0); // space covered by dropdown stack
  const [scoreH, setScoreH] = useState(0); // measured height of score overlay
  const [actionsH, setActionsH] = useState(0); // measured height of action buttons

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

  // speed-dial open/close
  const [fabOpen, setFabOpen] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;

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
  async function orientedFlyToHole(
    mapRef: { current: MapView | null },
    hole: Hole,
    flightMs = 900
  ) {
    if (!mapRef.current) return;

    const tee =
      hole.tee_latitude != null && hole.tee_longitude != null
        ? { latitude: hole.tee_latitude, longitude: hole.tee_longitude }
        : null;
    const green =
      hole.green_latitude != null && hole.green_longitude != null
        ? { latitude: hole.green_latitude, longitude: hole.green_longitude }
        : null;
    if (!tee || !green) return;

    const heading = bearingDeg(tee, green);

    // Bias center a touch toward the green, then nudge back toward tee
    const t = 0.5;
    const mid = {
      latitude: tee.latitude + (green.latitude - tee.latitude) * t,
      longitude: tee.longitude + (green.longitude - tee.longitude) * t,
    };
    const center = nudgeAlongHeading(mid, heading, 20); // meters back toward tee

    // Estimate zoom/altitude from hole length + visible height after paddings
    const meters = haversine(
      { lat: tee.latitude, lon: tee.longitude },
      { lat: green.latitude, lon: green.longitude }
    );

    if (Platform.OS === "ios") {
      // iOS altitude (meters). Tighter baseline.
      let altitude = Math.max(200, Math.min(1000, meters * 0.9 + 160));
      mapRef.current.animateCamera(
        { center, heading, pitch: 40, altitude },
        { duration: flightMs }
      );
    } else {
      // Android zoom (higher = closer). Tighter baseline.
      let zoom = 18.6 - Math.log2(Math.max(60, meters) / 150); // 150m ≈ 18.6
      zoom = Math.max(16.2, Math.min(19, zoom));
      mapRef.current.animateCamera(
        { center, heading, pitch: 40, zoom },
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

    console.log("👉 Inserting score:", {
      player_id: user.id,
      course_id: selectedCourse,
      hole_number: selectedHole.hole_number,
      score,
      putts,
    });

    setLoading(true);
    try {
      const { data, error } = await supabase.from("scores").insert([
        {
          player_id: user.id,
          course_id: selectedCourse!,
          hole_number: selectedHole.hole_number,
          score,
          putts,
        },
      ]);

      if (error) {
        console.error("❌ Supabase insert error:", error);
        showMessage(`Error saving score: ${error.message}`);
        return;
      }

      console.log("✅ Insert result:", data);

      // advance to next hole (with transition)
      const idx = holes.findIndex((h) => h.hole_number === selectedHoleNumber);
      const next = holes[idx + 1];
      if (next) {
        setScore(0);
        setPutts(0);
        setSelectedHoleNumber(next.hole_number); // the effect above will just fly the camera, no flash
      } else {
        router.push({
          pathname: "/scorecard",
          params: { playerId: user.id, courseId: selectedCourse! },
        });
      }
    } catch (err: any) {
      console.error("❌ Unexpected error:", err);
      showMessage(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ------------------- INIT & DATA FETCH -------------------------
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

      // Location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Lowest,
        });
        setLocation(currentLocation);
        setRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error: any) {
      setConnectionError(error.message);
    } finally {
      setLoading(false);
    }
  };

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
        .insert({ name: newCourseName })
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

  // Ensure initialization on mount
  useFocusEffect(
    React.useCallback(() => {
      mountedRef.current = true;
      initializeApp();
      return () => {
        mountedRef.current = false;
      };
    }, [])
  );

  // Fetch courses when the component is mounted and connection is good
  useEffect(() => {
    if (!connectionError) fetchCourses();
  }, [connectionError]);

  // Fetch holes when a course is selected
  useEffect(() => {
    if (selectedCourse) fetchHoles();
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
        console.log("🧭 Map or selected hole not ready");
        return;
      }

      console.log("🗺️ MapLoaded:", MapLoaded);
      console.log("📍 Tee → Fairway lat/lon:", selectedHole?.tee_latitude, selectedHole?.fairway_latitude);
      console.log("📍 Fairway → Green lat/lon:", selectedHole?.fairway_latitude, selectedHole?.green_latitude);

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
          console.log("🎯 Tee→Fairway screen point:", point);
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
          console.log("🎯 Fairway→Green screen point:", point);
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
                if (next) setSelectedHoleNumber(next.hole_number);
              }}
              style={({ pressed }) => [S.arrowButton, pressed && S.arrowButtonPressed]}
              disabled={holes.findIndex(h => h.hole_number === selectedHoleNumber) === holes.length - 1 || holes.length === 0}
            >
              {holes.findIndex(h => h.hole_number === selectedHoleNumber) < holes.length - 1 ? (
                <Text style={S.arrowText}>›</Text>
              ) : (
                <Text style={[S.arrowText, { opacity: 0.2 }]}>›</Text>
              )}
            </Pressable>
          </View>

          {/* New: live scoreboard for this course (today) */}
          <View style={S.sbContainer}>
            {scoreboard.length === 0 ? (
              <Text style={S.sbEmpty}>No scores yet</Text>
            ) : (
              scoreboard.map((p) => {
                const first = (p.name || "").trim().split(" ")[0] || "Player";
                const initials = first.slice(0, 1).toUpperCase();
                const toParStr = p.toPar === 0 ? "E" : p.toPar > 0 ? `+${p.toPar}` : `${p.toPar}`;
                const badgeStyle =
                  p.toPar < 0 ? S.sbBadgeUnder : p.toPar > 0 ? S.sbBadgeOver : S.sbBadgeEven;

                return (
                  <View key={p.player_id} style={S.sbChip}>
                    {p.avatar_url ? (
                      <Image
                        source={{ uri: p.avatar_url }}
                        style={S.sbAvatarImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={S.sbAvatar}>
                        <Text style={S.sbAvatarText}>{initials}</Text>
                      </View>
                    )}

                    <View style={S.sbInfo}>
                      <Text style={S.sbName}>{first}</Text>
                      <Text style={S.sbHoles}>
                        {p.strokes} strokes • Holes {p.holesPlayed}/{holes.length || 18}
                      </Text>
                    </View>

                    <View style={[S.sbBadge, badgeStyle]}>
                      <Text style={S.sbBadgeText}>{toParStr}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </View>

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
        showsUserLocation={!!location}
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
        {/* Tee marker */}
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

          <Pressable style={S.enterButton} onPress={handleEnter}>
            <Text style={S.enterText}>Enter</Text>
          </Pressable>
        </View>
      )}


      {selectedHole && (
        <>
          {/* existing Drop Pin */}
          <Pressable style={[S.pinButton, { left: 20 }]} onPress={handleDropPin}>
            <Text style={S.pinButtonText}>Drop Pin</Text>
          </Pressable>

          {/* Speed-dial FAB */}
          <View pointerEvents="box-none" style={S.fabContainer}>
            {/* Action: Scores */}
            <Animated.View
              style={[
                S.fabActionWrap,
                {
                  bottom: 16 + insets.bottom + LABEL_CLEARANCE,
                  //right: 16,
                  transform: [{ translateY: actionScoreY }],
                  opacity: fabAnim,
                },
              ]}
            >
              <Pressable
                style={S.fabAction}
                android_ripple={{ color: palette.secondary }}
                hitSlop={8}
                onPress={() => {
                  setScoreVisible(v => !v);
                  toggleFab();
                }}
              >
                <Text style={S.fabActionIcon}>🧮</Text>
              </Pressable>
              <Animated.Text style={[S.fabActionLabel, { opacity: fabAnim }]}>
                Scores
              </Animated.Text>
            </Animated.View>

            {/* Action: My Location */}
            <Animated.View
              style={[
                S.fabActionWrap,
                {
                  bottom: 32 + insets.bottom + LABEL_CLEARANCE,
                  //right: 16,
                  transform: [{ translateY: actionLocY }],
                  opacity: fabAnim,
                },
              ]}
            >
              <Pressable
                style={S.fabAction}
                android_ripple={{ color: palette.secondary }}
                hitSlop={8}
                onPress={() => {
                  if (location && mapRef.current) {
                    mapRef.current.animateToRegion(
                      {
                        latitude: location.coords.latitude,
                        longitude: location.coords.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      },
                      500
                    );
                  }
                  toggleFab();
                }}
              >
                <Text style={S.fabActionIcon}>⌖</Text>
              </Pressable>
              <Animated.Text style={[S.fabActionLabel, { opacity: fabAnim }]}>
                Location
              </Animated.Text>
            </Animated.View>

            {/* Main FAB */}
            <Pressable
              style={[S.fabMain, { bottom: 48 + insets.bottom, right: 16 }]}
              android_ripple={{ color: palette.secondary }}
              onPress={toggleFab}
            >
              <Animated.Text style={[S.fabMainIcon, { transform: [{ rotate: rotateZ }] }]}>
                ＋
              </Animated.Text>
            </Pressable>
          </View>
        </>
      )}

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
      backgroundColor: '#111',
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
      color: palette.white,
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
  color: palette.textDark,
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
    backgroundColor: "#111",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    elevation: 5,
  },
  distanceBannerText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
    // Banner styles
    bannerContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#111",
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
    },
    bannerCourse: {
      fontSize: 16,
      fontWeight: "600",
      color: palette.white,
    },
    bannerInfo: {
      fontSize: 14,
      color: palette.white,
      marginTop: 2,
    },
    arrowButton: {
      padding: 12,
    },
    arrowButtonPressed: {
      opacity: 0.6,
    },
    arrowText: {
      fontSize: 20,
      fontWeight: "bold",
      color: palette.white,
    },
    sbContainer: {
      marginTop: 10,
      backgroundColor: "#111",
      paddingHorizontal: 12,
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
    sbBadgeText: { color: "#fff", fontWeight: "700" },
    sbBadgeUnder: { backgroundColor: "#16a34a" }, // under par = green
    sbBadgeOver: { backgroundColor: "#ef4444" },  // over par = red
    sbBadgeEven: { backgroundColor: "#4b5563" },  // even = gray
  });
     
  