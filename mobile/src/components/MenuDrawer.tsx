import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  viewMode?: 'client' | 'organizer' | 'admin';
  onSetMode?: (mode: 'client' | 'organizer' | 'admin') => void;
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
  const [pendingViewMode, setPendingViewMode] = useState<'client' | 'organizer' | 'admin'>(viewMode);
  const modePillX = useRef(new Animated.Value(0)).current;
  const drawerY = useRef(new Animated.Value(900)).current;
  const modeCount = canAdmin ? 3 : 2;
  const modePillWidth = modeSwitchWidth > 0 ? (modeSwitchWidth - 8 - 6 * (modeCount - 1)) / modeCount : 0;

  useEffect(() => {
    if (!visible) return;
    setPendingViewMode(viewMode);
    drawerY.setValue(900);
    Animated.spring(drawerY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 170,
      mass: 0.9,
    }).start();
  }, [drawerY, viewMode, visible]);

  useEffect(() => {
    const activeModeIndex = pendingViewMode === 'admin' && canAdmin ? 2 : pendingViewMode === 'organizer' ? 1 : 0;
    Animated.spring(modePillX, {
      toValue: activeModeIndex * (modePillWidth + 6),
      useNativeDriver: true,
      damping: 18,
      stiffness: 210,
      mass: 0.7,
    }).start();
  }, [canAdmin, modePillWidth, modePillX, pendingViewMode]);

  const closeAndApplyMode = () => {
    closeWithAnimation(() => {
      if (canOrganize && onSetMode) onSetMode(pendingViewMode);
    });
  };

  const selectMode = (mode: 'client' | 'organizer' | 'admin') => {
    setPendingViewMode(mode);
    closeWithAnimation(() => {
      if (canOrganize && onSetMode) onSetMode(mode);
    });
  };

  const closeWithAnimation = (afterClose?: () => void) => {
    Animated.timing(drawerY, {
      toValue: 900,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      onClose();
      afterClose?.();
    });
  };

  const go = (action?: () => void) => {
    closeWithAnimation(action);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeAndApplyMode}>
      <Animated.View style={[styles.panel, Platform.OS === 'web' && { backgroundColor: 'transparent' }, { transform: [{ translateY: drawerY }] }]}>
        <ScreenBackground />

        <View style={styles.topBar}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
          <TouchableOpacity style={styles.closeBtn} onPress={closeAndApplyMode}>
            <Ionicons name="close" size={27} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Client / Organizer / Admin mode toggle */}
          {canOrganize && onSetMode && (
            <View style={styles.modeSwitch} onLayout={(event) => setModeSwitchWidth(event.nativeEvent.layout.width)}>
              {modePillWidth > 0 && (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.modeSlidingPill,
                    { width: modePillWidth, transform: [{ translateX: modePillX }] },
                  ]}
                >
                  <LinearGradient
                    colors={['#ff8a18', '#f46c00', '#c93f00']}
                    locations={[0, 0.46, 1]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={styles.modePillShine}>
                    <LinearGradient
                      colors={['rgba(255,235,205,0)', 'rgba(255,235,205,0.85)', 'rgba(255,235,205,0)']}
                      locations={[0, 0.5, 1]}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                </Animated.View>
              )}
              <TouchableOpacity
                style={[styles.modeBtn, pendingViewMode === 'client' && styles.modeBtnActive]}
                onPress={() => selectMode('client')}
              >
                <Ionicons name="person-outline" size={16} color={pendingViewMode === 'client' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
                <Text style={[styles.modeText, pendingViewMode === 'client' && styles.modeTextActive]}>{t('Cliente', 'Client')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, pendingViewMode === 'organizer' && styles.modeBtnActive]}
                onPress={() => selectMode('organizer')}
              >
                <Ionicons name="briefcase-outline" size={16} color={pendingViewMode === 'organizer' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
                <Text style={[styles.modeText, pendingViewMode === 'organizer' && styles.modeTextActive]}>{t('Organizador', 'Organizer')}</Text>
              </TouchableOpacity>
              {canAdmin && (
                <TouchableOpacity
                  style={[styles.modeBtn, pendingViewMode === 'admin' && styles.modeBtnActive]}
                  onPress={() => selectMode('admin')}
                >
                  <Ionicons name="shield-outline" size={16} color={pendingViewMode === 'admin' ? '#FFFFFF' : 'rgba(255,255,255,0.66)'} />
                  <Text style={[styles.modeText, pendingViewMode === 'admin' && styles.modeTextActive]}>{t('Admin', 'Admin')}</Text>
                </TouchableOpacity>
              )}
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
      </Animated.View>
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
    borderWidth: 1,
    borderColor: 'rgba(255,151,45,0.62)',
    overflow: 'hidden',
    shadowColor: '#ff6800',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  modePillShine: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 5,
    height: 1,
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
  modeText: { color: 'rgba(255,255,255,0.66)', fontSize: 12, fontWeight: '800' },
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
