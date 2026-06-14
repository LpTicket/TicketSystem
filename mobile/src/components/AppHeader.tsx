import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';

// Same asset as the web header (/logo.png): color icon + white "LPTicket" text.
const logo = require('../../assets/logo-header.png');

type Props = { onOpenMenu: () => void; onOpenScan: () => void; viewMode?: 'client' | 'organizer' | 'admin' };

// Mirrors the web's mobile header (max-width 1023px overrides):
// 84px row over the dark bg with a warm orange glow on the right,
// Compact lang pill (active = solid orange), 32px glass buttons,
// orange hamburger icon.
export function AppHeader({ onOpenMenu, viewMode = 'client' }: Props) {
  const { lang, setLang, t } = useLanguage();
  const langPillX = useRef(new Animated.Value(lang === 'es' ? 0 : 39)).current;

  useEffect(() => {
    Animated.spring(langPillX, {
      toValue: lang === 'es' ? 0 : 39,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.7,
    }).start();
  }, [lang, langPillX]);

  return (
    <View style={styles.header}>
      <View style={styles.brand}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <View style={styles.modeBadge}>
          <Ionicons name={viewMode === 'admin' ? 'shield-outline' : viewMode === 'organizer' ? 'briefcase-outline' : 'person-outline'} size={11} color="#F97316" />
          <Text style={styles.modeBadgeText}>
            {viewMode === 'admin' ? t('Administrador activo', 'Admin active') : viewMode === 'organizer' ? t('Organizador activo', 'Organizer active') : t('Cliente activo', 'Client active')}
          </Text>
        </View>
      </View>

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
    marginBottom: 16,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  brand: { alignItems: 'flex-start', justifyContent: 'center', transform: [{ translateY: 16 }] },
  logo: { width: 140, height: 42 },
  modeBadge: {
    height: 22,
    marginTop: 11,
    paddingHorizontal: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.36)',
    backgroundColor: '#030B14',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modeBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
  },
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
});
