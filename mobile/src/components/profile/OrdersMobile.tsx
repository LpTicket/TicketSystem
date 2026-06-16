import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

type Order = {
  id: string;
  status?: string;
  total?: number | string;
  ticketCount?: number;
  createdAt?: string;
  event?: { title?: string };
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

export function OrdersMobile() {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t('MIS RECIBOS', 'MY RECEIPTS')}</Text>

      {loading ? (
        <View style={styles.empty}><ActivityIndicator color="#F97316" /></View>
      ) : orders.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{t('Aún no tienes pedidos.', 'No orders yet.')}</Text></View>
      ) : (
        <>
          {orders.map((order) => {
            const badge = statusBadge(order.status, t);
            return (
              <View key={order.id} style={styles.row}>
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
});
