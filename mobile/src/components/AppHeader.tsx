import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';

// Same asset as the web header (/logo.png): color icon + white "LPTicket" text.
const logo = require('../../assets/logo-header.png');

type Props = { onOpenMenu: () => void; onOpenScan: () => void; onGoHome: () => void; onOpenLogin?: () => void; showLoginButton?: boolean };

// Mirrors the web's mobile header (max-width 1023px overrides):
// 84px row over the dark bg with a warm orange glow on the right,
// Compact lang pill (active = solid orange), 32px glass buttons,
// orange hamburger icon.
export function AppHeader({ onOpenMenu, onGoHome, onOpenLogin, showLoginButton = false }: Props) {
  const { lang, setLang } = useLanguage();
  const langPillX = useRef(new Animated.Value(lang === 'es' ? 0 : 39)).current;
  const logoPress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(langPillX, {
      toValue: lang === 'es' ? 0 : 39,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.7,
    }).start();
  }, [lang, langPillX]);

  const handleLogoPress = () => {
    Animated.sequence([
      Animated.timing(logoPress, { toValue: 0.94, duration: 85, useNativeDriver: true }),
      Animated.spring(logoPress, { toValue: 1, useNativeDriver: true, damping: 13, stiffness: 260, mass: 0.55 }),
    ]).start();
    onGoHome();
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity activeOpacity={0.86} onPress={handleLogoPress} style={styles.logoButton}>
        <Animated.Image source={logo} style={[styles.logo, { transform: [{ scale: logoPress }] }]} resizeMode="contain" />
      </TouchableOpacity>

      <View style={styles.actions}>
        <View style={styles.langSwitch}>
          <Animated.View style={[styles.langSlidingPill, { transform: [{ translateX: langPillX }] }]} />
          <TouchableOpacity
            onPress={() => setLang('es')}
            style={styles.langButton}
          >
            <Text style={[styles.langText, lang === 'es' && styles.langTextActive]}>ES</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLang('en')}
            style={styles.langButton}
          >
            <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>EN</Text>
          </TouchableOpacity>
        </View>

        {showLoginButton && (
          <TouchableOpacity style={[styles.iconButton, styles.loginButton]} onPress={onOpenLogin} activeOpacity={0.84}>
            <Text style={styles.loginButtonText}>{lang === 'es' ? 'Inicio' : 'Login'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.iconButton, styles.menuButton]} onPress={onOpenMenu}>
          <Ionicons name="menu-outline" size={26} color="#ff7a00" />
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
  logoButton: { width: 146, height: 48, alignItems: 'flex-start', justifyContent: 'center' },
  logo: { width: 140, height: 42 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 0 },
  langSwitch: {
    flexDirection: 'row',
    width: 84,
    height: 37,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.48)',
    padding: 3,
    backgroundColor: '#030B14',
    position: 'relative',
    overflow: 'hidden',
  },
  langSlidingPill: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 39,
    height: 31,
    borderRadius: 7,
    backgroundColor: '#F97316',
  },
  langButton: {
    flex: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  langText: {
    color: 'rgba(255,255,255,0.68)',
    fontWeight: '800',
    fontSize: 12,
  },
  langTextActive: {
    color: '#FFFFFF',
  },
  iconButton: {
    width: 37,
    height: 37,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(117,132,153,0.24)',
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  menuButton: {
    borderColor: 'rgba(249,115,22,0.62)',
  },
  loginButton: {
    width: 54,
    borderColor: 'rgba(249,115,22,0.62)',
    paddingHorizontal: 5,
  },
  loginButtonText: {
    color: '#ff7a00',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
