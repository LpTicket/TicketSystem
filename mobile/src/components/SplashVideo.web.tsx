import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

// Web can't play the source .mov, so it uses an animated WebP exported from
// the same file (keeps the alpha channel, plays once and holds the lockup).
const splashWebp = require('../../assets/splash.webp');

// The exported animation runs ~3.1s (sped up 2x) then holds.
const WEB_ANIM_MS = 2600;
// Hard safety: the splash can NEVER block the app longer than this.
const MAX_BLOCK_MS = 4000;

type Props = {
  onFinish: () => void;
};

export function SplashVideo({ onFinish }: Props) {
  const { t } = useLanguage();
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const done = useRef(false);

  // Fade out + finish, guaranteed to run only once no matter what triggers it.
  const dismiss = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 450,
      useNativeDriver: true,
    }).start(() => onFinish());
  };

  useEffect(() => {
    const t1 = setTimeout(dismiss, WEB_ANIM_MS);
    // Safety net: if anything stalls, force the app open.
    const t2 = setTimeout(() => {
      done.current = false; // bypass any half-started animation
      onFinish();
    }, MAX_BLOCK_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Tap anywhere to skip. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <View style={styles.bg} />
      </Pressable>
      <Image source={splashWebp} style={styles.lockup} resizeMode="contain" />
      <Pressable style={styles.skip} onPress={dismiss}>
        <Text style={styles.skipText}>{t('Saltar', 'Skip')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#030B14',
  },
  // WebP frame is 600x338 (16:9) with the lockup centered inside.
  lockup: {
    width: 360,
    height: 203,
    pointerEvents: 'none',
  },
  skip: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skipText: {
    color: 'rgba(248,250,252,0.9)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
