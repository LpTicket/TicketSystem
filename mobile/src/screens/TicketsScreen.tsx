import { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { API_URL, apiGet, apiPost } from '../services/api';
import { TicketCardSkeleton } from '../components/Skeleton';

type TicketStatus = 'active' | 'used' | 'cancelled' | string;

type MobileTicket = {
  id: string;
  ticketCode: string;
  qrData?: string | null;
  status: TicketStatus;
  createdAt?: string;
  sectionName?: string | null;
  rowLabel?: string | null;
  seatNumber?: string | number | null;
  seatLabel?: string | null;
  event?: {
    title?: string;
    eventDate?: string;
    eventTimezone?: string;
    venueName?: string;
    venueAddress?: string;
  } | null;
};

type TicketsResponse = {
  data?: MobileTicket[];
  tickets?: MobileTicket[];
};

function statusMeta(status: TicketStatus, t: (es: string, en: string) => string) {
  if (status === 'active') return { label: t('Activo', 'Active'), bg: 'rgba(34,197,94,0.14)', color: '#86EFAC' };
  if (status === 'used') return { label: t('Usado', 'Used'), bg: 'rgba(148,163,184,0.14)', color: '#CBD5E1' };
  return { label: t('Cancelado', 'Cancelled'), bg: 'rgba(248,113,113,0.14)', color: '#FCA5A5' };
}

function formatDate(value?: string, lang?: string) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function seatText(ticket: MobileTicket, t: (es: string, en: string) => string) {
  if (ticket.seatLabel) return ticket.seatLabel;
  const parts = [ticket.sectionName, ticket.rowLabel, ticket.seatNumber].filter(Boolean);
  return parts.length ? parts.join(' · ') : t('Entrada general', 'General admission');
}

function openUrl(url?: string | null) {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}

function ticketVerifyUrl(code: string) {
  const base = API_URL.replace(/\/api\/?$/, '');
  return `${base}/verify/${code}`;
}

function ticketApiUrl(code: string, path: string) {
  return `${API_URL.replace(/\/$/, '')}/orders/ticket/${code}/${path}`;
}

export function TicketsScreen() {
  const { t, lang } = useLanguage();
  const [tickets, setTickets] = useState<MobileTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    apiGet<TicketsResponse>('/orders/my-tickets?page=1&limit=12')
      .then((response) => {
        if (!mounted) return;
        setTickets(response.data || response.tickets || []);
      })
      .catch(() => {
        if (mounted) setTickets([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleTickets = tickets;

  const openGoogleWallet = async (code: string) => {
    try {
      const response = await apiGet<{ url?: string }>(`/orders/ticket/${code}/google-wallet`);
      openUrl(response.url);
    } catch {
      openUrl(ticketVerifyUrl(code));
    }
  };

  const resendEmail = async (code: string) => {
    if (resending) return;
    setResending(code);
    try {
      const data = await apiPost<{ email?: string }>(`/orders/ticket/${code}/resend-email`);
      Alert.alert(
        t('Correo enviado', 'Email sent'),
        t(`Entrada enviada a ${data?.email || 'tu correo'}`, `Ticket sent to ${data?.email || 'your email'}`),
      );
    } catch {
      Alert.alert(
        t('No se pudo reenviar', 'Could not resend'),
        t('Inténtalo de nuevo en un momento.', 'Please try again in a moment.'),
      );
    } finally {
      setResending(null);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{t('MIS TICKETS', 'MY TICKETS')}</Text>
        <Text style={styles.title}>{t('Tickets digitales', 'Digital tickets')}</Text>
        <Text style={styles.subtitle}>
          {t('Tus entradas, códigos QR y acceso a Wallet en un solo lugar.', 'Your tickets, QR codes, and Wallet access in one place.')}
        </Text>
      </View>

      {loading ? (
        <>
          <TicketCardSkeleton />
          <TicketCardSkeleton />
          <TicketCardSkeleton />
        </>
      ) : visibleTickets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('No tienes tickets todavía', 'No tickets yet')}</Text>
          <Text style={styles.emptyCopy}>{t('Cuando compres una entrada aparecerá aquí.', 'When you buy a ticket it will appear here.')}</Text>
        </View>
      ) : (
        visibleTickets.map((ticket, index) => {
          const meta = statusMeta(ticket.status, t);
          const event = ticket.event;
          return (
            <View key={`${ticket.id || ticket.ticketCode || 'ticket'}-${index}`} style={styles.ticketCard}>
              <View style={styles.ticketGlow} />
              <View style={styles.ticketTop}>
                <View style={styles.ticketInfo}>
                  <Text style={styles.ticketEyebrow}>{t('ENTRADA LP TICKET', 'LP TICKET PASS')}</Text>
                  <Text style={styles.eventTitle} numberOfLines={2}>{event?.title || t('Evento', 'Event')}</Text>
                  <Text style={styles.eventMeta}>{formatDate(event?.eventDate, lang)}</Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>{event?.venueName || t('Lugar por confirmar', 'Venue pending')}</Text>
                </View>

                <View style={[styles.statusPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
              </View>

              <View style={styles.ticketBody}>
                <View style={styles.qrBox}>
                  {ticket.qrData ? (
                    <Image source={{ uri: ticket.qrData }} style={styles.qrImage} resizeMode="contain" />
                  ) : (
                    <View style={styles.qrFallback}>
                      <Text style={styles.qrFallbackText}>Qr</Text>
                    </View>
                  )}
                </View>

                <View style={styles.ticketDetails}>
                  <Detail label={t('Código', 'Code')} value={ticket.ticketCode} />
                  <Detail label={t('Ubicación', 'Seat')} value={seatText(ticket, t)} />
                  <Detail label={t('Emitido', 'Issued')} value={formatDate(ticket.createdAt, lang)} />
                </View>
              </View>

              <View style={styles.ticketDivider}>
                <View style={styles.ticketNotchLeft} />
                <View style={styles.ticketLine} />
                <View style={styles.ticketNotchRight} />
              </View>

              <View style={styles.actions}>
                <ActionButton label={t('VER TICKET', 'VIEW TICKET')} primary onPress={() => openUrl(ticketVerifyUrl(ticket.ticketCode))} />
                <ActionButton label="APPLE WALLET" onPress={() => openUrl(ticketApiUrl(ticket.ticketCode, 'apple-wallet'))} />
                <ActionButton label="GOOGLE WALLET" onPress={() => openGoogleWallet(ticket.ticketCode)} />
                <ActionButton
                  label={resending === ticket.ticketCode ? t('ENVIANDO...', 'SENDING...') : t('REENVIAR AL CORREO', 'RESEND EMAIL')}
                  onPress={() => resendEmail(ticket.ticketCode)}
                />
                <ActionButton
                  label={t('COMPARTIR', 'SHARE')}
                  icon="share-social-outline"
                  onPress={() => Share.share({
                    title: event?.title || t('Mi ticket', 'My ticket'),
                    message: `🎟 ${event?.title || t('Evento', 'Event')}\n${event?.venueName ? `📍 ${event.venueName}\n` : ''}${t('Código', 'Code')}: ${ticket.ticketCode}\n${ticketVerifyUrl(ticket.ticketCode)}`,
                  })}
                />
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>{value || '-'}</Text>
    </View>
  );
}

function ActionButton({ label, primary, icon, onPress }: { label: string; primary?: boolean; icon?: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionButton, primary && styles.actionButtonPrimary]}>
      {icon && <Ionicons name={icon} size={13} color={primary ? '#FFFFFF' : 'rgba(226,232,240,0.7)'} />}
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 128 },
  hero: {
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: { color: '#F97316', fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  title: { color: '#F8FAFC', fontSize: 32, lineHeight: 36, fontWeight: '700', marginTop: 10 },
  subtitle: { color: 'rgba(226,232,240,0.70)', fontSize: 16, lineHeight: 23, marginTop: 10 },
  emptyCard: { borderRadius: 24, padding: 24, backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  emptyTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  emptyCopy: { color: 'rgba(226,232,240,0.68)', fontSize: 15, marginTop: 8 },
  ticketCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  ticketGlow: { position: 'absolute', top: -80, right: -70, width: 170, height: 170, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.12)' },
  ticketTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ticketInfo: { flex: 1 },
  ticketEyebrow: { color: '#F97316', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  eventTitle: { color: '#F8FAFC', fontSize: 26, lineHeight: 31, fontWeight: '700', marginTop: 8 },
  eventMeta: { color: 'rgba(226,232,240,0.72)', fontSize: 14, lineHeight: 21, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  ticketBody: { flexDirection: 'row', gap: 14, marginTop: 18, alignItems: 'stretch' },
  qrBox: { width: 118, height: 118, borderRadius: 20, backgroundColor: '#F8FAFC', padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)' },
  qrImage: { width: '100%', height: '100%' },
  qrFallback: { width: '100%', height: '100%', borderRadius: 14, backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  qrFallbackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700' },
  ticketDetails: { flex: 1, gap: 10 },
  detail: { backgroundColor: '#030B14', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 10 },
  detailLabel: { color: 'rgba(226,232,240,0.48)', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  detailValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginTop: 3 },
  ticketDivider: { height: 28, marginTop: 16, marginHorizontal: -18, flexDirection: 'row', alignItems: 'center' },
  ticketNotchLeft: { width: 18, height: 36, borderTopRightRadius: 999, borderBottomRightRadius: 999, backgroundColor: '#030B14', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.14)' },
  ticketLine: { flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(226,232,240,0.22)' },
  ticketNotchRight: { width: 18, height: 36, borderTopLeftRadius: 999, borderBottomLeftRadius: 999, backgroundColor: '#030B14', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.14)' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  actionButton: { width: '48%', minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 10 },
  actionButtonPrimary: { backgroundColor: '#F97316', borderColor: '#FB923C' },
  actionText: { color: '#F8FAFC', fontSize: 11, fontWeight: '700', letterSpacing: 0, textAlign: 'center' },
  actionTextPrimary: { color: '#FFFFFF' },
});
