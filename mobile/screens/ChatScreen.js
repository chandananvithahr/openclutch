import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
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
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

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
      toValue: (input.trim() || attachments.length > 0) ? 1 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [input, attachments]);

  // Scroll-to-bottom button — myChat ChatHistory + Gifted Chat MessagesContainer pattern
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollBtnOpacity = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const isAtBottom = useRef(true);

  const handleScroll = useCallback(({ nativeEvent }) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isAtBottom.current = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD;
  }, []);

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

  // Send — uploads attachments then delegates to useChat
  const handleSend = useCallback(async () => {
    const text = input.trim();
    const hasAttachments = attachments.length > 0;
    if ((!text && !hasAttachments) || isTyping) return;

    const currentAttachments = [...attachments];
    setInput('');
    setInputHeight(MIN_INPUT_HEIGHT);
    setAttachments([]);

    if (!hasAttachments) {
      await send(text);
      return;
    }

    // Build preview data for message bubble
    const previewAttachments = currentAttachments.map(a => ({
      uri: a.uri, name: a.name, isImage: a.isImage,
    }));

    // Send the user message immediately with previews (no blocking upload)
    const userText = text || `Analyze ${currentAttachments.map(a => a.name).join(', ')}`;
    send(userText, previewAttachments);

    // Upload files in background — results appear as follow-up
    const token = await getToken();
    for (const att of currentAttachments) {
      try {
        const formData = new FormData();
        formData.append('file', { uri: att.uri, name: att.name, type: att.type });
        if (text) formData.append('question', text);

        const endpoint = att.isImage ? '/api/files/analyze-image'
          : att.name?.toLowerCase().includes('cas') && att.name?.toLowerCase().endsWith('.pdf')
            ? '/api/cas/upload' : '/api/files/analyze';

        const res = await fetch(`${BACKEND_URL}${endpoint}`, {
          method: 'POST',
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        });
        const data = await res.json();
        if (data.error) Alert.alert('Upload failed', data.error);
      } catch (e) {
        Alert.alert('Upload error', e?.message || 'Failed to upload');
      }
    }
  }, [input, isTyping, send, attachments]);

  const handleNewChat = useCallback(() => {
    reset();
    setInput('');
    closeSidebar();
  }, [reset, closeSidebar]);

  // Attachment state — Claude-style preview inside input card
  const [attachments, setAttachments] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Auto-height TextInput — Gifted Chat Composer.tsx pattern
  const handleContentSizeChange = useCallback(({ nativeEvent }) => {
    const h = Math.min(Math.max(nativeEvent.contentSize.height, MIN_INPUT_HEIGHT), MAX_INPUT_HEIGHT);
    setInputHeight(h);
  }, []);

  const addAttachment = useCallback((file) => {
    setAttachments(prev => [...prev, {
      id: `att-${Date.now()}`,
      uri: file.uri,
      name: file.name || 'image.jpg',
      type: file.mimeType || file.type || 'application/octet-stream',
      isImage: (file.mimeType || file.type || '').startsWith('image/'),
    }]);
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  // Camera
  const handleCamera = useCallback(async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) addAttachment(result.assets[0]);
  }, [addAttachment]);

  // Photo gallery
  const handlePhotos = useCallback(async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Photo access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });
    if (!result.canceled) result.assets.forEach(addAttachment);
  }, [addAttachment]);

  // File picker (PDF, Excel, CSV)
  const handleFiles = useCallback(async () => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/*'],
      copyToCacheDirectory: true,
      multiple: true,
    });
    if (!result.canceled) result.assets.forEach(addAttachment);
  }, [addAttachment]);

  // Memoize filtered data — avoid new array on every render
  const filteredMessages = useMemo(
    () => messages.filter(m => !(m.streaming && !m.content)),
    [messages]
  );
  const showTypingFooter = useMemo(
    () => messages[messages.length - 1]?.streaming && !messages[messages.length - 1]?.content,
    [messages]
  );

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
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
          data={filteredMessages}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListFooterComponent={showTypingFooter ? <TypingIndicator /> : null}
          contentContainerStyle={styles.messageList}
          style={styles.flatList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={400}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
        />

      </View>

      {/* ===== INPUT BAR — Claude-style single container ===== */}
      <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 2) }]}>
        <View style={styles.inputCard}>
          {/* Attachment previews inside the input card */}
          {attachments.length > 0 && (
            <View style={styles.attachPreviewRow}>
              {attachments.map(att => (
                <View key={att.id} style={styles.attachPreview}>
                  {att.isImage ? (
                    <Image source={{ uri: att.uri }} style={styles.attachThumb} />
                  ) : (
                    <View style={styles.attachFileCard}>
                      <Text style={styles.attachFileIcon}>
                        {att.name?.endsWith('.pdf') ? '📄' : att.name?.endsWith('.csv') ? '📊' : '📎'}
                      </Text>
                      <Text style={styles.attachFileName} numberOfLines={1}>{att.name}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.attachRemove} onPress={() => removeAttachment(att.id)}>
                    <Text style={styles.attachRemoveText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          {/* Text input area */}
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
          {/* Action row — + left, send/stop right */}
          <View style={styles.inputActions}>
            <TouchableOpacity style={styles.attachBtn} onPress={() => setShowAttachMenu(true)}>
              <Text style={styles.attachBtnText}>+</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {isTyping ? (
              <TouchableOpacity style={styles.stopBtn} onPress={stop}>
                <View style={styles.stopIcon} />
              </TouchableOpacity>
            ) : (
              <Animated.View style={{ opacity: sendOpacity }}>
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={handleSend}
                  disabled={!input.trim() && attachments.length === 0}
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
      </View>

      {/* ===== ATTACH MENU — bottom sheet ===== */}
      <Modal visible={showAttachMenu} transparent animationType="slide" onRequestClose={() => setShowAttachMenu(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.attachSheet}>
            <View style={styles.attachSheetHandle} />
            <TouchableOpacity style={styles.attachOption} onPress={handleCamera}>
              <Text style={styles.attachOptionIcon}>📷</Text>
              <Text style={styles.attachOptionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handlePhotos}>
              <Text style={styles.attachOptionIcon}>🖼️</Text>
              <Text style={styles.attachOptionText}>Photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={handleFiles}>
              <Text style={styles.attachOptionIcon}>📁</Text>
              <Text style={styles.attachOptionText}>Files</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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

  // ===== INPUT — Claude-style single card =====
  inputContainer: {
    paddingHorizontal: spacing.sm, paddingTop: 4, paddingBottom: 0,
    backgroundColor: colors.bg,
  },
  inputCard: {
    backgroundColor: colors.bgSubtle, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 4,
  },
  inputActions: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 2, paddingBottom: 4,
  },
  attachBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.bgMuted,
    justifyContent: 'center', alignItems: 'center',
  },
  attachBtnText: {
    color: colors.textSecondary, fontSize: 22, fontWeight: '400', lineHeight: 26,
  },
  input: {
    fontSize: typography.md, color: colors.text,
    paddingVertical: 6, lineHeight: typography.normal,
    minHeight: 36,
  },
  stopBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  stopIcon: {
    width: 11, height: 11, borderRadius: 2,
    backgroundColor: colors.text,
  },
  sendBtn: {
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  // Attachment previews inside input card
  attachPreviewRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingBottom: 8,
  },
  attachPreview: {
    position: 'relative',
  },
  attachThumb: {
    width: 72, height: 72, borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
  },
  attachFileCard: {
    width: 140, height: 56, borderRadius: radius.md,
    backgroundColor: colors.bgMuted, flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 10, gap: 6,
  },
  attachFileIcon: { fontSize: 20 },
  attachFileName: {
    flex: 1, fontSize: typography.xs, color: colors.textSecondary,
  },
  attachRemove: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  attachRemoveText: {
    color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 16,
  },
  // Bottom sheet menu
  attachOverlay: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  attachSheet: {
    backgroundColor: colors.bgMuted, borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl, paddingBottom: 32, paddingTop: 12,
  },
  attachSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border, alignSelf: 'center', marginBottom: 16,
  },
  attachOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 24, gap: 16,
  },
  attachOptionIcon: { fontSize: 24 },
  attachOptionText: {
    fontSize: typography.md, color: colors.text, fontWeight: '500',
  },
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
