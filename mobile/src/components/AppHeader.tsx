import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';

// Same asset as the web header (/logo.png): color icon + white "LPTicket" text.
const logo = require('../../assets/logo-header.png');

type Mode = 'client' | 'organizer';
type Props = {
  onOpenMenu: () => void;
  onOpenScan: () => void;
  canOrganize?: boolean;
  viewMode?: Mode;
  onSetMode?: (mode: Mode) => void;
};

// Mirrors the web's mobile header (max-width 1023px overrides):
// 84px row over the dark bg with a warm orange glow on the right,
// Compact lang pill (active = solid orange), 32px glass buttons,
// orange hamburger icon.
export function AppHeader({ onOpenMenu, onOpenScan, canOrganize, viewMode = 'client', onSetMode }: Props) {
  const { lang, setLang } = useLanguage();
  const langPillX = useRef(new Animated.Value(lang === 'es' ? 0 : 34)).current;

  useEffect(() => {
    Animated.spring(langPillX, {
      toValue: lang === 'es' ? 0 : 34,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.7,
    }).start();
  }, [lang, langPillX]);

  return (
    <View style={styles.header}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />

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

        {canOrganize && onSetMode && (
          <View style={styles.modePill}>
            <TouchableOpacity onPress={() => onSetMode('client')} style={[styles.modeBtn, viewMode === 'client' && styles.modeBtnActive]}>
              <Ionicons name="person-outline" size={15} color={viewMode === 'client' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onSetMode('organizer')} style={[styles.modeBtn, viewMode === 'organizer' && styles.modeBtnActive]}>
              <Ionicons name="briefcase-outline" size={15} color={viewMode === 'organizer' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
            </TouchableOpacity>
          </View>
        )}

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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  modePill: {
    flexDirection: 'row',
    width: 74,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(117,132,153,0.34)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 3,
  },
  modeBtn: { flex: 1, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  modeBtnActive: { backgroundColor: '#F97316' },
  langSwitch: {
    flexDirection: 'row',
    width: 74,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(117,132,153,0.34)',
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.035)',
    position: 'relative',
    overflow: 'hidden',
  },
  langSlidingPill: {
    position: 'absolute',
    left: 3,
    top: 2,
    width: 34,
    height: 26,
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
    fontSize: 10.5,
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
