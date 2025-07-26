// ------------------- IMPORTS -------------------------
import { useAuth } from "@/components/AuthContext";
import { useCourse } from '@/components/CourseContext';
import { supabase, testSupabaseConnection } from "@/components/supabase";
import { useTheme } from "@/components/ThemeContext";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import haversine from "haversine-distance";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Region
} from "react-native-maps";

// …


// ------------------- TYPES -------------------------
type Course = {
  id: string;
  name: string;
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

// ------------------- COURSEVIEW LOGIC -------------------------
export default function CourseViewScreen() {
  // Declare states first (always in the same order)
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
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
  const { user } = useAuth();

  const mountedRef = useRef(true);
  const mapRef = useRef<MapView>(null);

  const { palette } = useTheme();
  const [score, setScore] = useState<number>(0);
  const [putts, setPutts] = useState<number>(0);
    // grab `courseId` from the URL (if any)
  const { courseId } = useLocalSearchParams<{ courseId?: string }>()
  const router = useRouter();
  // seed your dropdown state from that param:
  const { selectedCourse, setSelectedCourse } = useCourse();

  

  // Safe state update to avoid changing state after the component is unmounted
  const safeSetState = (setter: any, value: any) => {
    if (mountedRef.current) {
      setter(value);
    }
  };

  //Toast alerts for user login on course view - fall back to alert for ios
  const showMessage = (msg: string) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert(msg);
    }
  };


 const handleEnter = async () => {
  if (!user) {
    showMessage("Please sign in before recording scores.");
    return;
  }
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
    const { data, error } = await supabase
      .from("scores")
      .insert([{
        player_id: user.id,
        course_id: selectedCourse!,
        hole_number: selectedHole.hole_number,
        score,
        putts,
     }]);

    if (error) {
      console.error("❌ Supabase insert error:", error);
      showMessage(`Error saving score: ${error.message}`);
      return;
    }

    console.log("✅ Insert result:", data);

    // advance to next hole
    const idx = holes.findIndex(h => h.hole_number === selectedHoleNumber);
    const next = holes[idx + 1];
    if (next) {
      setSelectedHoleNumber(next.hole_number);
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


  // Initialize App and set user location
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
        ...(data || []).map(course => ({
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
        ...prev.filter(item => item.value !== "add_course"),
        { label: added.name, value: added.id },
        { label: "Add a course", value: "add_course" },
      ]);

      // Select the new course & prepare placeholder holes
      safeSetState(setSelectedCourse, added.id);
      safeSetState(setSelectedHoleNumber, null);
      // <-- Change highlighted: insert 18 empty holes into DB using the new course ID
    const { data: newHoles, error: holesError } = await supabase
      .from("holes")
      .insert(
        // Each hole record uses course_id = added.id to link back to the new course
        Array.from({ length: 18 }, (_, i) => ({
          course_id: added.id,
          hole_number: i + 1,
        }))
      )
      .select();
    if (holesError) throw holesError;

    // <-- Change highlighted: update local holes and holeItems
        safeSetState(setHoles, newHoles || []);
        safeSetState(
          setHoleItems,
          (newHoles || []).map((h) => ({ label: `Hole ${h.hole_number}`, value: h.hole_number }))
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
      if (!selectedHole) return;
      setLoading(true);
      try {
        // fetch fresh location
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

        const { data, error } = await supabase
          .from("holes")
          .update({
            tee_latitude: current.coords.latitude,
            tee_longitude: current.coords.longitude,
          })
          .eq("id", selectedHole.id)
          .select();

        if (error) throw error;
        // refetch so UI + DB stay in sync
        await fetchHoles();
      } catch (err: any) {
        setConnectionError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const handleAddFairwayTarget = async () => {
      if (!selectedHole) return;
      setLoading(true);
      try {
        // fetch fresh location
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

        const { data, error } = await supabase
          .from("holes")
          .update({
            fairway_latitude: current.coords.latitude,
            fairway_longitude: current.coords.longitude,
          })
          .eq("id", selectedHole.id)
          .select();

        if (error) throw error;
        await fetchHoles();
      } catch (err: any) {
        setConnectionError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const handleAddGreen = async () => {
      if (!selectedHole) return;
      setLoading(true);
      try {
        // fetch fresh location
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });

        const { data, error } = await supabase
          .from("holes")
          .update({
            green_latitude: current.coords.latitude,
            green_longitude: current.coords.longitude,
          })
          .eq("id", selectedHole.id)
          .select();

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

  // Center map when hole data changes
  useEffect(() => {
    if (selectedHole && mapRef.current) {
      const latitudes = [selectedHole.tee_latitude, selectedHole.green_latitude];
      const longitudes = [selectedHole.tee_longitude, selectedHole.green_longitude];
      if (selectedHole.fairway_latitude && selectedHole.fairway_longitude) {
        latitudes.push(selectedHole.fairway_latitude);
        longitudes.push(selectedHole.fairway_longitude);
      }
      const safeLatitudes = latitudes.filter((n): n is number => n != null);
      const safeLongitudes = longitudes.filter((n): n is number => n != null);

      const centerLat =
        safeLatitudes.reduce((a, b) => a + b, 0) / safeLatitudes.length;

      const centerLon =
        safeLongitudes.reduce((a, b) => a + b, 0) / safeLongitudes.length;

      mapRef.current?.animateToRegion(
        {
          latitude: centerLat!,
          longitude: centerLon!,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  }, [selectedHole]);

  useEffect(() => {
    if (selectedHole) {
      setScore(selectedHole.par ?? 0);
      setPutts(2);
    }
  }, [selectedHole]);

  // Clear dropped pins when a new hole is selected
  useEffect(() => {
    setDroppedPins([]);
  }, [selectedHoleNumber]);

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

    let targetCoords = null;

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
    <View style={styles(palette).container}>
    <Modal visible={showAddCourseModal} transparent animationType="slide">
        <View style={styles(palette).modalContainer}>
          <View style={styles(palette).modalContent}>
            <Text style={styles(palette).modalTitle}>Add New Course</Text>
              <TextInput style={styles(palette).modalInput}
              placeholder="Course name"
              value={newCourseName}
              onChangeText={setNewCourseName}
            />
            <View style={styles(palette).modalButtons}>
              <Button title="Cancel" onPress={() => { setShowAddCourseModal(false); setNewCourseName(""); }} />
              <Button title="Add" onPress={handleConfirmAddCourse} disabled={!newCourseName.trim()} />
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles(palette).overlayContainer}>
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={selectedCourse}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={(cb) => {
            const v = cb(selectedCourse);
            //closes drop down before modal pop up for text input
             if (v === "add_course") {
            setCourseOpen(false);
            setShowAddCourseModal(true);
             }
             else{
            setSelectedCourse(v);
            setCourseOpen(false);
            setSelectedHoleNumber(null);
            }
          }}
          setItems={setCourseItems}
          style={styles(palette).dropdown}
          listMode="MODAL"
            modalProps={{
            animationType: 'slide',
            transparent: true,
          }}
          modalContentContainerStyle={{
            backgroundColor: palette.secondary,
            maxHeight: 300,             // whatever height you want
            marginHorizontal: 20,       // gives you side padding
            borderRadius: 8,
          }}
          dropDownContainerStyle={styles(palette).dropdownContainer}
          placeholderStyle={styles(palette).placeholder}
          textStyle={styles(palette).text}
          listItemLabelStyle={styles(palette).listItemLabel}
          zIndex={2000}
        />

        {selectedCourse && (
          <DropDownPicker
            placeholder="Select a hole..."
            open={holeOpen}
            value={selectedHoleNumber}
            items={holeItems}
            setOpen={setHoleOpen}
            setValue={(cb) => {
              const v = cb(selectedHoleNumber);
              setSelectedHoleNumber(v);
            }}
            setItems={setHoleItems}
            style={styles(palette).dropdown}
              // FLATLIST is more reliable in release builds…
            listMode="MODAL"
            modalProps={{
            animationType: 'slide',
            transparent: true,
          }}
          modalContentContainerStyle={{
            backgroundColor: palette.secondary,
            maxHeight: 300, 
            marginVertical:75,            // whatever height you want
            marginHorizontal: 20,       // gives you side padding
            borderRadius: 8,
          }}
            dropDownContainerStyle={[styles(palette).dropdownContainer, { maxHeight: 300 }]}
            placeholderStyle={styles(palette).placeholder}
            textStyle={styles(palette).text}
            listItemLabelStyle={styles(palette).listItemLabel}
            zIndex={1000}
          />
        )}
      </View>

      <MapView
  provider={PROVIDER_GOOGLE}
  ref={mapRef}
  style={{ flex: 1 }}
  region={
    region || {
      latitude: -37.8136,
      longitude: 144.9631,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    }
  }
  showsUserLocation={!!location}
  showsMyLocationButton={false}
  mapType="hybrid"
  onMapReady={() => console.log("🗺️ Map is ready")}
  onMapLoaded={() => console.log("🗺️ Tiles loaded")}
>
  {/* Tee marker */}
  {selectedHole?.tee_latitude != null &&
   selectedHole?.tee_longitude != null && (  // <-- Change highlighted
    <Marker
      coordinate={{
        latitude: selectedHole.tee_latitude,
        longitude: selectedHole.tee_longitude,
      }}
      anchor={{ x: 0.6, y: 1 }}
      title={`Hole ${selectedHole.hole_number} Tee`}
    >
      <Image
        source={require("@/assets/images/golf-logo.png")}
        style={{ width: 50, height: 50, tintColor: palette.yellow }}
        resizeMode="contain"
      />
    </Marker>
  )}

  {/* Green marker */}
  {selectedHole?.green_latitude != null &&
   selectedHole?.green_longitude != null && (  // <-- Change highlighted
    <Marker
      coordinate={{
        latitude: selectedHole.green_latitude,
        longitude: selectedHole.green_longitude,
      }}
      anchor={{ x: 0.6, y: 1 }}
      title={`Hole ${selectedHole.hole_number} Green`}
    >
      <Image
        source={require("@/assets/images/flag.png")}
        style={{ width: 50, height: 50 }}
        resizeMode="contain"
      />
    </Marker>
  )}

  {/* Tee→(Fairway)→Green polyline */}
  {selectedHole?.tee_latitude != null &&
   selectedHole?.tee_longitude != null &&
   selectedHole?.green_latitude != null &&
   selectedHole?.green_longitude != null && (  // <-- Change highlighted
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
      strokeColor="#00BFFF"
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
      {!!selectedHole && (
      <View style={[styles(palette).scoreOverlay, { zIndex: 2000 }]}>
        <View style={styles(palette).statControl}>
          <Text style={styles(palette).statLabel}>Score</Text>
          <Pressable onPress={() => setScore(s => s + 1)} style={styles(palette).button}>
            <Text style={styles(palette).buttonText}>＋</Text>
          </Pressable>
          <Text style={styles(palette).statValue}>{score}</Text>
          <Pressable onPress={() => setScore(s => Math.max(0, s - 1))} style={styles(palette).button}>
            <Text style={styles(palette).buttonText}>－</Text>
          </Pressable>
        </View>
        <View style={styles(palette).statControl}>
          <Text style={styles(palette).statLabel}>Putts</Text>
          <Pressable onPress={() => setPutts(p => p + 1)} style={styles(palette).button}>
            <Text style={styles(palette).buttonText}>＋</Text>
          </Pressable>
          <Text style={styles(palette).statValue}>{putts}</Text>
          <Pressable onPress={() => setPutts(p => Math.max(0, p - 1))} style={styles(palette).button}>
            <Text style={styles(palette).buttonText}>－</Text>
          </Pressable>
        </View>
        <Pressable style={styles(palette).enterButton} onPress={handleEnter}>
          <Text style={styles(palette).enterText}>Enter</Text>
        </Pressable>
      </View>
    )}

      {distanceToPin !== null && (
        <View style={styles(palette).distanceOverlay}>
          <Text style={styles(palette).distanceText}>
            Distance to Pin: {(distanceToPin / 1).toFixed(0)} m
          </Text>
        </View>
      )}
      {selectedHole && (
  <>
    <Pressable
      style={[styles(palette).pinButton, { left: 20 }]}    // existing Drop Pin
      onPress={handleDropPin}
    >
      <Text style={styles(palette).pinButtonText}>Drop Pin</Text>
    </Pressable>

    <Pressable
      style={[styles(palette).pinButton, { left: 140 }]}   // new My Location button
      onPress={() => {
        if (location && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }, 500);
        }
      }}
    >
      <Text style={styles(palette).pinButtonText}>My Location</Text>
    </Pressable>
  </>
)}
       {/* Action Buttons for New Holes */}
        {selectedHole && (
          <View style={styles(palette).actionButtonsContainer}>
            {/* <-- Show only if tee coords are null */}
            {selectedHole.tee_latitude == null &&
            selectedHole.tee_longitude == null && (             // <-- Change highlighted
              <Pressable
                onPress={handleAddTeeBox}
                android_ripple={{ color: palette.secondary }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles(palette).actionButton,
                  pressed && styles(palette).actionButtonPressed,  // <-- Change highlighted
                ]}
              >
                <Text style={styles(palette).actionButtonText}>
                  Add Tee Box
                </Text>
              </Pressable>
            )}

            {/* <-- Show only if fairway coords are null */}
            {selectedHole.fairway_latitude == null &&
            selectedHole.fairway_longitude == null && (        // <-- Change highlighted
              <Pressable
                onPress={handleAddFairwayTarget}
                android_ripple={{ color: palette.secondary }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles(palette).actionButton,
                  pressed && styles(palette).actionButtonPressed,  // <-- Change highlighted
                ]}
              >
                <Text style={styles(palette).actionButtonText}>
                  Add Fairway Target
                </Text>
              </Pressable>
            )}

            {/* <-- Show only if green coords are null */}
            {selectedHole.green_latitude == null &&
            selectedHole.green_longitude == null && (         // <-- Change highlighted
              <Pressable
                onPress={handleAddGreen}
                android_ripple={{ color: palette.secondary }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles(palette).actionButton,
                  pressed && styles(palette).actionButtonPressed,  // <-- Change highlighted
                ]}
              >
                <Text style={styles(palette).actionButtonText}>
                  Add Green
                </Text>
              </Pressable>
            )}
          </View>
        )}
  </View>
  );

   
};

// ------------------- UI Styling -------------------------
const styles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: palette.background,
    paddingBottom: 20,
    paddingTop:20
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
    paddingTop: 20,
    position: "absolute",
    top: 20,
    alignSelf: "center",
    width: "90%",
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
  backgroundColor: palette.primary,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 8,
  zIndex: 1000,
  elevation: 3,
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
    bottom: 75,
    right: 16,
    backgroundColor: palette.secondary,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  statControl: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statLabel: {
    width: 50,
    fontWeight: "600",
    color: palette.textDark,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.primary,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 4,
  },
  buttonText: {
    color: palette.white,
    fontSize: 18,
    lineHeight: 18,
  },
  statValue: {
    width: 24,
    textAlign: "center",
    color: palette.textDark,
  },
  enterButton: {
    marginTop: 4,
    backgroundColor: palette.primary,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  enterText: {
    color: palette.white,
    fontWeight: "700",
  },
  //---------Add course styling -------
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '80%', backgroundColor: palette.primary || '#fff', padding: 20, borderRadius: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  modalInput: { borderWidth: 1, borderColor: palette.primary || '#ccc', padding: 10, marginBottom: 10, borderRadius: 4 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  actionButtonsContainer: { 
    flexDirection: "column",             
    justifyContent: "space-between",
    borderRadius: 8,
    position: "absolute",
    bottom: 120,  
    left: 10,                       
    width: "30%",
    alignSelf: "center",
    zIndex: 2000,
    elevation: 20,
    pointerEvents: "box-none",
   },
  actionButton: {
    backgroundColor: palette.primary, // now you can control this
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation:4,
  },
  actionButtonPressed: {
    opacity: 0.6,             // dim when pressed
  },
  actionButtonText: {
    color: palette.white,
    fontWeight: "600",
    textAlign: "center",
  },
  getLocationButton: {
  position: 'absolute',
  bottom: 80,
  left: 140,
  backgroundColor: palette.primary,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 8,
  elevation: 3,
},

});
