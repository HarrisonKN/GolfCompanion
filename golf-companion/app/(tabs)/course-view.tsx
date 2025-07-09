import { supabase } from "@/components/supabase";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from "react-native";


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

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required.");
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      setRegion({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    })();
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      const { data, error } = await supabase
        .from("GolfCourses")
        .select("*")
        .order("name");
      if (error) console.error(error);
      else {
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
    const fetchHoles = async () => {
      const { data, error } = await supabase
        .from("holes")
        .select("*")
        .eq("course_id", selectedCourseId)
        .order("hole_number", { ascending: true });
      if (error) console.error(error);
      else {
        setHoles(data);
        setHoleItems(
          data.map((hole) => ({
            label: `Hole ${hole.hole_number}`,
            value: hole.hole_number,
          }))
        );
      }
    };
    fetchHoles();
  }, [selectedCourseId]);

  const selectedHole = holes.find((h) => h.hole_number === selectedHoleNumber);

  useEffect(() => {
    if (!selectedHole || !mapRef.current) return;

    if (
      selectedHole.tee_latitude != null &&
      selectedHole.tee_longitude != null &&
      selectedHole.green_latitude != null &&
      selectedHole.green_longitude != null
    ) {
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
  }, [selectedHole]);

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.overlayContainer}>
        <DropDownPicker
          placeholder="Select a course..."
          open={courseOpen}
          value={selectedCourseId}
          items={courseItems}
          setOpen={setCourseOpen}
          setValue={(callback) => {
            const newValue = callback(selectedCourseId);
            setSelectedCourseId(newValue);
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
            setValue={setSelectedHoleNumber}
            setItems={setHoleItems}
            style={styles.dropdown}
            dropDownContainerStyle={styles.dropdownContainer}
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
        region={region}
        showsUserLocation
        showsMyLocationButton
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
    backgroundColor: "#040D12",
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
