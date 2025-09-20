import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ImageBackground,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Restricted zones data for Jammu & Kashmir
const RESTRICTED_ZONES = [
  // JAMMU DIVISION
  {
    id: 'jammu_1',
    name: 'Janiur Area',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.7266, longitude: 74.8570 },
      { latitude: 32.7280, longitude: 74.8590 },
      { latitude: 32.7250, longitude: 74.8610 },
      { latitude: 32.7235, longitude: 74.8585 },
    ]
  },
  {
    id: 'jammu_2',
    name: 'Peer Mitha (Gujjar Nagar)',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.7180, longitude: 74.8520 },
      { latitude: 32.7195, longitude: 74.8540 },
      { latitude: 32.7165, longitude: 74.8560 },
      { latitude: 32.7150, longitude: 74.8535 },
    ]
  },
  {
    id: 'jammu_3',
    name: 'Bhatindi and Sunjwan',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.6980, longitude: 74.8420 },
      { latitude: 32.6995, longitude: 74.8440 },
      { latitude: 32.6965, longitude: 74.8460 },
      { latitude: 32.6950, longitude: 74.8435 },
    ]
  },
  {
    id: 'jammu_4',
    name: 'Bahu Fort area (Kalka Colony)',
    district: 'Jammu',
    coordinates: [
      { latitude: 32.7320, longitude: 74.8680 },
      { latitude: 32.7335, longitude: 74.8700 },
      { latitude: 32.7305, longitude: 74.8720 },
      { latitude: 32.7290, longitude: 74.8695 },
    ]
  },
  // RAJOURI
  {
    id: 'rajouri_1',
    name: 'Sarola',
    district: 'Rajouri',
    coordinates: [
      { latitude: 33.3827, longitude: 74.3110 },
      { latitude: 33.3842, longitude: 74.3130 },
      { latitude: 33.3812, longitude: 74.3150 },
      { latitude: 33.3797, longitude: 74.3125 },
    ]
  },
  // KASHMIR DIVISION - Key areas
  {
    id: 'srinagar_1',
    name: 'Ahmed Nagar',
    district: 'Srinagar',
    coordinates: [
      { latitude: 34.0837, longitude: 74.7973 },
      { latitude: 34.0852, longitude: 74.7993 },
      { latitude: 34.0822, longitude: 74.8013 },
      { latitude: 34.0807, longitude: 74.7988 },
    ]
  },
  {
    id: 'srinagar_2',
    name: 'Lal Bazar',
    district: 'Srinagar',
    coordinates: [
      { latitude: 34.0896, longitude: 74.8060 },
      { latitude: 34.0911, longitude: 74.8080 },
      { latitude: 34.0881, longitude: 74.8100 },
      { latitude: 34.0866, longitude: 74.8075 },
    ]
  },
  {
    id: 'bandipora_1',
    name: 'Parray Mohalla',
    district: 'Bandipora',
    coordinates: [
      { latitude: 34.4196, longitude: 74.6450 },
      { latitude: 34.4211, longitude: 74.6470 },
      { latitude: 34.4181, longitude: 74.6490 },
      { latitude: 34.4166, longitude: 74.6465 },
    ]
  },
  // Add more zones as needed - this is a sample subset
];

// ⭐ NEW: Add an array of safe zones
const SAFE_ZONES = [
  {
    id: 'safe_1',
    name: 'Jammu Police Station',
    coordinates: { latitude: 32.7300, longitude: 74.8650 },
  },
  {
    id: 'safe_2',
    name: 'Srinagar Hospital',
    coordinates: { latitude: 34.0860, longitude: 74.7995 },
  },
  {
    id: 'safe_3',
    name: 'Rajouri Army Base',
    coordinates: { latitude: 33.3850, longitude: 74.3140 },
  },
];

const TravelTrackingScreen = () => {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  // ⭐ UPDATED: Track risk level and violated zone
  const [riskLevel, setRiskLevel] = useState('low'); // 'low', 'moderate', 'high'
  const [violatedZone, setViolatedZone] = useState(null);
  const mapRef = useRef(null);
  const locationSubscription = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Point in polygon algorithm for geo-fencing
  const isPointInPolygon = (point, polygon) => {
    const x = point.latitude;
    const y = point.longitude;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].latitude;
      const yi = polygon[i].longitude;
      const xj = polygon[j].latitude;
      const yj = polygon[j].longitude;

      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  };

  // ⭐ NEW: Haversine formula to calculate distance between two points on Earth
  const haversineDistance = (coords1, coords2) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371e3; // Earth's radius in meters
    const lat1 = toRad(coords1.latitude);
    const lon1 = toRad(coords1.longitude);
    const lat2 = toRad(coords2.latitude);
    const lon2 = toRad(coords2.longitude);
  
    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;
  
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
    return R * c; // Returns distance in meters
  };

  // Check if user is in any restricted zone
  const checkRestrictedZones = (currentLocation) => {
    for (let zone of RESTRICTED_ZONES) {
      if (isPointInPolygon(currentLocation.coords, zone.coordinates)) {
        return zone;
      }
    }
    return null;
  };
  
  // ⭐ NEW: Check if user is near a restricted zone
const checkProximityToRestrictedZones = (userLocation) => {
  const PROXIMITY_THRESHOLD_METERS = 10000; // Define your "near" distance here, now set to 10km

  for (let zone of RESTRICTED_ZONES) {
    // Find the center of the polygon for a simple distance check
    const zoneCenter = zone.coordinates.reduce(
      (acc, coord) => ({
        latitude: acc.latitude + coord.latitude,
        longitude: acc.longitude + coord.longitude,
      }),
      { latitude: 0, longitude: 0 }
    );
    zoneCenter.latitude /= zone.coordinates.length;
    zoneCenter.longitude /= zone.coordinates.length;

    const distance = haversineDistance(userLocation.coords, zoneCenter);
    if (distance <= PROXIMITY_THRESHOLD_METERS) {
      return zone;
    }
  }
  return null;
};

  // ⭐ NEW: Find the nearest safe zone
  const findNearestSafeZone = (userLocation) => {
    let nearestZone = null;
    let minDistance = Infinity;

    for (let zone of SAFE_ZONES) {
      const distance = haversineDistance(userLocation.coords, zone.coordinates);
      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = zone;
      }
    }
    return nearestZone;
  };

  // Send SMS notification using Twilio
  const sendSMSNotification = async (zone, userLocation) => {
    try {
      // Replace with your Twilio credentials from .env
      const TWILIO_ACCOUNT_SID = process.env.EXPO_PUBLIC_TWILIO_ACCOUNT_SID;
      const TWILIO_AUTH_TOKEN = process.env.EXPO_PUBLIC_TWILIO_AUTH_TOKEN;
      const TWILIO_PHONE_NUMBER = process.env.EXPO_PUBLIC_TWILIO_PHONE_NUMBER;
      const ALERT_PHONE_NUMBER = process.env.EXPO_PUBLIC_ALERT_PHONE_NUMBER;

      const message = `ALERT: User has entered restricted zone "${zone.name}" in ${zone.district} district. Location: ${userLocation.coords.latitude}, ${userLocation.coords.longitude}. Time: ${new Date().toLocaleString()}`;

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `From=${TWILIO_PHONE_NUMBER}&To=${ALERT_PHONE_NUMBER}&Body=${encodeURIComponent(message)}`,
      });

      if (response.ok) {
        console.log('SMS notification sent successfully');
      } else {
        console.error('Failed to send SMS notification');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
    }
  };

  // ⭐ UPDATED: Handle location updates with new risk logic
  const handleLocationUpdate = (newLocation) => {
    setLocation(newLocation);
    
    const restrictedZone = checkRestrictedZones(newLocation);
    const nearbyRestrictedZone = checkProximityToRestrictedZones(newLocation);
    const nearestSafeZone = findNearestSafeZone(newLocation);

    if (restrictedZone && restrictedZone.id !== violatedZone?.id) {
      // HIGH ALERT: Inside a restricted zone
      setRiskLevel('high');
      setViolatedZone(restrictedZone);
      Alert.alert(
        '⚠️ HIGH ALERT: Restricted Area',
        `You have entered a restricted zone: ${restrictedZone.name} in ${restrictedZone.district} district. Please exit immediately and go to the nearest safe zone: ${nearestSafeZone.name}.`,
        [{ text: 'OK' }]
      );
      sendSMSNotification(restrictedZone, newLocation);
    } else if (nearbyRestrictedZone && nearbyRestrictedZone.id !== violatedZone?.id) {
      // MODERATE ALERT: Near a restricted zone
      setRiskLevel('moderate');
      setViolatedZone(nearbyRestrictedZone);
      Alert.alert(
        '⚠️ WARNING: High Risk Area',
        `You are approaching a restricted zone: ${nearbyRestrictedZone.name}. Proceed with caution and consider a different route. Nearest safe zone: ${nearestSafeZone.name}.`,
        [{ text: 'OK' }]
      );
    } else if (!restrictedZone && !nearbyRestrictedZone) {
      // LOW ALERT: Safe area
      setRiskLevel('low');
      setViolatedZone(null); // Clear any previous alerts
    }
  };

  // Start live tracking
  const startTracking = async () => {
    if (!isTracking) {
      setIsTracking(true);
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 10,
        },
        handleLocationUpdate
      );
    }
  };

  // Stop live tracking
  const stopTracking = () => {
    if (isTracking && locationSubscription.current) {
      locationSubscription.current.remove();
      setIsTracking(false);
    }
  };

  // Center map on user location
  const centerMapOnUser = () => {
    if (location && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  };

  let text = 'Waiting...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={{ uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80' }}
        style={styles.backgroundImage}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
          style={styles.overlay}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Live Location Tracker</Text>
            <Text style={styles.headerSubtitle}>Kashmir Travel Safety</Text>
          </View>

          {/* Map Container */}
          <View style={styles.mapContainer}>
            {location ? (
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                showsUserLocation={true}
                showsMyLocationButton={false}
                followsUserLocation={isTracking}
              >
                {/* User location marker */}
                <Marker
                  coordinate={{
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  }}
                  title="Your Location"
                  description={`Lat: ${location.coords.latitude.toFixed(4)}, Lng: ${location.coords.longitude.toFixed(4)}`}
                >
                  <View style={styles.userMarker}>
                    <Ionicons name="person" size={20} color="white" />
                  </View>
                </Marker>
                
                {/* ⭐ NEW: Add Markers for safe zones */}
                {SAFE_ZONES.map((zone) => (
                  <Marker
                    key={zone.id}
                    coordinate={zone.coordinates}
                    title={zone.name}
                    pinColor="#4CAF50"
                  />
                ))}

                {/* Restricted zones polygons */}
                {RESTRICTED_ZONES.map((zone) => (
                  <Polygon
                    key={zone.id}
                    coordinates={zone.coordinates}
                    fillColor="rgba(255, 0, 0, 0.3)"
                    strokeColor="rgba(255, 0, 0, 0.8)"
                    strokeWidth={2}
                  />
                ))}
              </MapView>
            ) : (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading Map...</Text>
              </View>
            )}
          </View>

          {/* ⭐ UPDATED: Status Panel with risk levels */}
          <View style={styles.statusPanel}>
            <View style={styles.statusHeader}>
              <Text style={styles.statusTitle}>Tracking Status</Text>
              <View style={[styles.statusIndicator, { backgroundColor: isTracking ? '#4CAF50' : '#FF5722' }]} />
            </View>
            
            <Text style={styles.coordinatesText}>📍 {text}</Text>
            
            {/* Display alert based on risk level */}
            {riskLevel === 'high' && violatedZone && (
              <View style={[styles.alertContainer, styles.highAlert]}>
                <Ionicons name="warning" size={20} color="#FF5722" />
                <Text style={styles.alertText}>
                  HIGH ALERT: In Restricted Zone: {violatedZone.name}
                </Text>
              </View>
            )}

            {riskLevel === 'moderate' && violatedZone && (
              <View style={[styles.alertContainer, styles.moderateAlert]}>
                <Ionicons name="warning" size={20} color="#FFD700" />
                <Text style={styles.alertText}>
                  MODERATE ALERT: Near Restricted Zone: {violatedZone.name}
                </Text>
              </View>
            )}

            {/* Display nearest safe zone */}
            {location && (
              <View style={styles.safeZoneContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#4CAF50" />
                <Text style={styles.safeZoneText}>
                  Nearest Safe Zone: {findNearestSafeZone(location).name}
                </Text>
              </View>
            )}
          </View>

          {/* Control Buttons */}
          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: isTracking ? '#FF5722' : '#4CAF50' }]}
              onPress={isTracking ? stopTracking : startTracking}
            >
              <Ionicons 
                name={isTracking ? "stop" : "play"} 
                size={24} 
                color="white" 
              />
              <Text style={styles.buttonText}>
                {isTracking ? 'Stop Tracking' : 'Start Tracking'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: '#2196F3' }]}
              onPress={centerMapOnUser}
            >
              <Ionicons name="locate" size={24} color="white" />
              <Text style={styles.buttonText}>Center Map</Text>
            </TouchableOpacity>
          </View>

          {/* Info Panel */}
          <View style={styles.infoPanel}>
            <Text style={styles.infoPanelTitle}>🛡️ Safety Information</Text>
            <Text style={styles.infoPanelText}>
              {RESTRICTED_ZONES.length} restricted zones are being monitored.
              Emergency contacts will be notified if you enter any restricted area.
            </Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: Platform.OS === 'ios' ? 40 : 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    opacity: 0.95,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'white',
    opacity: 0.8,
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  mapContainer: {
    height: height * 0.4,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    opacity: 0.8,
  },
  userMarker: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  statusPanel: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 15,
    padding: 15,
    marginTop: 15,
    backdropFilter: 'blur(10px)',
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    opacity: 0.9,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  coordinatesText: {
    fontSize: 14,
    color: 'white',
    opacity: 0.85,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  alertContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
  },
  // ⭐ NEW: Specific styles for each alert level
  highAlert: {
    backgroundColor: 'rgba(255, 87, 34, 0.2)',
    borderLeftColor: '#FF5722',
  },
  moderateAlert: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderLeftColor: '#FFD700',
  },
  alertText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.95,
  },
  // ⭐ NEW: Safe zone styles
  safeZoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  safeZoneText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.95,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    flex: 0.48,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonText: {
    color: 'white',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  infoPanel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
  },
  infoPanelTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    opacity: 0.9,
  },
  infoPanelText: {
    fontSize: 13,
    color: 'white',
    opacity: 0.8,
    lineHeight: 18,
  },
});

export default TravelTrackingScreen;