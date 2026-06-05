import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { mockEvents } from '../data/mockEvents';
import { mockUser } from '../data/mockUser';

export function TicketsScreen() {
  const { t } = useLanguage();
  const event = mockEvents[0];

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>{t('MIS TICKETS', 'MY TICKETS')}</Text>
      <Text style={styles.title}>{t('Listo para entrar', 'Ready for entry')}</Text>
      <Text style={styles.subtitle}>{t('Tus tickets activos y pases QR aparecerán aquí después de la compra.', 'Your active tickets and QR passes will appear here after purchase.')}</Text>

      <View style={styles.ticketCard}>
        <View style={styles.ticketTop}>
          <View>
            <Text style={styles.ticketStatus}>{t('TICKET ACTIVO', 'ACTIVE TICKET')}</Text>
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
            <Text style={styles.infoLabel}>{t('Nombre', 'Name')}</Text>
            <Text style={styles.infoValue}>{mockUser.firstName} {mockUser.lastName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('Fecha', 'Date')}</Text>
            <Text style={styles.infoValue}>{event.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('Lugar', 'Venue')}</Text>
            <Text style={styles.infoValue}>{event.venue}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('Ticket', 'Ticket')}</Text>
            <Text style={styles.infoValue}>{t('Entrada general', 'General admission')}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.walletButton}>
          <Text style={styles.walletText}>{t('AGREGAR A WALLET', 'ADD TO WALLET')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030B14' },
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
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(226,232,240,0.64)',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    marginBottom: 22,
  },
  ticketCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    shadowColor: '#111827',
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
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 17,
    letterSpacing: 1,
    fontWeight: '900',
  },
  qrBox: {
    backgroundColor: 'rgba(255,255,255,0.012)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
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
    backgroundColor: 'rgba(255,255,255,0.90)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  qrCellDark: {
    backgroundColor: colors.navy,
  },
  infoBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingTop: 14,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  infoLabel: {
    color: 'rgba(226,232,240,0.64)',
    fontSize: 14,
    fontWeight: '700',
  },
  infoValue: {
    color: '#F8FAFC',
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
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '900',
  },
});
