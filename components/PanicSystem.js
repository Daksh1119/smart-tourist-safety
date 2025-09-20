import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PanicSystem = ({ visible, onClose }) => {
  const [isActivated, setIsActivated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [countdown, setCountdown] = useState(5);
  const [showCountdown, setShowCountdown] = useState(false);

  const [locationTracking, setLocationTracking] = useState(false);
  const [audioRecording, setAudioRecording] = useState(false);

  const [permissions, setPermissions] = useState({
    location: false,
    audio: false,
  });

  const recordingRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const modalScale = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(modalScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 90,
        friction: 10
      }).start();
      requestPermissions();
    } else {
      modalScale.setValue(0);
    }
  }, [visible]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    if (visible && !isActivated) loop.start(); else loop.stop();
    return () => loop.stop();
  }, [visible, isActivated]);

  useEffect(() => {
    return () => {
      stopLocationTracking();
      stopAudioRecording();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const requestPermissions = async () => {
    try {
      setIsLoading(true);
      setLoadingMessage('Requesting permissions...');
      const loc = await Location.requestForegroundPermissionsAsync();
      const aud = await Audio.requestPermissionsAsync();
      setPermissions({
        location: loc.status === 'granted',
        audio: aud.status === 'granted',
      });
      setIsLoading(false);
      setLoadingMessage('');
    } catch (e) {
      console.error('[PanicSystem] permission error', e);
      setIsLoading(false);
      setLoadingMessage('');
      Alert.alert('Permission Error', 'Could not request permissions.');
    }
  };

  const ensureDir = async () => {
    const dir = `${FileSystem.documentDirectory}panic_files/`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists)
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    return dir;
  };

  const getLocation = async () => {
    if (!permissions.location) return null;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });
      return {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: new Date().toISOString()
      };
    } catch {
      return {
        latitude: 19.0760,
        longitude: 72.8777,
        timestamp: new Date().toISOString(),
        error: 'Fallback location'
      };
    }
  };

  const persistLocations = async (arr) => {
    try {
      const dir = await ensureDir();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      await FileSystem.writeAsStringAsync(
        `${dir}location_${ts}.json`,
        JSON.stringify(arr, null, 2)
      );
    } catch (e) {
      console.warn('persistLocations error', e);
    }
  };

  const startLocationTracking = async () => {
    if (!permissions.location) return;
    setLocationTracking(true);
    const store = [];
    const first = await getLocation();
    if (first) store.push(first);
    await persistLocations(store);
    locationIntervalRef.current = setInterval(async () => {
      const cur = await getLocation();
      if (cur) {
        store.push(cur);
        await persistLocations(store);
      }
    }, 10000);
  };

  const stopLocationTracking = () => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = null;
    setLocationTracking(false);
  };

  const startAudioRecording = async () => {
    if (!permissions.audio) return;
    setAudioRecording(true);
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const dir = await ensureDir();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = `${dir}panic_audio_${ts}.m4a`;

    const { recording } = await Audio.Recording.createAsync({
      android: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
        audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
      },
      ios: {
        extension: '.m4a',
        outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
        audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        linearPCMBitDepth: 16,
        linearPCMIsBigEndian: false,
        linearPCMIsFloat: false,
      },
      web: { mimeType: 'audio/webm', bitsPerSecond: 128000 },
    });
    recordingRef.current = recording;

    setTimeout(async () => {
      try {
        if (recordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          const uri = recordingRef.current.getURI();
          if (uri) {
            await FileSystem.moveAsync({ from: uri, to: filePath });
          }
          recordingRef.current = null;
          setAudioRecording(false);
        }
      } catch {
        setAudioRecording(false);
      }
    }, 30000);
  };

  const stopAudioRecording = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
      setAudioRecording(false);
    } catch {}
  };

  const startCountdown = () => {
    setShowCountdown(true);
    setCountdown(5);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          activate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const activate = async () => {
    setIsLoading(true);
    setLoadingMessage('Activating panic mode...');
    setShowCountdown(false);
    setIsActivated(true);
    await Promise.all([
      startLocationTracking(),
      startAudioRecording(),
    ]);

    const session = {
      sessionId: Date.now().toString(),
      startTime: new Date().toISOString(),
      features: {
        locationTracking: true,
        audioRecording: true,
      }
    };
    await AsyncStorage.setItem('currentPanicSession', JSON.stringify(session));

    setIsLoading(false);
    setLoadingMessage('');
    Alert.alert(
      'Panic Mode Activated',
      'Features active:\n• Location tracking\n• Audio recording (30s)\nData stored locally.',
      [{ text: 'OK' }]
    );
  };

  const cancelPanicMode = async () => {
    setIsLoading(true);
    setLoadingMessage('Stopping panic mode...');
    stopLocationTracking();
    await stopAudioRecording();
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    await AsyncStorage.removeItem('currentPanicSession');
    setIsLoading(false);
    setLoadingMessage('');
    setIsActivated(false);
    setShowCountdown(false);
    setCountdown(5);
    Alert.alert('Panic Mode Stopped', 'Emergency features disabled.');
    onClose();
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setShowCountdown(false);
    setCountdown(5);
  };

  const renderPermissionStatus = () => {
    const items = [
      { key: 'location', name: 'Location', icon: 'location' },
      { key: 'audio', name: 'Microphone', icon: 'mic' },
    ];
    return (
      <View style={styles.permissionsContainer}>
        <Text style={styles.permissionsTitle}>Required Permissions:</Text>
        {items.map(i => (
          <View key={i.key} style={styles.permissionItem}>
            <Ionicons
              name={i.icon}
              size={16}
              color={permissions[i.key] ? '#4CAF50' : '#FF6B6B'}
            />
            <Text style={styles.permissionText}>{i.name}</Text>
            <Ionicons
              name={permissions[i.key] ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={permissions[i.key] ? '#4CAF50' : '#FF6B6B'}
            />
          </View>
        ))}
      </View>
    );
  };

  const renderStatus = () => {
    const items = [
      { key: 'location', name: 'Location Tracking', active: locationTracking, icon: 'location' },
      { key: 'audio', name: 'Audio Recording', active: audioRecording, icon: 'mic' },
    ];
    return (
      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Active Features:</Text>
        {items.map(i => (
          <View key={i.key} style={styles.statusItem}>
            <Ionicons
              name={i.icon}
              size={16}
              color={i.active ? '#4CAF50' : 'rgba(255,255,255,0.5)'}
            />
            <Text
              style={[
                styles.statusText,
                { color: i.active ? '#4CAF50' : 'rgba(255,255,255,0.5)' },
              ]}
            >
              {i.name}
            </Text>
            <Ionicons
              name={i.active ? 'radio-button-on' : 'radio-button-off'}
              size={16}
              color={i.active ? '#4CAF50' : 'rgba(255,255,255,0.5)'}
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (!isActivated && !showCountdown) onClose();
        else Alert.alert('Active', 'Stop panic mode first.');
      }}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ scale: modalScale }] },
          ]}
        >
          <LinearGradient
            colors={isActivated ? ['#4CAF50', '#45A049'] : ['#FF6B35', '#F7931E']}
            style={styles.modalGradient}
          >
            <View style={styles.modalContent}>
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="white" />
                  <Text style={styles.loadingText}>{loadingMessage}</Text>
                </View>
              )}

              {showCountdown && !isLoading && (
                <View style={styles.countdownContainer}>
                  <Text style={styles.countdownTitle}>Activating in</Text>
                  <Text style={styles.countdownNumber}>{countdown}</Text>
                  <Text style={styles.countdownSubtext}>Press cancel to abort</Text>
                  <TouchableOpacity
                    style={styles.cancelCountdownButton}
                    onPress={cancelCountdown}
                  >
                    <Text style={styles.cancelCountdownText}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isLoading && !showCountdown && !isActivated && (
                <>
                  <View style={styles.iconContainer}>
                    <Ionicons name="warning" size={60} color="white" />
                  </View>
                  <Text style={styles.modalTitle}>Emergency Panic Mode</Text>
                  <Text style={styles.modalMessage}>
                    Activate emergency features to protect yourself
                  </Text>
                  {renderPermissionStatus()}
                  <Text style={styles.featuresTitle}>This will activate:</Text>
                  <View style={styles.featuresList}>
                    <Text style={styles.featureItem}>📍 Continuous location tracking</Text>
                    <Text style={styles.featureItem}>🎙️ 30-second voice recording</Text>
                    <Text style={styles.featureItem}>💾 Local data storage</Text>
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={onClose}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: pulse }] }}>
                      <TouchableOpacity
                        style={styles.activateButton}
                        onPress={startCountdown}
                      >
                        <Text style={styles.activateButtonText}>ACTIVATE</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </>
              )}

              {!isLoading && !showCountdown && isActivated && (
                <>
                  <View style={styles.iconContainer}>
                    <Ionicons name="shield-checkmark" size={60} color="white" />
                  </View>
                  <Text style={styles.modalTitle}>Panic Mode Active</Text>
                  <Text style={styles.modalMessage}>
                    Emergency features are running in background
                  </Text>
                  {renderStatus()}
                  <Text style={styles.activeInfo}>
                    All data saved locally for safety.
                  </Text>
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={cancelPanicMode}
                  >
                    <Text style={styles.stopButtonText}>STOP PANIC MODE</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    overflow: 'hidden',
  },
  modalGradient: { padding: 0 },
  modalContent: { padding: 30, alignItems: 'center' },
  loadingContainer: { alignItems: 'center', padding: 40 },
  loadingText: { fontSize: 16, color: 'white', marginTop: 15, textAlign: 'center' },
  countdownContainer: { alignItems: 'center', padding: 40 },
  countdownTitle: { fontSize: 18, color: 'white', marginBottom: 10 },
  countdownNumber: { fontSize: 72, fontWeight: 'bold', color: 'white', marginVertical: 20 },
  countdownSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 30 },
  cancelCountdownButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  cancelCountdownText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  iconContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  modalTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 10, textAlign: 'center' },
  modalMessage: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  permissionsContainer: {
    width: '100%',
    marginBottom: 18,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
  },
  permissionsTitle: { fontSize: 14, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  permissionItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  permissionText: { fontSize: 14, color: 'white', marginLeft: 8, flex: 1 },
  statusContainer: {
    width: '100%',
    marginBottom: 20,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
  },
  statusTitle: { fontSize: 14, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  statusItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusText: { fontSize: 14, marginLeft: 8, flex: 1 },
  featuresTitle: { fontSize: 16, fontWeight: 'bold', color: 'white', marginBottom: 8, alignSelf: 'flex-start' },
  featuresList: { width: '100%', marginBottom: 28 },
  featureItem: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginBottom: 6, paddingLeft: 6 },
  buttonRow: { flexDirection: 'row', width: '100%', gap: 14 },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelButtonText: { fontSize: 16, fontWeight: '600', color: 'white' },
  activateButton: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  activateButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
  activeInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  stopButton: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  stopButtonText: { fontSize: 16, fontWeight: 'bold', color: 'white' },
});

export default PanicSystem;