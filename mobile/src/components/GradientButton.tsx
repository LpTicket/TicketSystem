import { ReactNode } from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Props = {
  label?: string;
  children?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  textStyle?: TextStyle;
  height?: number;
  disabled?: boolean;
};

// Glossy orange button matching the web's primary button
// (linear-gradient #ff8a18 -> #f46c00 -> #c93f00 + top shine line).
export function GradientButton({ label, children, onPress, style, textStyle, height = 58, disabled }: Props) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      disabled={disabled}
      style={[styles.wrap, { height }, style as ViewStyle]}
    >
      <LinearGradient
        colors={['#ff8a18', '#f46c00', '#c93f00']}
        locations={[0, 0.46, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.shine} />
      {children ?? <Text style={[styles.text, textStyle]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,151,45,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff6800',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  shine: {
    position: 'absolute',
    left: 13,
    right: 13,
    top: 6,
    height: 1,
    borderRadius: 999,
    backgroundColor: 'rgba(255,235,205,0.85)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.6,
    textShadowColor: 'rgba(0,0,0,0.24)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 1 },
  },
});
