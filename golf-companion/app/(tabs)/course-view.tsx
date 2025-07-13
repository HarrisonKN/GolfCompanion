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
  const [courseError, setCourseError] = useState<string | null>(null);
  const [holeError, setHoleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const mountedRef = useRef(true);

  const mapRef = useRef<MapView>(null);

  // Handle mounting state
  useEffect(() => {
    setIsMounted(true);
    return () => {
      mountedRef.current = false;
      setIsMounted(false);
    };
  }, []);

  // Safe state setter that only updates if component is mounted
  const safeSetState = (setter: any, value: any) => {
    if (mountedRef.current && isMounted) {
      setter(value);
    }
  };

  const addDebugInfo = (info: string) => {
    console.log(`[CourseView] ${info}`);
    safeSetState(setDebugInfo, prev => `${prev}\n${new Date().toLocaleTimeString()}: ${info}`);
  };

  const initializeApp = async () => {
    if (!isMounted) return;

    try {
      addDebugInfo('Starting initialization...');
      safeSetState(setLoading, true);
      safeSetState(setConnectionError, null);
      
      // Test Supabase connection with timeout
      addDebugInfo('Testing Supabase connection...');
      const connectionPromise = testSupabaseConnection();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), 10000);
      });

      let connectionTest;
      try {
        connectionTest = await Promise.race([connectionPromise, timeoutPromise]);
      } catch (error: any) {
        addDebugInfo(`Connection test failed: ${error.message}`);
        safeSetState(setConnectionError, `Connection test failed: ${error.message}`);
        return;
      }

      if (!connectionTest) {
        addDebugInfo('Connection test returned false');
        safeSetState(setConnectionError, 'Unable to connect to database. Please check your connection.');
        return;
      }
      addDebugInfo('Supabase connection successful');

      // Get location permission
      addDebugInfo('Requesting location permission...');
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          addDebugInfo('Location permission denied');
          Alert.alert("Permission Denied", "Location permission is required for full functionality.");
          // Continue without location - just don't set region
        } else {
          addDebugInfo('Location permission granted, getting current location...');
          try {
            let currentLocation = await Location.getCurrentPositionAsync({
              timeout: 10000,
              accuracy: Location.Accuracy.Balanced,
            });
            addDebugInfo('Current location retrieved successfully');
            safeSetState(setLocation, currentLocation);

            safeSetState(setRegion, {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          } catch (locationError: any) {
            addDebugInfo(`Location error: ${locationError.message}`);
            // Continue without location
          }
        }
      } catch (permissionError: any) {
        addDebugInfo(`Permission error: ${permissionError.message}`);
        // Continue without location
      }

      addDebugInfo('Initialization completed successfully');
      safeSetState(setConnectionError, null);
    } catch (error: any) {
      addDebugInfo(`Initialization error: ${error.message}`);
      console.error('Initialization error:', error);
      safeSetState(setConnectionError, `Initialization failed: ${error.message}`);
    } finally {
      safeSetState(setLoading, false);
    }
  };

  const fetchCourses = async () => {
    if (connectionError || !isMounted) {
      addDebugInfo('Skipping course fetch - connection error or not mounted');
      return;
    }

    try {
      addDebugInfo('Starting course fetch...');
      safeSetState(setCourseError, null);
      
      // Add timeout to course fetch
      const coursePromise = supabase
        .from("GolfCourses")
        .select("*")
        .order("name");

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Course fetch timeout')), 15000);
      });

      const { data, error } = await Promise.race([coursePromise, timeoutPromise]) as any;
      
      if (error) {
        addDebugInfo(`Course fetch error: ${error.message}`);
        console.error('Course fetch error:', error);
        safeSetState(setCourseError, `Failed to load courses: ${error.message}`);
        return;
      }

      addDebugInfo(`Courses fetched successfully: ${data?.length || 0} courses`);
      safeSetState(setCourses, data || []);
      safeSetState(setCourseItems, 
        (data || []).map((course) => ({
          label: course.name,
          value: course.id,
        }))
      );
    } catch (error: any) {
      addDebugInfo(`Course fetch catch error: ${error.message}`);
      console.error('Course fetch error:', error);
      safeSetState(setCourseError, `Failed to load courses: ${error.message}`);
    }
  };

  const fetchHoles = async () => {
    if (!selectedCourseId || connectionError || !isMounted) {
      addDebugInfo('Skipping hole fetch - no course selected, connection error, or not mounted');
      return;
    }

    try {
      addDebugInfo(`Starting hole fetch for course: ${selectedCourseId}`);
      safeSetState(setHoleError, null);
      
      // Add timeout to hole fetch
      const holePromise = supabase
        .from("holes")
        .select("*")
        .eq("course_id", selectedCourseId)
        .order("hole_number", { ascending: true });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Hole fetch timeout')), 15000);
      });

      const { data, error } = await Promise.race([holePromise, timeoutPromise]) as any;
      
      if (error) {
        addDebugInfo(`Hole fetch error: ${error.message}`);
        console.error('Hole fetch error:', error);
        safeSetState(setHoleError, `Failed to load holes: ${error.message}`);
        return;
      }

      addDebugInfo(`Holes fetched successfully: ${data?.length || 0} holes`);
      safeSetState(setHoles, data || []);
      safeSetState(setHoleItems,
        (data || []).map((hole) => ({
          label: `Hole ${hole.hole_number}`,
          value: hole.hole_number,
        }))
      );
    } catch (error: any) {
      addDebugInfo(`Hole fetch catch error: ${error.message}`);
      console.error('Hole fetch error:', error);
      safeSetState(setHoleError, `Failed to load holes: ${error.message}`);
    }
  };

  // Initialize app when component mounts
  useFocusEffect(
    React.useCallback(() => {
      if (isMounted) {
        addDebugInfo('Component focused, initializing app...');
        initializeApp();
      }
    }, [isMounted])
  );

  // Fetch courses when connection is established
  useEffect(() => {
    if (!connectionError && isMounted) {
      addDebugInfo('Connection established, fetching courses...');
      fetchCourses();
    }
  }, [connectionError, isMounted]);

  // Fetch holes when course is selected
  useEffect(() => {
    if (selectedCourseId && !connectionError && isMounted) {
      addDebugInfo(`Course selected: ${selectedCourseId}, fetching holes...`);
      fetchHoles();
    }
  }, [selectedCourseId, connectionError, isMounted]);

  const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);

  useEffect(() => {
    if (!selectedHole || !mapRef.current || !isMounted) return;

    if (
      selectedHole.tee_latitude != null &&
      selectedHole.tee_longitude != null &&
      selectedHole.green_latitude != null &&
      selectedHole.green_longitude != null
    ) {
      addDebugInfo(`Animating map to hole ${selectedHole.hole_number}`);
      const centerLat =
        (selectedHole.tee_latitude + selectedHole.green_latitude) / 2;
      const centerLon =
        (selectedHole.tee_longitude + selectedHole.green_longitude) / 2;

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
  }, [selectedHole, isMounted]);

  const handleRetry = () => {
    addDebugInfo('Retry button pressed, resetting...');
    safeSetState(setConnectionError, null);
    safeSetState(setCourseError, null);
    safeSetState(setHoleError, null);
    safeSetState(setDebugInfo, '');
    initializeApp();
  };

  // Early returns for loading and error states
  if (!isMounted) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading course data...</Text>
        {debugInfo && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugLog}>{debugInfo}</Text>
          </View>
        )}
      </View>
    );
  }

  if (connectionError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>⚠️ {connectionError}</Text>
        <Text style={styles.errorSubText}>Please check your internet connection and try again.</Text>
        <Pressable onPress={handleRetry} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        {debugInfo && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugText}>Debug Info:</Text>
            <Text style={styles.debugLog}>{debugInfo}</Text>
          </View>
        )}
      </View>
    );
  }

  // Default region if location not available
  const defaultRegion = {
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const currentRegion = region || defaultRegion;

  return (
    <View style={styles.container}>
      <View style={styles.overlayContainer}>
        {courseError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{courseError}</Text>
          </View>
        )}
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={selectedCourseId}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={(callback) => {
            const newValue = callback(selectedCourseId);
            safeSetState(setSelectedCourseId, newValue);
            safeSetState(setSelectedHoleNumber, null);
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
          <>
            {holeError && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{holeError}</Text>
              </View>
            )}
            <DropDownPicker
              placeholder="Select a hole..."
              open={holeOpen}
              value={selectedHoleNumber}
              items={holeItems}
              setOpen={setHoleOpen}
              setValue={(callback) => {
                const newValue = callback(selectedHoleNumber);
                safeSetState(setSelectedHoleNumber, newValue);
              }}
              setItems={setHoleItems}
              style={styles.dropdown}
              dropDownContainerStyle={styles.dropdownContainer}
              placeholderStyle={styles.placeholder}
              textStyle={styles.text}
              listItemLabelStyle={styles.listItemLabel}
              zIndex={1000}
            />
          </>
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
        {selectedHole && selectedHole.tee_latitude && selectedHole.green_latitude && (
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
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    maxHeight: 200,
  },
  debugText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 5,
  },
  debugLog: {
    fontSize: 12,
    color: "#6B7280",
    fontFamily: "monospace",
  },
  errorContainer: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: 8,
  },
  errorText: {
    color: "#EF4444",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  errorSubText: {
    color: "#6B7280",
    textAlign: "center",
    fontSize: 14,
    marginTop: 5,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    paddingHorizontal: 30,
    borderRadius: 12,
    marginTop: 15,
    marginBottom: 10,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
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
  placeholder: {
    color: "#ccc",
  },
  text: {
    color: "#fff",
  },
  listItemLabel: {
    color: "#fff",
  },
});