import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { mockEvents } from '../data/mockEvents';
import { API_URL, apiGet } from '../services/api';

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

const demoEvent = mockEvents[0];

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
  const [usingDemo, setUsingDemo] = useState(false);

  const demoTicket = useMemo<MobileTicket>(() => ({
    id: 'demo-ticket',
    ticketCode: 'LP-DEMO-2026',
    status: 'active',
    createdAt: new Date().toISOString(),
    sectionName: 'General',
    event: {
      title: demoEvent.title,
      eventDate: demoEvent.date,
      venueName: demoEvent.venue,
    },
  }), []);

  useEffect(() => {
    let mounted = true;

    apiGet<TicketsResponse>('/orders/my-tickets?page=1&limit=12')
      .then((response) => {
        if (!mounted) return;
        const items = response.data || response.tickets || [];
        setTickets(items);
        setUsingDemo(false);
      })
      .catch(() => {
        if (!mounted) return;
        setTickets([demoTicket]);
        setUsingDemo(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [demoTicket]);

  const visibleTickets = tickets.length ? tickets : [];

  const openGoogleWallet = async (code: string) => {
    try {
      const response = await apiGet<{ url?: string }>(`/orders/ticket/${code}/google-wallet`);
      openUrl(response.url);
    } catch {
      openUrl(ticketVerifyUrl(code));
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

      {usingDemo && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {t('Vista de diseño. Cuando inicies sesión con una cuenta real, se mostrarán los tickets del backend.', 'Design preview. Real backend tickets appear after signing in with a real account.')}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('Cargando tickets...', 'Loading tickets...')}</Text>
        </View>
      ) : visibleTickets.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{t('No tienes tickets todavía', 'No tickets yet')}</Text>
          <Text style={styles.emptyCopy}>{t('Cuando compres una entrada aparecerá aquí.', 'When you buy a ticket it will appear here.')}</Text>
        </View>
      ) : (
        visibleTickets.map((ticket) => {
          const meta = statusMeta(ticket.status, t);
          const event = ticket.event;
          return (
            <View key={ticket.id || ticket.ticketCode} style={styles.ticketCard}>
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
                      <Text style={styles.qrFallbackText}>QR</Text>
                    </View>
                  )}
                </View>

                <View style={styles.ticketDetails}>
                  <Detail label={t('Código', 'Code')} value={ticket.ticketCode} />
                  <Detail label={t('Ubicación', 'Seat')} value={seatText(ticket, t)} />
                  <Detail label={t('Emitido', 'Issued')} value={formatDate(ticket.createdAt, lang)} />
                </View>
              </View>

              <View style={styles.actions}>
                <ActionButton label={t('VER TICKET', 'VIEW TICKET')} primary onPress={() => openUrl(ticketVerifyUrl(ticket.ticketCode))} />
                <ActionButton label="APPLE WALLET" onPress={() => openUrl(ticketApiUrl(ticket.ticketCode, 'apple-wallet'))} />
                <ActionButton label="GOOGLE WALLET" onPress={() => openGoogleWallet(ticket.ticketCode)} />
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

function ActionButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionButton, primary && styles.actionButtonPrimary]}>
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030B14' },
  content: { paddingHorizontal: 18, paddingTop: 78, paddingBottom: 128 },
  hero: { marginBottom: 18 },
  eyebrow: { color: '#F97316', fontSize: 12, fontWeight: '900', letterSpacing: 5 },
  title: { color: '#FFFFFF', fontSize: 34, lineHeight: 38, fontWeight: '900', marginTop: 10 },
  subtitle: { color: 'rgba(226,232,240,0.70)', fontSize: 16, lineHeight: 23, marginTop: 10 },
  notice: { borderWidth: 1, borderColor: 'rgba(249,115,22,0.24)', backgroundColor: 'rgba(249,115,22,0.08)', borderRadius: 18, padding: 14, marginBottom: 18 },
  noticeText: { color: 'rgba(255,255,255,0.76)', fontSize: 13, lineHeight: 19 },
  emptyCard: { borderRadius: 26, padding: 24, backgroundColor: 'rgba(8,31,51,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  emptyTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  emptyCopy: { color: 'rgba(226,232,240,0.68)', fontSize: 15, marginTop: 8 },
  ticketCard: { borderRadius: 30, padding: 18, marginBottom: 18, backgroundColor: 'rgba(8,31,51,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)' },
  ticketTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ticketInfo: { flex: 1 },
  ticketEyebrow: { color: '#F97316', fontSize: 11, fontWeight: '900', letterSpacing: 3.5 },
  eventTitle: { color: '#FFFFFF', fontSize: 28, lineHeight: 32, fontWeight: '900', marginTop: 8 },
  eventMeta: { color: 'rgba(226,232,240,0.72)', fontSize: 14, lineHeight: 21, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  ticketBody: { flexDirection: 'row', gap: 16, marginTop: 18, alignItems: 'center' },
  qrBox: { width: 118, height: 118, borderRadius: 20, backgroundColor: '#FFFFFF', padding: 10, alignItems: 'center', justifyContent: 'center' },
  qrImage: { width: '100%', height: '100%' },
  qrFallback: { width: '100%', height: '100%', borderRadius: 14, backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  qrFallbackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  ticketDetails: { flex: 1, gap: 10 },
  detail: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingBottom: 8 },
  detailLabel: { color: 'rgba(226,232,240,0.48)', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
  detailValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginTop: 3 },
  actions: { gap: 10, marginTop: 18 },
  actionButton: { height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)' },
  actionButtonPrimary: { backgroundColor: '#F97316', borderColor: '#FB923C' },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 2.8 },
  actionTextPrimary: { color: '#FFFFFF' },
});
