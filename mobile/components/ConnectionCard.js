import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../styles/theme';

const SERVICE_META = {
  zerodha: { label: 'Zerodha', icon: '📈', desc: 'See your stock portfolio' },
  angelone: { label: 'Angel One', icon: '📊', desc: 'Track your investments' },
  upstox: { label: 'Upstox', icon: '📉', desc: 'View holdings & P&L' },
  fyers: { label: 'Fyers', icon: '💹', desc: 'Portfolio & live prices' },
  gmail: { label: 'Gmail', icon: '📧', desc: 'Email insights & job alerts' },
  broker: { label: 'a broker', icon: '🔗', desc: 'Connect any broker to get started' },
};

// Keywords that suggest the user needs a specific service connected
const SERVICE_KEYWORDS = {
  zerodha: ['zerodha', 'kite'],
  angelone: ['angel one', 'angelone', 'angel'],
  upstox: ['upstox'],
  fyers: ['fyers'],
  gmail: ['gmail', 'email', 'emails', 'inbox'],
  broker: ['portfolio', 'holdings', 'stocks', 'mutual fund', 'broker', 'connect your'],
};

function ConnectionCard({ service, onConnect }) {
  const meta = SERVICE_META[service] || SERVICE_META.broker;

  return (
    <TouchableOpacity style={styles.card} onPress={onConnect} activeOpacity={0.7}>
      <Text style={styles.icon}>{meta.icon}</Text>
      <View style={styles.info}>
        <Text style={styles.label}>Connect {meta.label}</Text>
        <Text style={styles.desc}>{meta.desc}</Text>
      </View>
      <View style={styles.connectBtn}>
        <Text style={styles.connectText}>Connect</Text>
      </View>
    </TouchableOpacity>
  );
}

// Given a message string + connection state, returns which services to prompt
export function detectConnectionPrompts(content, connectedServices) {
  if (!content) return [];
  const lower = content.toLowerCase();
  const prompts = [];

  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    if (service === 'broker') continue; // check broker last
    if (connectedServices[service]) continue; // already connected
    if (keywords.some(kw => lower.includes(kw))) {
      prompts.push(service);
    }
  }

  // Generic broker prompt — if message mentions portfolio/holdings but no specific broker matched
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  label: {
    fontSize: typography.sm + 1,
    fontWeight: typography.semibold,
    color: colors.text,
  },
  desc: {
    fontSize: typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  connectBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  connectText: {
    color: colors.bg,
    fontSize: typography.sm,
    fontWeight: typography.bold,
  },
});
