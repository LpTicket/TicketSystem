import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

const splashWebp = require('../../assets/splash.webp');

const SPLASH_MS = 2800;

// Hard safety: the splash can NEVER block the app longer than this.
const MAX_BLOCK_MS = 7000;

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
    const t1 = setTimeout(dismiss, SPLASH_MS);
    const t2 = setTimeout(() => {
      done.current = false;
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
