import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Fakes the web `.page-dark-shell` radial glows with stacked concentric circles
// (pure RN + expo-linear-gradient — works on iOS / Android / web, no SVG):
//   base navy gradient #061b2d -> #071827 -> #05111f
//   orange radial glow at ~10%/-top  (web: rgba(249,115,22,0.20), 28rem)
//   blue   radial glow at ~86%/top   (web: rgba(56,189,248,0.14), 30rem)

type Layer = { d: number; o: number };

const ORANGE: Layer[] = [
  { d: 960, o: 0.05 },
  { d: 760, o: 0.05 },
  { d: 560, o: 0.06 },
  { d: 380, o: 0.07 },
  { d: 230, o: 0.08 },
];

const BLUE: Layer[] = [
  { d: 900, o: 0.04 },
  { d: 680, o: 0.045 },
  { d: 460, o: 0.05 },
  { d: 300, o: 0.05 },
];

function Glow({ color, cx, cy, layers }: { color: string; cx: number; cy: number; layers: Layer[] }) {
  return (
    <>
      {layers.map((l, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: cx - l.d / 2,
            top: cy - l.d / 2,
            width: l.d,
            height: l.d,
            borderRadius: l.d / 2,
            backgroundColor: color,
            opacity: l.o,
          }}
        />
      ))}
    </>
  );
}

export function ScreenBackground() {
  const { width } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <LinearGradient
        colors={['#061b2d', '#071827', '#05111f']}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Glow color="#F97316" cx={width * 0.1} cy={-70} layers={ORANGE} />
      <Glow color="#38bdf8" cx={width * 0.86} cy={20} layers={BLUE} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', backgroundColor: '#05111f' },
});
