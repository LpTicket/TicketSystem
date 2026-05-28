import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { mockEvents } from '../data/mockEvents';
import { mockUser } from '../data/mockUser';

export function TicketsScreen() {
  const event = mockEvents[0];

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>MY TICKETS</Text>
      <Text style={styles.title}>Ready for entry</Text>
      <Text style={styles.subtitle}>Your active tickets and QR passes will appear here after purchase.</Text>

      <View style={styles.ticketCard}>
        <View style={styles.ticketTop}>
          <View>
            <Text style={styles.ticketStatus}>ACTIVE TICKET</Text>
            <Text style={styles.eventTitle}>{event.title}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>QR</Text>
          </View>
        </View>

        <View style={styles.qrBox}>
          <View style={styles.qrGrid}>
            {Array.from({ length: 49 }).map((_, index) => (
              <View key={index} style={[styles.qrCell, (index * 7 + index) % 3 === 0 && styles.qrCellDark]} />
            ))}
          </View>
        </View>

        <View style={styles.infoBlock}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{mockUser.firstName} {mockUser.lastName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date</Text>
            <Text style={styles.infoValue}>{event.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Venue</Text>
            <Text style={styles.infoValue}>{event.venue}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ticket</Text>
            <Text style={styles.infoValue}>General admission</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.walletButton}>
          <Text style={styles.walletText}>ADD TO WALLET</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 18, paddingBottom: 120 },
  eyebrow: {
    color: colors.orange,
    fontSize: 13,
    letterSpacing: 4,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 8,
  },
  title: {
    color: colors.navy,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748b',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    marginBottom: 22,
  },
  ticketCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  ticketStatus: {
    color: colors.orange,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '900',
    marginBottom: 7,
  },
  eventTitle: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 17,
    letterSpacing: 1,
    fontWeight: '900',
  },
  qrBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
  },
  qrGrid: {
    width: 190,
    height: 190,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  qrCell: {
    width: 190 / 7,
    height: 190 / 7,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  qrCellDark: {
    backgroundColor: colors.navy,
  },
  infoBlock: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  walletButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  walletText: {
    color: '#ffffff',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '900',
  },
});
