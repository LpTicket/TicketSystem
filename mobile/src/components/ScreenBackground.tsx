import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

// Mirrors the web `.page-dark-shell` background:
//   radial-gradient(circle at 10% -8%, rgba(249,115,22,0.20), transparent 28rem)
//   radial-gradient(circle at 86% 3%,  rgba(56,189,248,0.14), transparent 30rem)
//   linear-gradient(180deg, #061b2d, #071827 46%, #05111f)
export function ScreenBackground() {
  const { width, height } = useWindowDimensions();
  const orangeR = 28 * 16; // 28rem
  const blueR = 30 * 16; // 30rem

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#061b2d', '#071827', '#05111f']}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="orange" cx={width * 0.1} cy={height * -0.02} r={orangeR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#F97316" stopOpacity={0.2} />
            <Stop offset="1" stopColor="#F97316" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="blue" cx={width * 0.86} cy={height * 0.03} r={blueR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#38bdf8" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#38bdf8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#orange)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#blue)" />
      </Svg>
    </View>
  );
}
