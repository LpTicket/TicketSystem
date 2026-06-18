import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { OrderRowSkeleton } from '../Skeleton';

type Order = {
  id: string;
  status?: string;
  total?: number | string;
  subtotal?: number | string;
  lpFee?: number | string;
  processingFee?: number | string;
  ticketCount?: number;
  createdAt?: string;
  paidAt?: string;
  event?: { title?: string; eventDate?: string; venueName?: string; currency?: string };
  tickets?: OrderTicket[];
};

type OrderTicket = {
  id: string;
  ticketCode?: string;
  price?: number | string;
  sectionName?: string | null;
  rowLabel?: string | null;
  seatNumber?: string | number | null;
  seatLabel?: string | null;
};

type OrdersResponse = { data?: Order[]; pagination?: { total?: number; pages?: number } };

function money(value: number | string | undefined) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(value?: string, es?: boolean) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(es ? 'es-ES' : 'en-US', {
      day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusBadge(status: string | undefined, t: (es: string, en: string) => string) {
  switch (status) {
    case 'paid': return { label: t('Pagado', 'Paid'), color: '#34D399', bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.4)' };
    case 'pending': return { label: t('Pendiente', 'Pending'), color: '#FBBF24', bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.4)' };
    default: return { label: t('Cancelado', 'Cancelled'), color: '#FCA5A5', bg: 'rgba(255,90,69,0.12)', border: 'rgba(255,90,69,0.4)' };
  }
}

function seatText(ticket: OrderTicket, t: (es: string, en: string) => string) {
  if (ticket.seatLabel) return ticket.seatLabel;
  const parts = [ticket.sectionName, ticket.rowLabel, ticket.seatNumber].filter(Boolean);
  return parts.length ? parts.join(' · ') : t('General', 'General');
}

function OrderDetail({ orderId }: { orderId: string }) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [detail, setDetail] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiGet<Order>(`/orders/${orderId}`)
      .then((data) => { if (mounted) setDetail(data); })
      .catch(() => { if (mounted) setDetail(null); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [orderId]);

  if (loading) return <View style={styles.detailLoader}><ActivityIndicator color="#F97316" size="small" /></View>;
  if (!detail) return <Text style={styles.detailError}>{t('No se pudo cargar el recibo.', 'Could not load receipt.')}</Text>;

  const currency = detail.event?.currency || 'USD';
  const tickets = detail.tickets || [];
  const subtotal = Number(detail.subtotal ?? 0);
  const lpFee = Number(detail.lpFee ?? 0);
  const processingFee = Number(detail.processingFee ?? 0);
  const total = Number(detail.total ?? 0);
  const purchaseDate = detail.paidAt || detail.createdAt;

  return (
    <View style={styles.receipt}>
      {/* Header */}
      <View style={styles.receiptHeader}>
        <Text style={styles.receiptEyebrow}>{t('RECIBO DE COMPRA', 'PURCHASE RECEIPT')}</Text>
        <Text style={styles.receiptEvent} numberOfLines={2}>{detail.event?.title || t('Evento', 'Event')}</Text>
        {detail.event?.eventDate && (
          <Text style={styles.receiptMeta}>{formatDate(detail.event.eventDate, es)}</Text>
        )}
        {detail.event?.venueName && (
          <Text style={styles.receiptMeta}>{detail.event.venueName}</Text>
        )}
        {purchaseDate && (
          <Text style={styles.receiptMeta}>{t('Compra', 'Purchase')}: {formatDate(purchaseDate, es)}</Text>
        )}
        <Text style={styles.receiptOrderId} numberOfLines={1}>{t('Orden', 'Order')}: {orderId.slice(0, 20)}…</Text>
      </View>

      {/* Tickets list */}
      {tickets.length > 0 && (
        <View style={styles.ticketsBlock}>
          <Text style={styles.ticketsBlockLabel}>{t('ENTRADAS', 'TICKETS')}</Text>
          {tickets.map((tk, i) => (
            <View key={`${tk.id || tk.ticketCode || 'ticket'}-${i}`} style={styles.ticketRow}>
              <View style={styles.ticketRowLeft}>
                <Text style={styles.ticketSeat}>{seatText(tk, t)}</Text>
                {tk.ticketCode && <Text style={styles.ticketCode}>{tk.ticketCode}</Text>}
              </View>
              <Text style={styles.ticketPrice}>{money(tk.price)} {currency}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Fees breakdown */}
      <View style={styles.feesBlock}>
        <View style={styles.feeRow}>
          <Text style={styles.feeLabel}>{t('Subtotal entradas', 'Ticket subtotal')}</Text>
          <Text style={styles.feeValue}>{money(subtotal)} {currency}</Text>
        </View>
        {lpFee > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>{t('Cargo por servicio', 'Service fee')}</Text>
            <Text style={styles.feeValue}>{money(lpFee)} {currency}</Text>
          </View>
        )}
        {processingFee > 0 && (
          <View style={styles.feeRow}>
            <Text style={styles.feeLabel}>{t('Tarifa de procesamiento', 'Processing fee')}</Text>
            <Text style={styles.feeValue}>{money(processingFee)} {currency}</Text>
          </View>
        )}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('Total cobrado', 'Total charged')}</Text>
          <Text style={styles.totalValue}>{money(total)} {currency}</Text>
        </View>
      </View>

      <Text style={styles.receiptFooter}>
        {t('Este recibo corresponde a la orden completa.', 'This receipt covers the complete order.')}
      </Text>
    </View>
  );
}

export function OrdersMobile() {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async (nextPage: number) => {
    try {
      const res = await apiGet<OrdersResponse>(`/orders/my-orders?page=${nextPage}&limit=20`);
      const list = Array.isArray(res?.data) ? res.data : [];
      setOrders((prev) => (nextPage === 1 ? list : [...prev, ...list]));
      setPages(res?.pagination?.pages || 1);
      setPage(nextPage);
    } catch {
      if (nextPage === 1) setOrders([]);
    }
  };

  useEffect(() => {
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, []);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  };

  const toggleExpand = (id: string) => setExpandedId((prev) => (prev === id ? null : id));

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('MIS RECIBOS', 'MY RECEIPTS')}</Text>

      {loading ? (
        <>
          <OrderRowSkeleton />
          <OrderRowSkeleton />
          <OrderRowSkeleton />
          <OrderRowSkeleton />
        </>
      ) : orders.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{t('Aún no tienes pedidos.', 'No orders yet.')}</Text></View>
      ) : (
        <>
          {orders.map((order, index) => {
            const badge = statusBadge(order.status, t);
            const isOpen = expandedId === order.id;
            return (
              <View key={`${order.id || 'order'}-${index}`}>
                <TouchableOpacity onPress={() => toggleExpand(order.id)} activeOpacity={0.78} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.event} numberOfLines={1}>{order.event?.title || t('Evento', 'Event')}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {formatDate(order.createdAt, es)} · {order.ticketCount || 0} {t('ticket(s)', 'ticket(s)')}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.total}>{money(order.total)}</Text>
                    <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {isOpen && <OrderDetail orderId={order.id} />}
              </View>
            );
          })}

          {page < pages && (
            <TouchableOpacity onPress={loadMore} disabled={loadingMore} style={styles.loadMore}>
              <Text style={styles.loadMoreText}>
                {loadingMore ? t('Cargando...', 'Loading...') : `${t('Cargar más', 'Load more')} (${page}/${pages})`}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 16,
    marginTop: 16,
  },
  cardLabel: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 12 },
  empty: { paddingVertical: 24, alignItems: 'center' },
  emptyText: { color: 'rgba(226,232,240,0.6)', fontSize: 14 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)', gap: 12,
  },
  rowLeft: { flex: 1, minWidth: 0 },
  event: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  meta: { color: 'rgba(226,232,240,0.6)', fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  total: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '800' },
  loadMore: {
    marginTop: 12, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
  },
  loadMoreText: { color: '#F97316', fontSize: 13, fontWeight: '800' },

  // Receipt detail
  receipt: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.28)',
    backgroundColor: 'rgba(3,11,20,0.92)',
    marginBottom: 4,
    overflow: 'hidden',
  },
  detailLoader: { paddingVertical: 20, alignItems: 'center' },
  detailError: { color: 'rgba(226,232,240,0.5)', fontSize: 12, padding: 14, textAlign: 'center' },

  receiptHeader: { padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  receiptEyebrow: { color: '#F97316', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  receiptEvent: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', lineHeight: 20 },
  receiptMeta: { color: 'rgba(226,232,240,0.6)', fontSize: 11, fontWeight: '400', marginTop: 3 },
  receiptOrderId: { color: 'rgba(226,232,240,0.36)', fontSize: 10, fontFamily: 'monospace', marginTop: 6 },

  ticketsBlock: { padding: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  ticketsBlockLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  ticketRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 10,
  },
  ticketRowLeft: { flex: 1, minWidth: 0 },
  ticketSeat: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  ticketCode: { color: 'rgba(226,232,240,0.44)', fontSize: 10, fontFamily: 'monospace', marginTop: 2 },
  ticketPrice: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },

  feesBlock: { padding: 14 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  feeLabel: { color: 'rgba(226,232,240,0.7)', fontSize: 12, fontWeight: '400' },
  feeValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)', marginTop: 4,
  },
  totalLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  totalValue: { color: '#F97316', fontSize: 16, fontWeight: '800' },

  receiptFooter: {
    color: 'rgba(226,232,240,0.3)', fontSize: 10, fontWeight: '400',
    textAlign: 'center', padding: 12, paddingTop: 0,
  },
});
