import React, { memo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Markdown from 'react-native-markdown-display';
import PortfolioChart from './PortfolioChart';
import { colors, spacing, radius, typography } from '../styles/theme';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  // Subtle slide-in animation (Kailash: fast, 150ms)
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (isUser) {
    return (
      <Animated.View
        style={[
          styles.userRow,
          { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
        ]}
      >
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.content}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.assistantRow,
        { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>C</Text>
      </View>
      <View style={styles.assistantContent}>
        {message.content ? (
          <Markdown style={markdownStyles}>{message.content}</Markdown>
        ) : null}
        {message.chartData ? (
          <PortfolioChart data={message.chartData} />
        ) : null}
      </View>
    </Animated.View>
  );
}

export default memo(MessageBubble);

const markdownStyles = {
  body: {
    color: colors.text,
    fontSize: typography.base,
    lineHeight: typography.normal,
  },
  strong: { fontWeight: typography.bold, color: colors.text },
  em: { fontStyle: 'italic', color: colors.textSecondary },
  bullet_list: { marginVertical: spacing.xs },
  ordered_list: { marginVertical: spacing.xs },
  list_item: { marginVertical: 2 },

  // Inline code — for ticker symbols, amounts (₹12,500)
  code_inline: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontFamily: 'monospace',
    fontSize: typography.sm,
    color: colors.text,
  },

  // Code blocks — dark, terminal-style
  code_block: {
    backgroundColor: '#1e1e1e',
    borderRadius: radius.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
    fontFamily: 'monospace',
    fontSize: typography.sm,
    color: '#e0e0e0',
  },

  // Blockquote — used for AI insights/summaries
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.md,
    marginVertical: spacing.sm,
    color: colors.textSecondary,
  },

  heading1: {
    fontSize: typography.lg,
    fontWeight: typography.bold,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    color: colors.text,
  },
  heading2: {
    fontSize: typography.md,
    fontWeight: typography.bold,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
    color: colors.text,
  },
  heading3: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    marginBottom: 3,
    marginTop: spacing.xs,
    color: colors.text,
  },
  paragraph: { marginVertical: spacing.xs },
  hr: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.md,
  },
  link: { color: colors.primary },

  // Tables — financial data (holdings, transactions)
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    marginVertical: spacing.sm,
  },
  thead: { backgroundColor: colors.bgMuted },
  th: {
    padding: spacing.sm,
    fontWeight: typography.semibold,
    fontSize: typography.sm,
    color: colors.textSecondary,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  td: {
    padding: spacing.sm,
    fontSize: typography.sm,
    color: colors.text,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  tr: { borderBottomWidth: 1, borderBottomColor: colors.border },
};

const styles = StyleSheet.create({
  // User message — right-aligned pill
  userRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  userBubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 2,
    maxWidth: '80%',
  },
  userText: {
    fontSize: typography.base,
    lineHeight: typography.normal,
    color: colors.text,
  },

  // Assistant message — icon + full-width text
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  iconText: {
    color: colors.bg,
    fontWeight: typography.bold,
    fontSize: typography.sm,
  },
  assistantContent: { flex: 1 },
});
