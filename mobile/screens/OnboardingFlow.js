'use strict';

// OnboardingFlow — Cleo AI-inspired 10-screen adaptive onboarding
// Replaces OnboardingScreen.js
// Branching: screen 4 splits into Working vs Student paths
// Every answer triggers a micro-insight from the AI persona
// Completes by saving profile to /api/onboarding/profile + setting AsyncStorage flag

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Vibration,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingCard from '../components/OnboardingCard';
import BACKEND_URL from '../services/config';
import { getToken } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');

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

const INDIAN_CITIES = [
  'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur',
  'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Vadodara',
  'Patna', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Ranchi',
  'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Coimbatore', 'Kochi',
];

const DOMAIN_OPTIONS = [
  { id: 'money',  label: 'Money',   emoji: '💰' },
  { id: 'career', label: 'Career',  emoji: '🚀' },
  { id: 'health', label: 'Health',  emoji: '💪' },
  { id: 'mind',   label: 'Mind',    emoji: '🧠' },
];

const SAVINGS_OPTIONS = [
  { id: 'mf',     label: 'Mutual Funds',   emoji: '📈' },
  { id: 'stocks', label: 'Stocks',         emoji: '📊' },
  { id: 'gold',   label: 'Gold',           emoji: '🥇' },
  { id: 'fd',     label: 'Fixed Deposits', emoji: '🏦' },
  { id: 'none',   label: 'Not yet',        emoji: '🤷' },
];

const CONNECT_OPTIONS = [
  { id: 'zerodha',   label: 'Zerodha',     emoji: '📉' },
  { id: 'angelone',  label: 'Angel One',   emoji: '👼' },
  { id: 'gmail',     label: 'Gmail',       emoji: '📧' },
  { id: 'mf',        label: 'MF Statement',emoji: '📄' },
];

// ─── helpers ────────────────────────────────────────────────────────────────

function haptic() {
  if (Platform.OS === 'android') Vibration.vibrate(25);
}

function ctcToTakeHome(ctc) {
  if (!ctc || ctc <= 0) return null;
  // rough approximation: 80% of gross monthly, after basic deductions
  const monthly = (ctc / 12) * 0.80;
  return Math.round(monthly / 1000) * 1000;
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

function CurrencySlider({ label, value, min, max, step, onChange }) {
  // Simplified text-input slider (no native slider dep required)
  const formatted = value ? `₹${(value / 100000).toFixed(1)}L` : '—';
  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{formatted}</Text>
      </View>
      <View style={styles.sliderButtonRow}>
        {[0.5, 1, 2, 3, 5, 8, 12, 15, 20, 25, 30, 40, 50].map(lakh => {
          const val = lakh * 100000;
          const active = value === val;
          return (
            <TouchableOpacity
              key={lakh}
              style={[styles.sliderPill, active && styles.sliderPillActive]}
              onPress={() => { haptic(); onChange(val); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.sliderPillText, active && styles.sliderPillTextActive]}>
                {lakh}L
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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

  // Profile state
  const [name,              setName]              = useState('');
  const [age,               setAge]               = useState(null);
  const [city,              setCity]              = useState('');
  const [cityQuery,         setCityQuery]         = useState('');
  const [occupation,        setOccupation]        = useState(null); // 'working' | 'student'
  const [annualCtc,         setAnnualCtc]         = useState(null);
  const [monthlyEmi,        setMonthlyEmi]        = useState(null);
  const [emiEnabled,        setEmiEnabled]        = useState(null);
  const [fieldOfStudy,      setFieldOfStudy]      = useState('');
  const [domainPriorities,  setDomainPriorities]  = useState([]);
  const [fitnessActive,     setFitnessActive]     = useState(null);
  const [savingsMethods,    setSavingsMethods]    = useState([]);
  const [connectedServices, setConnectedServices] = useState([]);

  // Reactions
  const [reaction, setReaction] = useState('');

  // Adaptive step list based on occupation
  // Steps: 0=name, 1=age, 2=city, 3=occupation, 4=ctc/study, 5=emi/year, 6=domains, 7=health, 8=savings, 9=connect
  const TOTAL_STEPS = 10;

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

  // ── Step 0: Name ──
  function renderName() {
    return (
      <OnboardingCard
        headline="What should I call you?"
        showSkip={false}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Your first name"
          placeholderTextColor={COLORS.textSecondary}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => {
            if (name.trim()) {
              showReaction(`Hey ${name.trim()}! Let's get to know you 👋`);
              setTimeout(next, 900);
            }
          }}
        />
        <TouchableOpacity
          style={[styles.ctaButton, !name.trim() && styles.ctaButtonDisabled]}
          onPress={() => {
            if (!name.trim()) return;
            showReaction(`Hey ${name.trim()}! Let's get to know you 👋`);
            setTimeout(next, 900);
          }}
          disabled={!name.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>Let's go →</Text>
        </TouchableOpacity>
      </OnboardingCard>
    );
  }

  // ── Step 1: Age ──
  function renderAge() {
    const ageOptions = [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35];
    function getAgeReaction(a) {
      if (a <= 22) return `${a} and already thinking about this? You're ahead of the curve 🔥`;
      if (a <= 27) return 'Mid-twenties — the best time to build strong money habits 💪';
      return 'Late 20s/30s — clarity mode on. Let\'s make every rupee count 🎯';
    }
    return (
      <OnboardingCard
        headline={`How old are you, ${name}?`}
        subtext="Helps me tailor advice for your life stage"
        showSkip
        onSkip={next}
        reactionText={reaction}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {ageOptions.map(a => (
              <TouchableOpacity
                key={a}
                style={[styles.chip, age === a && styles.chipSelected]}
                onPress={() => {
                  haptic();
                  setAge(a);
                  showReaction(getAgeReaction(a));
                  setTimeout(next, 900);
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipLabel, age === a && styles.chipLabelSelected]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </OnboardingCard>
    );
  }

  // ── Step 2: City ──
  function renderCity() {
    const filtered = INDIAN_CITIES.filter(c =>
      c.toLowerCase().startsWith(cityQuery.toLowerCase())
    ).slice(0, 6);

    return (
      <OnboardingCard
        headline="Which city are you in?"
        subtext="For cost-of-living context"
        showSkip
        onSkip={next}
        reactionText={reaction}
      >
        <TextInput
          style={styles.textInput}
          placeholder="Type your city..."
          placeholderTextColor={COLORS.textSecondary}
          value={cityQuery}
          onChangeText={setCityQuery}
          autoCapitalize="words"
          autoFocus
        />
        {filtered.length > 0 && (
          <View style={styles.cityDropdown}>
            {filtered.map(c => (
              <TouchableOpacity
                key={c}
                style={styles.cityOption}
                onPress={() => {
                  haptic();
                  setCity(c);
                  setCityQuery(c);
                  showReaction(`${c}! Great city to build wealth in 🌆`);
                  setTimeout(next, 900);
                }}
              >
                <Text style={styles.cityOptionText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </OnboardingCard>
    );
  }

  // ── Step 3: Occupation ──
  function renderOccupation() {
    return (
      <OnboardingCard
        headline="Student or working?"
        reactionText={reaction}
        showSkip
        onSkip={next}
      >
        <BigChoice
          options={[
            { id: 'working', emoji: '💼', label: 'Working' },
            { id: 'student', emoji: '🎓', label: 'Student' },
          ]}
          selected={occupation}
          onSelect={val => {
            setOccupation(val);
            const r = val === 'working'
              ? "Let's figure out your real take-home and monthly burn rate 📊"
              : "Students building habits early = massive edge. Let's go 🎯";
            showReaction(r);
            setTimeout(next, 900);
          }}
        />
      </OnboardingCard>
    );
  }

  // ── Step 4: CTC (working) or Field of study (student) ──
  function renderCtcOrStudy() {
    if (occupation === 'working') {
      const takeHome = ctcToTakeHome(annualCtc);
      return (
        <OnboardingCard
          headline="What's your annual CTC?"
          subtext="I'll calculate your real take-home instantly"
          reactionText={reaction}
          showSkip
          onSkip={next}
        >
          <CurrencySlider
            label="Annual CTC"
            value={annualCtc}
            onChange={val => {
              setAnnualCtc(val);
              const th = ctcToTakeHome(val);
              showReaction(`Take-home ≈ ₹${(th / 1000).toFixed(0)}k/month after deductions 📊`);
            }}
          />
          {annualCtc && (
            <TouchableOpacity style={styles.ctaButton} onPress={next} activeOpacity={0.8}>
              <Text style={styles.ctaText}>Got it →</Text>
            </TouchableOpacity>
          )}
        </OnboardingCard>
      );
    }

    return (
      <OnboardingCard
        headline="What are you studying?"
        reactionText={reaction}
        showSkip
        onSkip={next}
      >
        <TextInput
          style={styles.textInput}
          placeholder="e.g. Computer Science, MBA, B.Com..."
          placeholderTextColor={COLORS.textSecondary}
          value={fieldOfStudy}
          onChangeText={setFieldOfStudy}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => {
            if (fieldOfStudy.trim()) {
              showReaction(`${fieldOfStudy} — I'll tailor career advice for your field 🎓`);
              setTimeout(next, 900);
            }
          }}
        />
        {fieldOfStudy.trim() ? (
          <TouchableOpacity style={styles.ctaButton} onPress={next} activeOpacity={0.8}>
            <Text style={styles.ctaText}>Continue →</Text>
          </TouchableOpacity>
        ) : null}
      </OnboardingCard>
    );
  }

  // ── Step 5: EMI (working) or nothing for students → go to domains ──
  function renderEmiOrSkip() {
    if (occupation !== 'working') {
      // Auto-advance for students
      setTimeout(next, 100);
      return null;
    }
    return (
      <OnboardingCard
        headline="Any monthly EMIs?"
        subtext="Loans, car, home — helps me calculate your real disposable income"
        reactionText={reaction}
        showSkip
        onSkip={next}
      >
        <BigChoice
          options={[
            { id: 'yes', emoji: '📋', label: 'Yes, I have EMIs' },
            { id: 'no',  emoji: '✅', label: 'No EMIs' },
          ]}
          selected={emiEnabled === true ? 'yes' : emiEnabled === false ? 'no' : null}
          onSelect={val => {
            if (val === 'no') {
              setEmiEnabled(false);
              setMonthlyEmi(0);
              showReaction("EMI-free! That\'s solid financial flexibility 💪");
              setTimeout(next, 900);
            } else {
              setEmiEnabled(true);
              showReaction('Got it. Enter your total monthly EMI below 👇');
            }
          }}
        />
        {emiEnabled === true && (
          <>
            <CurrencySlider
              label="Monthly EMI"
              value={monthlyEmi}
              onChange={val => {
                setMonthlyEmi(val);
                const disposable = annualCtc
                  ? ctcToTakeHome(annualCtc) - val
                  : null;
                if (disposable) {
                  showReaction(`Disposable ≈ ₹${(disposable / 1000).toFixed(0)}k/month after EMI 💰`);
                }
              }}
            />
            {monthlyEmi != null && (
              <TouchableOpacity style={styles.ctaButton} onPress={next} activeOpacity={0.8}>
                <Text style={styles.ctaText}>Got it →</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </OnboardingCard>
    );
  }

  // ── Step 6: Domain priorities ──
  function renderDomains() {
    return (
      <OnboardingCard
        headline="What matters most to you?"
        subtext="Pick all that apply — I'll lead with what you care about"
        reactionText={reaction}
        showSkip
        onSkip={next}
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
        {domainPriorities.length > 0 && (
          <TouchableOpacity style={[styles.ctaButton, { marginTop: 24 }]} onPress={next} activeOpacity={0.8}>
            <Text style={styles.ctaText}>These are my priorities →</Text>
          </TouchableOpacity>
        )}
      </OnboardingCard>
    );
  }

  // ── Step 7: Fitness ──
  function renderFitness() {
    return (
      <OnboardingCard
        headline="Into fitness?"
        subtext="I can connect sleep + steps to your spending patterns"
        reactionText={reaction}
        showSkip
        onSkip={next}
      >
        <BigChoice
          options={[
            { id: 'yes',  emoji: '🏃', label: 'Yes, I track' },
            { id: 'no',   emoji: '🛋️', label: 'Not really' },
          ]}
          selected={fitnessActive === true ? 'yes' : fitnessActive === false ? 'no' : null}
          onSelect={val => {
            setFitnessActive(val === 'yes');
            const r = val === 'yes'
              ? "I\'ll correlate your sleep quality with your spending impulsiveness 😏"
              : 'No worries — I\'ll nudge you when it matters 😄';
            showReaction(r);
            setTimeout(next, 900);
          }}
        />
      </OnboardingCard>
    );
  }

  // ── Step 8: Savings methods ──
  function renderSavings() {
    return (
      <OnboardingCard
        headline="How do you save?"
        subtext="I'll track your net worth across all of these"
        reactionText={reaction}
        showSkip
        onSkip={next}
      >
        <MultiSelect
          options={SAVINGS_OPTIONS}
          selected={savingsMethods}
          onToggle={id => {
            toggleMulti(savingsMethods, setSavingsMethods, id);
            const r = id === 'mf'     ? 'MFs — I\'ll show you real XIRR not just NAV 📈'
                    : id === 'stocks' ? 'I\'ll merge all your broker portfolios into one view 📊'
                    : id === 'gold'   ? 'Digital gold counts too! 🥇'
                    : id === 'fd'     ? 'FDs — I\'ll track when they mature 🏦'
                    : 'Starting now is the best move. Let\'s set up your first ₹500/month 💡';
            showReaction(r);
          }}
        />
        {savingsMethods.length > 0 && (
          <TouchableOpacity style={[styles.ctaButton, { marginTop: 24 }]} onPress={next} activeOpacity={0.8}>
            <Text style={styles.ctaText}>That's my saving style →</Text>
          </TouchableOpacity>
        )}
      </OnboardingCard>
    );
  }

  // ── Step 9: Connect services ──
  function renderConnect() {
    return (
      <OnboardingCard
        headline="Connect your accounts"
        subtext="I work best with data. Connect what you're comfortable with."
        reactionText={reaction}
        showSkip
        onSkip={handleComplete}
      >
        <MultiSelect
          options={CONNECT_OPTIONS}
          selected={connectedServices}
          onToggle={id => {
            toggleMulti(connectedServices, setConnectedServices, id);
            showReaction('Added! You can always connect more later 🔗');
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
            : <Text style={styles.ctaText}>Let's do this 🚀</Text>
          }
        </TouchableOpacity>
      </OnboardingCard>
    );
  }

  // ── Save profile + navigate ──
  async function handleComplete() {
    setSaving(true);
    try {
      const userId = await AsyncStorage.getItem('userId') || `user_${Date.now()}`;
      await AsyncStorage.setItem('userId', userId);

      const profile = {
        userId,
        name:              name.trim() || 'User',
        age,
        city:              city || cityQuery,
        occupation,
        annual_ctc:        annualCtc,
        monthly_emi:       monthlyEmi,
        field_of_study:    fieldOfStudy,
        domain_priorities: domainPriorities,
        fitness_active:    fitnessActive === true,
        has_fitness_tracker: fitnessActive === true,
        savings_methods:   savingsMethods,
        tone:              'pro', // default, user can change in settings
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
    renderName,
    renderAge,
    renderCity,
    renderOccupation,
    renderCtcOrStudy,
    renderEmiOrSkip,
    renderDomains,
    renderFitness,
    renderSavings,
    renderConnect,
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

  // Currency slider (pill selector)
  sliderBlock: {
    marginBottom: 16,
  },
  sliderHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   12,
  },
  sliderLabel: {
    color:    COLORS.textSecondary,
    fontSize: 14,
  },
  sliderValue: {
    color:      COLORS.accent,
    fontSize:   18,
    fontWeight: '700',
  },
  sliderButtonRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  sliderPill: {
    backgroundColor:  COLORS.card,
    borderRadius:     20,
    paddingVertical:   6,
    paddingHorizontal: 12,
    borderWidth:      1,
    borderColor:      COLORS.border,
  },
  sliderPillActive: {
    backgroundColor: COLORS.accent,
    borderColor:     COLORS.accent,
  },
  sliderPillText: {
    color:    COLORS.textSecondary,
    fontSize: 13,
  },
  sliderPillTextActive: {
    color:      COLORS.bg,
    fontWeight: '700',
  },

  // City autocomplete
  cityDropdown: {
    backgroundColor: COLORS.card,
    borderRadius:    12,
    overflow:        'hidden',
    borderWidth:     1,
    borderColor:     COLORS.border,
    marginTop:       4,
  },
  cityOption: {
    paddingVertical:   12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cityOptionText: {
    color:    COLORS.textPrimary,
    fontSize: 16,
  },
});
