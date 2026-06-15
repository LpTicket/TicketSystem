import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

// Web can't play the source .mov, so it uses an animated WebP exported from
// the same file (keeps the alpha channel, plays once and holds the lockup).
const splashWebp = require('../../assets/splash.webp');

// The exported animation runs ~6.0s (146 frames @ 24fps) then holds.
const WEB_ANIM_MS = 5800;

type Props = {
  onFinish: () => void;
};

export function SplashVideo({ onFinish }: Props) {
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, WEB_ANIM_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.bg} />
      <Image source={splashWebp} style={styles.lockup} resizeMode="contain" />
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
  },
});
