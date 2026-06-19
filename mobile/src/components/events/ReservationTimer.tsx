import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  /** Unix ms timestamp of when the reservation was made (addedAt from AsyncStorage) */
  addedAt: number;
  /** Reservation window in ms, default 10 min */
  durationMs?: number;
  /** Called when timer reaches 0 */
  onExpire: () => void;
};

export function ReservationTimer({ addedAt, durationMs = 10 * 60 * 1000, onExpire }: Props) {
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const calcRemaining = () => Math.max(0, Math.floor((addedAt + durationMs - Date.now()) / 1000));

  const [secondsLeft, setSecondsLeft] = useState(calcRemaining);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const tick = setInterval(() => {
      const left = calcRemaining();
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(tick);
        onExpireRef.current();
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [addedAt, durationMs]);

  const isUrgent = secondsLeft < 120;

  // Pulse animation when urgent
  useEffect(() => {
    if (!isUrgent) { pulseAnim.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isUrgent]);

  const pct = Math.min(100, (secondsLeft / (durationMs / 1000)) * 100);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const barColor = isUrgent ? '#ef4444' : '#f97316';
  const textColor = isUrgent ? '#fca5a5' : '#fb923c';

  return (
    <Animated.View style={[st.container, isUrgent && st.containerUrgent, { transform: [{ scale: pulseAnim }] }]}>
      <View style={st.row}>
        <Ionicons name="time-outline" size={16} color={textColor} style={{ flexShrink: 0 }} />
        <View style={{ flex: 1 }}>
          <Text style={st.label}>Tu reservación expirará en:</Text>
          <Text style={[st.countdown, { color: textColor }]}>{mm}m {ss}s</Text>
        </View>
      </View>
      <View style={st.barTrack}>
        <View style={[st.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.30)',
    backgroundColor: 'rgba(249,115,22,0.07)',
    padding: 12,
    gap: 8,
  },
  containerUrgent: {
    borderColor: 'rgba(239,68,68,0.40)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: 'rgba(226,232,240,0.70)', fontSize: 11, fontWeight: '600' },
  countdown: { fontSize: 20, fontWeight: '900', marginTop: 1 },
  barTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
});
