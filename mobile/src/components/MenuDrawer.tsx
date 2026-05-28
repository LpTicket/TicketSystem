import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  visible: boolean;
  onClose: () => void;
  onGoEvents?: () => void;
  onGoTickets?: () => void;
  onGoProfile?: () => void;
  onGoScan?: () => void;
  onGoOrganizer?: () => void;
  onGoAdmin?: () => void;
  canOrganize?: boolean;
  canAdmin?: boolean;
};

export function MenuDrawer({ visible, onClose, onGoEvents, onGoTickets, onGoProfile, onGoScan, onGoOrganizer, onGoAdmin, canOrganize, canAdmin }: Props) {
  const go = (action?: () => void) => {
    onClose();
    action?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.drawer}>
          <View style={styles.handle} />

          <Text style={styles.eyebrow}>MENU</Text>
          <Text style={styles.title}>LPTicket</Text>

          <View style={styles.links}>
            <TouchableOpacity style={styles.link} onPress={() => go(onGoEvents)}>
              <Text style={styles.linkText}>Events</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => go(onGoTickets)}>
              <Text style={styles.linkText}>My Tickets</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link} onPress={() => go(onGoProfile)}>
              <Text style={styles.linkText}>Profile</Text>
            </TouchableOpacity>

            {canOrganize && (
              <TouchableOpacity style={styles.link} onPress={() => go(onGoScan)}>
                <Text style={styles.linkText}>Scan Tickets</Text>
              </TouchableOpacity>
            )}

            {canOrganize && (
              <TouchableOpacity style={[styles.link, styles.organizerLink]} onPress={() => go(onGoOrganizer)}>
                <Text style={styles.organizerText}>Organizer Panel</Text>
              </TouchableOpacity>
            )}

            {canAdmin && (
              <TouchableOpacity style={[styles.link, styles.adminLink]} onPress={() => go(onGoAdmin)}>
                <Text style={styles.adminText}>Admin Panel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.link}>
              <Text style={styles.linkText}>Support</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>CLOSE</Text>
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
    backgroundColor: '#ffffff',
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
    backgroundColor: '#dbe3ec',
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
    color: colors.navy,
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  linkText: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '800',
  },
  organizerLink: {
    backgroundColor: colors.navy,
    borderColor: colors.navy,
  },
  organizerText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  adminLink: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  adminText: {
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '900',
  },
});
