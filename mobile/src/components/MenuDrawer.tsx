import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, ScrollView, StyleSheet, Text, TouchableOpacity, View, SafeAreaView, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useLanguage } from '../i18n/LanguageContext';
import { ScreenBackground } from './ScreenBackground';
import { ModeSelector, AppMode } from './ModeSelector';

type AdminSectionId = 'dashboard' | 'events' | 'users' | 'categories' | 'marketing' | 'analytics' | 'codes';
type OrgPanelSectionId = 'dashboard' | 'events' | 'create';
type OrgSectionId = OrgPanelSectionId | 'scan' | 'doorSale';

type Props = {
  visible: boolean;
  onClose: () => void;
  onGoEvents?: () => void;
  onGoHome?: () => void;
  onGoTickets?: () => void;
  onGoProfile?: () => void;
  onGoScan?: () => void;
  onGoEmployeeScan?: () => void;
  onGoEmployeeDoorSale?: () => void;
  onGoDoorSale?: () => void;
  onGoAiChat?: () => void;
  onGoSocialMatch?: () => void;
  onGoCart?: () => void;
  onGoOrganizer?: () => void;
  onGoAdmin?: () => void;
  onGoContact?: () => void;
  onGoAbout?: () => void;
  onGoSupport?: () => void;
  onGoLegal?: (key: 'privacy' | 'terms' | 'refunds' | 'organizer-agreement') => void;
  onLogout?: () => void;
  isLoggedIn?: boolean;
  canOrganize?: boolean;
  canAdmin?: boolean;
  viewMode?: AppMode;
  activeClientTab?: 'events' | 'tickets' | 'profile' | 'social' | 'aichat';
  onSetMode?: (mode: AppMode) => void;
  // Admin panel section navigation
  adminSection?: AdminSectionId;
  onGoAdminSection?: (section: AdminSectionId) => void;
  // Organizer panel section navigation
  orgSection?: OrgSectionId;
  onGoOrgSection?: (section: OrgPanelSectionId | 'scan') => void;
};

type IconName = keyof typeof Ionicons.glyphMap;
const logo = require('../../assets/logo-header.png');

const adminSections: { id: AdminSectionId; labelEs: string; labelEn: string; icon: IconName }[] = [
  { id: 'dashboard', labelEs: 'Dashboard', labelEn: 'Dashboard', icon: 'grid-outline' },
  { id: 'events', labelEs: 'Eventos', labelEn: 'Events', icon: 'calendar-outline' },
  { id: 'users', labelEs: 'Usuarios', labelEn: 'Users', icon: 'people-outline' },
  { id: 'categories', labelEs: 'Categorías', labelEn: 'Categories', icon: 'pricetag-outline' },
  { id: 'marketing', labelEs: 'Marketing', labelEn: 'Marketing', icon: 'megaphone-outline' },
  { id: 'analytics', labelEs: 'Analíticas', labelEn: 'Analytics', icon: 'stats-chart-outline' },
  { id: 'codes', labelEs: 'Códigos especiales', labelEn: 'Special codes', icon: 'key-outline' },
];

const orgSections: { id: OrgSectionId; labelEs: string; labelEn: string; icon: IconName }[] = [
  { id: 'dashboard', labelEs: 'Dashboard', labelEn: 'Dashboard', icon: 'grid-outline' },
  { id: 'scan', labelEs: 'Scan', labelEn: 'Scan', icon: 'scan-outline' },
  { id: 'doorSale', labelEs: 'Venta en puerta', labelEn: 'Door sale', icon: 'card-outline' },
  { id: 'events', labelEs: 'Mis Eventos', labelEn: 'My Events', icon: 'calendar-outline' },
  { id: 'create', labelEs: 'Crear Evento', labelEn: 'Create Event', icon: 'add-circle-outline' },
];

export function MenuDrawer({
  visible, onClose, onGoEvents, onGoHome, onGoTickets, onGoProfile, onGoScan, onGoAiChat,
  onGoEmployeeScan, onGoEmployeeDoorSale, onGoDoorSale, onGoSocialMatch, onGoOrganizer, onGoAdmin, onGoContact, onGoAbout, onGoSupport, onGoLegal, onLogout,
  isLoggedIn, canOrganize, canAdmin, viewMode = 'client', activeClientTab, onSetMode,
  adminSection, onGoAdminSection,
  orgSection, onGoOrgSection,
}: Props) {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const logoPress = useRef(new Animated.Value(1)).current;
  const sheetTranslateY = useRef(new Animated.Value(height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(22)).current;
  const drawerScrollY = useRef(0);
  const gestureDismissInProgress = useRef(false);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      gestureDismissInProgress.current = false;
      setMounted(true);
      return;
    }
    if (!mounted || gestureDismissInProgress.current) return;

    sheetTranslateY.stopAnimation();
    backdropOpacity.stopAnimation();
    contentOpacity.stopAnimation();
    contentTranslateY.stopAnimation();
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(contentTranslateY, { toValue: 22, duration: 160, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: height, duration: 300, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, mounted, height, sheetTranslateY, backdropOpacity, contentOpacity, contentTranslateY]);

  useEffect(() => {
    if (!mounted || !visible) return;

    sheetTranslateY.stopAnimation();
    backdropOpacity.stopAnimation();
    contentOpacity.stopAnimation();
    contentTranslateY.stopAnimation();
    sheetTranslateY.setValue(height);
    backdropOpacity.setValue(0);
    contentOpacity.setValue(0);
    contentTranslateY.setValue(22);
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 340, useNativeDriver: true }),
      Animated.spring(sheetTranslateY, { toValue: 0, damping: 24, stiffness: 230, mass: 0.78, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(115),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(contentTranslateY, { toValue: 0, duration: 330, useNativeDriver: true }),
        ]),
      ]),
    ]).start();
  }, [mounted, visible, height, sheetTranslateY, backdropOpacity, contentOpacity, contentTranslateY]);

  const restoreSheetPosition = () => {
    Animated.parallel([
      Animated.spring(sheetTranslateY, { toValue: 0, damping: 24, stiffness: 230, mass: 0.78, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
  };

  const dismissSheetFromGesture = useCallback((distance: number) => {
    if (gestureDismissInProgress.current) return;
    gestureDismissInProgress.current = true;
    const remainingDuration = Math.max(150, Math.round(300 * (1 - Math.min(distance, height) / height)));
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: Math.min(140, remainingDuration), useNativeDriver: true }),
      Animated.timing(contentTranslateY, { toValue: 22, duration: Math.min(180, remainingDuration), useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: remainingDuration, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: height, duration: remainingDuration, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) {
        gestureDismissInProgress.current = false;
        return;
      }
      onClose();
      setMounted(false);
    });
  }, [height, onClose, sheetTranslateY, backdropOpacity, contentOpacity, contentTranslateY]);

  const sheetPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      drawerScrollY.current <= 0
      && gesture.dy > 8
      && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25
    ),
    onPanResponderGrant: () => {
      sheetTranslateY.stopAnimation();
      backdropOpacity.stopAnimation();
      contentOpacity.stopAnimation();
    },
    onPanResponderMove: (_event, gesture) => {
      const distance = Math.min(Math.max(gesture.dy, 0), height);
      sheetTranslateY.setValue(distance);
      backdropOpacity.setValue(Math.max(0, 1 - distance / (height * 0.72)));
      contentOpacity.setValue(Math.max(0.82, 1 - distance / height * 0.18));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > height * 0.18 || gesture.vy > 0.85) {
        dismissSheetFromGesture(Math.max(gesture.dy, 0));
        return;
      }
      restoreSheetPosition();
    },
    onPanResponderTerminate: restoreSheetPosition,
    onPanResponderTerminationRequest: () => true,
  }), [height, dismissSheetFromGesture, sheetTranslateY, backdropOpacity, contentOpacity]);

  const go = (action?: () => void) => {
    onClose();
    action?.();
  };
  const handleLogoPress = () => {
    Animated.sequence([
      Animated.timing(logoPress, { toValue: 0.94, duration: 85, useNativeDriver: true }),
      Animated.spring(logoPress, { toValue: 1, useNativeDriver: true, damping: 13, stiffness: 260, mass: 0.55 }),
    ]).start();
    go(onGoHome || onGoEvents);
  };

  if (!mounted) return null;

  return (
      <View style={styles.panel}>
        <Animated.View pointerEvents="none" style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <BlurView intensity={18} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
        <Animated.View {...sheetPanResponder.panHandlers} style={[styles.sheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <ScreenBackground />
          <Animated.View style={[styles.sheetContent, { opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }]}>
            <SafeAreaView style={styles.safeArea}>
              <View style={styles.container}>
          <View style={styles.topBar}>
          <TouchableOpacity activeOpacity={0.86} onPress={handleLogoPress} style={styles.logoButton}>
            <Animated.Image source={logo} style={[styles.logo, { transform: [{ scale: logoPress }] }]} resizeMode="contain" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Mode selector — Client / Organizer (+ Admin) */}
        {canOrganize && onSetMode && (
          <View style={styles.modeSelectorWrap}>
            <ModeSelector mode={viewMode} canAdmin={canAdmin} onChange={onSetMode} />
          </View>
        )}

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          onScroll={(event) => { drawerScrollY.current = event.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
        >
          {isLoggedIn && onGoEmployeeScan && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('ACCESO EN PUERTA', 'DOOR ACCESS')}</Text>
              </View>
              <Row icon="scan-outline" label={t('Scan entradas empleados', 'Staff ticket scan')} onPress={() => go(onGoEmployeeScan)} />
              <Row icon="card-outline" label={t('Ventas en puerta', 'Door sales')} onPress={() => go(onGoEmployeeDoorSale || onGoEmployeeScan)} />
            </View>
          )}

          {/* Admin quick-access sections */}
          {viewMode === 'admin' && onGoAdminSection && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('PANEL ADMIN', 'ADMIN PANEL')}</Text>
              </View>
              {adminSections.map((s, index) => (
                <Row
                  key={`${s.id}-${index}`}
                  icon={s.icon}
                  label={t(s.labelEs, s.labelEn)}
                  active={adminSection === s.id}
                  onPress={() => go(() => onGoAdminSection(s.id))}
                />
              ))}
            </View>
          )}

          {/* Organizer quick-access sections */}
          {viewMode === 'organizer' && onGoOrgSection && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('ORGANIZADOR', 'ORGANIZER')}</Text>
              </View>
              {orgSections.map((s, index) => (
                <Row
                  key={`${s.id}-${index}`}
                  icon={s.icon}
                  label={t(s.labelEs, s.labelEn)}
                  active={s.id === 'scan' || s.id === 'doorSale' ? false : orgSection === s.id}
                  onPress={() => go(() => (
                    s.id === 'scan'
                      ? onGoScan?.()
                      : s.id === 'doorSale'
                        ? onGoDoorSale?.()
                        : onGoOrgSection(s.id)
                  ))}
                />
              ))}
            </View>
          )}

          {/* Client nav */}
          {viewMode === 'client' && isLoggedIn && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('MI CUENTA', 'MY ACCOUNT')}</Text>
              </View>
              <Row icon="calendar-outline" label={t('Eventos', 'Events')} active={activeClientTab === 'events'} onPress={() => go(onGoEvents)} />
              <Row icon="ticket-outline" label={t('Mis tickets', 'My tickets')} active={activeClientTab === 'tickets'} onPress={() => go(onGoTickets)} />
              <Row icon="person-outline" label={t('Mi perfil', 'My profile')} active={activeClientTab === 'profile'} onPress={() => go(onGoProfile)} />
              <Row icon="people-outline" label={t('Social Match', 'Social Match')} active={activeClientTab === 'social'} onPress={() => go(onGoSocialMatch)} />
              <Row icon="chatbubble-ellipses-outline" label={t('AI Chat', 'AI Chat')} active={activeClientTab === 'aichat'} onPress={() => go(onGoAiChat)} />
            </View>
          )}

          {/* Primary nav */}
          <View style={styles.card}>
            <Row label={t('Quiénes Somos', 'About Us')} onPress={() => go(onGoAbout)} />
            <Row label={t('Contacto', 'Contact')} onPress={() => go(onGoContact)} />
            <Row label={t('Soporte', 'Support')} onPress={() => go(onGoSupport)} />
          </View>

          {/* Legal */}
          {onGoLegal && (
            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionLabel}>{t('LEGAL', 'LEGAL')}</Text>
              </View>
              <Row icon="shield-checkmark-outline" label={t('Términos y Condiciones', 'Terms & Conditions')} onPress={() => go(() => onGoLegal('terms'))} />
              <Row icon="lock-closed-outline" label={t('Privacidad', 'Privacy')} onPress={() => go(() => onGoLegal('privacy'))} />
              <Row icon="cash-outline" label={t('Reembolsos', 'Refunds')} onPress={() => go(() => onGoLegal('refunds'))} />
              <Row icon="briefcase-outline" label={t('Acuerdo de Organizador', 'Organizer Agreement')} onPress={() => go(() => onGoLegal('organizer-agreement'))} />
            </View>
          )}

          {/* Account / actions */}
          {isLoggedIn && (
            <View style={styles.card}>
              <Row icon="log-out-outline" label={t('Cerrar sesión', 'Log out')} onPress={() => go(onLogout)} danger />
            </View>
          )}
        </ScrollView>
              </View>
            </SafeAreaView>
          </Animated.View>
        </Animated.View>
      </View>
  );
}

function Row({ label, onPress, icon, danger, featured, active }: { label: string; onPress: () => void; icon?: IconName; danger?: boolean; featured?: boolean; active?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, featured && styles.rowFeatured, danger && styles.rowDanger, active && styles.rowActive]} onPress={onPress} activeOpacity={0.7}>
      {icon && <Ionicons name={icon} size={20} color={danger ? '#ff5a45' : active ? '#F97316' : 'rgba(255,255,255,0.55)'} />}
      <Text style={[styles.rowText, danger && styles.rowTextDanger, active && styles.rowTextActive]}>{label}</Text>
      {active && <View style={styles.rowActiveDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 35,
    elevation: 35,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.34)',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
    backgroundColor: '#030B14',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -12 },
    elevation: 24,
  },
  sheetContent: { flex: 1 },
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 84 },
  logoButton: { width: 146, height: 48, alignItems: 'flex-start', justifyContent: 'center' },
  logo: { width: 140, height: 42 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center',
  },
  modeSelectorWrap: { marginBottom: 16 },
  scroll: { paddingBottom: 100, gap: 16 },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  modeRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeRowText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
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
    marginBottom: 8,
  },
  rowDanger: { borderColor: 'rgba(255,90,69,0.24)', backgroundColor: 'rgba(255,90,69,0.08)', marginTop: 4, marginBottom: 0 },
  rowActive: {
    borderColor: 'rgba(249,115,22,0.45)',
    backgroundColor: 'rgba(249,115,22,0.10)',
  },
  rowFeatured: {
    borderColor: 'rgba(249,115,22,0.34)',
    backgroundColor: 'rgba(249,115,22,0.075)',
    shadowColor: '#F97316',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  rowText: { color: 'rgba(248,250,252,0.80)', fontSize: 15, fontWeight: '600' },
  rowTextActive: { color: '#F97316', fontWeight: '600' },
  rowTextDanger: { color: '#ff5a45' },
  rowActiveDot: {
    marginLeft: 'auto',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F97316',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionLabel: {
    color: '#F97316',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
