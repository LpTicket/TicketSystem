import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { mockUser } from '../data/mockUser';

type Props = {
  event: any;
  onViewTickets: () => void;
  onHome: () => void;
};

export function PaymentSuccessScreen({ event, onViewTickets, onHome }: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <View style={styles.checkCircle}>
          <Text style={styles.check}>✓</Text>
        </View>

        <Text style={styles.eyebrow}>CONFIRMED</Text>
        <Text style={styles.title}>Your ticket is ready</Text>
        <Text style={styles.copy}>
          We sent the confirmation to {mockUser.email}. Your QR ticket is now available in My Tickets.
        </Text>

        <View style={styles.ticket}>
          <View style={styles.qr}>
            <Text style={styles.qrText}>QR</Text>
          </View>

          <View style={styles.ticketInfo}>
            <Text style={styles.ticketLabel}>EVENT</Text>
            <Text style={styles.eventTitle}>{event?.title || 'Event'}</Text>
            <Text style={styles.eventMeta}>{event?.date || '06/25 at 07:00 PM'}</Text>
            <Text style={styles.eventMeta}>{event?.venue || 'Ambriza'}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={onViewTickets}>
          <Text style={styles.primaryText}>VIEW MY TICKETS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onHome}>
          <Text style={styles.secondaryText}>BACK TO EVENTS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 18,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    alignItems: 'center',
  },
  checkCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  check: {
    color: '#10b981',
    fontSize: 40,
    fontWeight: '800',
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
    marginBottom: 8,
  },
  title: {
    color: colors.navy,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  copy: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 22,
  },
  ticket: {
    width: '100%',
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  qr: {
    width: 92,
    height: 92,
    borderRadius: 18,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrText: {
    color: '#ffffff',
    fontSize: 24,
    letterSpacing: 2,
    fontWeight: '900',
  },
  ticketInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  ticketLabel: {
    color: '#64748b',
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '800',
    marginBottom: 6,
  },
  eventTitle: {
    color: colors.navy,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  eventMeta: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  primaryButton: {
    width: '100%',
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.navy,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
});
