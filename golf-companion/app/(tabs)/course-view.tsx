import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import MapView, { Region } from 'react-native-maps';

export default function CourseViewScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
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
        style={{ flex: 1 }}
        region={region}
        showsUserLocation
        showsMyLocationButton
        mapType='hybrid'
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040D12',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#040D12',
  },
});
