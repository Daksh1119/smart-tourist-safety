import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  StatusBar,
  Dimensions,
  Animated,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import PanicSystem from '../components/PanicSystem';   // <-- NEW import (adjust path if placed elsewhere)

const { width, height } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { profile, logout } = useAuth();

  const [panicVisible, setPanicVisible] = useState(false); // NEW
  const [isLocationTracking, setIsLocationTracking] = useState(true);
  const [safetyScore, setSafetyScore] = useState(85);
  const [currentLocation, setCurrentLocation] = useState('Goa, India');
  const userName = profile?.fullName || 'Traveler';

  const [tripData] = useState({
    destination: 'Goa Beach Resort',
    startDate: '15 Sep 2025',
    endDate: '22 Sep 2025',
    daysRemaining: 5
  });

  const [alertCount] = useState(2);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scoreAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, delay: 300, useNativeDriver: true }),
      Animated.timing(scoreAnim, { toValue: safetyScore, duration: 1500, delay: 500, useNativeDriver: false }),
    ]).start();

    const id = scoreAnim.addListener(v => setDisplayScore(Math.round(v.value)));
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      scoreAnim.removeListener(id);
    };
  }, [safetyScore]);

  const getSafetyScoreColor = (score) => {
    if (score >= 80) return ['#4CAF50', '#8BC34A'];
    if (score >= 50) return ['#FF9800', '#FFC107'];
    return ['#F44336', '#E57373'];
  };

  const getSafetyScoreText = (score) => {
    if (score >= 80) return 'SAFE';
    if (score >= 50) return 'MODERATE';
    return 'HIGH RISK';
  };

  // Replaced: now just open modal
  const handlePanicButton = () => {
    setPanicVisible(true);
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Do you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          try { await logout(); } catch (e) { Alert.alert('Error', e.message); }
        }
      }
    ]);
  };

  const QuickActionButton = ({ icon, title, onPress, color, badge }) => (
    <TouchableOpacity style={styles.quickActionButton} onPress={onPress}>
      <LinearGradient
        colors={color || ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
        style={styles.quickActionGradient}
      >
        <View style={styles.quickActionContent}>
          <Ionicons name={icon} size={24} color="white" />
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.quickActionText}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../assets/login-background.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.6)']}
        style={styles.overlay}
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <Animated.View
          style={[styles.headerSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={styles.welcomeContainer}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName} numberOfLines={1}>{userName}</Text>
            </View>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Ionicons name="person-circle" size={46} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Trip Summary */}
        <Animated.View
          style={[styles.tripSummaryCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            style={styles.cardGradient}
          >
            <View style={styles.cardHeader}>
              <Ionicons name="location" size={20} color="#4ECDC4" />
              <Text style={styles.cardTitle}>Current Trip</Text>
            </View>
            <View style={styles.tripInfo}>
              <Text style={styles.destination}>{tripData.destination}</Text>
              <Text style={styles.location}>📍 {currentLocation}</Text>
              <View style={styles.tripDates}>
                <Text style={styles.dateText}>{tripData.startDate} - {tripData.endDate}</Text>
                <View style={styles.daysRemaining}>
                  <Text style={styles.daysRemainingText}>{tripData.daysRemaining} days left</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Safety Score */}
        <Animated.View
          style={[styles.safetyScoreCard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <LinearGradient
            colors={getSafetyScoreColor(safetyScore)}
            style={styles.safetyScoreGradient}
          >
            <View style={styles.safetyScoreContent}>
              <View style={styles.safetyScoreLeft}>
                <Text style={styles.safetyScoreLabel}>Safety Score</Text>
                <Animated.Text style={styles.safetyScoreNumber}>{displayScore}</Animated.Text>
                <Text style={styles.safetyScoreStatus}>{getSafetyScoreText(safetyScore)}</Text>
              </View>
              <View style={styles.safetyScoreRight}>
                <Ionicons
                  name={safetyScore >= 80 ? "shield-checkmark" : safetyScore >= 50 ? "warning" : "alert-circle"}
                  size={50}
                  color="white"
                />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          style={[styles.quickActionsSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={styles.sectionTitle}>Quick Actions</Text>

            {/* Main Panic Button (now opens modal) */}
            <Animated.View style={[styles.panicButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
              <TouchableOpacity onPress={handlePanicButton}>
                <LinearGradient
                  colors={['#FF4444', '#CC0000']}
                  style={styles.panicButton}
                >
                  <Ionicons name="alert" size={30} color="white" />
                  <Text style={styles.panicButtonText}>PANIC BUTTON</Text>
                  <Text style={styles.panicButtonSubtext}>Tap for Emergency</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

          <View style={styles.quickActionsGrid}>
            <QuickActionButton
              icon="navigate"
              title="Map & Location"
              onPress={() => navigation.navigate('TravelTracking')}
              color={['#4ECDC4', '#44A08D']}
            />
            <QuickActionButton
              icon="notifications"
              title="Alerts"
              onPress={() => Alert.alert('Coming Soon', 'Alerts screen not implemented yet')}
              color={['#FF6B6B', '#FF8E53']}
              badge={alertCount > 0 ? alertCount : null}
            />
            <QuickActionButton
              icon="card"
              title="Digital ID"
              onPress={() => navigation.navigate('Profile')}
              color={['#9B59B6', '#8E44AD']}
            />
            <QuickActionButton
              icon="time"
              title="Trip History"
              onPress={() => Alert.alert('Coming Soon', 'Trip history screen not implemented yet')}
              color={['#3498DB', '#2980B9']}
            />
          </View>
        </Animated.View>

        {/* Location Tracking Toggle */}
        <Animated.View
          style={[styles.trackingSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
            style={styles.trackingCard}
          >
            <View style={styles.trackingContent}>
              <View style={styles.trackingInfo}>
                <Ionicons
                  name={isLocationTracking ? "location" : "location-outline"}
                  size={24}
                  color={isLocationTracking ? "#4CAF50" : "rgba(255,255,255,0.6)"}
                />
                <View style={styles.trackingTextContainer}>
                  <Text style={styles.trackingTitle}>Real-time Location Tracking</Text>
                  <Text style={styles.trackingSubtitle}>
                    {isLocationTracking ? 'Sharing with emergency contacts' : 'Location sharing disabled'}
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: '#767577', true: '#4CAF50' }}
                thumbColor={isLocationTracking ? '#fff' : '#f4f3f4' }
                onValueChange={setIsLocationTracking}
                value={isLocationTracking}
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Recent Activities */}
        <Animated.View
          style={[styles.recentActivitiesSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <LinearGradient
            colors={['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']}
            style={styles.activityCard}
          >
            <View style={styles.activityItem}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.activityText}>Checked into Goa Beach Resort</Text>
              <Text style={styles.activityTime}>2h ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="warning" size={20} color="#FF9800" />
              <Text style={styles.activityText}>Entered moderate risk zone</Text>
              <Text style={styles.activityTime}>4h ago</Text>
            </View>
            <View style={styles.activityItem}>
              <Ionicons name="location" size={20} color="#4ECDC4" />
              <Text style={styles.activityText}>Location shared with family</Text>
              <Text style={styles.activityTime}>6h ago</Text>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            style={styles.logoutGradient}
          >
            <Ionicons name="log-out" size={20} color="white" />
            <Text style={styles.logoutText}>Logout</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* Panic System Modal */}
      <PanicSystem
        visible={panicVisible}
        onClose={() => setPanicVisible(false)}
      />
    </ImageBackground>
  );
};

/* (Existing styles unchanged) */
const styles = StyleSheet.create({
  backgroundImage: { flex: 1, width, height },
  overlay: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1 },
  scrollContent: {
    paddingTop: StatusBar.currentHeight + 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: { marginBottom: 20 },
  welcomeContainer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  welcomeText: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 2 },
  profileButton: { padding: 5 },

  tripSummaryCard: { marginBottom: 20, borderRadius: 20, overflow: 'hidden' },
  cardGradient: { padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: 'white', marginLeft: 10 },
  tripInfo: { gap: 8 },
  destination: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  location: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  tripDates: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10,
  },
  dateText: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  daysRemaining: { backgroundColor: '#4ECDC4', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  daysRemainingText: { fontSize: 12, fontWeight: 'bold', color: 'white' },

  safetyScoreCard: { marginBottom: 20, borderRadius: 20, overflow: 'hidden' },
  safetyScoreGradient: { padding: 20 },
  safetyScoreContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  safetyScoreLeft: { flex: 1 },
  safetyScoreLabel: { fontSize: 16, color: 'white', opacity: 0.9 },
  safetyScoreNumber: { fontSize: 48, fontWeight: 'bold', color: 'white' },
  safetyScoreStatus: { fontSize: 14, fontWeight: 'bold', color: 'white', marginTop: 5 },
  safetyScoreRight: { marginLeft: 20 },

  quickActionsSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: 'white', marginBottom: 15 },

  panicButtonContainer: { marginBottom: 15, borderRadius: 20, overflow: 'hidden' },
  panicButton: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  panicButtonText: { fontSize: 20, fontWeight: 'bold', color: 'white', marginTop: 8 },
  panicButtonSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },

  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickActionButton: { width: '48%', marginBottom: 12, borderRadius: 15, overflow: 'hidden' },
  quickActionGradient: {
    padding: 15, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  quickActionContent: { position: 'relative', marginBottom: 8 },
  badge: {
    position: 'absolute', top: -8, right: -8, backgroundColor: '#FF4444',
    borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: 'white' },
  quickActionText: { fontSize: 14, fontWeight: '600', color: 'white', textAlign: 'center' },

  trackingSection: { marginBottom: 20 },
  trackingCard: {
    borderRadius: 15, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  trackingContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  trackingInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  trackingTextContainer: { marginLeft: 12, flex: 1 },
  trackingTitle: { fontSize: 16, fontWeight: '600', color: 'white' },
  trackingSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  recentActivitiesSection: { marginBottom: 20 },
  activityCard: {
    borderRadius: 15, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activityText: { fontSize: 14, color: 'white', flex: 1, marginLeft: 12 },
  activityTime: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  logoutButton: { marginTop: 20, borderRadius: 15, overflow: 'hidden' },
  logoutGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: 'white', marginLeft: 8 },
});

export default HomeScreen;