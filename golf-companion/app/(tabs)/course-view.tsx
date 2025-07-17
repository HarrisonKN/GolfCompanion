// ------------------- IMPORTS -------------------------
import { supabase, testSupabaseConnection } from "@/components/supabase";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import MapView, {
  Marker,
  Polyline,
  Region,
} from "react-native-maps";


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
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedHoleNumber, setSelectedHoleNumber] = useState<number | null>(null);
  const [courseOpen, setCourseOpen] = useState(false);
  const [holeOpen, setHoleOpen] = useState(false);
  const [courseItems, setCourseItems] = useState<any[]>([]);
  const [holeItems, setHoleItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [droppedPins, setDroppedPins] = useState<{ latitude: number; longitude: number }[]>([]);
  const mountedRef = useRef(true);
  const mapRef = useRef<MapView>(null);

  const safeSetState = (setter: any, value: any) => {
    if (mountedRef.current) {
      setter(value);
    }
  };

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
      setCourseItems(
        (data || []).map((course) => ({
          label: course.name,
          value: course.id,
        }))
      );
    } catch (error: any) {
      setConnectionError(`Course fetch error: ${error.message}`);
    }
  };

  const fetchHoles = async () => {
    if (!selectedCourseId) return;
    try {
      const { data, error } = await supabase
        .from("holes")
        .select("*")
        .eq("course_id", selectedCourseId)
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

  useFocusEffect(
    React.useCallback(() => {
      mountedRef.current = true;
      initializeApp();
      return () => {
        mountedRef.current = false;
      };
    }, [])
  );

  useEffect(() => {
    if (!connectionError) fetchCourses();
  }, [connectionError]);

  useEffect(() => {
    if (selectedCourseId) fetchHoles();
  }, [selectedCourseId]);

  const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);

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
  // Clear dropped pins when a new hole is selected
  setDroppedPins([]);
}, [selectedHoleNumber]);

  //dropping pins around course funciton to show shots according to players position
  const handleDropPin = async () => {
  if (!location) return;

  const newPin = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };

  setDroppedPins((prevPins) => [...prevPins, newPin]);
};

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (connectionError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{connectionError}</Text>
        <Pressable onPress={initializeApp} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  const currentRegion = region || {
    latitude: -37.8136,
    longitude: 144.9631,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // ------------------- COURSE VIEW UI -------------------------
  return (
    <View style={styles.container}>
      <View style={styles.overlayContainer}>
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={selectedCourseId}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={(cb) => {
            const v = cb(selectedCourseId);
            setSelectedCourseId(v);
            setSelectedHoleNumber(null);
          }}
          setItems={setCourseItems}
          style={styles.dropdown}
          dropDownContainerStyle={styles.dropdownContainer}
          placeholderStyle={styles.placeholder}
          textStyle={styles.text}
          listItemLabelStyle={styles.listItemLabel}
          zIndex={2000}
        />

        {selectedCourseId && (
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
            style={styles.dropdown}
            dropDownContainerStyle={[styles.dropdownContainer, { maxHeight: 400 }]} // keep maxheight here to display all holes rather then 1-5
            placeholderStyle={styles.placeholder}
            textStyle={styles.text}
            listItemLabelStyle={styles.listItemLabel}
            zIndex={1000}
          />
        )}
      </View>

      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={currentRegion}
        showsUserLocation={!!location}
        showsMyLocationButton={!!location}
        mapType="hybrid"
      >
        {selectedHole && (
          <>
            <Marker
              coordinate={{
                latitude: selectedHole.tee_latitude!,
                longitude: selectedHole.tee_longitude!,
              }}
              anchor={{ x: 0.5, y: 0.5 }} // Fix floating issue
              title={`Hole ${selectedHole.hole_number} Tee`}
              >
              <Image
                source={require("@/assets/images/golf-logo.png")}
                style={{ width: 30, height: 30 }}
                resizeMode="contain"
              />
            </Marker>
            <Marker
              coordinate={{
                latitude: selectedHole.green_latitude!,
                longitude: selectedHole.green_longitude!,
              }}
              anchor={{ x: 0.5, y: 0.5 }} // Fix floating issue
              title={`Hole ${selectedHole.hole_number} Green`}
              >
              <Image
                source={require("@/assets/images/flag.png")}
                style={{ width: 30, height: 30 }}
                resizeMode="contain"
              />
            </Marker>
            <Polyline
              coordinates={[
                {
                  latitude: selectedHole.tee_latitude!,
                  longitude: selectedHole.tee_longitude!,
                },
                ...(selectedHole.fairway_latitude && selectedHole.fairway_longitude
                  ? [
                      {
                        latitude: selectedHole.fairway_latitude,
                        longitude: selectedHole.fairway_longitude,
                      },
                    ]
                  : []),
                {
                  latitude: selectedHole.green_latitude!,
                  longitude: selectedHole.green_longitude!,
                },
              ]}
              strokeColor="#00BFFF"
              strokeWidth={2}
            />
          </>
        )}
        {droppedPins.map((pin, index) => (
          <Marker
            key={`pin-${index}`}
            coordinate={pin}
            pinColor="orange"
            title={`Pin ${index + 1}`}
          />
        ))}

        {droppedPins.length >= 1 && (
          <Polyline
            coordinates={[
              {
                latitude: selectedHole?.tee_latitude!,
                longitude: selectedHole?.tee_longitude!,
              },
              droppedPins[0],
            ]}
            strokeColor="rgba(30, 144, 255, 0.5)" // 50% opacity blue
            strokeWidth={2}
            lineDashPattern={[10, 5]} // Dotted line
          />
        )}

        {droppedPins.length > 1 &&
          droppedPins.slice(1).map((pin, index) => (
            <Polyline
              key={`line-${index}`}
              coordinates={[droppedPins[index], pin]}
              strokeColor="rgba(30, 144, 255, 0.5)"
              strokeWidth={2}
              lineDashPattern={[10, 5]}
            />
          ))}
      </MapView>

      <Pressable style={styles.pinButton} onPress={handleDropPin}>
        <Text style={styles.pinButtonText}>Drop Pin</Text>
      </Pressable>

    </View>
  );
}

// ------------------- UI Styling -------------------------
const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6B7280",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#3B82F6",
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "700",
  },
  overlayContainer: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    width: "90%",
    zIndex: 10,
  },
  dropdown: {
    backgroundColor: "rgba(0,0,0,0.8)",
    borderColor: "#555",
    marginBottom: 8,
  },
  dropdownContainer: {
    backgroundColor: "rgba(0,0,0,0.9)",
    borderColor: "#555",
  },
  placeholder: { color: "#ccc" },
  text: { color: "#fff" },
  listItemLabel: { color: "#fff" },
  //-------Pin Button Styling ----- 
  pinButton: {
  position: "absolute",
  bottom: 30,
  left: 20,
  backgroundColor: "#1D4ED8",
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 8,
  zIndex: 1000,
  elevation: 3,
},
pinButtonText: {
  color: "#fff",
  fontWeight: "bold",
  fontSize: 14,
},
});
