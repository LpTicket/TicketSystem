import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../i18n/LanguageContext';

export type AppMode = 'client' | 'organizer' | 'admin';

type IconName = keyof typeof Ionicons.glyphMap;

// Segmented mode selector: Client / Organizer (+ Admin when allowed).
export function ModeSelector({
  mode,
  canAdmin,
  onChange,
}: {
  mode: AppMode;
  canAdmin?: boolean;
  onChange: (mode: AppMode) => void;
}) {
  const { t } = useLanguage();

  const options: { key: AppMode; label: string; icon: IconName }[] = [
    { key: 'client', label: t('Cliente', 'Client'), icon: 'person-outline' },
    { key: 'organizer', label: t('Organizador', 'Organizer'), icon: 'briefcase-outline' },
    ...(canAdmin ? [{ key: 'admin' as AppMode, label: 'Admin', icon: 'shield-outline' as IconName }] : []),
  ];
  const selectorX = useRef(new Animated.Value(0)).current;
  const [wrapWidth, setWrapWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((o) => o.key === mode));
  const segmentGap = 4;
  const wrapPadding = 4;
  const segmentWidth = wrapWidth > 0
    ? (wrapWidth - wrapPadding * 2 - segmentGap * (options.length - 1)) / options.length
    : 0;

  useEffect(() => {
    if (!segmentWidth) return;
    Animated.spring(selectorX, {
      toValue: wrapPadding + activeIndex * (segmentWidth + segmentGap),
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [activeIndex, segmentWidth, selectorX]);

  return (
    <View style={styles.wrap} onLayout={(event) => setWrapWidth(event.nativeEvent.layout.width)}>
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            { width: segmentWidth, transform: [{ translateX: selectorX }] },
          ]}
        >
          <LinearGradient
            colors={['#ff8a18', '#f46c00', '#c93f00']}
            locations={[0, 0.46, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View pointerEvents="none" style={styles.slidingPillShine}>
            <LinearGradient
              colors={['rgba(255,235,205,0)', 'rgba(255,235,205,0.85)', 'rgba(255,235,205,0)']}
              locations={[0, 0.5, 1]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </Animated.View>
      )}
      {options.map((o) => {
        const activeOpt = mode === o.key;
        return (
          <TouchableOpacity key={o.key} style={styles.seg} onPress={() => onChange(o.key)}>
            <Ionicons name={o.icon} size={15} color={activeOpt ? '#FFFFFF' : 'rgba(255,255,255,0.62)'} />
            <Text style={[styles.segText, activeOpt && styles.segTextActive]} numberOfLines={1}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  slidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,151,45,0.62)',
    shadowColor: '#ff6800',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  slidingPillShine: {
    position: 'absolute',
    left: 13,
    right: 13,
    top: 6,
    height: 1,
  },
  seg: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingHorizontal: 4,
    zIndex: 1,
  },
  segText: { color: 'rgba(255,255,255,0.62)', fontSize: 13, fontWeight: '800' },
  segTextActive: { color: '#FFFFFF' },
});
