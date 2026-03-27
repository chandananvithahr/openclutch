import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../styles/theme';

// No emoji — clean letter avatars with brand colors
const SERVICE_META = {
  zerodha:   { label: 'Zerodha',   initial: 'Z', color: '#387ED1', desc: 'See your stock portfolio' },
  angelone:  { label: 'Angel One', initial: 'A', color: '#E84040', desc: 'Track your investments' },
  upstox:    { label: 'Upstox',    initial: 'U', color: '#5367FF', desc: 'View holdings & P&L' },
  fyers:     { label: 'Fyers',     initial: 'F', color: '#F26722', desc: 'Portfolio & live prices' },
  gmail:     { label: 'Gmail',     initial: 'G', color: '#D44638', desc: 'Email insights & job alerts' },
  broker:    { label: 'Broker',    initial: '↗', color: colors.primary, desc: 'Connect a broker to get started' },
};

const SERVICE_KEYWORDS = {
  zerodha:  ['zerodha', 'kite'],
  angelone: ['angel one', 'angelone', 'angel'],
  upstox:   ['upstox'],
  fyers:    ['fyers'],
  gmail:    ['gmail', 'email', 'emails', 'inbox'],
  broker:   ['portfolio', 'holdings', 'stocks', 'mutual fund', 'broker', 'connect your'],
};

function ConnectionCard({ service, onConnect }) {
  const meta = SERVICE_META[service] || SERVICE_META.broker;

  return (
    <TouchableOpacity style={styles.card} onPress={onConnect} activeOpacity={0.75}>
      {/* Letter avatar */}
      <View style={[styles.initial, { backgroundColor: meta.color + '22' }]}>
        <Text style={[styles.initialText, { color: meta.color }]}>{meta.initial}</Text>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.label}>Connect {meta.label}</Text>
        <Text style={styles.desc}>{meta.desc}</Text>
      </View>

      {/* Arrow CTA */}
      <View style={styles.arrow}>
        <Text style={styles.arrowText}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export function detectConnectionPrompts(content, connectedServices) {
  if (!content) return [];
  const lower = content.toLowerCase();
  const prompts = [];

  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    if (service === 'broker') continue;
    if (connectedServices[service]) continue;
    if (keywords.some(kw => lower.includes(kw))) prompts.push(service);
  }

  if (
    prompts.length === 0 &&
    SERVICE_KEYWORDS.broker.some(kw => lower.includes(kw)) &&
    !connectedServices.zerodha &&
    !connectedServices.angelone &&
    !connectedServices.upstox &&
    !connectedServices.fyers
  ) {
    prompts.push('broker');
  }

  return prompts;
}

export default memo(ConnectionCard);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  initial: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialText: {
    fontSize: 15,
    fontWeight: typography.bold,
    letterSpacing: -0.3,
  },
  info: { flex: 1 },
  label: {
    fontSize: typography.sm,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  desc: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  arrow: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowText: {
    color: colors.bg,
    fontSize: 20,
    fontWeight: typography.bold,
    lineHeight: 24,
    textAlign: 'center',
  },
});
