import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

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
  onLogout?: () => void;
  canOrganize?: boolean;
  canAdmin?: boolean;
};

export function MenuDrawer({ visible, onClose, onGoEvents, onGoTickets, onGoProfile, onGoScan, onGoAiChat, onGoSocialMatch, onGoCart, onGoOrganizer, onGoAdmin, onLogout, canOrganize, canAdmin }: Props) {
  const { t } = useLanguage();
  const go = (action?: () => void) => {
    onClose();
    action?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.drawer}>
          <View style={styles.handle} />

          <Text style={styles.eyebrow}>{t('MENÚ', 'MENU')}</Text>
          <Text style={styles.title}>LPTicket</Text>

          <View style={styles.links}>
            <TouchableOpacity style={styles.link} onPress={() => go(onGoEvents)}>
              <Text style={styles.linkText}>{t('Eventos', 'Events')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => go(onGoAiChat)}>
              <Text style={styles.linkText}>{t('Chat IA', 'AI Assistant')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => go(onGoProfile)}>
              <Text style={styles.linkText}>{t('Pagos', 'Payments')}</Text>
            </TouchableOpacity>
            {canOrganize && (
              <TouchableOpacity style={[styles.link, styles.organizerLink]} onPress={() => go(onGoOrganizer)}>
                <Text style={styles.organizerText}>{t('Panel Organizador', 'Organizer Panel')}</Text>
              </TouchableOpacity>
            )}

            {canAdmin && (
              <TouchableOpacity style={[styles.link, styles.adminLink]} onPress={() => go(onGoAdmin)}>
                <Text style={styles.adminText}>{t('Panel Administrador', 'Admin Panel')}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>{t('Contacto', 'Contact')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>{t('Soporte', 'Support')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.link, styles.logoutLink]} onPress={() => go(onLogout)}>
              <Text style={styles.logoutText}>{t('Cerrar sesión', 'Log out')}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>{t('CERRAR', 'CLOSE')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
  },
  drawer: {
    backgroundColor: '#071827',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 26,
  },
  handle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '900',
    marginBottom: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 18,
  },
  links: {
    gap: 10,
  },
  link: {
    height: 58,
    borderRadius: 18,
    backgroundColor: '#071827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  linkText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  organizerLink: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  organizerText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  adminLink: {
    backgroundColor: '#0A375A',
    borderColor: '#0A375A',
  },
  adminText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  logoutLink: {
    backgroundColor: 'rgba(248,113,113,0.08)',
    borderColor: 'rgba(248,113,113,0.26)',
  },
  logoutText: {
    color: '#FCA5A5',
    fontSize: 17,
    fontWeight: '800',
  },
  closeButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '900',
  },
});
