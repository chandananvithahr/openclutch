import React, { memo, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

function Sidebar({
  visible, onClose, slideAnim,
  conversations, activeConversationId,
  onSelectConversation, onNewChat,
  zerodhaConnected, angelOneConnected, upstoxConnected, fyersConnected, gmailConnected,
  onConnectZerodha, onConnectAngel, onConnectUpstox, onConnectFyers, onConnectGmail,
  backendOnline, onLogout,
}) {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (visible) {
      AsyncStorage.getItem('clutch_user_name').then(n => {
        if (n) setUserName(n);
      });
    }
  }, [visible]);

  if (!visible) return null;

  const initials = userName
    ? userName.trim().split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          styles.sidebar,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {/* ── CRED-style profile header ── */}
        <View style={styles.profileHeader}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitials}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>
              {userName || 'Your Account'}
            </Text>
            <Text style={styles.profileSub}>Personal AI · Pro</Text>
          </View>
          {onLogout && (
            <TouchableOpacity style={styles.logoutIcon} onPress={onLogout} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={styles.logoutDash} />
              <View style={[styles.logoutDash, { width: 10 }]} />
            </TouchableOpacity>
          )}
        </View>

        {/* New Chat */}
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
          <View style={styles.connectionsSectionHeader}>
            <Text style={styles.sectionLabel}>Connections</Text>
            <View style={[styles.serverChip, backendOnline ? styles.serverChipOnline : styles.serverChipOffline]}>
              <View style={[styles.serverDot, backendOnline ? styles.dotGreen : styles.dotRed]} />
              <Text style={[styles.serverChipText, backendOnline ? styles.serverTextOnline : styles.serverTextOffline]}>
                {backendOnline === null ? 'checking' : backendOnline ? 'live' : 'offline'}
              </Text>
            </View>
          </View>
          {backendOnline && (
            <View style={styles.brokerGrid}>
              {[
                { label: 'Zerodha',   connected: zerodhaConnected,   onConnect: onConnectZerodha },
                { label: 'Angel One', connected: angelOneConnected,  onConnect: onConnectAngel },
                { label: 'Upstox',    connected: upstoxConnected,    onConnect: onConnectUpstox },
                { label: 'Fyers',     connected: fyersConnected,     onConnect: onConnectFyers },
                { label: 'Gmail',     connected: gmailConnected,     onConnect: onConnectGmail },
              ].map(({ label, connected, onConnect }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.brokerChip, connected ? styles.brokerChipOn : styles.brokerChipOff]}
                  onPress={!connected ? onConnect : undefined}
                  activeOpacity={connected ? 1 : 0.7}
                >
                  <View style={[styles.brokerDot, connected ? styles.dotGreen : styles.dotDim]} />
                  <Text style={[styles.brokerLabel, connected && styles.brokerLabelOn]}>{label}</Text>
                  {!connected && <Text style={styles.brokerConnectArrow}>›</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Bottom: version */}
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
    paddingHorizontal: spacing.lg,
  },

  // ── CRED-style profile header ──
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitials: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.bg,
    letterSpacing: -0.3,
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.text,
    letterSpacing: -0.2,
  },
  profileSub: {
    fontSize: typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Logout — two dashes forming an exit icon
  logoutIcon: { gap: 4, alignItems: 'flex-end', justifyContent: 'center', padding: 4 },
  logoutDash: { height: 1.5, width: 14, backgroundColor: colors.textFaint, borderRadius: 1 },

  newChatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
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
  connectionsSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing.md,
  },
  serverChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, gap: 5,
  },
  serverChipOnline: { backgroundColor: 'rgba(76,175,80,0.12)' },
  serverChipOffline: { backgroundColor: 'rgba(255,107,107,0.12)' },
  serverDot: { width: 5, height: 5, borderRadius: 3 },
  dotGreen: { backgroundColor: colors.online },
  dotDim: { backgroundColor: colors.textFaint },
  dotRed: { backgroundColor: colors.offline },
  serverChipText: { fontSize: typography.xs, fontWeight: typography.semibold },
  serverTextOnline: { color: colors.online },
  serverTextOffline: { color: colors.offline },
  // Broker grid — 2 column chip layout
  brokerGrid: { gap: spacing.sm },
  brokerChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1,
    gap: spacing.sm,
  },
  brokerChipOn: { borderColor: 'rgba(76,175,80,0.25)', backgroundColor: 'rgba(76,175,80,0.06)' },
  brokerChipOff: { borderColor: colors.border, backgroundColor: 'transparent' },
  brokerDot: { width: 6, height: 6, borderRadius: 3 },
  brokerLabel: { flex: 1, fontSize: typography.sm, color: colors.textSecondary },
  brokerLabelOn: { color: colors.text },
  brokerConnectArrow: { color: colors.primary, fontSize: 18, fontWeight: typography.semibold },
  bottomSection: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingVertical: spacing.lg, alignItems: 'center',
  },
  versionText: { color: colors.textFaint, fontSize: typography.xs },
});
