import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

export function FloatingButtons() {
  return (
    <>
      <TouchableOpacity style={[styles.floatButton, styles.chatFloat]}>
        <Text style={styles.floatText}>☵</Text>
        <View style={styles.onlineDot} />
      </TouchableOpacity>
      <TouchableOpacity style={[styles.floatButton, styles.mailFloat]}>
        <Text style={styles.floatText}>✉</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.floatButton, styles.cartFloat]}>
        <Text style={styles.floatText}>🛒</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  floatButton: {
    position: 'absolute',
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#E7F4FF',
    borderWidth: 1,
    borderColor: '#AFC7DA',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
  },
  floatText: { color: colors.navy, fontSize: 28, fontWeight: '600' },
  chatFloat: { left: 20, bottom: 34 },
  mailFloat: { right: 20, bottom: 126 },
  cartFloat: { right: 20, bottom: 34 },
  onlineDot: {
    position: 'absolute',
    right: 5,
    top: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#22C55E',
    borderWidth: 3,
    borderColor: '#CFF6D7',
  },
});
