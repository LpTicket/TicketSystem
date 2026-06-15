import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

// Native plays the .mov directly (qtrle with alpha over the dark background).
// Web uses SplashVideo.web.tsx (animated WebP) — Metro picks the platform file.
const splashVideo = require('../../assets/splash.mov');

type Props = {
  onFinish: () => void;
};

export function SplashVideo({ onFinish }: Props) {
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const fadeOut = () => {
    Animated.timing(containerOpacity, {
      toValue: 0,
      duration: 650,
      useNativeDriver: true,
    }).start(() => onFinish());
  };

  // Safety timeout in case the video fails to fire didJustFinish.
  useEffect(() => {
    const t = setTimeout(fadeOut, 7000);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.bg} />
      <Video
        source={splashVideo}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        isMuted
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded && status.didJustFinish) {
            fadeOut();
          }
        }}
      />
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
});
