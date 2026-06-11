import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
};

type IconName = keyof typeof Ionicons.glyphMap;

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
      <View style={styles.panel}>
        <ScreenBackground />

        <View style={styles.topBar}>
          <Text style={styles.brand}>LPTicket</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Primary nav — text rows, no icons (matches web) */}
          <LinearGradient colors={['rgba(18,29,44,0.96)', 'rgba(7,14,23,0.96)']} style={styles.card}>
            <Row label={t('Eventos', 'Events')} onPress={() => go(onGoEvents)} />
            <Row label={t('Quiénes Somos', 'About Us')} onPress={() => go(onGoAbout)} />
            <Row label={t('Mis Tickets', 'My Tickets')} onPress={() => go(onGoTickets)} />
            <Row label={t('Contacto', 'Contact')} onPress={() => go(onGoContact)} />
            <Row label={t('Soporte', 'Support')} onPress={() => go(onGoSupport)} />
          </LinearGradient>

          {/* Account / actions — with orange icons */}
          <LinearGradient colors={['rgba(18,29,44,0.96)', 'rgba(7,14,23,0.96)']} style={styles.card}>
            <Row icon="chatbubble-ellipses-outline" label={t('Chat IA', 'AI Assistant')} onPress={() => go(onGoAiChat)} />
            <Row icon="people-outline" label={t('Match Social', 'Social Match')} onPress={() => go(onGoSocialMatch)} />
            <Row icon="qr-code-outline" label={t('Escanear', 'Scan')} onPress={() => go(onGoScan)} />
            <Row icon="person-outline" label={t('Mi Perfil', 'My Profile')} onPress={() => go(onGoProfile)} />
            {canOrganize && (
              <Row icon="settings-outline" label={t('Panel Organizador', 'Organizer Panel')} onPress={() => go(onGoOrganizer)} />
            )}
            {canAdmin && (
              <Row icon="shield-outline" label={t('Panel Administrador', 'Admin Panel')} onPress={() => go(onGoAdmin)} />
            )}
            <Row icon="log-out-outline" label={t('Cerrar sesión', 'Log out')} onPress={() => go(onLogout)} danger />
          </LinearGradient>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Row({ label, onPress, icon, danger }: { label: string; onPress: () => void; icon?: IconName; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.row, danger && styles.rowDanger]} onPress={onPress} activeOpacity={0.7}>
      {icon && <Ionicons name={icon} size={23} color={danger ? '#ff5a45' : '#ff7a00'} />}
      <Text style={[styles.rowText, danger && styles.rowTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: '#05111f',
    paddingHorizontal: 16,
    paddingTop: 54,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 48, marginBottom: 12 },
  brand: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingBottom: 40, gap: 16 },
  card: {
    padding: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.18)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 24,
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
    borderRadius: 10,
  },
  rowDanger: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', marginTop: 4 },
  rowText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  rowTextDanger: { color: '#ff5a45' },
});
