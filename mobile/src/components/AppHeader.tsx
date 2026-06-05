import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

const logo = require('../../assets/lpticket-logo.png');

type Props = { onOpenMenu: () => void; onOpenScan: () => void };

export function AppHeader({ onOpenMenu, onOpenScan }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <View style={styles.header}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />

      <View style={styles.actions}>
        <View style={styles.langSwitch}>
          <TouchableOpacity
            onPress={() => setLang('es')}
            style={[styles.langButton, lang === 'es' && styles.langButtonActive]}
          >
            <Text style={[styles.langText, lang === 'es' && styles.langTextActive]}>ES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLang('en')}
            style={[styles.langButton, lang === 'en' && styles.langButtonActive]}
          >
            <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.scanButton} onPress={onOpenScan}>
          <Text style={styles.scanText}># SCAN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton} onPress={onOpenMenu}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 96,
    backgroundColor: '#030B14',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    zIndex: 10,
  },
  logo: { width: 176, height: 52, tintColor: '#FFFFFF' },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexShrink: 0 },
  langSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    height: 36,
    backgroundColor: '#030B14',
    transform: [{ translateY: -7 }],
  },
  langButton: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  langText: {
    color: 'rgba(226,232,240,0.58)',
    fontWeight: '700',
    fontSize: 12,
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  scanButton: {
    height: 36,
    minWidth: 92,
    borderRadius: 13,
    backgroundColor: '#F97316',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transform: [{ translateY: -7 }],
  },
  scanText: { color: '#FFFFFF', fontSize: 12, lineHeight: 14, fontWeight: '900', letterSpacing: 1.2 },
  menuButton: {
    width: 46,
    height: 36,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transform: [{ translateY: -7 }],
  },
  hamburgerLine: { width: 27, height: 3, borderRadius: 999, backgroundColor: colors.white, marginVertical: 2 },
});
