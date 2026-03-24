import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export default function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);

    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Animated.Text style={styles.avatarText}>C</Animated.Text>
      </View>
      <View style={styles.bubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, marginVertical: 6 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#6C63FF', justifyContent: 'center',
    alignItems: 'center', marginRight: 8,
  },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  bubble: {
    flexDirection: 'row', backgroundColor: '#F0F0F0',
    padding: 14, borderRadius: 18, borderBottomLeftRadius: 4, gap: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#999' },
});
