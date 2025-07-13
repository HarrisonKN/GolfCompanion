import { supabase, testSupabaseConnection } from "@/components/supabase";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
  Text,
  Pressable,
} from "react-native";
import { useFocusEffect } from "expo-router";
import DropDownPicker from "react-native-dropdown-picker";
import MapView, {
  Marker,
  Polyline,
  Region,
} from "react-native-maps";

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
  green_latitude: number | null;
  green_longitude: number | null;
};

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
  const [debugInfo, setDebugInfo] = useState<string>("");
  const mountedRef = useRef(true);
  const mapRef = useRef<MapView>(null);

  const safeSetState = (setter: any, value: any) => {
    if (mountedRef.current) {
      setter(value);
    }
  };

  const addDebugInfo = (info: string) => {
    console.log(`[CourseView] ${info}`);
    safeSetState(setDebugInfo, (prev: string) => `${prev}\n${new Date().toLocaleTimeString()}: ${info}`);
  };

  const initializeApp = async () => {
    try {
      setLoading(true);
      setConnectionError(null);

      // Test Supabase connection
      addDebugInfo("Testing Supabase connection...");
      const connectionTest = await Promise.race([
        testSupabaseConnection(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection test timeout")), 10000)
        ),
      ]);
      if (!connectionTest) {
        throw new Error("Connection test failed.");
      }
      addDebugInfo("Supabase connection successful.");

      // Location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation);
        setRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        addDebugInfo("Location obtained.");
      } else {
        addDebugInfo("Location permission denied.");
      }
    } catch (error: any) {
      setConnectionError(error.message);
      addDebugInfo(`Initialization error: ${error.message}`);
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
      addDebugInfo(`Fetched ${data?.length || 0} courses.`);
    } catch (error: any) {
      addDebugInfo(`Course fetch error: ${error.message}`);
    }
  };

  const fetchHoles = async () => {
    if (!selectedCourseId) return;

    try {
      const { data, error } = await supabase
        .from("holes")
        .select("*")
        .eq("course_id", selectedCourseId)
        .order("hole_number", { ascending: true });

      if (error) throw error;
      setHoles(data || []);
      setHoleItems(
        (data || []).map((hole) => ({
          label: `Hole ${hole.hole_number}`,
          value: hole.hole_number,
        }))
      );
      addDebugInfo(`Fetched ${data?.length || 0} holes.`);
    } catch (error: any) {
      addDebugInfo(`Hole fetch error: ${error.message}`);
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
      const centerLat =
        (selectedHole.tee_latitude! + selectedHole.green_latitude!) / 2;
      const centerLon =
        (selectedHole.tee_longitude! + selectedHole.green_longitude!) / 2;

      mapRef.current.animateToRegion(
        {
          latitude: centerLat,
          longitude: centerLon,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  }, [selectedHole]);

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
        <Text style={styles.errorText}>⚠️ {connectionError}</Text>
        <Pressable onPress={initializeApp} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const currentRegion = region || {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

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
          dropDownContainerStyle={[styles.dropdownContainer, { maxHeight: 300 }]}
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
            dropDownContainerStyle={[styles.dropdownContainer, { maxHeight: 400 }]}
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
              pinColor="blue"
              title={`Hole ${selectedHole.hole_number} Tee`}
            />
            <Marker
              coordinate={{
                latitude: selectedHole.green_latitude!,
                longitude: selectedHole.green_longitude!,
              }}
              pinColor="green"
              title={`Hole ${selectedHole.hole_number} Green`}
            />
            <Polyline
              coordinates={[
                {
                  latitude: selectedHole.tee_latitude!,
                  longitude: selectedHole.tee_longitude!,
                },
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
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#6B7280",
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  retryButton: {
    backgroundColor: "#3B82F6",
    padding: 10,
    marginTop: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "700",
    textAlign: "center",
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
});
