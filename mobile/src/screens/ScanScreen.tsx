import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GradientButton } from '../components/GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser, apiGet, apiPost, getImageUrl } from '../services/api';

type Props = {
  onBack: () => void;
  user?: AuthUser | null;
};

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

  // Session counters (local, like web)
  const [sessionStats, setSessionStats] = useState({ total: 0, approved: 0, denied: 0 });

  // Event selector + server stats
  const [myEvents, setMyEvents] = useState<MyEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // QR de-dup: ignore the same code twice in a row
  const lastQrCode = useRef<string>('');

  const scanAnim = useRef(new Animated.Value(0)).current;

  // Load organizer's events
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

  // Poll scanner stats for selected event
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setEventStats(null);
    if (!selectedEventId) return;

    const fetchStats = () =>
      apiGet<EventStats>(`/orders/event/${selectedEventId}/scanner-stats`)
        .then(setEventStats)
        .catch(() => {});

    fetchStats();
    pollRef.current = setInterval(fetchStats, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedEventId]);

  // Scan line animation
  useEffect(() => {
    if (scanState !== 'scanning') {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
      return;
    }
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
  const showManual = !isApproved && !isDenied && scanState !== 'validating';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View pointerEvents="none" style={styles.bgGridA} />
      <View pointerEvents="none" style={styles.bgGridB} />

      {/* Header */}
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>▣</Text>
          <Text style={styles.badgeText}>{t('MODO EVENTO', 'EVENT MODE')}</Text>
        </View>
        <TouchableOpacity onPress={() => setSoundEnabled((v) => !v)} style={[styles.chip, soundEnabled && styles.chipActive]}>
          <Text style={[styles.chipText, soundEnabled && styles.chipTextActive]}>
            {soundEnabled ? t('SONIDO', 'SOUND') : t('SILENCIO', 'MUTED')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('Scanner de puerta', 'Door scanner')}</Text>
      <Text style={styles.subtitle}>
        {t('Validación rápida con cámara, sonido y conteo en vivo.', 'Fast validation with camera, sound and live counts.')}
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
      {showManual && (
        <View style={styles.scannerCard}>
          {scanState === 'scanning' ? (
            Platform.OS === 'web' ? (
              // Web: fake scanner UI (no camera API in web RN)
              <View style={styles.cameraFrame}>
                <View style={styles.cameraNoise} />
                <View style={styles.scanBox} />
                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
                <TouchableOpacity style={styles.stopButton} onPress={resetScanner}>
                  <Text style={styles.stopText}>{t('DETENER CÁMARA', 'STOP CAMERA')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // Native: real QR camera
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
                  <Text style={styles.stopText}>{t('DETENER CÁMARA', 'STOP CAMERA')}</Text>
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

      {/* Validating spinner */}
      {scanState === 'validating' && (
        <View style={styles.statusCard}>
          <View style={styles.spinner} />
          <Text style={styles.statusEyebrow}>{t('VERIFICANDO ENTRADA...', 'VERIFYING TICKET...')}</Text>
        </View>
      )}

      {/* Result card */}
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
              <Detail
                label={t('ASISTENTE', 'ATTENDEE')}
                value={[scanResult?.ticket?.user?.firstName, scanResult?.ticket?.user?.lastName].filter(Boolean).join(' ') || scanResult?.ticket?.user?.email || '-'}
              />
              <Detail
                label={t('UBICACIÓN', 'LOCATION')}
                value={scanResult?.ticket?.seatLabel || [scanResult?.ticket?.sectionName, scanResult?.ticket?.rowLabel, scanResult?.ticket?.seatNumber].filter(Boolean).join(' · ') || 'General'}
              />
              <Detail
                label={t('ESTADO', 'STATUS')}
                value={scanResult?.message || (isApproved ? t('Válido', 'Valid') : t('Inválido', 'Invalid'))}
              />
              <Detail label={t('CÓDIGO', 'CODE')} value={scanResult?.ticket?.ticketCode || manualCode} orange />
            </View>
          </View>

          {scanResult?.eventStats && (
            <View style={styles.miniStats}>
              <MiniStat label={t('EMITIDAS', 'ISSUED')} value={String(scanResult.eventStats.totalIssued ?? scanResult.eventStats.totalPurchased ?? '—')} />
              <MiniStat label={t('POR ESCANEAR', 'LEFT')} value={String(scanResult.eventStats.ticketsToScan ?? '—')} orange />
            </View>
          )}

          <TouchableOpacity style={styles.nextButton} onPress={resetScanner}>
            <Text style={styles.nextButtonText}>{t('VALIDAR SIGUIENTE', 'VALIDATE NEXT')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual code input */}
      {showManual && (
        <View style={styles.manualSection}>
          <View style={styles.separator}>
            <View style={styles.separatorLine} />
            <Text style={styles.separatorText}>{t('CÓDIGO MANUAL', 'MANUAL CODE')}</Text>
            <View style={styles.separatorLine} />
          </View>
          <View style={styles.inputShell}>
            <Text style={styles.inputIcon}>⌕</Text>
            <TextInput
              value={manualCode}
              onChangeText={setManualCode}
              placeholder={t('Código del ticket', 'Ticket code')}
              placeholderTextColor="rgba(148,163,184,0.70)"
              autoCapitalize="characters"
              style={styles.input}
              onSubmitEditing={() => validateCode(manualCode)}
            />
          </View>
          <TouchableOpacity style={styles.blueButton} onPress={() => validateCode(manualCode)}>
            <Text style={styles.blueButtonText}>{t('VALIDAR CÓDIGO', 'VALIDATE CODE')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Server event stats (from backend poll) */}
      {eventStats && (
        <View style={styles.statsPanel}>
          <View style={styles.statsHeader}>
            <View>
              <Text style={styles.statsEyebrow}>{t('ESTADÍSTICAS DEL EVENTO', 'EVENT STATS')}</Text>
              <Text style={styles.statsTitle}>{t('Conteo del servidor', 'Server count')}</Text>
            </View>
          </View>
          <View style={styles.statGrid}>
            <Stat label={t('ENTRADAS EMITIDAS', 'ISSUED TICKETS')} value={String(eventStats.totalIssued ?? eventStats.totalPurchased ?? '—')} tone="blue" />
            <Stat label={t('POR ESCANEAR', 'LEFT TO SCAN')} value={String(eventStats.ticketsToScan ?? '—')} tone="orange" />
            <Stat label={t('YA INGRESARON', 'ALREADY ENTERED')} value={String(eventStats.ticketsEntered ?? '—')} tone="green" />
          </View>
          {eventStats.totalCapacity != null && eventStats.totalCapacity > 0 && (
            <View style={styles.capacityCard}>
              <View>
                <Text style={styles.capacityLabel}>{t('CAPACIDAD DEL LUGAR', 'VENUE CAPACITY')}</Text>
                <Text style={styles.capacityValue}>{eventStats.totalCapacity}</Text>
              </View>
              <Text style={styles.capacityPercent}>
                {eventStats.ticketsEntered != null
                  ? `${Math.round((eventStats.ticketsEntered / eventStats.totalCapacity) * 100)}%`
                  : '—'}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Session stats */}
      <View style={styles.statsPanel}>
        <View style={styles.statsHeader}>
          <View>
            <Text style={styles.statsEyebrow}>{t('CONTEO EN VIVO', 'LIVE COUNT')}</Text>
            <Text style={styles.statsTitle}>{t('Operación de puerta', 'Door operation')}</Text>
          </View>
          <TouchableOpacity style={styles.resetButton} onPress={() => setSessionStats({ total: 0, approved: 0, denied: 0 })}>
            <Text style={styles.resetText}>{t('REINICIAR', 'RESET')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sessionGrid}>
          <SessionStat label={t('TOTAL', 'TOTAL')} value={String(sessionStats.total)} />
          <SessionStat label={t('APROBADOS', 'APPROVED')} value={String(sessionStats.approved)} tone="green" />
          <SessionStat label={t('DENEGADOS', 'DENIED')} value={String(sessionStats.denied)} tone="red" />
        </View>
      </View>

      {/* Recent scans */}
      <View style={styles.recentPanel}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>{t('Últimos escaneados', 'Last scanned')}</Text>
          <Text style={styles.recentClock}>◷</Text>
        </View>
        {recentScans.length === 0 ? (
          <View style={styles.recentEmpty}>
            <Text style={styles.recentEmptyText}>{t('Todavía no hay escaneos en esta sesión.', 'No scans in this session yet.')}</Text>
          </View>
        ) : (
          recentScans.map((scan) => (
            <View key={scan.id} style={[styles.recentItem, scan.valid ? styles.recentValid : styles.recentInvalid]}>
              <View style={styles.recentLeft}>
                <Text style={[styles.recentMark, scan.valid ? styles.recentMarkValid : styles.recentMarkInvalid]}>
                  {scan.valid ? '✓' : '×'}
                </Text>
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
      <Text style={[styles.detailValue, featured && styles.detailValueFeatured, orange && styles.detailValueOrange]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function MiniStat({ label, value, orange }: { label: string; value: string; orange?: boolean }) {
  return (
    <View style={styles.miniStatItem}>
      <Text style={styles.miniStatLabel}>{label}</Text>
      <Text style={[styles.miniStatValue, orange && styles.miniStatValueOrange]}>{value}</Text>
    </View>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'orange' | 'green' }) {
  return (
    <View style={[styles.statCard, tone === 'orange' && styles.statOrange, tone === 'green' && styles.statGreen]}>
      <Text style={[styles.statLabel, tone === 'orange' && styles.statLabelOrange, tone === 'green' && styles.statLabelGreen]}>{label}</Text>
      <Text style={[styles.statValue, tone === 'orange' && styles.statValueOrange, tone === 'green' && styles.statValueGreen]}>{value}</Text>
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 132 },
  bgGridA: { position: 'absolute', left: '28%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(125,211,252,0.035)' },
  bgGridB: { position: 'absolute', left: 0, right: 0, top: 220, height: 1, backgroundColor: 'rgba(125,211,252,0.030)' },

  topRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { height: 36, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030B14' },
  chipActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  chipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#FFFFFF' },

  badge: { height: 36, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeIcon: { color: '#F97316', fontSize: 14, fontWeight: '700' },
  badgeText: { color: '#F8FAFC', fontSize: 11, fontWeight: '700' },

  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 34, fontWeight: '700', marginTop: 14 },
  subtitle: { color: 'rgba(226,232,240,0.64)', fontSize: 13, lineHeight: 20, fontWeight: '400', marginTop: 8 },

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
  cameraNoise: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)' },
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

  statusCard: { marginTop: 16, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  spinner: { width: 44, height: 44, borderRadius: 22, borderWidth: 4, borderColor: '#F97316', borderTopColor: 'transparent' },
  statusEyebrow: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '700' },

  validationCard: { marginTop: 18, borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center' },
  approvedCard: { borderColor: 'rgba(16,185,129,0.38)', backgroundColor: 'rgba(16,185,129,0.10)' },
  deniedCard: { borderColor: 'rgba(239,68,68,0.38)', backgroundColor: 'rgba(239,68,68,0.10)' },
  validationIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  approvedIcon: { backgroundColor: '#10B981' },
  deniedIcon: { backgroundColor: '#EF4444' },
  validationIconText: { color: '#FFFFFF', fontSize: 42, fontWeight: '700', lineHeight: 46 },
  validationLabel: { color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '400' },
  validationTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  validationCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '400', marginTop: 8 },
  ticketDetails: { alignSelf: 'stretch', marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  detail: { flex: 1, minWidth: 0, paddingVertical: 6 },
  detailFeatured: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)', marginBottom: 8, paddingBottom: 12 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '400' },
  detailValue: { color: '#E5E7EB', fontSize: 12, fontWeight: '400', marginTop: 4 },
  detailValueFeatured: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  detailValueOrange: { color: '#F97316', fontWeight: '700' },

  miniStats: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 12 },
  miniStatItem: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 12 },
  miniStatLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '400' },
  miniStatValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '700', marginTop: 4 },
  miniStatValueOrange: { color: '#F97316' },

  nextButton: { alignSelf: 'stretch', minHeight: 48, borderRadius: 16, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  nextButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  manualSection: { marginTop: 18, gap: 12 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(226,232,240,0.12)' },
  separatorText: { color: 'rgba(226,232,240,0.48)', fontSize: 10, fontWeight: '400' },
  inputShell: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  inputIcon: { color: 'rgba(148,163,184,0.9)', fontSize: 20 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700', outlineStyle: 'none' as any },
  blueButton: { minHeight: 56, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  blueButtonText: { color: '#F97316', fontSize: 12, fontWeight: '700' },

  statsPanel: { marginTop: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  statsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statsEyebrow: { color: '#F97316', fontSize: 10, fontWeight: '700' },
  statsTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginTop: 6 },
  resetButton: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 12, paddingVertical: 9 },
  resetText: { color: '#CBD5E1', fontSize: 10, fontWeight: '700' },
  statGrid: { marginTop: 16, gap: 10 },
  statCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  statOrange: { borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(249,115,22,0.10)' },
  statGreen: { borderColor: 'rgba(16,185,129,0.18)', backgroundColor: '#030B14' },
  statLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '400' },
  statLabelOrange: { color: '#FB923C' },
  statLabelGreen: { color: '#CBD5E1' },
  statValue: { color: '#F8FAFC', fontSize: 32, fontWeight: '700', marginTop: 6 },
  statValueOrange: { color: '#F97316' },
  statValueGreen: { color: '#F8FAFC' },
  capacityCard: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capacityLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 10, fontWeight: '400' },
  capacityValue: { color: '#F8FAFC', fontSize: 30, fontWeight: '700', marginTop: 4 },
  capacityPercent: { color: '#F97316', fontSize: 24, fontWeight: '700' },

  sessionGrid: { marginTop: 16, flexDirection: 'row', gap: 10 },
  sessionCard: { flex: 1, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  sessionGreen: { borderColor: 'rgba(16,185,129,0.28)', backgroundColor: 'rgba(16,185,129,0.10)' },
  sessionRed: { borderColor: 'rgba(239,68,68,0.28)', backgroundColor: 'rgba(239,68,68,0.10)' },
  sessionLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '400' },
  sessionLabelGreen: { color: 'rgba(52,211,153,0.9)' },
  sessionLabelRed: { color: 'rgba(252,165,165,0.9)' },
  sessionValue: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', marginTop: 6 },
  sessionValueGreen: { color: '#34D399' },
  sessionValueRed: { color: '#F87171' },

  recentPanel: { marginTop: 22 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recentTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  recentClock: { color: '#F97316', fontSize: 22 },
  recentEmpty: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.018)', paddingVertical: 32, alignItems: 'center' },
  recentEmptyText: { color: 'rgba(226,232,240,0.46)', fontSize: 13, fontWeight: '400' },
  recentItem: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  recentValid: { borderColor: 'rgba(16,185,129,0.28)', backgroundColor: 'rgba(16,185,129,0.10)' },
  recentInvalid: { borderColor: 'rgba(239,68,68,0.24)', backgroundColor: 'rgba(239,68,68,0.10)' },
  recentLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentMark: { width: 24, height: 24, borderRadius: 12, color: '#FFFFFF', textAlign: 'center', lineHeight: 24, fontWeight: '700' },
  recentMarkValid: { backgroundColor: '#10B981' },
  recentMarkInvalid: { backgroundColor: '#EF4444' },
  recentCopy: { flex: 1, minWidth: 0 },
  recentName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  recentMeta: { color: 'rgba(226,232,240,0.52)', fontSize: 11, fontWeight: '400', marginTop: 3 },
  recentTime: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' },
});
