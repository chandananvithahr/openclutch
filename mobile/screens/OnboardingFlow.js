'use strict';

// OnboardingFlow — Simplified 2-step onboarding (sprint item #13)
//
// Step 1: Name + occupation (working/student)
// Step 2: What matters most (domain priorities) → go to chat
//
// Everything else (age, city, CTC, EMI, fitness, savings, connections) gets
// collected through AI chat nudges via profile completeness tracking.
// This gets users to their first AI conversation in under 30 seconds.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingCard from '../components/OnboardingCard';
import BACKEND_URL from '../services/config';
import { getToken } from '../services/api';

const COLORS = {
  bg:            '#2D1B14',
  card:          '#3A2820',
  accent:        '#FFE36D',
  success:       '#4CAF50',
  alert:         '#FF6B6B',
  textPrimary:   '#F5F0EB',
  textSecondary: '#B8A99A',
  inputBg:       '#4A3028',
  border:        '#6B4C3A',
};

const DOMAIN_OPTIONS = [
  { id: 'money',  label: 'Money',   emoji: '💰' },
  { id: 'career', label: 'Career',  emoji: '🚀' },
  { id: 'health', label: 'Health',  emoji: '💪' },
  { id: 'mind',   label: 'Mind',    emoji: '🧠' },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function haptic() {
  if (Platform.OS === 'android') Vibration.vibrate(25);
}

// ─── sub-components ─────────────────────────────────────────────────────────

function BigChoice({ options, selected, onSelect }) {
  return (
    <View style={styles.bigChoiceRow}>
      {options.map(opt => {
        const isSelected = selected === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.bigChoiceCard, isSelected && styles.bigChoiceCardSelected]}
            onPress={() => { haptic(); onSelect(opt.id); }}
            activeOpacity={0.8}
          >
            <Text style={styles.bigChoiceEmoji}>{opt.emoji}</Text>
            <Text style={[styles.bigChoiceLabel, isSelected && styles.bigChoiceLabelSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MultiSelect({ options, selected, onToggle }) {
  return (
    <View style={styles.chipRow}>
      {options.map(opt => {
        const isSelected = selected.includes(opt.id);
        return (
          <TouchableOpacity
            key={opt.id}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => { haptic(); onToggle(opt.id); }}
            activeOpacity={0.8}
          >
            <Text style={styles.chipEmoji}>{opt.emoji}</Text>
            <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ProgressDots({ total, current }) {
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, i <= current && styles.dotActive]}
        />
      ))}
    </View>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function OnboardingFlow({ navigation }) {
  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  // Profile state — only essentials collected here
  const [name,              setName]              = useState('');
  const [occupation,        setOccupation]        = useState(null); // 'working' | 'student'
  const [domainPriorities,  setDomainPriorities]  = useState([]);

  // Reactions
  const [reaction, setReaction] = useState('');

  const TOTAL_STEPS = 2;

  function showReaction(text) {
    setReaction(text);
    setTimeout(() => setReaction(''), 5000);
  }

  function next() {
    haptic();
    setStep(s => s + 1);
    setReaction('');
  }

  function toggleMulti(arr, setter, id) {
    haptic();
    setter(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  // ── Step 0: Name + Occupation ──
  function renderNameAndOccupation() {
    const nameEntered = name.trim().length > 0;

    return (
      <OnboardingCard
        headline="What should I call you?"
        subtext="Let's set up in under 30 seconds"
        showSkip={false}
        reactionText={reaction}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Your first name"
          placeholderTextColor={COLORS.textSecondary}
          value={name}
          onChangeText={t => {
            setName(t);
            if (t.trim().length > 0 && !reaction) {
              showReaction(`Hey ${t.trim()}! One more question and you're in 👋`);
            }
          }}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
        />

        {nameEntered && (
          <>
            <Text style={styles.sectionLabel}>Are you...</Text>
            <BigChoice
              options={[
                { id: 'working', emoji: '💼', label: 'Working' },
                { id: 'student', emoji: '🎓', label: 'Student' },
              ]}
              selected={occupation}
              onSelect={val => {
                setOccupation(val);
                const r = val === 'working'
                  ? `Nice, ${name.trim()}! I'll track your salary, spending, and investments 📊`
                  : `Smart start, ${name.trim()}! Building habits early = massive edge 🎯`;
                showReaction(r);
                setTimeout(next, 900);
              }}
            />
          </>
        )}
      </OnboardingCard>
    );
  }

  // ── Step 1: Domain Priorities → Complete ──
  function renderDomains() {
    return (
      <OnboardingCard
        headline={`What matters most, ${name.trim()}?`}
        subtext="Pick what you care about — I'll lead with that"
        reactionText={reaction}
        showSkip
        onSkip={handleComplete}
      >
        <MultiSelect
          options={DOMAIN_OPTIONS}
          selected={domainPriorities}
          onToggle={id => {
            toggleMulti(domainPriorities, setDomainPriorities, id);
            const reactions = {
              money:  "I'll keep a sharp eye on every rupee 💰",
              career: "Career moves = income moves. I've got you 🚀",
              health: "Mind + body = the real wealth 💪",
              mind:   "Stress → impulse spend? I track that loop 🧠",
            };
            showReaction(reactions[id]);
          }}
        />

        <TouchableOpacity
          style={[styles.ctaButton, { marginTop: 24 }]}
          onPress={handleComplete}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator color={COLORS.bg} />
            : <Text style={styles.ctaText}>
                {domainPriorities.length > 0 ? "Let's go 🚀" : "Skip — take me to chat →"}
              </Text>
          }
        </TouchableOpacity>

        <Text style={styles.footnote}>
          I'll ask about salary, health, and connections naturally in chat
        </Text>
      </OnboardingCard>
    );
  }

  // ── Save profile + navigate ──
  async function handleComplete() {
    setSaving(true);
    try {
      const userId = await AsyncStorage.getItem('userId') || `user_${Date.now()}`;
      await AsyncStorage.setItem('userId', userId);

      // Minimal profile — everything else gets filled via chat nudges
      const profile = {
        userId,
        name:              name.trim() || 'User',
        occupation,
        domain_priorities: domainPriorities,
        // Profile completeness starts low — AI will nudge for the rest
        tone:              'pro',
      };

      const token = await getToken();
      await fetch(`${BACKEND_URL}/api/onboarding/profile`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body:    JSON.stringify(profile),
      });

      await AsyncStorage.setItem('onboarding_done', 'true');
      navigation.replace('Chat');
    } catch (err) {
      // Non-blocking — still proceed to chat
      await AsyncStorage.setItem('onboarding_done', 'true');
      navigation.replace('Chat');
    } finally {
      setSaving(false);
    }
  }

  // ── Render current step ──
  const stepRenderers = [
    renderNameAndOccupation,
    renderDomains,
  ];

  const renderer = stepRenderers[step];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.root}>
        {/* Progress dots */}
        <View style={styles.progressBar}>
          <ProgressDots total={TOTAL_STEPS} current={step} />
        </View>

        {/* Active screen */}
        {renderer ? renderer() : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: COLORS.bg,
  },
  progressBar: {
    paddingTop:       Platform.OS === 'ios' ? 56 : 36,
    paddingHorizontal: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap:           6,
    marginBottom:  8,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },

  // Section label between inputs
  sectionLabel: {
    fontSize:     16,
    color:        COLORS.textSecondary,
    marginTop:    24,
    marginBottom: 12,
  },

  // Text input
  textInput: {
    backgroundColor:  COLORS.inputBg,
    borderRadius:     12,
    paddingHorizontal: 16,
    paddingVertical:  14,
    fontSize:         18,
    color:            COLORS.textPrimary,
    borderWidth:      1,
    borderColor:      COLORS.border,
    marginBottom:     12,
  },

  // CTA button
  ctaButton: {
    backgroundColor: COLORS.accent,
    borderRadius:    14,
    paddingVertical: 16,
    alignItems:      'center',
    marginTop:       8,
  },
  ctaButtonDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color:      COLORS.bg,
    fontWeight: '700',
    fontSize:   17,
  },

  // Footnote
  footnote: {
    color:      COLORS.textSecondary,
    fontSize:   13,
    textAlign:  'center',
    marginTop:  16,
    lineHeight: 18,
  },

  // Big 2-choice cards
  bigChoiceRow: {
    flexDirection: 'row',
    gap:           14,
  },
  bigChoiceCard: {
    flex:             1,
    backgroundColor:  COLORS.card,
    borderRadius:     16,
    paddingVertical:  28,
    alignItems:       'center',
    borderWidth:      2,
    borderColor:      'transparent',
  },
  bigChoiceCardSelected: {
    borderColor:     COLORS.accent,
    backgroundColor: '#4A3028',
  },
  bigChoiceEmoji: {
    fontSize:     36,
    marginBottom: 8,
  },
  bigChoiceLabel: {
    fontSize:   16,
    color:      COLORS.textSecondary,
    fontWeight: '600',
  },
  bigChoiceLabelSelected: {
    color: COLORS.accent,
  },

  // Multi-select chips
  chipRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           10,
  },
  chip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: COLORS.card,
    borderRadius:    24,
    paddingVertical:   10,
    paddingHorizontal: 16,
    borderWidth:     2,
    borderColor:     'transparent',
  },
  chipSelected: {
    borderColor:     COLORS.accent,
    backgroundColor: '#4A3028',
  },
  chipEmoji: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: 14,
    color:    COLORS.textSecondary,
  },
  chipLabelSelected: {
    color:      COLORS.accent,
    fontWeight: '600',
  },
});
