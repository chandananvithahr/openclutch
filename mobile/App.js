import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import OnboardingFlow from './screens/OnboardingFlow';
import ChatScreen from './screens/ChatScreen';
import { bootstrapAuth, getToken } from './services/api';

const Stack = createStackNavigator();

// Get or create a stable device-scoped userId (replaced by real auth later)
async function getOrCreateUserId() {
  let userId = await AsyncStorage.getItem('clutch_user_id');
  if (!userId) {
    userId = uuidv4();
    await AsyncStorage.setItem('clutch_user_id', userId);
  }
  return userId;
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null); // null = loading

  useEffect(() => {
    async function init() {
      try {
        // Ensure we have a JWT before any API calls
        const existingToken = await getToken();
        if (!existingToken) {
          const userId = await getOrCreateUserId();
          await bootstrapAuth(userId);
        }
      } catch (e) {
        // Auth failed — app will still load; API calls will fail gracefully
        console.warn('Auth bootstrap failed:', e.message);
      }

      const done = await AsyncStorage.getItem('onboarding_done');
      setInitialRoute(done === 'true' ? 'Chat' : 'Onboarding');
    }
    init();
  }, []);

  // Show spinner while checking AsyncStorage
  if (!initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2D1B14' }}>
        <ActivityIndicator size="large" color="#FFE36D" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingFlow} />
          <Stack.Screen name="Chat" component={ChatScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
