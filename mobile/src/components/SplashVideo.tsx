import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

const splashAnimation = require('../../assets/splash-animation.mp4');

const SPLASH_MS = 7000;

// Hard safety: the splash can NEVER block the app longer than this.
const MAX_BLOCK_MS = 8500;

type Props = {
  onFinish: () => void;
};

export function SplashVideo({ onFinish }: Props) {
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const done = useRef(false);
  const player = useVideoPlayer(splashAnimation, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.volume = 0;
    videoPlayer.play();
  });

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
      <View style={styles.bg} />
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        contentFit="cover"
        allowsPictureInPicture={false}
        pointerEvents="none"
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
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
