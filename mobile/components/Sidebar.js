import React, { memo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.78;

function Sidebar({
  visible, onClose, slideAnim,
  conversations, activeConversationId,
  onSelectConversation, onNewChat,
  zerodhaConnected, angelOneConnected, gmailConnected,
  onConnectZerodha, onConnectAngel, onConnectGmail,
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
    backgroundColor: '#171717',
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  newChatBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#333',
    marginBottom: 20,
  },
  newChatIcon: { color: '#fff', fontSize: 20, marginRight: 12, fontWeight: '300' },
  newChatText: { color: '#fff', fontSize: 15, fontWeight: '500' },
  convList: { flex: 1 },
  sectionLabel: {
    color: '#888', fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, marginTop: 4,
  },
  emptyText: { color: '#555', fontSize: 13, paddingVertical: 8 },
  convItem: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 8, marginBottom: 2,
  },
  convItemActive: { backgroundColor: '#2a2a2a' },
  convTitle: { color: '#ccc', fontSize: 14 },
  convTitleActive: { color: '#fff' },
  connectionsSection: {
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
    paddingTop: 14, marginTop: 8,
  },
  connectionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4, marginRight: 10,
  },
  dotGreen: { backgroundColor: '#22c55e' },
  dotRed: { backgroundColor: '#ef4444' },
  connectionIcon: { color: '#888', fontSize: 14, marginRight: 10, width: 18 },
  connectionText: { color: '#aaa', fontSize: 13, flex: 1 },
  connectedText: { color: '#22c55e' },
  connectLink: { color: '#6C63FF', fontSize: 12, fontWeight: '600' },
  bottomSection: {
    borderTopWidth: 1, borderTopColor: '#2a2a2a',
    paddingVertical: 16, alignItems: 'center',
  },
  versionText: { color: '#555', fontSize: 11 },
});
