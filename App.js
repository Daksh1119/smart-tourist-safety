import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Provider as PaperProvider } from 'react-native-paper';

// Firebase (Option 1 root file)
import './firebase';

// Auth Context
import { AuthProvider } from './context/AuthContext';

// Navigation container (ensure this file exists)
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  return (
    <PaperProvider>
      <AuthProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="light" translucent backgroundColor="transparent" />
          <AppNavigator />
        </View>
      </AuthProvider>
    </PaperProvider>
  );
}