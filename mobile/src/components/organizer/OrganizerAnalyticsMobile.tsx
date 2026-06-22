import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../i18n/LanguageContext';
import { exportCsv } from '../../utils/csv';

type Attendee = { status?: string; sectionName?: string; price?: number | string; orderId?: string };
type Props = {
  sales: any | null;
  attendees: Attendee[];
  sections: any[];
  eventTitle?: string;
};

// Local YYYY-MM-DD key (organizer analytics groups by calendar day).
function dayKey(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function sectionAnalyticsLabel(name: string, es: boolean): string {
  const clean = String(name || '').trim();
  if (/^\d+$/.test(clean)) return es ? `Mesa ${clean}` : `Table ${clean}`;
  return clean || (es ? 'General' : 'General');
}

export function OrganizerAnalyticsMobile({ sales, attendees, sections, eventTitle }: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';

  const data = useMemo(() => {
    const orders = (sales?.orders || []) as any[];
    const totalRevenue = Number(sales?.totalRevenue || 0);
    const paidOrders = orders.filter((order) => Number(order.subtotal ?? order.total ?? 0) > 0);
    const totalOrders = paidOrders.length;
    const issuedTickets = Math.max(Number(sales?.totalTickets || 0), attendees.length);
    const paidTicketsFromOrders = orders.reduce((sum, order) => {
      const orderTotal = Number(order.subtotal ?? order.total ?? 0);
      const tickets = Array.isArray(order.tickets) ? order.tickets : [];
      if (tickets.length > 0) {
        return sum + tickets.filter((ticket: any) => Number(ticket.price ?? orderTotal) > 0).length;
      }
      return sum + (orderTotal > 0 ? Number(order.ticketCount || 0) : 0);
    }, 0);
    const paidTicketsFromAttendees = attendees.filter((attendee) => Number(attendee.price || 0) > 0).length;
    const paidTickets = paidTicketsFromOrders || paidTicketsFromAttendees || Number(sales?.paidTickets || 0);
    const scannedTickets = attendees.filter((a) => a.status === 'used').length;
    const pendingTickets = attendees.filter((a) => a.status === 'active').length;

    const sectionStats = sections.reduce((acc, section) => {
      const type = String(section.sectionType || '').toLowerCase();
      if (type === 'stage' || type === 'decor') return acc;
      const lockedSeats = Array.isArray(section.seats)
        ? section.seats.filter((seat: any) => String(seat.status || '').toLowerCase() === 'locked').length
        : 0;
      const nextLocked = acc.lockedSeats + lockedSeats;
      if (type === 'standing') return { capacity: acc.capacity + (Number(section.capacity) || 100), lockedSeats: nextLocked };
      const realSeats = Array.isArray(section.seats) ? section.seats.length : 0;
      const capacity = realSeats > 0 ? realSeats : Number(section.rows || 0) * Number(section.seatsPerRow || 0);
      return { capacity: acc.capacity + capacity, lockedSeats: nextLocked };
    }, { capacity: 0, lockedSeats: 0 });
    const totalEventCapacity = sectionStats.capacity;
    const unpaidIssuedTickets = Math.max(issuedTickets - paidTickets, 0);
    const blockedTickets = unpaidIssuedTickets + sectionStats.lockedSeats;
    const remainingEventCapacity = Math.max(totalEventCapacity - paidTickets - blockedTickets, 0);
    const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const scanRate = issuedTickets > 0 ? Math.round((scannedTickets / issuedTickets) * 100) : 0;

    const rawByDay = paidOrders.reduce<Record<string, { date: string; orders: number; tickets: number; revenue: number }>>((acc, o) => {
      const key = dayKey(o.paidAt || o.createdAt);
      if (!key) return acc;
      if (!acc[key]) acc[key] = { date: key, orders: 0, tickets: 0, revenue: 0 };
      const tickets = Array.isArray(o.tickets) ? o.tickets : [];
      const paidTicketsInOrder = tickets.length > 0
        ? tickets.filter((ticket: any) => Number(ticket.price ?? o.subtotal ?? o.total ?? 0) > 0).length
        : Number(o.ticketCount || 0);
      acc[key].orders += 1;
      acc[key].tickets += paidTicketsInOrder;
      acc[key].revenue += Number(o.subtotal ?? o.total ?? 0);
      return acc;
    }, {});
    // Show ALL days with sales, sorted chronologically.
    const salesByDay = Object.values(rawByDay).sort((a, b) => a.date.localeCompare(b.date));

    const salesBySection = Object.values(
      attendees.reduce<Record<string, { section: string; tickets: number; scanned: number; pending: number }>>((acc, a) => {
        const key = a.sectionName || (es ? 'General' : 'General');
        if (!acc[key]) acc[key] = { section: key, tickets: 0, scanned: 0, pending: 0 };
        acc[key].tickets += 1;
        if (a.status === 'used') acc[key].scanned += 1;
        if (a.status === 'active') acc[key].pending += 1;
        return acc;
      }, {}),
    ).sort((a, b) => b.tickets - a.tickets);

    return { totalRevenue, totalOrders, issuedTickets, paidTickets, blockedTickets, scannedTickets, pendingTickets, totalEventCapacity, remainingEventCapacity, averageOrder, scanRate, salesByDay, salesBySection };
  }, [sales, attendees, sections, es]);

  const cards = [
    { label: es ? 'Ingresos por entradas' : 'Ticket revenue', value: `$${data.totalRevenue.toFixed(2)}`, note: `${data.totalOrders} ${es ? 'órdenes · lo que recibes' : 'orders · what you receive'}`, icon: 'cash-outline' as const },
    { label: es ? 'Tickets vendidos' : 'Tickets sold', value: String(data.paidTickets), note: `$${data.averageOrder.toFixed(2)} ${es ? 'promedio/orden · pagados' : 'avg/order · paid'}`, icon: 'ticket-outline' as const },
    { label: es ? 'Tickets bloqueados' : 'Blocked tickets', value: String(data.blockedTickets), note: es ? 'Sin ingreso recibido' : 'No revenue received', icon: 'lock-closed-outline' as const },
    { label: es ? 'Entrada escaneada' : 'Entry scanned', value: `${data.scanRate}%`, note: `${data.scannedTickets} ${es ? 'escaneados' : 'scanned'} · ${data.pendingTickets} ${es ? 'pendientes' : 'pending'}`, icon: 'checkmark-circle-outline' as const },
    { label: es ? 'Capacidad total' : 'Total capacity', value: String(data.totalEventCapacity), note: `${data.remainingEventCapacity} ${es ? 'por vender o asignar' : 'left to sell or assign'}`, icon: 'people-outline' as const },
  ];

  const maxRevenue = Math.max(...data.salesByDay.map((d) => d.revenue), 1);
  const maxTickets = Math.max(...data.salesBySection.map((s) => s.tickets), 1);

  const onExport = () => {
    const rows: (string | number)[][] = [
      [es ? 'Métrica' : 'Metric', es ? 'Valor' : 'Value'],
      [es ? 'Ingresos por entradas' : 'Ticket revenue', data.totalRevenue.toFixed(2)],
      [es ? 'Órdenes' : 'Orders', data.totalOrders],
      [es ? 'Tickets vendidos pagados' : 'Paid tickets sold', data.paidTickets],
      [es ? 'Tickets bloqueados / sin ingreso' : 'Blocked / no-revenue tickets', data.blockedTickets],
      [es ? 'Tickets emitidos' : 'Issued tickets', data.issuedTickets],
      [es ? 'Tickets escaneados' : 'Scanned tickets', data.scannedTickets],
      [es ? 'Pendientes' : 'Pending', data.pendingTickets],
      [es ? 'Promedio por orden' : 'Average order', data.averageOrder.toFixed(2)],
      [],
      [es ? 'Día' : 'Day', es ? 'Órdenes' : 'Orders', 'Tickets', es ? 'Ingresos' : 'Revenue'],
      ...data.salesByDay.map((d) => [d.date, d.orders, d.tickets, d.revenue.toFixed(2)]),
      [],
      [es ? 'Sección' : 'Section', 'Tickets', es ? 'Escaneados' : 'Scanned', es ? 'Pendientes' : 'Pending'],
      ...data.salesBySection.map((s) => [sectionAnalyticsLabel(s.section, es), s.tickets, s.scanned, s.pending]),
    ];
    exportCsv(`${(eventTitle || 'event').replace(/\s+/g, '-').toLowerCase()}-analytics.csv`, rows);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{es ? 'ANALYTICS DEL EVENTO' : 'EVENT ANALYTICS'}</Text>
          <Text style={styles.headerTitle}>{es ? 'Rendimiento en vivo' : 'Live performance'}</Text>
          <Text style={styles.headerCopy}>{es ? 'Ventas, acceso, asistentes y por sección.' : 'Sales, access, attendees and by section.'}</Text>
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={onExport}>
          <Ionicons name="download-outline" size={16} color="#F97316" />
          <Text style={styles.exportText}>{es ? 'Exportar' : 'Export'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        {cards.map((c, index) => (
          <View key={`${c.label}-${index}`} style={styles.statCard}>
            <View style={styles.statTop}>
              <Text style={styles.statLabel}>{c.label}</Text>
              <View style={styles.statIcon}><Ionicons name={c.icon} size={16} color="#F97316" /></View>
            </View>
            <Text style={styles.statValue}>{c.value}</Text>
            <Text style={styles.statNote}>{c.note}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{es ? 'Ventas por día' : 'Sales by day'}</Text>
        <Text style={styles.cardSub}>{es ? 'Órdenes, tickets e ingresos diarios' : 'Daily orders, tickets and revenue'}</Text>
        {data.salesByDay.some((d) => d.revenue > 0) ? (
          <ScrollView style={styles.innerScroll} nestedScrollEnabled showsVerticalScrollIndicator>
            {data.salesByDay.map((day, index) => (
              <View key={`${day.date}-${index}`} style={styles.barRow}>
                <View style={styles.barHead}>
                  <Text style={styles.barLabel}>{dayLabel(day.date)}</Text>
                  <Text style={styles.barValue}>${day.revenue.toFixed(2)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(6, (day.revenue / maxRevenue) * 100)}%`, backgroundColor: '#F97316' }]} />
                </View>
                <Text style={styles.barNote}>{day.orders} {es ? 'órdenes' : 'orders'} · {day.tickets} tickets</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>{es ? 'Aún no hay ventas para graficar.' : 'No sales to chart yet.'}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{es ? 'Tickets por sección' : 'Tickets by section'}</Text>
        <Text style={styles.cardSub}>{es ? 'Vendido, escaneado y pendiente por área' : 'Sold, scanned and pending by area'}</Text>
        {data.salesBySection.length > 0 ? (
          <ScrollView style={styles.innerScroll} nestedScrollEnabled showsVerticalScrollIndicator>
            {data.salesBySection.map((sec, index) => (
              <View key={`${sec.section || 'section'}-${index}`} style={styles.barRow}>
                <View style={styles.barHead}>
                  <Text style={styles.barLabel} numberOfLines={1}>{sectionAnalyticsLabel(sec.section, es)}</Text>
                  <Text style={styles.barValue}>{sec.tickets} tickets</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(8, (sec.tickets / maxTickets) * 100)}%`, backgroundColor: '#7DD3FC' }]} />
                </View>
                <Text style={styles.barNote}>{sec.scanned} {es ? 'escaneados' : 'scanned'} · {sec.pending} {es ? 'pendientes' : 'pending'}</Text>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>{es ? 'Aún no hay tickets por sección.' : 'No section ticket data yet.'}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  headerCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  eyebrow: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginTop: 4 },
  headerCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 13, marginTop: 4 },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.1)', paddingHorizontal: 12, paddingVertical: 10 },
  exportText: { color: '#F97316', fontSize: 12, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', flexGrow: 1, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  statTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  statLabel: { color: 'rgba(203,213,225,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', flex: 1 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.12)' },
  statValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '800', marginTop: 8 },
  statNote: { color: 'rgba(226,232,240,0.6)', fontSize: 11, fontWeight: '600', marginTop: 4 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  cardTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  cardSub: { color: 'rgba(226,232,240,0.6)', fontSize: 12, marginTop: 2, marginBottom: 12 },
  innerScroll: { maxHeight: 350 },
  barRow: { marginBottom: 14 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  barLabel: { color: 'rgba(248,250,252,0.85)', fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8 },
  barValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barNote: { color: 'rgba(226,232,240,0.55)', fontSize: 11, fontWeight: '600', marginTop: 6 },
  empty: { color: 'rgba(203,213,225,0.7)', fontSize: 13, textAlign: 'center', paddingVertical: 18 },
});
