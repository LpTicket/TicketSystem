import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClientSeat, ClientVenueMap, ClientVenueSection } from '../events/ClientVenueMap';
import { apiGet, apiPost } from '../../services/api';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type Props = {
  eventId?: string;
  onScrollLock?: (locked: boolean) => void;
};

function listFrom(payload: any): ClientVenueSection[] {
  if (Array.isArray(payload)) return payload;
  return payload?.sections || payload?.data || [];
}

function isTemporaryHold(seat: ClientSeat) {
  const status = String(seat.status || '').toLowerCase();
  return status === 'locked' && !!seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() > Date.now();
}

function isPermanentlyBlocked(seat: ClientSeat) {
  const status = String(seat.status || '').toLowerCase();
  return (status === 'locked' && !isTemporaryHold(seat)) || status === 'blocked';
}

function isSold(seat: ClientSeat) {
  return String(seat.status || '').toLowerCase() === 'sold';
}

/**
 * The organizer's mobile map intentionally reuses the customer map's exact
 * viewport and responder system.  It never saves section geometry: its only
 * mutation is the existing server-side seat block endpoint.
 */
export function OrganizerVenueMapMobile({ eventId, onScrollLock }: Props) {
  const { t } = useLanguage();
  const [sections, setSections] = useState<ClientVenueSection[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<ClientSeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadMap = useCallback(async () => {
    if (!eventId) {
      setSections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      let payload: any;
      try {
        payload = await apiGet<any[]>(`/events/${eventId}/seatmap`);
      } catch {
        payload = await apiGet<any[]>(`/events/${eventId}/sections`);
      }
      setSections(listFrom(payload));
    } catch (err: any) {
      setSections([]);
      setError(err?.message || t('No se pudo cargar el mapa.', 'Unable to load the map.'));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    setSelectedSeats([]);
    loadMap();
  }, [loadMap]);

  const stats = useMemo(() => {
    const seats = sections.flatMap((section) => section.seats || []);
    const sold = seats.filter(isSold).length;
    const blocked = seats.filter(isPermanentlyBlocked).length;
    const available = Math.max(0, seats.length - sold - blocked - seats.filter(isTemporaryHold).length);
    return { capacity: seats.length, available, sold, blocked };
  }, [sections]);

  const selectSeats = useCallback((seats: ClientSeat[]) => {
    // Sales and active checkout holds are protected. They remain visible on
    // the map but can never be changed from this organizer action.
    const manageable = seats.filter((seat) => !isSold(seat) && !isTemporaryHold(seat));
    if (!manageable.length) {
      Alert.alert(
        t('No disponible', 'Unavailable'),
        t('Esta selección tiene una venta confirmada o una reserva temporal y no se puede modificar.', 'This selection has a confirmed sale or a temporary hold and cannot be changed.'),
      );
      return;
    }
    setSelectedSeats((current) => {
      const currentIds = new Set(current.map((seat) => seat.id));
      const nextIds = new Set(manageable.map((seat) => seat.id));
      const isSameSelection = currentIds.size === nextIds.size
        && [...nextIds].every((id) => currentIds.has(id));

      // A second touch on the exact same chair or table is a safe toggle-off.
      // Nothing is persisted until the organizer explicitly taps Block/Unblock.
      return isSameSelection ? [] : manageable;
    });
  }, [t]);

  const clearSelection = () => setSelectedSeats([]);

  const allSelectedBlocked = selectedSeats.length > 0 && selectedSeats.every(isPermanentlyBlocked);
  const selectedCount = selectedSeats.length;
  const selectedTable = useMemo(() => {
    if (!selectedCount) return '';
    const ids = new Set(selectedSeats.map((seat) => seat.sectionId));
    if (ids.size !== 1) return '';
    const section = sections.find((item) => item.id === selectedSeats[0]?.sectionId);
    return section?.name || section?.label || '';
  }, [sections, selectedCount, selectedSeats]);

  const toggleBlock = async () => {
    if (!selectedSeats.length || updating) return;
    const seatIds = selectedSeats.map((seat) => seat.id).filter(Boolean);
    if (!seatIds.length) return;
    setUpdating(true);
    try {
      await apiPost('/orders/seats/toggle-block-bulk', { seatIds, blocked: !allSelectedBlocked }, 30000);
      setSelectedSeats([]);
      await loadMap();
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo actualizar el bloqueo.', 'Unable to update the block.'));
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <View style={styles.state}><ActivityIndicator color={colors.orange} /><Text style={styles.stateText}>{t('Cargando mapa...', 'Loading map...')}</Text></View>;
  }

  if (error) {
    return (
      <View style={styles.state}>
        <Ionicons name="warning-outline" size={26} color={colors.orange} />
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadMap}><Text style={styles.retryText}>{t('Reintentar', 'Retry')}</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.summary}>
        <View>
          <Text style={styles.summaryEyebrow}>{t('MAPA VISUAL', 'VENUE MAP')}</Text>
          <Text style={styles.summaryTitle}>{t('Bloquea o desbloquea mesas y asientos', 'Block or unblock tables and seats')}</Text>
        </View>
        <View style={styles.metrics}>
          <Metric label={t('Capacidad', 'Capacity')} value={stats.capacity} />
          <Metric label={t('Disponibles', 'Available')} value={stats.available} tone="available" />
          <Metric label={t('Vendidas', 'Sold')} value={stats.sold} tone="sold" />
          <Metric label={t('Bloqueadas', 'Blocked')} value={stats.blocked} tone="blocked" />
        </View>
      </View>

      <View style={styles.actionPanel}>
        {selectedCount ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectionTitle}>
                {selectedTable ? `${t('Mesa', 'Table')} ${selectedTable}` : t('Asientos seleccionados', 'Selected seats')}
              </Text>
              <Text style={styles.selectionCopy}>{selectedCount} {t('asiento(s) seleccionado(s)', 'seat(s) selected')}</Text>
            </View>
            <TouchableOpacity style={styles.clearButton} onPress={clearSelection} disabled={updating}>
              <Text style={styles.clearText}>{t('Cancelar', 'Cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.blockButton, allSelectedBlocked && styles.unblockButton]} onPress={toggleBlock} disabled={updating}>
              {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.blockText}>{allSelectedBlocked ? t('Desbloquear', 'Unblock') : t('Bloquear', 'Block')}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.emptySelection}>{t('Toca una silla para seleccionarla o el centro de una mesa para seleccionar la mesa completa.', 'Tap a chair to select it, or the center of a table to select the whole table.')}</Text>
        )}
      </View>

      <ClientVenueMap
        seatMap={sections}
        selectedSeats={selectedSeats}
        onToggleSeat={() => undefined}
        onManageSeats={selectSeats}
        onScrollLock={onScrollLock}
      />
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: 'available' | 'sold' | 'blocked' }) {
  return <View style={[styles.metric, tone === 'available' && styles.metricAvailable, tone === 'sold' && styles.metricSold, tone === 'blocked' && styles.metricBlocked]}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  summary: { backgroundColor: 'rgba(8, 32, 54, 0.95)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.18)', borderRadius: 18, padding: 15, gap: 14 },
  summaryEyebrow: { color: 'rgba(191,219,254,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  summaryTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '700', marginTop: 4 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metric: { minWidth: 73, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: 'rgba(148,163,184,0.12)' },
  metricAvailable: { backgroundColor: 'rgba(34,197,94,0.13)' },
  metricSold: { backgroundColor: 'rgba(249,115,22,0.13)' },
  metricBlocked: { backgroundColor: 'rgba(148,163,184,0.18)' },
  metricValue: { color: '#f8fafc', fontSize: 16, fontWeight: '800' },
  metricLabel: { color: 'rgba(203,213,225,0.72)', fontSize: 10, marginTop: 2 },
  actionPanel: { minHeight: 66, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(15,23,42,0.96)', padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectionTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800' },
  selectionCopy: { color: 'rgba(203,213,225,0.7)', fontSize: 12, marginTop: 2 },
  clearButton: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(203,213,225,0.38)', paddingVertical: 11, paddingHorizontal: 12 },
  clearText: { color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  blockButton: { minWidth: 98, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 13, alignItems: 'center', backgroundColor: '#ea580c' },
  unblockButton: { backgroundColor: '#2563eb' },
  blockText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  emptySelection: { color: 'rgba(203,213,225,0.78)', fontSize: 12, lineHeight: 18, flex: 1 },
  state: { minHeight: 190, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', backgroundColor: 'rgba(8,32,54,0.92)', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  stateText: { color: 'rgba(226,232,240,0.82)', textAlign: 'center' },
  retryButton: { borderRadius: 10, backgroundColor: '#ea580c', paddingVertical: 10, paddingHorizontal: 16 },
  retryText: { color: '#fff', fontWeight: '800' },
});
