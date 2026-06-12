import { Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '../i18n/LanguageContext';

// Same asset as the web header (/logo.png): color icon + white "LPTicket" text.
const logo = require('../../assets/logo-header.png');

type Props = { onOpenMenu: () => void; onOpenScan: () => void; onOpenAccount: () => void };

// Mirrors the web's mobile header (max-width 1023px overrides):
// 84px row over the dark bg with a warm orange glow on the right,
// 116x38 lang pill (active = solid orange), 32px glass buttons,
// orange hamburger icon.
export function AppHeader({ onOpenMenu, onOpenScan, onOpenAccount }: Props) {
  const { lang, setLang } = useLanguage();

  return (
    <View style={styles.header}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(249,115,22,0)', 'rgba(249,115,22,0.06)', 'rgba(249,115,22,0.16)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
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
          <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.92)" />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.iconButton, styles.menuButton]} onPress={onOpenMenu}>
          <Ionicons name="menu-outline" size={21} color="#ff7a00" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 84,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  logo: { width: 131, height: 33 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 0 },
  langSwitch: {
    flexDirection: 'row',
    width: 116,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(117,132,153,0.34)',
    padding: 3,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  langButton: {
    flex: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langButtonActive: {
    backgroundColor: '#F97316',
  },
  langText: {
    color: 'rgba(255,255,255,0.68)',
    fontWeight: '800',
    fontSize: 11.5,
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(117,132,153,0.24)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuButton: {
    borderColor: 'rgba(255,122,0,0.45)',
  },
});
