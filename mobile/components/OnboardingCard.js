'use strict';

// OnboardingCard — Cleo Super Type style reusable question card
// One question per screen. Warm cocoa palette. Slide-up animation.
// Props:
//   headline      string    — big question text
//   subtext       string?   — optional supporting line below headline
//   reactionText  string?   — AI micro-insight shown after answer
//   showSkip      bool      — show skip button (default true)
//   onSkip        fn        — called when skip tapped
//   children      node      — input/choice UI (sliders, cards, text inputs)
//   style         object?   — override container style

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
  Platform,
} from 'react-native';

const COLORS = {
  bg:           '#2D1B14',
  card:         '#3A2820',
  accent:       '#FFE36D',
  success:      '#4CAF50',
  alert:        '#FF6B6B',
  textPrimary:  '#F5F0EB',
  textSecondary:'#B8A99A',
};

export default function OnboardingCard({
  headline,
  subtext,
  reactionText,
  showSkip = true,
  onSkip,
  children,
  style,
}) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const reactionFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide up + fade in on mount
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue:         0,
        duration:        320,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue:         1,
        duration:        320,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!reactionText) return;
    // Fade in reaction text with a short delay
    reactionFade.setValue(0);
    const timer = setTimeout(() => {
      Animated.timing(reactionFade, {
        toValue:         1,
        duration:        400,
        useNativeDriver: true,
      }).start();
    }, 300);
    return () => clearTimeout(timer);
  }, [reactionText]);

  function handleSkip() {
    if (Platform.OS === 'android') {
      Vibration.vibrate(30); // light haptic via vibration
    }
    onSkip?.();
  }

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity:   fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Headline */}
      <Text style={styles.headline}>{headline}</Text>

      {/* Optional subtext */}
      {subtext ? (
        <Text style={styles.subtext}>{subtext}</Text>
      ) : null}

      {/* Input / choice area */}
      <View style={styles.inputArea}>{children}</View>

      {/* AI micro-insight reaction */}
      {reactionText ? (
        <Animated.View style={[styles.reactionBubble, { opacity: reactionFade }]}>
          <Text style={styles.reactionText}>{reactionText}</Text>
        </Animated.View>
      ) : null}

      {/* Skip */}
      {showSkip ? (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 28,
    paddingTop:      56,
    paddingBottom:   32,
  },
  headline: {
    fontSize:   36,
    fontWeight: '700',
    color:      COLORS.textPrimary,
    lineHeight: 44,
    marginBottom: 12,
  },
  subtext: {
    fontSize:     16,
    color:        COLORS.textSecondary,
    lineHeight:   24,
    marginBottom: 8,
  },
  inputArea: {
    marginTop:    32,
    marginBottom: 24,
  },
  reactionBubble: {
    backgroundColor: COLORS.card,
    borderRadius:    14,
    paddingVertical:   12,
    paddingHorizontal: 16,
    marginBottom:    16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  reactionText: {
    fontSize:   14,
    color:      COLORS.textPrimary,
    lineHeight: 20,
  },
  skipButton: {
    alignSelf:    'center',
    marginTop:    'auto',
    paddingTop:   16,
  },
  skipText: {
    fontSize:  15,
    color:     COLORS.textSecondary,
    textDecorationLine: 'underline',
  },
});
