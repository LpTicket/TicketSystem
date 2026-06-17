import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height, borderRadius = 8, style }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const translateX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-300, 300] });

  return (
    <View style={[{ width, height, borderRadius, backgroundColor: 'rgba(8,31,51,0.55)', overflow: 'hidden' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(23,49,74,0.85)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function TicketCardSkeleton() {
  return (
    <View style={sk.ticketCard}>
      <View style={sk.ticketTop}>
        <View style={sk.flex1}>
          <Skeleton width="40%" height={11} borderRadius={4} />
          <Skeleton height={26} borderRadius={8} style={sk.mt8} />
          <Skeleton width="70%" height={26} borderRadius={8} style={sk.mt4} />
          <Skeleton width="55%" height={14} borderRadius={6} style={sk.mt8} />
          <Skeleton width="45%" height={14} borderRadius={6} style={sk.mt4} />
        </View>
        <Skeleton width={64} height={28} borderRadius={999} />
      </View>
      <View style={sk.ticketBody}>
        <Skeleton width={118} height={118} borderRadius={20} />
        <View style={sk.ticketDetails}>
          <Skeleton height={44} borderRadius={14} />
          <Skeleton height={44} borderRadius={14} />
          <Skeleton height={44} borderRadius={14} />
        </View>
      </View>
      <View style={sk.actions}>
        <Skeleton width="48%" height={48} borderRadius={14} />
        <Skeleton width="48%" height={48} borderRadius={14} />
        <Skeleton width="48%" height={48} borderRadius={14} />
        <Skeleton width="48%" height={48} borderRadius={14} />
      </View>
    </View>
  );
}

export function EventCardSkeleton() {
  return (
    <View style={sk.eventCard}>
      <Skeleton style={{ aspectRatio: 3 / 4 }} borderRadius={0} />
      <View style={sk.eventInfo}>
        <Skeleton height={21} borderRadius={6} />
        <Skeleton width="70%" height={21} borderRadius={6} style={sk.mt4} />
        <Skeleton width="60%" height={15} borderRadius={6} style={sk.mt14} />
        <Skeleton width="50%" height={15} borderRadius={6} style={sk.mt8} />
        <View style={sk.divider} />
        <Skeleton width="30%" height={20} borderRadius={6} />
        <View style={sk.ctaRow}>
          <Skeleton width={56} height={56} borderRadius={8} />
          <Skeleton height={56} borderRadius={16} style={sk.flex1} />
        </View>
      </View>
    </View>
  );
}

export function OrderRowSkeleton() {
  return (
    <View style={sk.orderRow}>
      <View style={sk.flex1}>
        <Skeleton width="70%" height={15} borderRadius={6} />
        <Skeleton width="50%" height={12} borderRadius={4} style={sk.mt6} />
      </View>
      <View style={sk.orderRight}>
        <Skeleton width={56} height={16} borderRadius={6} />
        <Skeleton width={56} height={22} borderRadius={10} style={sk.mt6} />
      </View>
    </View>
  );
}

export function PaymentMethodSkeleton() {
  return (
    <View style={sk.payRow}>
      <Skeleton width={42} height={42} borderRadius={12} />
      <View style={sk.flex1}>
        <Skeleton width="45%" height={14} borderRadius={6} />
        <Skeleton width="30%" height={11} borderRadius={4} style={sk.mt4} />
      </View>
      <Skeleton width={32} height={32} borderRadius={8} />
    </View>
  );
}

const sk = StyleSheet.create({
  ticketCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  ticketTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ticketBody: { flexDirection: 'row', gap: 14, marginTop: 18 },
  ticketDetails: { flex: 1, gap: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  eventCard: {
    marginHorizontal: 16,
    marginTop: 18,
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  eventInfo: {
    padding: 18,
    backgroundColor: '#030B14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
  },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: 20 },
  ctaRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    marginBottom: 8,
  },
  orderRight: { alignItems: 'flex-end' },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    marginBottom: 8,
  },
  flex1: { flex: 1 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  mt8: { marginTop: 8 },
  mt14: { marginTop: 14 },
});
