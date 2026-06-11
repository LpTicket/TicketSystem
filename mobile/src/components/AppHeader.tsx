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
          <Ionicons name="person-outline" size={18} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={onOpenMenu}>
          <Ionicons name="menu-outline" size={23} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 72,
    backgroundColor: '#030B14',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  logo: { width: 132, height: 34, tintColor: '#FFFFFF', marginLeft: -4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 0 },
  langSwitch: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    height: 38,
    padding: 3,
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  langButton: {
    paddingHorizontal: 15,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButtonActive: {
    backgroundColor: '#F97316',
  },
  langText: {
    color: 'rgba(255,255,255,0.72)',
    fontWeight: '800',
    fontSize: 12,
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
