import { supabase } from "@/components/supabase"; // make sure you have this!
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  Region,
} from "react-native-maps";

import { useLocalSearchParams } from "expo-router";

type Hole = {
  id: string;
  hole_number: number;
  par: number | null;
  yardage: number | null;
  tee_latitude: number | null;
  tee_longitude: number | null;
  green_latitude: number | null;
  green_longitude: number | null;
  course_id: string;
};

export default function CourseViewScreen() {
  const { courseId } = useLocalSearchParams();
  const myCourseId = courseId || "55f35035-2cb2-4693-9554-9536e07e3cc2";
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const mapRef = useRef<MapView | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Location permission is required to use this feature."
        );
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

  // Fetch holes from Supabase
  useEffect(() => {
    console.log("courseId param:", courseId);
    console.log("Using courseId:", myCourseId);

    const fetchHoles = async () => {
      const { data, error } = await supabase
        .from("holes")
        .select("*")
        .eq("course_id", myCourseId)
        .order("hole_number", { ascending: true });

        console.log("Fetched holes:", data);
        console.log("Error:", error);
      if (error) console.error(error);
      else setHoles(data);
    };

    fetchHoles();
  }, [courseId]);

  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        region={region}
        showsUserLocation
        showsMyLocationButton
        mapType="hybrid"
        onMapReady={() => {
          // Optionally fit all hole markers
          if (holes.length) {
            const coords = holes
            .flatMap((hole) => [
              hole.tee_latitude !== null && hole.tee_longitude !== null
                ? {
                    latitude: hole.tee_latitude,
                    longitude: hole.tee_longitude,
                  }
                : null,
              hole.green_latitude !== null && hole.green_longitude !== null
                ? {
                    latitude: hole.green_latitude,
                    longitude: hole.green_longitude,
                  }
                : null,
            ])
            .filter(
              (c): c is { latitude: number; longitude: number } => c !== null
            );
            mapRef.current?.fitToCoordinates(coords, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true,
            });
          }
        }}
      >
        {holes.map((hole) => (
  <React.Fragment key={hole.id}>
    {hole.tee_latitude && hole.tee_longitude && (
      <Marker
        key={`tee-${hole.id}`}
        coordinate={{
          latitude: hole.tee_latitude,
          longitude: hole.tee_longitude,
        }}
        pinColor="blue"
        title={`Hole ${hole.hole_number} Tee`}
      />
    )}
    {hole.green_latitude && hole.green_longitude && (
      <Marker
        key={`green-${hole.id}`}
        coordinate={{
          latitude: hole.green_latitude,
          longitude: hole.green_longitude,
        }}
        pinColor="green"
        title={`Hole ${hole.hole_number} Green`}
      />
    )}
    {hole.tee_latitude &&
      hole.green_latitude &&
      hole.tee_longitude &&
      hole.green_longitude && (
        <Polyline
          key={`line-${hole.id}`}
          coordinates={[
            {
              latitude: hole.tee_latitude,
              longitude: hole.tee_longitude,
            },
            {
              latitude: hole.green_latitude,
              longitude: hole.green_longitude,
            },
          ]}
          strokeColor="#00BFFF"
          strokeWidth={2}
        />
      )}
  </React.Fragment>
))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#040D12",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#040D12",
  },
});
