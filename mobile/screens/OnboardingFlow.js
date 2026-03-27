'use strict';

// OnboardingFlow — 2-step, Cleo Super Type style
// Step 0: Name + occupation
// Step 1: Domain priorities → chat

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Vibration, Platform, ActivityIndicator,
  KeyboardAvoidingView, Animated, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingCard from '../components/OnboardingCard';
import BACKEND_URL from '../services/config';
import { getToken } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

const C = {
  bg:        '#2D1B14',
  card:      '#3A2820',
  accent:    '#FFE36D',
  success:   '#4CAF50',
  text:      '#F5F0EB',
  textMuted: '#B8A99A',
  inputBg:   '#4A3028',
  border:    '#6B4C3A',
};

// Domain options — NO emoji, clean labels with short descriptors
const DOMAIN_OPTIONS = [
  { id: 'money',  label: 'Money',   sub: 'Spend less, save more' },
  { id: 'career', label: 'Career',  sub: 'Jobs, salary, growth' },
  { id: 'health', label: 'Health',  sub: 'Steps, sleep, fitness' },
  { id: 'mind',   label: 'Mind',    sub: 'Mood, stress, patterns' },
];

function haptic() {
  if (Platform.OS === 'android') Vibration.vibrate(25);
}

// ─── BigChoice — two large pill cards, text-only ─────────────────────────────
function BigChoice({ options, selected, onSelect }) {
  return (
    <View style={styles.bigChoiceRow}>
      {options.map(opt => {
        const active = selected === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.bigChoiceCard, active && styles.bigChoiceCardActive]}
            onPress={() => { haptic(); onSelect(opt.id); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.bigChoiceLabel, active && styles.bigChoiceLabelActive]}>
              {opt.label}
            </Text>
            {opt.sub && (
              <Text style={[styles.bigChoiceSub, active && styles.bigChoiceSubActive]}>
                {opt.sub}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── MultiSelect — pill chips, text-only ─────────────────────────────────────
function MultiSelect({ options, selected, onToggle }) {
  return (
    <View style={styles.chipGrid}>
      {options.map(opt => {
        const active = selected.includes(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => { haptic(); onToggle(opt.id); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>
              {opt.label}
            </Text>
            <Text style={[styles.chipSub, active && styles.chipSubActive]}>
              {opt.sub}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Progress — elongated pill bar (Cleo style) ───────────────────────────────
function ProgressBar({ total, current }) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.progressPill, i <= current && styles.progressPillActive]}
        />
      ))}
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingFlow({ onDone, navigation }) {
  const [step, setStep]       = useState(0);
  const [saving, setSaving]   = useState(false);
  const [name, setName]       = useState('');
  const [occupation, setOccupation]   = useState(null);
  const [domainPriorities, setDomainPriorities] = useState([]);
  const [reaction, setReaction] = useState('');

  // Slide animation for step transitions
  const slideAnim = useRef(new Animated.Value(0)).current;
  const TOTAL_STEPS = 2;

  function showReaction(text) {
    setReaction(text);
    setTimeout(() => setReaction(''), 5000);
  }

  function next() {
    haptic();
    // Slide out left, then snap to right, slide in
    Animated.timing(slideAnim, {
      toValue: -SCREEN_W * 0.3,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(SCREEN_W * 0.3);
      setStep(s => s + 1);
      setReaction('');
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }

  function toggleMulti(id) {
    haptic();
    setDomainPriorities(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // ── Step 0: Name + Occupation ──────────────────────────────────────────────
  function renderStep0() {
    const nameReady = name.trim().length > 0;

    return (
      <OnboardingCard
        headline="What should I call you?"
        subtext="30 seconds to set up. Zero fluff."
        showSkip={false}
        reactionText={reaction}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Your first name"
          placeholderTextColor={C.textMuted}
          value={name}
          onChangeText={t => {
            setName(t);
            if (t.trim().length >= 2 && !reaction) {
              showReaction(`Hey ${t.trim()}! One more thing and you're in.`);
            }
          }}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
        />

        {nameReady && (
          <>
            <Text style={styles.sectionLabel}>You are...</Text>
            <BigChoice
              options={[
                { id: 'working', label: 'Working', sub: 'Salary, investments, EMIs' },
                { id: 'student', label: 'Student', sub: 'Budgets, career, internships' },
              ]}
              selected={occupation}
              onSelect={val => {
                setOccupation(val);
                const r = val === 'working'
                  ? `Got it, ${name.trim()}. I'll track salary, spending, and investments.`
                  : `Smart start, ${name.trim()}. Building habits early is the biggest edge.`;
                showReaction(r);
                setTimeout(next, 900);
              }}
            />
          </>
        )}
      </OnboardingCard>
    );
  }

  // ── Step 1: Domain priorities ──────────────────────────────────────────────
  function renderStep1() {
    return (
      <OnboardingCard
        headline={`What matters most${name.trim() ? `, ${name.trim()}` : ''}?`}
        subtext="I'll lead with this. Change it anytime."
        reactionText={reaction}
        showSkip
        onSkip={handleComplete}
      >
        <MultiSelect
          options={DOMAIN_OPTIONS}
          selected={domainPriorities}
          onToggle={id => {
            toggleMulti(id);
            const reactions = {
              money:  'Every rupee tracked. No surprises.',
              career: 'Career moves = income moves. On it.',
              health: 'Sleep, steps, heart rate — all connected.',
              mind:   'Stress patterns show up in your spending. I track that.',
            };
            showReaction(reactions[id]);
          }}
        />

        <TouchableOpacity
          style={[styles.ctaButton, saving && { opacity: 0.6 }]}
          onPress={handleComplete}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={C.bg} />
            : <Text style={styles.ctaText}>
                {domainPriorities.length > 0 ? "Let's go" : "Skip — take me to chat"}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.footnote}>
          I'll ask about salary, health, and connections naturally in chat
        </Text>
      </OnboardingCard>
    );
  }

  async function handleComplete() {
    setSaving(true);
    try {
      const userId = await AsyncStorage.getItem('userId') || `user_${Date.now()}`;
      await AsyncStorage.setItem('userId', userId);

      const token = await getToken();
      await fetch(`${BACKEND_URL}/api/onboarding/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId,
          name: name.trim() || 'User',
          occupation,
          domain_priorities: domainPriorities,
          tone: 'pro',
        }),
      });

      await AsyncStorage.setItem('onboarding_done', 'true');
      onDone ? onDone() : navigation?.replace('Chat');
    } catch {
      await AsyncStorage.setItem('onboarding_done', 'true');
      onDone ? onDone() : navigation?.replace('Chat');
    } finally {
      setSaving(false);
    }
  }

  const steps = [renderStep0, renderStep1];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        <View style={styles.progressWrap}>
          <ProgressBar total={TOTAL_STEPS} current={step} />
        </View>
        <Animated.View
          style={[styles.stepWrap, { transform: [{ translateX: slideAnim }] }]}
        >
          {steps[step] ? steps[step]() : null}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  progressWrap: {
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 28,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  progressPill: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.border,
  },
  progressPillActive: {
    backgroundColor: C.accent,
  },

  stepWrap: { flex: 1 },

  // Section label
  sectionLabel: {
    fontSize: 15,
    color: C.textMuted,
    marginTop: 28,
    marginBottom: 14,
    fontWeight: '500',
  },

  // Text input
  textInput: {
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    color: C.text,
    borderWidth: 1,
    borderColor: C.border,
    fontWeight: '500',
  },

  // BigChoice — two tall cards side by side
  bigChoiceRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bigChoiceCard: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 100,
  },
  bigChoiceCardActive: {
    borderColor: C.accent,
    backgroundColor: '#4A3028',
  },
  bigChoiceLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: C.textMuted,
    marginBottom: 4,
  },
  bigChoiceLabelActive: { color: C.accent },
  bigChoiceSub: {
    fontSize: 12,
    color: C.border,
    textAlign: 'center',
    lineHeight: 16,
  },
  bigChoiceSubActive: { color: C.textMuted },

  // MultiSelect chips — 2 column grid
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    width: (SCREEN_W - 56 - 10) / 2,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: C.accent,
    backgroundColor: '#4A3028',
  },
  chipLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textMuted,
    marginBottom: 3,
  },
  chipLabelActive: { color: C.accent },
  chipSub: {
    fontSize: 11,
    color: C.border,
    lineHeight: 15,
  },
  chipSubActive: { color: C.textMuted },

  // CTA
  ctaButton: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 28,
  },
  ctaText: {
    color: C.bg,
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.1,
  },

  // Footnote
  footnote: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    opacity: 0.7,
  },
});
