import React, { memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions,
} from 'react-native';
import { colors, spacing, radius, typography } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

function Sidebar({
  visible, onClose, slideAnim,
  conversations, activeConversationId,
  onSelectConversation, onNewChat,
  zerodhaConnected, angelOneConnected, upstoxConnected, fyersConnected, gmailConnected,
  onConnectZerodha, onConnectAngel, onConnectUpstox, onConnectFyers, onConnectGmail,
  backendOnline,
}) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* New Chat Button */}
        <TouchableOpacity style={styles.newChatBtn} onPress={onNewChat}>
          <Text style={styles.newChatIcon}>+</Text>
          <Text style={styles.newChatText}>New chat</Text>
        </TouchableOpacity>

        {/* Conversations List */}
        <ScrollView style={styles.convList} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Recent</Text>
          {conversations.length === 0 ? (
            <Text style={styles.emptyText}>No conversations yet</Text>
          ) : (
            conversations.map(conv => (
              <TouchableOpacity
                key={conv.id}
                style={[
                  styles.convItem,
                  conv.id === activeConversationId && styles.convItemActive,
                ]}
                onPress={() => onSelectConversation(conv.id)}
              >
                <Text
                  style={[
                    styles.convTitle,
                    conv.id === activeConversationId && styles.convTitleActive,
                  ]}
                  numberOfLines={1}
                >
                  {conv.title}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        {/* Connections Section */}
        <View style={styles.connectionsSection}>
          <Text style={styles.sectionLabel}>Connections</Text>
          <View style={styles.connectionRow}>
            <View style={[styles.statusDot, backendOnline ? styles.dotGreen : styles.dotRed]} />
            <Text style={styles.connectionText}>
              {backendOnline === null ? 'Checking...' : backendOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          {backendOnline && (
            <>
              <TouchableOpacity
                style={styles.connectionRow}
                onPress={!zerodhaConnected ? onConnectZerodha : undefined}
              >
                <Text style={styles.connectionIcon}>{zerodhaConnected ? '✓' : '○'}</Text>
                <Text style={[styles.connectionText, zerodhaConnected && styles.connectedText]}>
                  Zerodha
                </Text>
                {!zerodhaConnected && <Text style={styles.connectLink}>Connect</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectionRow}
                onPress={!angelOneConnected ? onConnectAngel : undefined}
              >
                <Text style={styles.connectionIcon}>{angelOneConnected ? '✓' : '○'}</Text>
                <Text style={[styles.connectionText, angelOneConnected && styles.connectedText]}>
                  Angel One
                </Text>
                {!angelOneConnected && <Text style={styles.connectLink}>Connect</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectionRow}
                onPress={!upstoxConnected ? onConnectUpstox : undefined}
              >
                <Text style={styles.connectionIcon}>{upstoxConnected ? '✓' : '○'}</Text>
                <Text style={[styles.connectionText, upstoxConnected && styles.connectedText]}>
                  Upstox
                </Text>
                {!upstoxConnected && <Text style={styles.connectLink}>Connect</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectionRow}
                onPress={!fyersConnected ? onConnectFyers : undefined}
              >
                <Text style={styles.connectionIcon}>{fyersConnected ? '✓' : '○'}</Text>
                <Text style={[styles.connectionText, fyersConnected && styles.connectedText]}>
                  Fyers
                </Text>
                {!fyersConnected && <Text style={styles.connectLink}>Connect</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.connectionRow}
                onPress={!gmailConnected ? onConnectGmail : undefined}
              >
                <Text style={styles.connectionIcon}>{gmailConnected ? '✓' : '○'}</Text>
                <Text style={[styles.connectionText, gmailConnected && styles.connectedText]}>
                  Gmail
                </Text>
                {!gmailConnected && <Text style={styles.connectLink}>Connect</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Tone selector at bottom */}
        <View style={styles.bottomSection}>
          <Text style={styles.versionText}>Clutch v1.0</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(Sidebar);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.bg,
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
  },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  newChatIcon: { color: colors.text, fontSize: 20, marginRight: spacing.md, fontWeight: '300' },
  newChatText: { color: colors.text, fontSize: typography.base, fontWeight: typography.medium },
  convList: { flex: 1 },
  sectionLabel: {
    color: colors.textMuted, fontSize: typography.xs, fontWeight: typography.semibold,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: spacing.sm, marginTop: spacing.xs,
  },
  emptyText: { color: colors.textFaint, fontSize: typography.sm, paddingVertical: spacing.sm },
  convItem: {
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, marginBottom: 2,
  },
  convItemActive: { backgroundColor: colors.surface },
  convTitle: { color: colors.textSecondary, fontSize: typography.sm + 1 },
  convTitleActive: { color: colors.text },
  connectionsSection: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 14, marginTop: spacing.sm,
  },
  connectionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4, marginRight: 10,
  },
  dotGreen: { backgroundColor: colors.online },
  dotRed: { backgroundColor: colors.offline },
  connectionIcon: { color: colors.textMuted, fontSize: 14, marginRight: 10, width: 18 },
  connectionText: { color: colors.textSecondary, fontSize: typography.sm, flex: 1 },
  connectedText: { color: colors.online },
  connectLink: { color: colors.primary, fontSize: typography.xs, fontWeight: typography.semibold },
  bottomSection: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  versionText: { color: colors.textFaint, fontSize: typography.xs },
});
