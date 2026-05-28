import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

const logo = require('../../assets/lpticket-logo.png');

type Props = { onOpenMenu: () => void; onOpenScan: () => void };

export function AppHeader({ onOpenMenu, onOpenScan }: Props) {
  return (
    <View style={styles.header}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      <View style={styles.actions}>
        <View style={styles.langSwitch}>
          <Text style={styles.langOff}>ES</Text>
          <Text style={styles.langOn}>EN</Text>
        </View>
        <TouchableOpacity style={styles.scanButton} onPress={onOpenScan}>
          <Text style={styles.scanIcon}>⌗</Text>
          <Text style={styles.scanText}>SCAN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
          <View style={styles.menuLine} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 96,
    backgroundColor: colors.white,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E5EAF0',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 10,
  },
  logo: { width: 132, height: 38 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  langSwitch: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#DDE3EA', height: 36 },
  langOff: { color: '#7C8491', backgroundColor: colors.white, paddingHorizontal: 10, paddingVertical: 9, fontWeight: '800', fontSize: 12 },
  langOn: { color: colors.white, backgroundColor: colors.navy, paddingHorizontal: 10, paddingVertical: 9, fontWeight: '800', fontSize: 12 },
  scanButton: { height: 36, borderRadius: 10, backgroundColor: colors.orange, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  scanIcon: { color: colors.white, fontSize: 14, fontWeight: '800' },
  scanText: { color: colors.white, fontWeight: '800', fontSize: 12, letterSpacing: 1.2 },
  menuButton: { width: 30, height: 30, justifyContent: 'center', gap: 5 },
  menuLine: { height: 3, backgroundColor: colors.navy, borderRadius: 999 },
});
