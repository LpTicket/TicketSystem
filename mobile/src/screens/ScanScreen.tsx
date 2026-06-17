import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GradientButton } from '../components/GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser, apiGet, apiPost, getImageUrl } from '../services/api';

type Props = { onBack: () => void; user?: AuthUser | null };

type ScanState = 'idle' | 'scanning' | 'validating' | 'approved' | 'denied';

type TicketResult = {
  ticketCode?: string;
  status?: string;
  sectionName?: string | null;
  rowLabel?: string | null;
  seatNumber?: number | null;
  seatLabel?: string | null;
  event?: { title?: string; venueName?: string } | null;
  user?: { firstName?: string; lastName?: string; email?: string } | null;
};

type EventStats = {
  totalPurchased?: number;
  totalIssued?: number;
  ticketsToScan?: number;
  ticketsEntered?: number;
  totalCapacity?: number;
};

type ValidateResult = {
  valid: boolean;
  message?: string;
  ticket?: TicketResult;
  eventStats?: EventStats;
};

type MyEvent = {
  id: string;
  title: string;
  eventDate?: string | null;
  status?: string | null;
  imageUrl?: string | null;
  bannerImageUrl?: string | null;
};

type RecentScan = {
  id: string;
  valid: boolean;
  name: string;
  location: string;
  code: string;
  time: string;
};

function listFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.events || payload?.items || [];
}

function isActiveEvent(eventDate?: string | null) {
  if (!eventDate) return true;
  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return true;
  const eventDay = new Date(date);
  eventDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return eventDay.getTime() >= today.getTime();
}

function eventDateBadge(eventDate?: string | null) {
  if (!eventDate) return null;
  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: String(date.getDate()),
    month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
  };
}

function eventTime(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

export function ScanScreen({ onBack: _onBack, user }: Props) {
  const { t } = useLanguage();
  const [permission, requestPermission] = useCameraPermissions();

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<ValidateResult | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [sessionStats, setSessionStats] = useState({ total: 0, approved: 0, denied: 0 });

  // Event selector + server stats
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastQrCode = useRef<string>('');
  const scanAnim = useRef(new Animated.Value(0)).current;

  const selectedEventTitle = myEvents.find((e) => e.id === selectedEventId)?.title ?? null;

  useEffect(() => {
    if (!user) return;
    apiGet<any>('/events/mine/list')
      .then((data) => {
        const filtered = listFrom(data)
          .filter((e) => (e.status || 'published') === 'published')
          .filter((e) => isActiveEvent(e.eventDate))
          .sort((a, b) => eventTime(a.eventDate) - eventTime(b.eventDate))
          .map((e) => ({
            id: String(e.id),
            title: e.title || t('Evento', 'Event'),
            eventDate: e.eventDate,
            status: e.status,
            imageUrl: getImageUrl(e.imageUrl || e.bannerImageUrl),
            bannerImageUrl: getImageUrl(e.bannerImageUrl || e.imageUrl),
          }));
        setMyEvents(filtered);
        setSelectedEventId((current) => (
          current && filtered.some((event) => event.id === current)
            ? current
            : filtered[0]?.id || null
        ));
      })
      .catch(() => {});
  }, [t, user]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setEventStats(null);
    if (!selectedEventId) return;
    const fetchStats = () =>
      apiGet<EventStats>(`/orders/event/${selectedEventId}/scanner-stats`)
        .then(setEventStats).catch(() => {});
    fetchStats();
    pollRef.current = setInterval(fetchStats, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedEventId]);

  useEffect(() => {
    if (scanState !== 'scanning') { scanAnim.stopAnimation(); scanAnim.setValue(0); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scanAnim, scanState]);

  const scanTranslateY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 218] });

  const registerScan = useCallback((result: ValidateResult, code: string) => {
    setSessionStats((prev) => ({
      total: prev.total + 1,
      approved: prev.approved + (result.valid ? 1 : 0),
      denied: prev.denied + (result.valid ? 0 : 1),
    }));
    const u = result.ticket?.user;
    const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || t('Visitante', 'Guest');
    const tk = result.ticket;
    const seatParts = [tk?.sectionName, tk?.rowLabel, tk?.seatNumber].filter(Boolean);
    const location = tk?.seatLabel || (seatParts.length ? seatParts.join(' · ') : 'General');
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    setRecentScans((prev) =>
      [{ id: String(Date.now()), valid: result.valid, name, location, code: tk?.ticketCode || code, time }, ...prev].slice(0, 10)
    );
  }, [t]);

  const validateCode = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setScanState('validating');
    setScanResult(null);
    try {
      const res = await apiPost<ValidateResult>(`/orders/ticket/${clean}/validate`, {});
      setScanResult(res);
      if (res.eventStats) setEventStats(res.eventStats);
      registerScan(res, clean);
      setScanState(res.valid ? 'approved' : 'denied');
    } catch (err: any) {
      const res: ValidateResult = { valid: false, message: err?.message };
      setScanResult(res);
      registerScan(res, clean);
      setScanState('denied');
    }
  }, [registerScan]);

  const resetScanner = () => {
    setManualCode('');
    setScanResult(null);
    lastQrCode.current = '';
    setScanState('idle');
  };

  const handleQrScanned = useCallback(({ data }: { data: string }) => {
    if (scanState !== 'scanning') return;
    let code = data.trim();
    if (data.includes('/verify/')) {
      const parts = data.split('/verify/');
      code = parts[parts.length - 1].trim();
    }
    const clean = code.toUpperCase();
    if (clean === lastQrCode.current) return;
    lastQrCode.current = clean;
    validateCode(clean);
  }, [scanState, validateCode]);

  const startScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    lastQrCode.current = '';
    setScanResult(null);
    setScanState('scanning');
  };

  const isApproved = scanState === 'approved';
  const isDenied = scanState === 'denied';
  const showIdle = !isApproved && !isDenied && scanState !== 'validating';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

      {/* ── Top row: EVENT MODE + SOUND ── */}
      <View style={styles.topRow}>
        <View style={styles.eventModeBadge}>
          <Ionicons name="qr-code-outline" size={14} color="#F97316" />
          <Text style={styles.eventModeText}>{t('MODO EVENTO', 'EVENT MODE')}</Text>
        </View>
        <TouchableOpacity onPress={() => setSoundEnabled((v) => !v)} style={[styles.soundChip, soundEnabled && styles.soundChipActive]}>
          <Text style={[styles.soundChipText, soundEnabled && styles.soundChipTextActive]}>
            {soundEnabled ? t('SONIDO', 'SOUND') : t('SILENCIO', 'MUTED')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Title ── */}
      <Text style={styles.title}>{t('Scanner de puerta', 'Door scanner')}</Text>
      <Text style={styles.subtitle}>
        {t('Validación rápida con cámara, vibración, sonido y conteo en vivo.', 'Fast validation with camera, vibration, sound and live counts.')}
      </Text>

      {/* Event selector */}
      {myEvents.length > 0 && (
        <View style={styles.selectorCard}>
          <View style={styles.selectorHeader}>
            <View>
              <Text style={styles.selectorLabel}>{t('EVENTO', 'EVENT')}</Text>
              <Text style={styles.selectorTitle}>{t('Eventos activos', 'Active events')}</Text>
            </View>
            <Ionicons name="albums-outline" size={20} color="#F97316" />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorScroll}>
            {myEvents.map((ev) => {
              const badge = eventDateBadge(ev.eventDate);
              return (
                <TouchableOpacity
                  key={ev.id}
                  activeOpacity={0.88}
                  style={[styles.eventPickerItem, selectedEventId === ev.id && styles.eventPickerItemActive]}
                  onPress={() => setSelectedEventId(ev.id)}
                >
                  <View style={styles.eventThumb}>
                    {ev.imageUrl || ev.bannerImageUrl ? (
                      <Image source={{ uri: ev.imageUrl || ev.bannerImageUrl || '' }} style={styles.eventThumbImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.eventThumbFallback}>
                        <Ionicons name="ticket-outline" size={21} color="#F97316" />
                      </View>
                    )}
                    {selectedEventId === ev.id && (
                      <View style={styles.selectedCheck}>
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.eventPickerMetaRow}>
                    <Text style={[styles.eventPickerText, selectedEventId === ev.id && styles.eventPickerTextActive]} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    {badge && (
                      <View style={[styles.eventDateBadge, selectedEventId === ev.id && styles.eventDateBadgeActive]}>
                        <Text style={styles.eventDateDay}>{badge.day}</Text>
                        <Text style={styles.eventDateMonth}>{badge.month}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Camera / scan box */}
      {showIdle && (
        <View style={styles.scannerCard}>
          {scanState === 'scanning' ? (
            Platform.OS === 'web' ? (
              <View style={styles.cameraFrame}>
                <View style={styles.cameraNoise} />
                <View style={styles.scanBox} />
                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
                <TouchableOpacity style={styles.stopButton} onPress={resetScanner}>
                  <Text style={styles.stopText}>{t('DETENER', 'STOP')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cameraFrame}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleQrScanned}
                />
                <View pointerEvents="none" style={styles.scanBox} />
                <Animated.View pointerEvents="none" style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
                <TouchableOpacity style={styles.stopButton} onPress={resetScanner}>
                  <Text style={styles.stopText}>{t('DETENER', 'STOP')}</Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <View style={styles.startPanel}>
              <View style={styles.scanHeroIcon}>
                <View style={styles.scanHeroGlow} />
                <View style={styles.scanCornerTL} />
                <View style={styles.scanCornerTR} />
                <View style={styles.scanCornerBL} />
                <View style={styles.scanCornerBR} />
                <Ionicons name="scan-outline" size={38} color="#FFFFFF" />
                <View style={styles.qrDotRow}>
                  <View style={styles.qrDot} />
                  <View style={styles.qrDotSmall} />
                  <View style={styles.qrDot} />
                </View>
              </View>
              <Text style={styles.startTitle}>{t('Listo para validar', 'Ready to validate')}</Text>
              <Text style={styles.startCopy}>{t('Escanea el QR del ticket en la puerta.', 'Scan the ticket QR at the door.')}</Text>
              <GradientButton onPress={startScanner} height={58} style={styles.startScanButton}>
                <View style={styles.startButtonContent}>
                  <Text style={styles.startButtonText}>{t('INICIAR SCANNER', 'START SCANNER')}</Text>
                  <View style={styles.startArrow}>
                    <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                  </View>
                </View>
              </GradientButton>
              {!permission?.granted && Platform.OS !== 'web' && (
                <Text style={styles.permNote}>{t('Se necesita permiso de cámara', 'Camera permission required')}</Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Validating spinner ── */}
      {scanState === 'validating' && (
        <View style={styles.statusCard}>
          <View style={styles.spinner} />
          <Text style={styles.statusEyebrow}>{t('VERIFICANDO ENTRADA...', 'VERIFYING TICKET...')}</Text>
        </View>
      )}

      {/* ── Result card ── */}
      {(isApproved || isDenied) && (
        <View style={[styles.validationCard, isApproved ? styles.approvedCard : styles.deniedCard]}>
          <View style={[styles.validationIcon, isApproved ? styles.approvedIcon : styles.deniedIcon]}>
            <Text style={styles.validationIconText}>{isApproved ? '✓' : '×'}</Text>
          </View>
          <Text style={styles.validationLabel}>{isApproved ? t('APROBADO', 'APPROVED') : t('DENEGADO', 'DENIED')}</Text>
          <Text style={styles.validationTitle}>
            {isApproved ? t('Entrada confirmada', 'Entry confirmed') : t('Boleto inválido', 'Invalid ticket')}
          </Text>
          <Text style={styles.validationCopy}>
            {scanResult?.message || (isApproved
              ? t('Ticket válido. Puedes permitir el acceso.', 'Valid ticket. You can allow entry.')
              : t('Código no encontrado, usado o inválido.', 'Code not found, used or invalid.'))}
          </Text>
          <View style={styles.ticketDetails}>
            <Detail label={t('EVENTO', 'EVENT')} value={scanResult?.ticket?.event?.title || t('Evento', 'Event')} featured />
            <View style={styles.detailGrid}>
              <Detail label={t('ASISTENTE', 'ATTENDEE')} value={[scanResult?.ticket?.user?.firstName, scanResult?.ticket?.user?.lastName].filter(Boolean).join(' ') || scanResult?.ticket?.user?.email || '-'} />
              <Detail label={t('UBICACIÓN', 'LOCATION')} value={scanResult?.ticket?.seatLabel || [scanResult?.ticket?.sectionName, scanResult?.ticket?.rowLabel, scanResult?.ticket?.seatNumber].filter(Boolean).join(' · ') || 'General'} />
              <Detail label={t('ESTADO', 'STATUS')} value={scanResult?.message || (isApproved ? t('Válido', 'Valid') : t('Inválido', 'Invalid'))} />
              <Detail label={t('CÓDIGO', 'CODE')} value={scanResult?.ticket?.ticketCode || manualCode} orange />
            </View>
          </View>
          <TouchableOpacity style={styles.nextButton} onPress={resetScanner}>
            <Text style={styles.nextButtonText}>{t('VALIDAR SIGUIENTE', 'VALIDATE NEXT')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Manual code input ── */}
      {showIdle && (
        <View style={styles.manualSection}>
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{t('CÓDIGO MANUAL', 'MANUAL CODE')}</Text>
            <View style={styles.separatorLine} />
          </View>
          <View style={styles.inputShell}>
            <Ionicons name="search-outline" size={18} color="rgba(148,163,184,0.8)" />
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder={t('Código del ticket', 'Ticket code')}
              placeholderTextColor="rgba(148,163,184,0.60)"
              autoCapitalize="characters"
              style={styles.input}
              onSubmitEditing={() => validateCode(manualCode)}
            />
          </View>
          <TouchableOpacity style={styles.validateBtn} onPress={() => validateCode(manualCode)}>
            <Text style={styles.validateBtnText}>{t('VALIDAR CÓDIGO', 'VALIDATE CODE')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Event selector (dropdown) ── */}
      {myEvents.length > 0 && (
        <View style={styles.eventSection}>
          <Text style={styles.eventEyebrow}>{t('EVENTO', 'EVENT')}</Text>
          <TouchableOpacity
            style={styles.eventDropdown}
            onPress={() => setDropdownOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.eventDropdownText, !selectedEventTitle && styles.eventDropdownPlaceholder]} numberOfLines={1}>
              {selectedEventTitle || t('— Seleccionar evento —', '— Select event —')}
            </Text>
            <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(148,163,184,0.8)" />
          </TouchableOpacity>
          {dropdownOpen && (
            <View style={styles.dropdownList}>
              <TouchableOpacity
                style={[styles.dropdownItem, !selectedEventId && styles.dropdownItemActive]}
                onPress={() => { setSelectedEventId(null); setDropdownOpen(false); }}
              >
                <Text style={[styles.dropdownItemText, !selectedEventId && styles.dropdownItemTextActive]}>
                  {t('— Todos los eventos —', '— All events —')}
                </Text>
              </TouchableOpacity>
              {myEvents.map((ev) => (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.dropdownItem, selectedEventId === ev.id && styles.dropdownItemActive]}
                  onPress={() => { setSelectedEventId(ev.id); setDropdownOpen(false); }}
                >
                  <Text style={[styles.dropdownItemText, selectedEventId === ev.id && styles.dropdownItemTextActive]} numberOfLines={1}>
                    {ev.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {/* Server stats inline when event selected */}
          {eventStats && selectedEventId && (
            <View style={styles.serverStats}>
              <ServerStat label={t('EMITIDOS', 'ISSUED')} value={String(eventStats.totalIssued ?? eventStats.totalPurchased ?? '—')} />
              <ServerStat label={t('INGRESARON', 'ENTERED')} value={String(eventStats.ticketsEntered ?? '—')} tone="green" />
              <ServerStat label={t('POR ESCANEAR', 'REMAINING')} value={String(eventStats.ticketsToScan ?? '—')} tone="orange" />
            </View>
          )}
        </View>
      )}

      {/* ── Live count (session stats) ── */}
      <View style={styles.liveSection}>
        <View style={styles.liveSectionHeader}>
          <View>
            <Text style={styles.liveEyebrow}>{t('CONTEO EN VIVO', 'LIVE COUNT')}</Text>
            <Text style={styles.liveTitle}>{t('Operación de puerta', 'Door operation')}</Text>
          </View>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => setSessionStats({ total: 0, approved: 0, denied: 0 })}
          >
            <Ionicons name="refresh-outline" size={13} color="#CBD5E1" />
            <Text style={styles.resetBtnText}>{t('RESET', 'RESET')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sessionGrid}>
          <SessionStat label={t('TOTAL', 'TOTAL')} value={String(sessionStats.total)} />
          <SessionStat label={t('APROBADOS', 'APPROVED')} value={String(sessionStats.approved)} tone="green" />
          <SessionStat label={t('DENEGADOS', 'DENIED')} value={String(sessionStats.denied)} tone="red" />
        </View>
      </View>

      {/* ── Last scanned ── */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>{t('Últimos escaneados', 'Last scanned')}</Text>
          <Ionicons name="time-outline" size={20} color="#F97316" />
        </View>
        {recentScans.length === 0 ? (
          <View style={styles.recentEmpty}>
            <Ionicons name="ticket-outline" size={36} color="rgba(148,163,184,0.3)" style={{ marginBottom: 10 }} />
            <Text style={styles.recentEmptyText}>{t('Todavía no hay escaneos en esta sesión.', 'No scans in this session yet.')}</Text>
          </View>
        ) : (
          recentScans.map((scan) => (
            <View key={scan.id} style={[styles.recentItem, scan.valid ? styles.recentValid : styles.recentInvalid]}>
              <View style={styles.recentLeft}>
                <View style={[styles.recentMark, scan.valid ? styles.recentMarkValid : styles.recentMarkInvalid]}>
                  <Text style={styles.recentMarkText}>{scan.valid ? '✓' : '×'}</Text>
                </View>
                <View style={styles.recentCopy}>
                  <Text style={styles.recentName}>{scan.name}</Text>
                  <Text style={styles.recentMeta}>{scan.location} · {scan.code}</Text>
                </View>
              </View>
              <Text style={styles.recentTime}>{scan.time}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

function Detail({ label, value, featured, orange }: { label: string; value: string; featured?: boolean; orange?: boolean }) {
  return (
    <View style={[styles.detail, featured && styles.detailFeatured]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, featured && styles.detailValueFeatured, orange && styles.detailValueOrange]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function SessionStat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) {
  return (
    <View style={[styles.sessionCard, tone === 'green' && styles.sessionGreen, tone === 'red' && styles.sessionRed]}>
      <Text style={[styles.sessionLabel, tone === 'green' && styles.sessionLabelGreen, tone === 'red' && styles.sessionLabelRed]}>{label}</Text>
      <Text style={[styles.sessionValue, tone === 'green' && styles.sessionValueGreen, tone === 'red' && styles.sessionValueRed]}>{value}</Text>
    </View>
  );
}

function ServerStat({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'orange' }) {
  return (
    <View style={styles.serverStatItem}>
      <Text style={[styles.serverStatLabel, tone === 'green' && { color: '#34D399' }, tone === 'orange' && { color: '#F97316' }]}>{label}</Text>
      <Text style={[styles.serverStatValue, tone === 'green' && { color: '#34D399' }, tone === 'orange' && { color: '#F97316' }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 132 },

  // Top row
  topRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  eventModeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 38, borderRadius: 14, paddingHorizontal: 14,
    backgroundColor: 'rgba(3,11,20,0.92)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  eventModeText: { color: '#F8FAFC', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  soundChip: {
    height: 38, borderRadius: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  soundChipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  soundChipText: { color: 'rgba(226,232,240,0.7)', fontSize: 12, fontWeight: '800' },
  soundChipTextActive: { color: '#FFFFFF' },

  // Title
  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 34, fontWeight: '700', marginTop: 14 },
  subtitle: { color: 'rgba(226,232,240,0.6)', fontSize: 13, lineHeight: 20, marginTop: 6, marginBottom: 2 },

  selectorCard: { marginTop: 14, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.74)', padding: 12, overflow: 'hidden' },
  selectorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  selectorLabel: { color: '#F97316', fontSize: 10, fontWeight: '700' },
  selectorTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginTop: 3 },
  selectorScroll: { flexDirection: 'row' },
  eventPickerItem: { width: 118, minHeight: 122, marginRight: 10, padding: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(2,6,23,0.84)', alignItems: 'center' },
  eventPickerItemActive: { borderColor: 'rgba(249,115,22,0.72)', backgroundColor: 'rgba(249,115,22,0.12)', shadowColor: '#F97316', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  eventThumb: { width: '100%', height: 68, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  eventThumbImage: { width: '100%', height: '100%' },
  eventThumbFallback: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  selectedCheck: { position: 'absolute', right: 5, top: 5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#F97316', borderWidth: 1, borderColor: 'rgba(255,255,255,0.64)', alignItems: 'center', justifyContent: 'center' },
  eventPickerMetaRow: { width: '100%', minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  eventPickerText: { flex: 1, minWidth: 0, color: 'rgba(226,232,240,0.72)', fontSize: 11, lineHeight: 14, fontWeight: '700', textAlign: 'left' },
  eventPickerTextActive: { color: '#FFFFFF' },
  eventDateBadge: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)', backgroundColor: 'rgba(249,115,22,0.10)', alignItems: 'center', justifyContent: 'center' },
  eventDateBadgeActive: { borderColor: 'rgba(249,115,22,0.72)', backgroundColor: 'rgba(249,115,22,0.20)' },
  eventDateDay: { color: '#FFFFFF', fontSize: 13, lineHeight: 15, fontWeight: '700' },
  eventDateMonth: { color: '#FB923C', fontSize: 8, lineHeight: 9, fontWeight: '700' },

  scannerCard: { marginTop: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', overflow: 'hidden' },
  startPanel: { minHeight: 282, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(255,255,255,0.025)' },
  scanHeroIcon: { width: 92, height: 92, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.42)', marginBottom: 14, shadowColor: '#F97316', shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  scanHeroGlow: { position: 'absolute', left: 12, right: 12, top: 12, bottom: 12, borderRadius: 22, backgroundColor: 'rgba(249,115,22,0.12)' },
  scanCornerTL: { position: 'absolute', left: 15, top: 15, width: 18, height: 18, borderLeftWidth: 2, borderTopWidth: 2, borderColor: '#FB923C', borderTopLeftRadius: 5 },
  scanCornerTR: { position: 'absolute', right: 15, top: 15, width: 18, height: 18, borderRightWidth: 2, borderTopWidth: 2, borderColor: '#FB923C', borderTopRightRadius: 5 },
  scanCornerBL: { position: 'absolute', left: 15, bottom: 15, width: 18, height: 18, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: '#FB923C', borderBottomLeftRadius: 5 },
  scanCornerBR: { position: 'absolute', right: 15, bottom: 15, width: 18, height: 18, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#FB923C', borderBottomRightRadius: 5 },
  qrDotRow: { position: 'absolute', bottom: 22, flexDirection: 'row', gap: 4, alignItems: 'center' },
  qrDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#F97316' },
  qrDotSmall: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: 'rgba(255,255,255,0.72)' },
  startTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginTop: 4, textAlign: 'center' },
  startCopy: { color: 'rgba(226,232,240,0.56)', fontSize: 12, lineHeight: 18, fontWeight: '400', marginTop: 6, marginBottom: 18, textAlign: 'center' },
  cameraFrame: { height: 300, backgroundColor: '#020617', overflow: 'hidden' },
  cameraNoise: { position: 'absolute', inset: 0, backgroundColor: 'rgba(15,23,42,0.3)' },
  scanBox: { position: 'absolute', left: 28, right: 28, top: 28, bottom: 44, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(249,115,22,0.82)' },
  scanLine: { position: 'absolute', left: 36, right: 36, top: 0, height: 2, backgroundColor: '#F97316' },
  stopButton: { position: 'absolute', bottom: 14, alignSelf: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 18, paddingVertical: 10 },
  stopText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  permNote: { color: 'rgba(226,232,240,0.52)', fontSize: 11, fontWeight: '400', marginTop: 10, textAlign: 'center' },

  orangeButton: { minHeight: 56, borderRadius: 16, backgroundColor: '#F97316', paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', elevation: 5 },
  orangeTopLine: { position: 'absolute', top: 4, left: 14, right: 14, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.24)' },
  orangeBottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%', backgroundColor: 'rgba(154,52,18,0.18)' },
  orangeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', zIndex: 2 },
  startScanButton: { alignSelf: 'stretch', borderRadius: 18 },
  startButtonContent: { width: '100%', paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.24)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  startArrow: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' },

  // Validating
  statusCard: { marginTop: 16, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  spinner: { width: 44, height: 44, borderRadius: 22, borderWidth: 4, borderColor: '#F97316', borderTopColor: 'transparent' },
  statusEyebrow: { color: 'rgba(226,232,240,0.55)', fontSize: 11, fontWeight: '700' },

  // Validation result
  validationCard: { marginTop: 18, borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center' },
  approvedCard: { borderColor: 'rgba(16,185,129,0.38)', backgroundColor: 'rgba(16,185,129,0.08)' },
  deniedCard: { borderColor: 'rgba(239,68,68,0.38)', backgroundColor: 'rgba(239,68,68,0.08)' },
  validationIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  approvedIcon: { backgroundColor: '#10B981' },
  deniedIcon: { backgroundColor: '#EF4444' },
  validationIconText: { color: '#FFFFFF', fontSize: 42, fontWeight: '700', lineHeight: 46 },
  validationLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  validationTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  validationCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  ticketDetails: { alignSelf: 'stretch', marginTop: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', padding: 14 },
  detail: { flex: 1, minWidth: 0, paddingVertical: 5 },
  detailFeatured: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)', marginBottom: 8, paddingBottom: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  detailValue: { color: '#E2E8F0', fontSize: 12, fontWeight: '600', marginTop: 3 },
  detailValueFeatured: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  detailValueOrange: { color: '#F97316', fontWeight: '700' },
  nextButton: { alignSelf: 'stretch', height: 50, borderRadius: 16, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  nextButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Manual code
  manualSection: { marginTop: 18, gap: 12 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  separatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(226,232,240,0.10)' },
  separatorText: { color: 'rgba(226,232,240,0.44)', fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  inputShell: {
    height: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10,
  },
  input: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700', outlineStyle: 'none' as any },
  validateBtn: {
    minHeight: 56, borderRadius: 16, backgroundColor: '#030B14',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center',
  },
  validateBtnText: { color: '#F97316', fontSize: 12, fontWeight: '700' },

  // Event dropdown
  eventSection: { marginTop: 22 },
  eventEyebrow: { color: '#F97316', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  eventDropdown: {
    height: 52, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, justifyContent: 'space-between',
  },
  eventDropdownText: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  eventDropdownPlaceholder: { color: 'rgba(148,163,184,0.7)', fontWeight: '400' },
  dropdownList: { marginTop: 6, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', overflow: 'hidden' },
  dropdownItem: { height: 46, paddingHorizontal: 16, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dropdownItemActive: { backgroundColor: 'rgba(249,115,22,0.12)' },
  dropdownItemText: { color: 'rgba(226,232,240,0.8)', fontSize: 13, fontWeight: '600' },
  dropdownItemTextActive: { color: '#F97316', fontWeight: '700' },
  serverStats: {
    flexDirection: 'row', gap: 8, marginTop: 10,
  },
  serverStatItem: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.025)', padding: 12,
  },
  serverStatLabel: { color: 'rgba(148,163,184,0.8)', fontSize: 9, fontWeight: '700', letterSpacing: 0.5, marginBottom: 4 },
  serverStatValue: { color: '#F8FAFC', fontSize: 20, fontWeight: '800' },

  // Live count
  liveSection: { marginTop: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  liveSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  liveEyebrow: { color: '#F97316', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  liveTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginTop: 4 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 12, paddingVertical: 8 },
  resetBtnText: { color: '#CBD5E1', fontSize: 10, fontWeight: '800' },
  sessionGrid: { flexDirection: 'row', gap: 10, marginTop: 14 },
  sessionCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  sessionGreen: { borderColor: 'rgba(16,185,129,0.32)', backgroundColor: 'rgba(16,185,129,0.10)' },
  sessionRed: { borderColor: 'rgba(239,68,68,0.28)', backgroundColor: 'rgba(239,68,68,0.10)' },
  sessionLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  sessionLabelGreen: { color: 'rgba(52,211,153,0.9)' },
  sessionLabelRed: { color: 'rgba(252,165,165,0.9)' },
  sessionValue: { color: '#F8FAFC', fontSize: 28, fontWeight: '700', marginTop: 6 },
  sessionValueGreen: { color: '#34D399' },
  sessionValueRed: { color: '#F87171' },

  // Last scanned
  recentSection: { marginTop: 22 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recentTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  recentEmpty: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderStyle: 'dashed', backgroundColor: 'rgba(255,255,255,0.012)',
    paddingVertical: 36, alignItems: 'center',
  },
  recentEmptyText: { color: 'rgba(226,232,240,0.44)', fontSize: 13 },
  recentItem: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  recentValid: { borderColor: 'rgba(16,185,129,0.28)', backgroundColor: 'rgba(16,185,129,0.08)' },
  recentInvalid: { borderColor: 'rgba(239,68,68,0.24)', backgroundColor: 'rgba(239,68,68,0.08)' },
  recentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentMark: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recentMarkValid: { backgroundColor: '#10B981' },
  recentMarkInvalid: { backgroundColor: '#EF4444' },
  recentMarkText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 15 },
  recentCopy: { flex: 1, minWidth: 0 },
  recentName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  recentMeta: { color: 'rgba(226,232,240,0.5)', fontSize: 11, marginTop: 2 },
  recentTime: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' },
});
