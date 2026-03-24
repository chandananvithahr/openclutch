import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, Linking,
  PermissionsAndroid, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'http://127.0.0.1:3000';

// ─── Step 1: Name ─────────────────────────────────────────────────────────────
function StepName({ onNext }) {
  const [name, setName] = useState('');

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.title}>Hi, I'm Clutch.</Text>
      <Text style={styles.subtitle}>Your personal AI assistant.</Text>
      <Text style={styles.question}>What's your name?</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#aaa"
        value={name}
        onChangeText={setName}
        autoFocus
      />
      <TouchableOpacity
        style={[styles.btn, !name.trim() && styles.btnDisabled]}
        onPress={() => name.trim() && onNext(name.trim())}
        disabled={!name.trim()}
      >
        <Text style={styles.btnText}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 2: Goals ────────────────────────────────────────────────────────────
const GOALS = [
  { key: 'investments', label: '📈 Investments & stocks' },
  { key: 'emails', label: '📧 Managing emails' },
  { key: 'expenses', label: '💸 Tracking expenses' },
  { key: 'jobs', label: '💼 Jobs & career' },
];

function StepGoals({ name, onNext }) {
  const [selected, setSelected] = useState([]);

  const toggle = (key) => {
    setSelected(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={styles.title}>Nice to meet you, {name}!</Text>
      <Text style={styles.question}>What do you want help with?</Text>
      {GOALS.map(g => (
        <TouchableOpacity
          key={g.key}
          style={[styles.goalBtn, selected.includes(g.key) && styles.goalBtnActive]}
          onPress={() => toggle(g.key)}
        >
          <Text style={[styles.goalBtnText, selected.includes(g.key) && styles.goalBtnTextActive]}>
            {g.label}
          </Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={[styles.btn, selected.length === 0 && styles.btnDisabled]}
        onPress={() => selected.length > 0 && onNext(selected)}
        disabled={selected.length === 0}
      >
        <Text style={styles.btnText}>Continue →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 3: Connect Broker ───────────────────────────────────────────────────
function StepBroker({ goals, onNext }) {
  const showBroker = goals.includes('investments');

  if (!showBroker) {
    // Skip straight past this step
    return (
      <View style={styles.stepContainer}>
        <Text style={styles.emoji}>⚡</Text>
        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>Connect your data sources to get started.</Text>
        <TouchableOpacity style={styles.btn} onPress={onNext}>
          <Text style={styles.btnText}>Continue →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>📊</Text>
      <Text style={styles.title}>Let's connect your broker.</Text>
      <Text style={styles.subtitle}>Takes 30 seconds. Clutch reads your portfolio — nothing else.</Text>

      <TouchableOpacity
        style={styles.brokerBtn}
        onPress={() => Linking.openURL(`${BACKEND_URL}/api/zerodha/login`)}
      >
        <Text style={styles.brokerBtnText}>🔗 Connect Zerodha</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.brokerBtn}
        onPress={() => onNext('angel_one_modal')}
      >
        <Text style={styles.brokerBtnText}>🔗 Connect Angel One</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={onNext}>
        <Text style={styles.skipText}>Skip for now →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 4: SMS Permission ────────────────────────────────────────────────────
// Always shown — SMS catches bank alerts from any number, Gmail catches from any email
function StepSmsPermission({ onNext }) {
  const [granted, setGranted] = useState(false);
  const [asking, setAsking] = useState(false);

  const requestPermission = async () => {
    if (Platform.OS !== 'android') {
      // iOS — skip SMS, rely on Gmail
      onNext(false);
      return;
    }

    setAsking(true);
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: 'Bank SMS Alerts',
          message:
            'Clutch reads your bank SMS alerts to track spending automatically. ' +
            'Only transaction amounts and merchants are used. ' +
            'Raw SMS content is never stored.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        }
      );
      const ok = result === PermissionsAndroid.RESULTS.GRANTED;
      setGranted(ok);
      // Short pause so user sees the tick, then move on
      setTimeout(() => onNext(ok), ok ? 800 : 0);
    } finally {
      setAsking(false);
    }
  };

  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>💸</Text>
      <Text style={styles.title}>Track spending automatically.</Text>
      <Text style={styles.subtitle}>
        Clutch reads your bank SMS alerts to track every transaction — no manual entry ever.
      </Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoRow}>✅ Detects HDFC, SBI, ICICI, Axis, Kotak & more</Text>
        <Text style={styles.infoRow}>✅ Also reads bank emails if SMS number differs</Text>
        <Text style={styles.infoRow}>✅ Used by Walnut, ETMONEY, MoneyView — Play Store approved</Text>
        <Text style={styles.infoRow}>🔒 No raw SMS stored — only amount + merchant + date</Text>
      </View>

      {granted ? (
        <View style={styles.grantedBox}>
          <Text style={styles.grantedText}>✅ Permission granted!</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.btn, asking && styles.btnDisabled]}
          onPress={requestPermission}
          disabled={asking}
        >
          <Text style={styles.btnText}>
            {asking ? 'Requesting...' : 'Allow Bank SMS Access'}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={() => onNext(false)}>
        <Text style={styles.skipText}>
          Skip — I'll use Gmail for expense tracking →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Step 5: Ready ────────────────────────────────────────────────────────────
function StepReady({ name, onDone }) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.emoji}>🚀</Text>
      <Text style={styles.title}>You're ready, {name}!</Text>
      <Text style={styles.subtitle}>Ask me anything about your money, emails, or career.</Text>
      <Text style={styles.hint}>Try: "How is my portfolio today?"</Text>
      <TouchableOpacity style={styles.btn} onPress={onDone}>
        <Text style={styles.btnText}>Open Clutch →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Onboarding Flow ─────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [goals, setGoals] = useState([]);

  const handleNameDone = async (n) => {
    setName(n);
    await AsyncStorage.setItem('user_name', n);
    setStep(2);
  };

  const handleGoalsDone = (g) => {
    setGoals(g);
    setStep(3);
  };

  const handleBrokerDone = () => setStep(4);

  const handleSmsDone = async (smsGranted) => {
    await AsyncStorage.setItem('sms_permission', smsGranted ? 'granted' : 'denied');
    setStep(5);
  };

  const handleOnboardingDone = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    navigation.replace('Chat');
  };

  const totalSteps = 5;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Progress dots */}
      <View style={styles.dots}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View key={i} style={[styles.dot, step >= i + 1 && styles.dotActive]} />
        ))}
      </View>

      {step === 1 && <StepName onNext={handleNameDone} />}
      {step === 2 && <StepGoals name={name} onNext={handleGoalsDone} />}
      {step === 3 && <StepBroker goals={goals} onNext={handleBrokerDone} />}
      {step === 4 && <StepSmsPermission onNext={handleSmsDone} />}
      {step === 5 && <StepReady name={name} onDone={handleOnboardingDone} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' },
  dotActive: { backgroundColor: '#6C63FF' },
  stepContainer: {
    flex: 1, paddingHorizontal: 28, paddingTop: 40, paddingBottom: 32,
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 24, lineHeight: 24 },
  question: { fontSize: 18, fontWeight: '600', color: '#1a1a1a', marginBottom: 20 },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    color: '#1a1a1a', marginBottom: 24,
  },
  btn: {
    backgroundColor: '#6C63FF', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { backgroundColor: '#c5c2f0' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  goalBtn: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 16, marginBottom: 12,
  },
  goalBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  goalBtnText: { fontSize: 15, color: '#555', fontWeight: '500' },
  goalBtnTextActive: { color: '#fff' },
  brokerBtn: {
    borderWidth: 1.5, borderColor: '#6C63FF', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  brokerBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 15 },
  skipText: {
    textAlign: 'center', color: '#aaa', fontSize: 14,
    marginTop: 16, paddingVertical: 8,
  },
  hint: {
    backgroundColor: '#f5f4ff', borderRadius: 10,
    padding: 14, fontSize: 14, color: '#6C63FF',
    fontStyle: 'italic', marginBottom: 32,
  },
  // SMS step
  infoBox: {
    backgroundColor: '#f5f4ff', borderRadius: 12,
    padding: 16, marginBottom: 28, gap: 10,
  },
  infoRow: { fontSize: 14, color: '#444', lineHeight: 20 },
  grantedBox: {
    backgroundColor: '#f0fdf4', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8, marginBottom: 8,
  },
  grantedText: { fontSize: 16, color: '#16a34a', fontWeight: '600' },
});
