import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

const logo = require('../../assets/lpticket-logo.png');

type Props = { onOpenMenu: () => void; onOpenScan: () => void; onOpenAccount: () => void };

// Mirrors the web's mobile header: logo left, then lang switch (active = orange),
// account icon and hamburger — one compact 64px row, no dead space below.
export function AppHeader({ onOpenMenu, onOpenScan, onOpenAccount }: Props) {
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

        <TouchableOpacity style={styles.iconButton} onPress={onOpenAccount}>
          <Ionicons name="person-outline" size={17} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={onOpenMenu}>
          <Ionicons name="menu-outline" size={21} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    backgroundColor: '#030B14',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  logo: { width: 138, height: 36, tintColor: '#FFFFFF', marginLeft: -6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  langSwitch: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  langButton: {
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButtonActive: {
    backgroundColor: '#F97316',
    borderRadius: 9,
  },
  langText: {
    color: 'rgba(255,255,255,0.70)',
    fontWeight: '800',
    fontSize: 11,
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
