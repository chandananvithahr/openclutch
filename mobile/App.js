import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-get-random-values';

import LoginScreen    from './screens/LoginScreen';
import OnboardingFlow from './screens/OnboardingFlow';
import ChatScreen     from './screens/ChatScreen';
import { getToken, clearToken } from './services/api';
import BACKEND_URL from './services/config';

const Stack = createStackNavigator();

function SplashScreen() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={splash.root}>
      <Animated.View style={[splash.logo, { transform: [{ scale: pulse }] }]}>
        <Text style={splash.logoText}>C</Text>
      </Animated.View>
      <Text style={splash.wordmark}>Clutch</Text>
      <Text style={splash.tagline}>Your life's control room.</Text>
    </View>
  );
}

const splash = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#2D1B14',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFE36D',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFE36D',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  logoText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2D1B14',
    letterSpacing: -0.5,
  },
  wordmark: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F5F0EB',
    letterSpacing: 0.2,
  },
  tagline: {
    fontSize: 13,
    color: '#8B7A6B',
    marginTop: -4,
  },
});

// Auth state machine: 'loading' | 'unauthenticated' | 'onboarding' | 'chat'
export default function App() {
  const [authState, setAuthState] = useState('loading');

  // Check if user already completed onboarding (local flag OR backend profile exists)
  const isOnboardingDone = useCallback(async (token) => {
    const local = await AsyncStorage.getItem('onboarding_done');
    if (local === 'true') return true;
    // Local flag missing (cleared app data) — check backend
    try {
      const res = await fetch(`${BACKEND_URL}/api/onboarding/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.profile?.name) {
          await AsyncStorage.setItem('onboarding_done', 'true');
          return true;
        }
      }
    } catch {}
    return false;
  }, []);

  const checkAuth = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setAuthState('unauthenticated');
      return;
    }
    const done = await isOnboardingDone(token);
    setAuthState(done ? 'chat' : 'onboarding');
  }, [isOnboardingDone]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Called by LoginScreen after successful signup or login
  const handleAuthSuccess = useCallback(async () => {
    const token = await getToken();
    const done = await isOnboardingDone(token);
    setAuthState(done ? 'chat' : 'onboarding');
  }, [isOnboardingDone]);

  // Called by OnboardingFlow on completion
  const handleOnboardingDone = useCallback(() => {
    setAuthState('chat');
  }, []);

  // Called by ChatScreen sidebar logout button
  const handleLogout = useCallback(async () => {
    await clearToken();
    await AsyncStorage.multiRemove(['onboarding_done']);
    setAuthState('unauthenticated');
  }, []);

  // Loading splash — pulsing logo
  if (authState === 'loading') {
    return <SplashScreen />;
  }

  // Not logged in → show LoginScreen (outside NavigationContainer — simpler, no nav overhead)
  if (authState === 'unauthenticated') {
    return (
      <SafeAreaProvider>
        <LoginScreen onAuthSuccess={handleAuthSuccess} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={authState === 'chat' ? 'Chat' : 'Onboarding'}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Onboarding">
            {(props) => <OnboardingFlow {...props} onDone={handleOnboardingDone} />}
          </Stack.Screen>
          <Stack.Screen name="Chat">
            {(props) => <ChatScreen {...props} onLogout={handleLogout} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
