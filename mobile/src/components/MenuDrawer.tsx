import { Image, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
};

type IconName = keyof typeof Ionicons.glyphMap;
const logo = require('../../assets/logo-header.png');

export function MenuDrawer({
  visible, onClose, onGoEvents, onGoTickets, onGoProfile, onGoScan, onGoAiChat,
  onGoSocialMatch, onGoOrganizer, onGoAdmin, onGoContact, onGoAbout, onGoSupport, onLogout,
  canOrganize, canAdmin,
}: Props) {
  const { t } = useLanguage();
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
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
    paddingTop: 54,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, marginBottom: 12 },
  logo: { width: 131, height: 33 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingBottom: 40, gap: 16 },
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
  rowFeatured: {
    borderColor: 'rgba(249,115,22,0.34)',
    backgroundColor: 'rgba(249,115,22,0.075)',
    shadowColor: '#F97316',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  rowText: { color: '#F8FAFC', fontSize: 16, fontWeight: '700' },
  rowTextDanger: { color: '#ff5a45' },
});
