import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signup, login } from '../services/api';

const C = {
  bg:        '#2D1B14',
  surface:   '#3A2820',
  accent:    '#FFE36D',
  text:      '#F5F0EB',
  textMuted: '#B8A99A',
  textFaint: '#6B5C4D',
  error:     '#FF6B6B',
  border:    '#4A3428',
  inputBg:   '#221410',
};

export default function LoginScreen({ onAuthSuccess }) {
  const insets = useSafeAreaInsets();
  const [mode, setMode]       = useState('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const emailRef    = useRef(null);
  const passwordRef = useRef(null);

  const switchMode = useCallback((m) => {
    setMode(m);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
  }, []);

  const handleSubmit = useCallback(async () => {
    setError('');
    const trimEmail = email.trim().toLowerCase();
    const trimName  = name.trim();

    if (!trimEmail || !password) {
      setError('Email and password are required.');
      return;
    }
    if (mode === 'signup') {
      if (!trimName)            { setError('Name is required.'); return; }
      if (password.length < 8)  { setError('Password must be at least 8 characters.'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signup') await signup(trimName, trimEmail, password);
      else                   await login(trimEmail, password);
      onAuthSuccess();
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }, [mode, name, email, password, onAuthSuccess]);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── CRED-style: logo mark top, no card wrapper ── */}
        <View style={styles.top}>
          {/* Logo */}
          <View style={styles.logoMark}>
            <Text style={styles.logoLetter}>C</Text>
          </View>

          {/* Big headline — CRED Super Type style */}
          <Text style={styles.headline}>
            {mode === 'login' ? 'Welcome\nback.' : 'Take\ncontrol.'}
          </Text>
          <Text style={styles.sub}>
            {mode === 'login'
              ? 'Your money, career, and health — all in one place.'
              : 'Set up in 30 seconds. No fluff.'}
          </Text>
        </View>

        {/* ── Fields — float on dark bg, no card ── */}
        <View style={styles.fields}>
          {mode === 'signup' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your first name"
                placeholderTextColor={C.textFaint}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              ref={emailRef}
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={C.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={mode === 'signup' ? 'Min 8 characters' : '••••••••'}
              placeholderTextColor={C.textFaint}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        </View>

        {/* ── Error ── */}
        {!!error && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── CTA — full width, CRED style ── */}
        <TouchableOpacity
          style={[styles.cta, loading && styles.ctaLoading]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color={C.bg} />
            : <Text style={styles.ctaText}>
                {mode === 'login' ? 'Log In' : 'Create Account'}
              </Text>
          }
        </TouchableOpacity>

        {/* ── Mode switch — minimal text, CRED style ── */}
        <View style={styles.switchRow}>
          <TouchableOpacity
            style={[styles.switchTab, mode === 'login' && styles.switchTabActive]}
            onPress={() => switchMode('login')}
          >
            <Text style={[styles.switchTabText, mode === 'login' && styles.switchTabTextActive]}>
              Log In
            </Text>
          </TouchableOpacity>
          <View style={styles.switchDivider} />
          <TouchableOpacity
            style={[styles.switchTab, mode === 'signup' && styles.switchTabActive]}
            onPress={() => switchMode('signup')}
          >
            <Text style={[styles.switchTabText, mode === 'signup' && styles.switchTabTextActive]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Trust line ── */}
        <Text style={styles.trust}>
          Your data stays yours. Read-only. Never sold.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  // ── Top section ──
  top: {
    paddingTop: 48,
    marginBottom: 40,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  logoLetter: {
    fontSize: 22,
    fontWeight: '800',
    color: C.bg,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 42,
    fontWeight: '800',
    color: C.text,
    lineHeight: 50,
    letterSpacing: -1,
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    color: C.textMuted,
    lineHeight: 22,
  },

  // ── Fields ──
  fields: {
    gap: 20,
    marginBottom: 24,
  },
  field: {},
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.textFaint,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: C.text,
    fontWeight: '500',
  },

  // ── Error ──
  errorWrap: {
    backgroundColor: 'rgba(255,107,107,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: C.error,
  },
  errorText: {
    color: C.error,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── CTA ──
  cta: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 28,
  },
  ctaLoading: { opacity: 0.7 },
  ctaText: {
    color: C.bg,
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.2,
  },

  // ── Mode switcher — two underlined tabs ──
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginBottom: 32,
  },
  switchDivider: {
    width: 1,
    height: 14,
    backgroundColor: C.border,
  },
  switchTab: {
    paddingVertical: 4,
  },
  switchTabActive: {},
  switchTabText: {
    fontSize: 14,
    color: C.textFaint,
    fontWeight: '500',
  },
  switchTabTextActive: {
    color: C.accent,
    fontWeight: '700',
  },

  // ── Trust ──
  trust: {
    color: C.textFaint,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
