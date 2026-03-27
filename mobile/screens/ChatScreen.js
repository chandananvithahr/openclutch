import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  FlatList, StyleSheet, StatusBar, Modal, Alert,
  Animated, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { colors, spacing, radius, typography } from '../styles/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MessageBubble from '../components/MessageBubble';
import TypingIndicator from '../components/TypingIndicator';
import Sidebar from '../components/Sidebar';
import { getChatHistory, getToken, authFetch } from '../services/api';
import BACKEND_URL from '../services/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestSmsPermission, syncSmsTransactions } from '../services/smsParser';
import { useChat } from '../hooks/useChat';
import ConnectionCard, { detectConnectionPrompts } from '../components/ConnectionCard';

const TONE_OPTIONS = [
  { key: 'bhai', label: 'Bhai', desc: 'Casual, Hinglish' },
  { key: 'pro', label: 'Pro', desc: 'Data-first' },
  { key: 'mentor', label: 'Mentor', desc: 'Patient, explains' },
];

const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.78;

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
const SCROLL_BOTTOM_THRESHOLD = 200; // px from bottom to show scroll button
const MIN_INPUT_HEIGHT = 44;
const MAX_INPUT_HEIGHT = 120;

export default function ChatScreen({ onLogout }) {
  const insets = useSafeAreaInsets();
  const [tone, setTone] = useState('pro');

  // Chat logic — myChat useChat hook pattern
  const { messages, isTyping, conversations, send, stop, reset, loadHistory } = useChat(tone);

  // Input state
  const [input, setInput] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);

  // Send button fade animation — Gifted Chat Send.tsx pattern
  const sendOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(sendOpacity, {
      toValue: input.trim() ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [input]);

  // Scroll-to-bottom button — myChat ChatHistory + Gifted Chat MessagesContainer pattern
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollBtnOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const isAtBottom = useRef(true);

  const handleScroll = useCallback(({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    const atBottom = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
    if (atBottom !== isAtBottom.current) {
      isAtBottom.current = atBottom;
      setShowScrollBtn(!atBottom);
      Animated.timing(scrollBtnOpacity, {
        toValue: atBottom ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [scrollBtnOpacity]);

  const scrollToBottom = useCallback(() => {
    // 10ms delay ensures list renders before scroll — React-Native-AI-Assistant-App pattern
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 10);
  }, []);

  // Auto-scroll when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (isAtBottom.current) {
      scrollToBottom();
    }
  }, [messages, isTyping]);

  // Backend + broker status
  const [backendOnline, setBackendOnline] = useState(null);
  const [zerodhaConnected, setZerodhaConnected] = useState(false);
  const [angelOneConnected, setAngelOneConnected] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  // Upstox + Fyers status
  const [upstoxConnected, setUpstoxConnected] = useState(false);
  const [fyersConnected, setFyersConnected] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/health`);
        if (res.ok) {
          setBackendOnline(true);
          const token = await getToken();
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const [zRes, aRes, uRes, fRes, gRes] = await Promise.all([
            fetch(`${BACKEND_URL}/api/zerodha/status`, { headers }).then(r => r.json()).catch(() => ({ connected: false })),
            fetch(`${BACKEND_URL}/api/angelone/status`, { headers }).then(r => r.json()).catch(() => ({ connected: false })),
            fetch(`${BACKEND_URL}/api/upstox/status`, { headers }).then(r => r.json()).catch(() => ({ connected: false })),
            fetch(`${BACKEND_URL}/api/fyers/status`, { headers }).then(r => r.json()).catch(() => ({ connected: false })),
            fetch(`${BACKEND_URL}/api/gmail/status`, { headers }).then(r => r.json()).catch(() => ({ connected: false })),
          ]);
          setZerodhaConnected(zRes.connected);
          setAngelOneConnected(aRes.connected);
          setUpstoxConnected(uRes.connected);
          setFyersConnected(fRes.connected);
          setGmailConnected(gRes.connected);
        } else {
          setBackendOnline(false);
        }
      } catch {
        setBackendOnline(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // SMS background sync
  useEffect(() => {
    const syncSms = async () => {
      const granted = await requestSmsPermission();
      if (!granted) return;
      const userId = await AsyncStorage.getItem('clutch_user_id');
      if (!userId) return;
      const result = await syncSmsTransactions(userId);
      if (result.synced > 0) console.log(`SMS: synced ${result.synced} transactions`);
    };
    syncSms();
    const interval = setInterval(syncSms, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Load chat history
  useEffect(() => {
    const load = async () => {
      try {
        const history = await getChatHistory(50);
        loadHistory(history);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 500);
      } catch (e) {
        console.warn('Chat history load failed:', e?.message);
      }
    };
    load();
  }, []);

  // Notifications
  const [notifCount, setNotifCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${BACKEND_URL}/api/workflows/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.notifications || [];
      setNotifications(list);
      setNotifCount(list.filter(n => !n.read).length);
    } catch {
      // silent
    }
  }, []);

  const markNotificationsRead = useCallback(async () => {
    setShowNotifModal(true);
    if (notifCount === 0) return;
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${BACKEND_URL}/api/workflows/notifications/read-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // silent
    }
  }, [notifCount]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Sidebar
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH)).current;

  const openSidebar = useCallback(() => {
    setSidebarVisible(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [slideAnim]);

  const closeSidebar = useCallback(() => {
    Animated.timing(slideAnim, { toValue: -SIDEBAR_WIDTH, duration: 200, useNativeDriver: true })
      .start(() => setSidebarVisible(false));
  }, [slideAnim]);

  // Tone picker
  const [showTonePicker, setShowTonePicker] = useState(false);

  // Angel One modal
  const [showAngelOneModal, setShowAngelOneModal] = useState(false);
  const [angelCreds, setAngelCreds] = useState({ clientId: '', password: '', totp: '' });
  const [angelConnecting, setAngelConnecting] = useState(false);

  // Broker connections — all OAuth flows open in browser
  const handleOAuthConnect = useCallback(async (broker, endpoint) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}${endpoint}?json=true`, {
        headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.loginUrl) {
        const { Linking } = require('react-native');
        await Linking.openURL(data.loginUrl);
      } else {
        console.warn(`${broker} login no URL:`, res.status, JSON.stringify(data));
        Alert.alert(broker, `Error ${res.status}: ${data.error || 'No login URL returned'}`);
      }
    } catch (e) {
      console.warn(`${broker} connect failed:`, e?.message);
      Alert.alert(broker, `Could not connect: ${e?.message}`);
    }
  }, []);

  const handleZerodhaConnect = useCallback(() => handleOAuthConnect('Zerodha', '/api/zerodha/login'), [handleOAuthConnect]);
  const handleUpstoxConnect = useCallback(() => handleOAuthConnect('Upstox', '/api/upstox/login'), [handleOAuthConnect]);
  const handleFyersConnect = useCallback(() => handleOAuthConnect('Fyers', '/api/fyers/login'), [handleOAuthConnect]);
  const handleGmailConnect = useCallback(() => handleOAuthConnect('Gmail', '/api/gmail/login'), [handleOAuthConnect]);

  const handleAngelOneConnect = useCallback(async () => {
    const { clientId, password, totp } = angelCreds;
    if (!clientId || !password || !totp) return;
    setAngelConnecting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/api/angelone/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ clientId, password, totp }),
      });
      const data = await res.json();
      if (data.success) {
        setAngelOneConnected(true);
        setShowAngelOneModal(false);
        setAngelCreds({ clientId: '', password: '', totp: '' });
      } else {
        Alert.alert('Failed', data.error || 'Check credentials.');
      }
    } catch {
      Alert.alert('Error', 'Could not connect.');
    } finally {
      setAngelConnecting(false);
    }
  }, [angelCreds]);

  // Send — delegates to useChat hook
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');
    setInputHeight(MIN_INPUT_HEIGHT);
    await send(text);
  }, [input, isTyping, send]);

  const handleNewChat = useCallback(() => {
    reset();
    setInput('');
    closeSidebar();
  }, [reset, closeSidebar]);

  // Auto-height TextInput — Gifted Chat Composer.tsx pattern
  const handleContentSizeChange = useCallback(({ nativeEvent }) => {
    const h = Math.min(Math.max(nativeEvent.contentSize.height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
    setInputHeight(h);
  }, []);

  const selectedTone = TONE_OPTIONS.find(t => t.key === tone);

  const renderItem = useCallback(({ item }) => {
    const prompts = item.role === 'assistant' && item.id !== 'welcome'
      ? detectConnectionPrompts(item.content, {
          zerodha: zerodhaConnected, angelone: angelOneConnected,
          upstox: upstoxConnected, fyers: fyersConnected, gmail: gmailConnected,
        })
      : [];
    return (
      <View>
        <MessageBubble message={item} />
        {prompts.map(svc => (
          <ConnectionCard
            key={svc}
            service={svc}
            onConnect={() => {
              if (svc === 'zerodha') handleZerodhaConnect();
              else if (svc === 'angelone') setShowAngelOneModal(true);
              else if (svc === 'upstox') handleUpstoxConnect();
              else if (svc === 'fyers') handleFyersConnect();
              else if (svc === 'gmail') handleGmailConnect();
              else if (svc === 'broker') handleZerodhaConnect();
            }}
          />
        ))}
      </View>
    );
  }, [zerodhaConnected, angelOneConnected, upstoxConnected, fyersConnected, gmailConnected,
      handleZerodhaConnect, handleUpstoxConnect, handleFyersConnect, handleGmailConnect]);

  return (
    // KeyboardAvoidingView — Gifted Chat fix for input bar sticking to keyboard
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior="padding"
      keyboardVerticalOffset={insets.top + 48}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} translucent={false} />

      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        {/* Hamburger — 3 clean lines */}
        <TouchableOpacity style={styles.headerBtn} onPress={openSidebar}>
          <View style={styles.menuIcon}>
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 14 }]} />
            <View style={styles.menuLine} />
          </View>
        </TouchableOpacity>

        {/* Center — app name + tone pill */}
        <TouchableOpacity style={styles.headerCenter} onPress={() => setShowTonePicker(true)}>
          <Text style={styles.headerTitle}>Clutch</Text>
          <View style={styles.tonePill}>
            <Text style={styles.tonePillText}>{selectedTone.label}</Text>
          </View>
        </TouchableOpacity>

        {/* Right actions */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={markNotificationsRead}>
            <View style={styles.bellIcon}>
              <View style={styles.bellTop} />
              <View style={styles.bellBottom} />
            </View>
            {notifCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{notifCount > 9 ? '9+' : notifCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerBtn, styles.newChatBtn]} onPress={handleNewChat}>
            <Text style={styles.newChatBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {backendOnline === false && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>● Offline — start backend & run adb reverse</Text>
        </View>
      )}

      {/* ===== MESSAGES ===== */}
      <View style={styles.listWrapper}>
        <FlatList
          ref={flatListRef}
          data={messages.filter(m => !(m.streaming && !m.content))}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListFooterComponent={messages[messages.length - 1]?.streaming && !messages[messages.length - 1]?.content ? <TypingIndicator /> : null}
          contentContainerStyle={styles.messageList}
          style={styles.flatList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

      </View>

      {/* ===== INPUT BAR ===== */}
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 8 }]}>
        <View style={[styles.inputRow, { minHeight: Math.max(inputHeight + 8, 48) }]}>
          <TextInput
            style={[styles.input, { height: inputHeight }]}
            value={input}
            onChangeText={setInput}
            placeholder="Message Clutch..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            onContentSizeChange={handleContentSizeChange}
            editable={true}
          />

          {/* Stop button while typing, send button otherwise */}
          {isTyping ? (
            <TouchableOpacity style={styles.stopBtn} onPress={stop}>
              <View style={styles.stopIcon} />
            </TouchableOpacity>
          ) : (
            <Animated.View style={[styles.sendBtnWrap, { opacity: sendOpacity }]}>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={handleSend}
                disabled={!input.trim()}
              >
                <View style={styles.sendArrow}>
                  <View style={styles.sendArrowLeft} />
                  <View style={styles.sendArrowRight} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>

      {/* ===== SIDEBAR ===== */}
      <Sidebar
        visible={sidebarVisible}
        onClose={closeSidebar}
        slideAnim={slideAnim}
        conversations={conversations}
        activeConversationId="current"
        onSelectConversation={() => closeSidebar()}
        onNewChat={handleNewChat}
        zerodhaConnected={zerodhaConnected}
        angelOneConnected={angelOneConnected}
        upstoxConnected={upstoxConnected}
        fyersConnected={fyersConnected}
        gmailConnected={gmailConnected}
        onConnectZerodha={() => { closeSidebar(); handleZerodhaConnect(); }}
        onConnectAngel={() => { closeSidebar(); setShowAngelOneModal(true); }}
        onConnectUpstox={() => { closeSidebar(); handleUpstoxConnect(); }}
        onConnectFyers={() => { closeSidebar(); handleFyersConnect(); }}
        onConnectGmail={() => { closeSidebar(); handleGmailConnect(); }}
        backendOnline={backendOnline}
        onLogout={onLogout}
      />

      {/* ===== TONE PICKER ===== */}
      <Modal visible={showTonePicker} transparent animationType="fade" onRequestClose={() => setShowTonePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTonePicker(false)}>
          <View style={styles.tonePickerBox}>
            <Text style={styles.tonePickerTitle}>Choose tone</Text>
            {TONE_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.toneOption, tone === opt.key && styles.toneOptionActive]}
                onPress={() => { setTone(opt.key); setShowTonePicker(false); }}
              >
                <View>
                  <Text style={[styles.toneOptionLabel, tone === opt.key && styles.toneOptionLabelActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.toneOptionDesc}>{opt.desc}</Text>
                </View>
                {tone === opt.key && (
                  <View style={styles.selectedDot} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ===== NOTIFICATIONS MODAL ===== */}
      <Modal visible={showNotifModal} transparent animationType="slide" onRequestClose={() => setShowNotifModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.notifModalBox}>
            <View style={styles.notifModalHeader}>
              <Text style={styles.credModalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                <Text style={styles.notifClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={notifications.slice(0, 30)}
              keyExtractor={(item, i) => item.id || `notif-${i}`}
              ListEmptyComponent={<Text style={styles.notifEmpty}>No notifications yet.</Text>}
              renderItem={({ item: n }) => (
                <View style={[styles.notifItem, !n.read && styles.notifItemUnread]}>
                  <Text style={styles.notifMsg}>{n.message}</Text>
                  <Text style={styles.notifTime}>{formatTimeAgo(n.created_at)}</Text>
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* ===== ANGEL ONE MODAL ===== */}
      <Modal visible={showAngelOneModal} transparent animationType="fade" onRequestClose={() => setShowAngelOneModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.credModalBox}>
            <Text style={styles.credModalTitle}>Connect Angel One</Text>
            <Text style={styles.credModalDesc}>
              Credentials go directly to Angel One. Clutch never stores your password.
            </Text>
            <TextInput
              style={styles.credInput}
              placeholder="Client ID (e.g. A123456)"
              placeholderTextColor={colors.textMuted}
              value={angelCreds.clientId}
              onChangeText={v => setAngelCreds(p => ({ ...p, clientId: v }))}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.credInput}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={angelCreds.password}
              onChangeText={v => setAngelCreds(p => ({ ...p, password: v }))}
              secureTextEntry
            />
            <TextInput
              style={styles.credInput}
              placeholder="TOTP (6-digit code)"
              placeholderTextColor={colors.textMuted}
              value={angelCreds.totp}
              onChangeText={v => setAngelCreds(p => ({ ...p, totp: v }))}
              keyboardType="numeric"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.credSubmitBtn, angelConnecting && { opacity: 0.6 }]}
              onPress={handleAngelOneConnect}
              disabled={angelConnecting}
            >
              <Text style={styles.credSubmitText}>{angelConnecting ? 'Connecting...' : 'Connect'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAngelOneModal(false)}>
              <Text style={styles.credCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // ===== HEADER =====
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, height: 52,
    borderBottomWidth: 0.5, borderBottomColor: colors.border,
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  // Custom menu icon — 3 lines
  menuIcon: { gap: 5, alignItems: 'flex-start' },
  menuLine: { height: 1.5, width: 18, backgroundColor: colors.textSecondary, borderRadius: 2 },
  // Center
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { fontSize: 17, fontWeight: typography.bold, color: colors.text, letterSpacing: 0.2 },
  tonePill: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tonePillText: { fontSize: typography.xs, color: colors.textMuted, fontWeight: typography.semibold },
  // Bell icon — CSS-drawn
  bellIcon: { alignItems: 'center' },
  bellTop: {
    width: 14, height: 12,
    borderWidth: 1.5, borderColor: colors.textSecondary,
    borderTopLeftRadius: 7, borderTopRightRadius: 7,
    borderBottomWidth: 0,
  },
  bellBottom: {
    width: 18, height: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    marginTop: 1,
  },
  // New chat button — accent pill
  newChatBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    width: 32, height: 32,
  },
  newChatBtnText: {
    fontSize: 22, color: colors.primary, fontWeight: '300',
    lineHeight: 28, textAlign: 'center',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  notifBadge: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: colors.offline, borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: colors.text, fontSize: 9, fontWeight: '700' },
  notifModalBox: {
    backgroundColor: colors.bg, borderRadius: radius.lg,
    padding: spacing.xl, width: '100%', maxWidth: 360, maxHeight: '80%',
  },
  notifModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.lg,
  },
  notifClose: { fontSize: 18, color: colors.textMuted, padding: 4 },
  notifEmpty: { color: colors.textMuted, fontSize: typography.sm, textAlign: 'center', paddingVertical: spacing.xl },
  notifItem: {
    paddingVertical: spacing.md, borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  notifItemUnread: { backgroundColor: colors.primaryLight, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  notifMsg: { fontSize: typography.sm, color: colors.text, lineHeight: 20 },
  notifTime: { fontSize: typography.xs, color: colors.textMuted, marginTop: 3 },

  offlineBar: { backgroundColor: colors.lossBg, paddingVertical: 6, paddingHorizontal: spacing.lg },
  offlineText: { color: colors.offline, fontSize: typography.xs, textAlign: 'center' },

  // ===== MESSAGES =====
  listWrapper: { flex: 1 },
  flatList: { flex: 1 },
  messageList: { paddingVertical: spacing.md },

  // Scroll-to-bottom button
  scrollBtnWrap: {
    position: 'absolute', bottom: 12, alignSelf: 'center', left: 0, right: 0,
    alignItems: 'center',
  },
  scrollBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    backgroundColor: colors.bgMuted,
    borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  chevronDown: {
    width: 14, height: 8,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  chevronLeft: {
    position: 'absolute', left: 0, top: 0,
    width: 9, height: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateX: -1 }],
  },
  chevronRight: {
    position: 'absolute', right: 0, top: 0,
    width: 9, height: 2,
    backgroundColor: colors.textSecondary,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateX: 1 }],
  },

  // ===== INPUT =====
  inputContainer: {
    paddingHorizontal: spacing.md, paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.bgSubtle, borderRadius: radius.xl,
    paddingHorizontal: spacing.lg, paddingVertical: 4,
  },
  input: {
    flex: 1, fontSize: typography.md, color: colors.text,
    paddingVertical: 10, lineHeight: typography.normal,
  },
  stopBtn: {
    width: 34, height: 34, borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: spacing.sm, marginBottom: 4,
    borderWidth: 1.5, borderColor: colors.border,
  },
  stopIcon: {
    width: 12, height: 12, borderRadius: 2,
    backgroundColor: colors.text,
  },
  sendBtnWrap: { marginLeft: spacing.sm, marginBottom: 4 },
  sendBtn: {
    width: 34, height: 34, borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  // Chevron-up icon drawn with two rotated bars
  sendArrow: {
    width: 14, height: 10,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  sendArrowLeft: {
    position: 'absolute', left: 0, bottom: 0,
    width: 9, height: 2,
    backgroundColor: colors.bg,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }, { translateX: -1 }],
  },
  sendArrowRight: {
    position: 'absolute', right: 0, bottom: 0,
    width: 9, height: 2,
    backgroundColor: colors.bg,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }, { translateX: 1 }],
  },

  // ===== TONE PICKER =====
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.xxl,
  },
  tonePickerBox: {
    backgroundColor: colors.bg, borderRadius: radius.lg,
    padding: spacing.xl, width: '100%', maxWidth: 320,
  },
  tonePickerTitle: {
    fontSize: 17, fontWeight: typography.bold, color: colors.text,
    marginBottom: spacing.lg, textAlign: 'center',
  },
  toneOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: spacing.lg,
    borderRadius: radius.md, marginBottom: 4,
  },
  toneOptionActive: { backgroundColor: colors.primaryLight },
  toneOptionLabel: { fontSize: typography.base, fontWeight: typography.semibold, color: colors.textSecondary },
  toneOptionLabelActive: { color: colors.primary },
  toneOptionDesc: { fontSize: typography.xs, color: colors.textMuted, marginTop: 2 },
  selectedDot: {
    width: 8, height: 8, borderRadius: radius.full,
    backgroundColor: colors.primary,
  },

  // ===== ANGEL ONE MODAL =====
  credModalBox: {
    backgroundColor: colors.bg, borderRadius: radius.lg,
    padding: spacing.xxl, width: '100%', maxWidth: 340,
  },
  credModalTitle: { fontSize: 17, fontWeight: typography.bold, color: colors.text, marginBottom: spacing.sm },
  credModalDesc: { fontSize: typography.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  credInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: typography.sm,
    color: colors.text, marginBottom: spacing.md, backgroundColor: colors.bgMuted,
  },
  credSubmitBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: 4, marginBottom: spacing.md,
  },
  credSubmitText: { color: colors.bg, fontWeight: typography.bold, fontSize: typography.base },
  credCancelText: { textAlign: 'center', color: colors.textMuted, fontSize: typography.sm, paddingVertical: 4 },
});
