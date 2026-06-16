import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useLanguage } from '../i18n/LanguageContext';

// Native plays the .mov directly (qtrle with alpha over the dark background).
// Web uses SplashVideo.web.tsx (animated WebP) — Metro picks the platform file.
const splashVideo = require('../../assets/splash.mov');

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

  // Safety net in case the video never fires didJustFinish.
  useEffect(() => {
    const safety = setTimeout(() => {
      done.current = false;
      onFinish();
    }, MAX_BLOCK_MS);
    return () => clearTimeout(safety);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      {/* Tap anywhere to skip. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss}>
        <View style={styles.bg} />
      </Pressable>
      <Video
        source={splashVideo}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        isMuted
        pointerEvents="none"
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish) {
            dismiss();
          }
        }}
      />
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
  video: {
    width: '80%',
    aspectRatio: 1,
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
