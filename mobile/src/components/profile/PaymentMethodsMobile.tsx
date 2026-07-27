import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet, apiDelete, apiPost } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { PaymentMethodSkeleton } from '../Skeleton';

type PaymentMethod = {
  id: string;
  type: 'credit_card' | 'bank_account';
  last4: string;
  brand: string;
  isDefault?: boolean;
};

export function PaymentMethodsMobile() {
  const { t } = useLanguage();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const didOpenStripe = useRef(false);

  const load = async () => {
    try {
      const res = await apiGet<PaymentMethod[]>('/payments/methods');
      setMethods(Array.isArray(res) ? res : []);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Cuando el usuario vuelve del navegador de Stripe, recargamos la lista
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active' && didOpenStripe.current) {
        didOpenStripe.current = false;
        load();
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  const handleAddCard = async () => {
    setRedirecting(true);
    try {
      const res = await apiPost<{ url: string }>('/payments/setup-session', {});
      didOpenStripe.current = true;
      await Linking.openURL(res.url);
    } catch {
      /* ignore */
    } finally {
      setRedirecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiDelete(`/payments/methods/${id}`);
      setMethods((prev) => prev.filter((m) => m.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeleting(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{t('MÉTODOS DE PAGO', 'PAYMENT METHODS')}</Text>
        <TouchableOpacity onPress={handleAddCard} disabled={redirecting} style={[styles.addBtn, redirecting && { opacity: 0.6 }]}>
          {redirecting
            ? <ActivityIndicator color="#F97316" size="small" style={{ width: 60 }} />
            : <Text style={styles.addBtnText}>+ {t('Agregar', 'Add')}</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <Text style={styles.infoIcon}>🔒</Text>
        <Text style={styles.infoText}>
          {t(
            'Tus datos de tarjeta son procesados de forma segura por Stripe. LPTicket nunca almacena números de tarjeta.',
            'Your card data is securely handled by Stripe. LPTicket never stores card numbers.',
          )}
        </Text>
      </View>

      {loading ? (
        <>
          <PaymentMethodSkeleton />
          <PaymentMethodSkeleton />
        </>
      ) : methods.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💳</Text>
          <Text style={styles.emptyText}>{t('No tienes tarjetas guardadas.', 'No saved cards yet.')}</Text>
          <Text style={styles.emptySubText}>
            {t(
              'Agrega una tarjeta o se guardará automáticamente al completar tu primera compra.',
              'Add a card or one will be saved automatically after your first purchase.',
            )}
          </Text>
        </View>
      ) : (
        methods.map((m, index) => (
          <View key={`${m.id || 'method'}-${index}`} style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <Text style={styles.methodIconText}>💳</Text>
            </View>
            <View style={styles.methodCopy}>
              <Text style={styles.methodBrand}>{m.brand}</Text>
              <Text style={styles.methodSub}>
                {t(`Tarjeta terminada en **** ${m.last4}`, `Card ending in **** ${m.last4}`)}
              </Text>
            </View>
            {m.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t('Principal', 'Default')}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleDelete(m.id)}
              disabled={deleting === m.id}
              style={styles.deleteBtn}
            >
              {deleting === m.id
                ? <ActivityIndicator color="#FCA5A5" size="small" />
                : <Text style={styles.deleteIcon}>✕</Text>
              }
            </TouchableOpacity>
          </View>
        ))
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
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardLabel: { color: '#F97316', fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  addBtn: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { color: '#F97316', fontSize: 12, fontWeight: '600' },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  infoIcon: { fontSize: 13, marginTop: 1 },
  infoText: { flex: 1, color: 'rgba(226,232,240,0.5)', fontSize: 11, fontWeight: '400', lineHeight: 16 },

  emptyState: { paddingVertical: 24, alignItems: 'center', gap: 6 },
  emptyEmoji: { fontSize: 28 },
  emptyText: { color: 'rgba(226,232,240,0.5)', fontSize: 13, fontWeight: '500', textAlign: 'center' },
  emptySubText: { color: 'rgba(226,232,240,0.35)', fontSize: 11, fontWeight: '400', textAlign: 'center', paddingHorizontal: 10 },

  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  methodIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  methodIconText: { fontSize: 20 },
  methodCopy: { flex: 1, minWidth: 0 },
  methodBrand: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  methodSub: { color: 'rgba(226,232,240,0.5)', fontSize: 11, fontWeight: '400', marginTop: 2 },
  defaultBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  defaultBadgeText: { color: '#F97316', fontSize: 9, fontWeight: '600' },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,90,69,0.08)', borderWidth: 1, borderColor: 'rgba(255,90,69,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteIcon: { color: '#FCA5A5', fontSize: 12, fontWeight: '600' },
});
