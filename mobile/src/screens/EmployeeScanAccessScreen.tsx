import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { GradientButton } from '../components/GradientButton';
import { AuthUser, apiGet } from '../services/api';
import {
  ScannerAccessEvent,
  ScannerAccessGrant,
  approveScannerAccessRequest,
  getMyScannerAccess,
  getOrganizerScannerAccessRequests,
  rejectScannerAccessRequest,
  requestScannerAccess,
  revokeScannerAccessRequest,
  searchScannerAccessEvents,
} from '../services/scannerAccess';
import { DoorSaleScreen } from './DoorSaleScreen';
import { ScanScreen, ScannerEvent } from './ScanScreen';

type Props = {
  user?: AuthUser | null;
  onBack: () => void;
};

function fmtDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value || '';
  }
}

function toScannerEvent(event: ScannerAccessEvent): ScannerEvent {
  return {
    id: event.id,
    title: event.title,
    eventDate: event.eventDate,
    status: event.status || 'published',
    imageUrl: event.imageUrl,
    bannerImageUrl: event.bannerImageUrl,
  };
}

function listFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.events || payload?.items || [];
}

export function EmployeeScanAccessScreen({ user, onBack }: Props) {
  const { t } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const [accessList, setAccessList] = useState<ScannerAccessGrant[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ScannerAccessEvent[]>([]);
  const [requestingEventId, setRequestingEventId] = useState<string | null>(null);
  const [activeScanEvent, setActiveScanEvent] = useState<ScannerAccessEvent | null>(null);
  const [activeDoorSaleEvent, setActiveDoorSaleEvent] = useState<ScannerAccessEvent | null>(null);
  const [organizerRequests, setOrganizerRequests] = useState<ScannerAccessGrant[]>([]);
  const [organizerRequestsLoading, setOrganizerRequestsLoading] = useState(false);
  const [canManageScannerRequests, setCanManageScannerRequests] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const approved = useMemo(() => accessList.filter((item) => item.status === 'approved'), [accessList]);
  const pending = useMemo(() => accessList.filter((item) => item.status === 'pending'), [accessList]);
  const rejected = useMemo(() => accessList.filter((item) => item.status === 'rejected'), [accessList]);
  const knownEventIds = useMemo(() => new Set(accessList.map((item) => item.event.id)), [accessList]);
  const organizerRequestsByEvent = useMemo(() => {
    const groups: { event: ScannerAccessEvent; requests: ScannerAccessGrant[] }[] = [];
    organizerRequests.forEach((request) => {
      const eventId = request.event.id;
      let group = groups.find((item) => item.event.id === eventId);
      if (!group) {
        group = { event: request.event, requests: [] };
        groups.push(group);
      }
      group.requests.push(request);
    });
    return groups;
  }, [organizerRequests]);

  const loadAccess = useCallback(async (quiet = false) => {
    if (!user) return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const data = await getMyScannerAccess();
      setAccessList(data);
    } catch (err: any) {
      setError(err?.message || t('No se pudo cargar tu acceso de scan.', 'Could not load your scan access.'));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [t, user]);

  const loadOrganizerRequests = useCallback(async (quiet = false) => {
    if (!user) return;
    if (!quiet) setOrganizerRequestsLoading(true);
    try {
      let hasOrganizerEvents = user.role === 'admin';
      if (!hasOrganizerEvents) {
        const mine = await apiGet<any>('/events/mine/list');
        hasOrganizerEvents = listFrom(mine).length > 0;
      }
      if (!hasOrganizerEvents) {
        setCanManageScannerRequests(false);
        setOrganizerRequests([]);
        return;
      }
      const requests = await getOrganizerScannerAccessRequests();
      setOrganizerRequests(requests);
      setCanManageScannerRequests(true);
    } catch {
      setCanManageScannerRequests(false);
      setOrganizerRequests([]);
    } finally {
      if (!quiet) setOrganizerRequestsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAccess();
    loadOrganizerRequests();
  }, [loadAccess, loadOrganizerRequests]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(Math.max(0, event.endCoordinates?.height || 0));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAccess(true), loadOrganizerRequests(true)]);
    setRefreshing(false);
  };

  const decideOrganizerRequest = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    setError('');
    try {
      const updated = action === 'approve'
        ? await approveScannerAccessRequest(id)
        : action === 'reject'
          ? await rejectScannerAccessRequest(id)
          : await revokeScannerAccessRequest(id);
      setOrganizerRequests((current) => current.map((item) => item.id === id ? updated : item));
    } catch (err: any) {
      setError(err?.message || t('No se pudo actualizar el permiso de scan.', 'Could not update scanner access.'));
    }
  };

  const searchEvents = async () => {
    const clean = query.trim();
    if (clean.length < 1) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const results = await searchScannerAccessEvents(clean);
      setSearchResults(results);
    } catch (err: any) {
      setError(err?.message || t('No se pudo buscar eventos.', 'Could not search events.'));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 1) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      searchScannerAccessEvents(clean)
        .then(setSearchResults)
        .catch((err: any) => setError(err?.message || t('No se pudo buscar eventos.', 'Could not search events.')))
        .finally(() => setSearching(false));
    }, 260);
    return () => clearTimeout(timer);
  }, [query, t]);

  const sendRequest = async (event: ScannerAccessEvent) => {
    setRequestingEventId(event.id);
    setError('');
    try {
      const created = await requestScannerAccess(event.id);
      setAccessList((prev) => {
        const next = prev.filter((item) => item.event.id !== event.id);
        return [{ ...created, event: created.event?.id ? created.event : event, status: created.status || 'pending' }, ...next];
      });
      setSearchResults((prev) => prev.filter((item) => item.id !== event.id));
    } catch (err: any) {
      setError(err?.message || t('No se pudo enviar la solicitud.', 'Could not send the request.'));
    } finally {
      setRequestingEventId(null);
    }
  };

  if (activeScanEvent) {
    return (
      <ScanScreen
        user={user}
        mode="employee"
        assignedEvents={[toScannerEvent(activeScanEvent)]}
        initialSelectedEventId={activeScanEvent.id}
        lockEventSelection
        onBack={() => setActiveScanEvent(null)}
      />
    );
  }

  if (activeDoorSaleEvent) {
    return (
      <DoorSaleScreen
        user={user}
        eventSource="employee"
        assignedEvents={[{
          id: activeDoorSaleEvent.id,
          title: activeDoorSaleEvent.title,
          eventDate: activeDoorSaleEvent.eventDate || undefined,
          venueName: activeDoorSaleEvent.venueName || undefined,
          imageUrl: activeDoorSaleEvent.imageUrl || activeDoorSaleEvent.bannerImageUrl || undefined,
          status: activeDoorSaleEvent.status || undefined,
        }]}
        initialSelectedEventId={activeDoorSaleEvent.id}
        onBack={() => setActiveDoorSaleEvent(null)}
      />
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 20 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#F97316" />}
    >
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.78}>
          <Ionicons name="chevron-back" size={18} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.modeBadge}>
          <Ionicons name="scan-outline" size={14} color="#F97316" />
          <Text style={styles.modeBadgeText}>{t('ACCESO DE EMPLEADO', 'STAFF ACCESS')}</Text>
        </View>
      </View>

      <Text style={styles.title}>{t('Scan entradas', 'Ticket scan')}</Text>
      <Text style={styles.subtitle}>
        {t('Solicita permiso para escanear un evento. Cuando el organizador apruebe, el evento aparecerá aquí.', 'Request permission to scan an event. Once the organizer approves, the event appears here.')}
      </Text>

      {error ? (
        <View style={styles.noticeDanger}>
          <Ionicons name="alert-circle-outline" size={18} color="#FCA5A5" />
          <Text style={styles.noticeDangerText}>{error}</Text>
        </View>
      ) : null}

      {canManageScannerRequests && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.eyebrow}>{t('ORGANIZADOR', 'ORGANIZER')}</Text>
              <Text style={styles.sectionTitle}>{t('Empleados para scan', 'Scan staff')}</Text>
            </View>
            {organizerRequestsLoading ? <ActivityIndicator color="#F97316" /> : <Ionicons name="people-outline" size={20} color="#F97316" />}
          </View>

          {organizerRequestsByEvent.length === 0 ? (
            <EmptyCard
              icon="people-outline"
              title={t('Sin solicitudes todavía', 'No requests yet')}
              copy={t('Cuando un empleado solicite acceso para tus eventos, aparecerá aquí.', 'When a staff member requests access to your events, it will appear here.')}
            />
          ) : (
            organizerRequestsByEvent.map((group) => (
              <View key={group.event.id} style={styles.organizerEventGroup}>
                <Text style={styles.organizerEventTitle} numberOfLines={2}>{group.event.title}</Text>
                <Text style={styles.organizerEventMeta} numberOfLines={1}>{[fmtDate(group.event.eventDate), group.event.venueName].filter(Boolean).join(' · ')}</Text>
                {group.requests.map((request, index) => (
                  <ScannerRequestRow
                    key={`${request.id}-${index}`}
                    request={request}
                    onApprove={() => decideOrganizerRequest(request.id, 'approve')}
                    onReject={() => decideOrganizerRequest(request.id, 'reject')}
                    onRevoke={() => decideOrganizerRequest(request.id, 'revoke')}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.eyebrow}>{t('APROBADOS', 'APPROVED')}</Text>
            <Text style={styles.sectionTitle}>{t('Eventos para escanear', 'Events you can scan')}</Text>
          </View>
          {loading && <ActivityIndicator color="#F97316" />}
        </View>

        {!loading && approved.length === 0 ? (
          <EmptyCard
            icon="lock-closed-outline"
            title={t('Sin eventos aprobados', 'No approved events')}
            copy={t('Busca un evento y envía una solicitud al organizador.', 'Search for an event and send a request to the organizer.')}
          />
        ) : (
          approved.map((item, index) => (
            <EventAccessCard
              key={`${item.id}-${index}`}
              event={item.event}
              status="approved"
              actionLabel={t('ABRIR SCAN', 'OPEN SCAN')}
              onPress={() => setActiveScanEvent(item.event)}
              secondaryActionLabel={t('VENTA EN PUERTA', 'DOOR SALE')}
              onSecondaryPress={() => setActiveDoorSaleEvent(item.event)}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>{t('BUSCAR EVENTO', 'SEARCH EVENT')}</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="rgba(148,163,184,0.82)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Nombre del evento, lugar...', 'Event name, venue...')}
            placeholderTextColor="rgba(148,163,184,0.58)"
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={searchEvents}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 180)}
          />
          <GradientButton height={56} style={styles.searchButton} onPress={searchEvents}>
            {searching ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.searchButtonText}>{t('BUSCAR', 'SEARCH')}</Text>}
          </GradientButton>
        </View>

        {searchResults.map((event, index) => {
          const alreadyKnown = knownEventIds.has(event.id);
          return (
            <EventAccessCard
              key={`${event.id}-${index}`}
              event={event}
              status={alreadyKnown ? 'pending' : undefined}
              actionLabel={alreadyKnown ? t('SOLICITADO', 'REQUESTED') : t('SOLICITAR', 'REQUEST')}
              disabled={alreadyKnown || requestingEventId === event.id}
              loading={requestingEventId === event.id}
              onPress={() => sendRequest(event)}
            />
          );
        })}
      </View>

      {(pending.length > 0 || rejected.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{t('SOLICITUDES', 'REQUESTS')}</Text>
          {pending.map((item, index) => (
            <EventAccessCard key={`pending-${item.id}-${index}`} event={item.event} status="pending" actionLabel={t('PENDIENTE', 'PENDING')} disabled />
          ))}
          {rejected.map((item, index) => (
            <EventAccessCard key={`rejected-${item.id}-${index}`} event={item.event} status="rejected" actionLabel={t('RECHAZADO', 'REJECTED')} disabled />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function ScannerRequestRow({
  request,
  onApprove,
  onReject,
  onRevoke,
}: {
  request: ScannerAccessGrant;
  onApprove: () => void;
  onReject: () => void;
  onRevoke: () => void;
}) {
  const employeeName = [request.user?.firstName, request.user?.lastName].filter(Boolean).join(' ') || request.user?.email || 'Empleado';
  const avatarUrl = request.user?.avatarUrl || '';
  const pending = request.status === 'pending';
  const approved = request.status === 'approved';
  const rejected = request.status === 'rejected';

  return (
    <View style={styles.scannerRequestRow}>
      <View style={styles.scannerAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.scannerAvatarImage} />
        ) : (
          <Text style={styles.scannerAvatarText}>{employeeName.slice(0, 2).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.scannerRequestMain}>
        <Text style={styles.scannerRequestName} numberOfLines={1}>{employeeName}</Text>
        <Text style={styles.scannerRequestEmail} numberOfLines={1}>{request.user?.email || '-'}</Text>
        <View style={[styles.scannerStatus, approved ? styles.scannerStatusApproved : pending ? styles.scannerStatusPending : styles.scannerStatusRejected]}>
          <Text style={styles.scannerStatusText}>{approved ? 'APROBADO' : pending ? 'PENDIENTE' : rejected ? 'RECHAZADO' : request.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.scannerActions}>
        {pending ? (
          <>
            <TouchableOpacity style={styles.scannerApproveBtn} onPress={onApprove}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.scannerRejectBtn} onPress={onReject}>
              <Ionicons name="close" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : approved ? (
          <TouchableOpacity style={styles.scannerRevokeBtn} onPress={onRevoke}>
            <Text style={styles.scannerRevokeText}>REVOCAR</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function EventAccessCard({
  event,
  status,
  actionLabel,
  disabled,
  loading,
  onPress,
  secondaryActionLabel,
  onSecondaryPress,
}: {
  event: ScannerAccessEvent;
  status?: 'approved' | 'pending' | 'rejected';
  actionLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryPress?: () => void;
}) {
  const tone = status === 'approved' ? styles.statusApproved : status === 'rejected' ? styles.statusRejected : styles.statusPending;
  const icon = status === 'approved' ? 'checkmark-circle-outline' : status === 'rejected' ? 'close-circle-outline' : 'time-outline';

  return (
    <View style={styles.eventCard}>
      <View style={styles.thumb}>
        {event.imageUrl || event.bannerImageUrl ? (
          <Image source={{ uri: event.imageUrl || event.bannerImageUrl || '' }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <Ionicons name="ticket-outline" size={24} color="#F97316" />
        )}
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.eventMeta} numberOfLines={1}>{[fmtDate(event.eventDate), event.venueName].filter(Boolean).join(' · ') || 'Evento'}</Text>
        {status && (
          <View style={[styles.statusPill, tone]}>
            <Ionicons name={icon as any} size={12} color="#FFFFFF" />
            <Text style={styles.statusText}>{status.toUpperCase()}</Text>
          </View>
        )}
      </View>
      <View style={styles.actionsColumn}>
        <GradientButton height={42} style={disabled ? [styles.actionButton, styles.actionButtonDisabled] : styles.actionButton} disabled={disabled || loading} onPress={onPress}>
          {loading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.actionText, disabled && styles.actionTextDisabled]}>{actionLabel}</Text>}
        </GradientButton>
        {secondaryActionLabel && !disabled ? (
          <TouchableOpacity style={styles.secondaryActionButton} onPress={onSecondaryPress} activeOpacity={0.78}>
            <Ionicons name="card-outline" size={13} color="#F97316" />
            <Text style={styles.secondaryActionText}>{secondaryActionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function EmptyCard({ icon, title, copy }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={30} color="rgba(249,115,22,0.52)" />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 132 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, borderRadius: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: '#030B14' },
  modeBadgeText: { color: '#F8FAFC', fontSize: 10, fontWeight: '600' },
  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 34, fontWeight: '600', marginTop: 16 },
  subtitle: { color: 'rgba(226,232,240,0.62)', fontSize: 13, lineHeight: 20, marginTop: 7 },
  noticeDanger: { marginTop: 14, flexDirection: 'row', gap: 9, alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.30)', backgroundColor: 'rgba(239,68,68,0.10)', padding: 13 },
  noticeDangerText: { flex: 1, color: '#FCA5A5', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  section: { marginTop: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  eyebrow: { color: '#F97316', fontSize: 10, fontWeight: '600', letterSpacing: 0.7 },
  sectionTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '600', marginTop: 4 },
  emptyCard: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderStyle: 'dashed', backgroundColor: '#030B14', alignItems: 'center', paddingVertical: 28, paddingHorizontal: 18 },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginTop: 10 },
  emptyCopy: { color: 'rgba(226,232,240,0.52)', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  eventCard: { minHeight: 96, flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', padding: 10, marginTop: 10 },
  thumb: { width: 68, height: 74, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: '100%', height: '100%' },
  eventInfo: { flex: 1, minWidth: 0 },
  eventTitle: { color: '#F8FAFC', fontSize: 14, lineHeight: 18, fontWeight: '600' },
  eventMeta: { color: 'rgba(226,232,240,0.48)', fontSize: 11, marginTop: 4 },
  statusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginTop: 8 },
  statusApproved: { backgroundColor: 'rgba(16,185,129,0.82)' },
  statusPending: { backgroundColor: 'rgba(249,115,22,0.82)' },
  statusRejected: { backgroundColor: 'rgba(239,68,68,0.82)' },
  statusText: { color: '#FFFFFF', fontSize: 8, fontWeight: '600' },
  actionsColumn: { width: 104, gap: 7 },
  actionButton: { minWidth: 86, borderRadius: 14, paddingHorizontal: 10 },
  actionButtonDisabled: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  actionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
  actionTextDisabled: { color: 'rgba(226,232,240,0.42)' },
  secondaryActionButton: { minHeight: 34, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(249,115,22,0.32)', backgroundColor: 'rgba(249,115,22,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, flexDirection: 'row', gap: 5 },
  secondaryActionText: { color: '#F97316', fontSize: 8, fontWeight: '600', textAlign: 'center' },
  organizerEventGroup: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#030B14', padding: 12, marginTop: 10 },
  organizerEventTitle: { color: '#F8FAFC', fontSize: 15, lineHeight: 19, fontWeight: '600' },
  organizerEventMeta: { color: 'rgba(226,232,240,0.46)', fontSize: 11, marginTop: 4, marginBottom: 8 },
  scannerRequestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.025)', padding: 10, marginTop: 8 },
  scannerAvatar: { width: 42, height: 42, borderRadius: 21, overflow: 'hidden', backgroundColor: 'rgba(249,115,22,0.18)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  scannerAvatarImage: { width: '100%', height: '100%' },
  scannerAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  scannerRequestMain: { flex: 1, minWidth: 0 },
  scannerRequestName: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  scannerRequestEmail: { color: 'rgba(226,232,240,0.52)', fontSize: 11, marginTop: 2 },
  scannerStatus: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6 },
  scannerStatusApproved: { backgroundColor: 'rgba(16,185,129,0.80)' },
  scannerStatusPending: { backgroundColor: 'rgba(249,115,22,0.82)' },
  scannerStatusRejected: { backgroundColor: 'rgba(239,68,68,0.78)' },
  scannerStatusText: { color: '#FFFFFF', fontSize: 8, fontWeight: '600' },
  scannerActions: { flexDirection: 'row', gap: 7 },
  scannerApproveBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  scannerRejectBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  scannerRevokeBtn: { minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.32)', backgroundColor: 'rgba(239,68,68,0.10)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  scannerRevokeText: { color: '#FCA5A5', fontSize: 9, fontWeight: '600' },
  searchBox: { minHeight: 56, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, marginTop: 12 },
  searchInput: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 14, fontWeight: '600', outlineStyle: 'none' as any },
  searchButton: { alignSelf: 'stretch', minWidth: 78, borderTopRightRadius: 16, borderBottomRightRadius: 16, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, paddingHorizontal: 12 },
  searchButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '600' },
});
