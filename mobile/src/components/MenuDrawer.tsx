import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { ScreenBackground } from './ScreenBackground';

type Props = {
  visible: boolean;
  onClose: () => void;
  onGoEvents?: () => void;
  onGoTickets?: () => void;
  onGoProfile?: () => void;
  onGoScan?: () => void;
  onGoAiChat?: () => void;
  onGoSocialMatch?: () => void;
  onGoCart?: () => void;
  onGoOrganizer?: () => void;
  onGoAdmin?: () => void;
  onGoContact?: () => void;
  onGoAbout?: () => void;
  onGoSupport?: () => void;
  onLogout?: () => void;
  canOrganize?: boolean;
  canAdmin?: boolean;
  viewMode?: 'client' | 'organizer';
  onSetMode?: (mode: 'client' | 'organizer') => void;
};

type IconName = keyof typeof Ionicons.glyphMap;
const logo = require('../../assets/logo-header.png');

export function MenuDrawer({
  visible, onClose, onGoEvents, onGoTickets, onGoProfile, onGoScan, onGoAiChat,
  onGoSocialMatch, onGoOrganizer, onGoAdmin, onGoContact, onGoAbout, onGoSupport, onLogout,
  canOrganize, canAdmin, viewMode = 'client', onSetMode,
}: Props) {
  const { t } = useLanguage();
  const [modeSwitchWidth, setModeSwitchWidth] = useState(0);
  const modePillX = useRef(new Animated.Value(0)).current;
  const modePillWidth = modeSwitchWidth > 0 ? (modeSwitchWidth - 14) / 2 : 0;

  useEffect(() => {
    Animated.spring(modePillX, {
      toValue: viewMode === 'organizer' ? modePillWidth + 6 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.7,
    }).start();
  }, [modePillWidth, modePillX, viewMode]);

  const go = (action?: () => void) => {
    onClose();
    action?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.panel, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
        <ScreenBackground />

        <View style={styles.topBar}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={27} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Client / Organizer mode toggle */}
          {canOrganize && onSetMode && (
            <View style={styles.modeSwitch} onLayout={(event) => setModeSwitchWidth(event.nativeEvent.layout.width)}>
              {modePillWidth > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.modeSlidingPill,
                    { width: modePillWidth, transform: [{ translateX: modePillX }] },
                  ]}
                />
              )}
              <TouchableOpacity
                style={[styles.modeBtn, viewMode === 'client' && styles.modeBtnActive]}
                onPress={() => { onClose(); onSetMode('client'); }}
              >
                <Ionicons name="person-outline" size={16} color={viewMode === 'client' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
                <Text style={[styles.modeText, viewMode === 'client' && styles.modeTextActive]}>{t('Cliente', 'Client')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, viewMode === 'organizer' && styles.modeBtnActive]}
                onPress={() => { onClose(); onSetMode('organizer'); }}
              >
                <Ionicons name="briefcase-outline" size={16} color={viewMode === 'organizer' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
                <Text style={[styles.modeText, viewMode === 'organizer' && styles.modeTextActive]}>{t('Organizador', 'Organizer')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Primary nav — text rows, no icons (matches web) */}
          <View style={styles.card}>
            <Row label={t('Quiénes Somos', 'About Us')} onPress={() => go(onGoAbout)} />
            <Row label={t('Contacto', 'Contact')} onPress={() => go(onGoContact)} />
            <Row label={t('Soporte', 'Support')} onPress={() => go(onGoSupport)} />
          </View>

          {/* Account / actions — with orange icons */}
          <View style={styles.card}>
            <Row icon="chatbubble-ellipses-outline" label={t('Chat IA', 'AI Assistant')} onPress={() => go(onGoAiChat)} />
            {canOrganize && (
              <Row icon="settings-outline" label={t('Panel Organizador', 'Organizer Panel')} onPress={() => go(onGoOrganizer)} featured />
            )}
            {canAdmin && (
              <Row icon="shield-outline" label={t('Panel Administrador', 'Admin Panel')} onPress={() => go(onGoAdmin)} featured />
            )}
            <Row icon="log-out-outline" label={t('Cerrar sesión', 'Log out')} onPress={() => go(onLogout)} danger />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ label, onPress, icon, danger, featured }: { label: string; onPress: () => void; icon?: IconName; danger?: boolean; featured?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, featured && styles.rowFeatured, danger && styles.rowDanger]} onPress={onPress} activeOpacity={0.7}>
      {icon && <Ionicons name={icon} size={23} color={danger ? '#ff5a45' : '#ff7a00'} />}
      <Text style={[styles.rowText, danger && styles.rowTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#030B14',
    paddingHorizontal: 16,
    paddingTop: 65,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, marginBottom: 22 },
  logo: { width: 140, height: 42 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingBottom: 40, gap: 16 },
  modeSwitch: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    position: 'relative',
    overflow: 'hidden',
  },
  modeSlidingPill: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    borderRadius: 12,
    backgroundColor: '#F97316',
  },
  modeBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    zIndex: 1,
  },
  modeBtnActive: {},
  modeText: { color: 'rgba(255,255,255,0.66)', fontSize: 14, fontWeight: '800' },
  modeTextActive: { color: '#FFFFFF' },
  card: {
    padding: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  row: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    marginBottom: 3,
  },
  rowDanger: { borderColor: 'rgba(255,90,69,0.24)', backgroundColor: 'rgba(255,90,69,0.08)', marginTop: 5, marginBottom: 0 },
  rowFeatured: {
    borderColor: 'rgba(249,115,22,0.34)',
    backgroundColor: 'rgba(249,115,22,0.075)',
    marginTop: 5,
    shadowColor: '#F97316',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  rowText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  rowTextDanger: { color: '#ff5a45' },
});
