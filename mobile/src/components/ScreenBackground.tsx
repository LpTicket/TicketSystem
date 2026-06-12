import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

// Native (iOS/Android) port of the web `html body` background (globals.css ~5780):
//   92px grid squares (rgba(148,163,184,~0.02))
//   radial orange glow at 78%/12% (right)  rgba(255,107,0,0.18), 27rem
//   radial blue   glow at 16%/2%  (left)   rgba(65,110,155,0.16), 24rem
//   base linear-gradient #050b12 -> #07111d 46% -> #050b12
// Web uses ScreenBackground.web.tsx (CSS injection) via Metro platform resolution.
export function ScreenBackground() {
  const { width, height } = useWindowDimensions();
  const orangeR = 27 * 16; // 27rem
  const blueR = 24 * 16; // 24rem

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#050b12', '#07111d', '#050b12']}
        locations={[0, 0.46, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <RadialGradient id="lp-orange" cx={width * 0.78} cy={height * 0.12} r={orangeR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#ff6b00" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#ff6b00" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="lp-blue" cx={width * 0.16} cy={height * 0.02} r={blueR} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#416e9b" stopOpacity={0.16} />
            <Stop offset="1" stopColor="#416e9b" stopOpacity={0} />
          </RadialGradient>
          <Pattern id="lp-grid" width={92} height={92} patternUnits="userSpaceOnUse">
            <Path d={`M 92 0 L 0 0 L 0 92`} fill="none" stroke="rgba(148,163,184,0.05)" strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#lp-grid)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#lp-orange)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#lp-blue)" />
      </Svg>
    </View>
  );
}
