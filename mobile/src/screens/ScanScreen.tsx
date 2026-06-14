import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { apiPost } from '../services/api';

type Props = {
  onBack: () => void;
};

type ScanState = 'idle' | 'scanning' | 'validating' | 'approved' | 'denied';

type ScanResult = {
  valid: boolean;
  message?: string;
  ticket?: {
    ticketCode?: string;
    status?: string;
    sectionName?: string | null;
    rowLabel?: string | null;
    seatNumber?: number | null;
    seatLabel?: string | null;
    event?: { title?: string; venueName?: string } | null;
    user?: { firstName?: string; lastName?: string; email?: string } | null;
  };
  eventStats?: {
    totalCapacity?: number;
    totalIssued?: number;
    ticketsToScan?: number;
    ticketsEntered?: number;
  };
};

type RecentScan = { id: string; valid: boolean; name: string; location: string; code: string; time: string };

export function ScanScreen({ onBack: _onBack }: Props) {
  const { t } = useLanguage();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [eventStats, setEventStats] = useState<ScanResult['eventStats'] | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (scanState !== 'scanning') {
      scanAnim.stopAnimation();
      scanAnim.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [scanAnim, scanState]);

  const validateCode = async () => {
    const code = manualCode.trim();
    if (!code) return;
    setScanState('validating');
    try {
      const result = await apiPost<ScanResult>(`/orders/ticket/${code}/validate`, {});
      setScanResult(result);
      if (result.eventStats) setEventStats(result.eventStats);
      const u = result.ticket?.user;
      const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || u?.email || t('Visitante', 'Guest');
      const t2 = result.ticket;
      const seatParts = [t2?.sectionName, t2?.rowLabel, t2?.seatNumber].filter(Boolean);
      const location = t2?.seatLabel || (seatParts.length ? seatParts.join(' · ') : 'General');
      const now = new Date();
      const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
      setRecentScans((prev) => [{ id: String(Date.now()), valid: result.valid, name, location, code: t2?.ticketCode || code, time }, ...prev].slice(0, 10));
      setScanState(result.valid ? 'approved' : 'denied');
    } catch (err: any) {
      setScanResult({ valid: false, message: err?.message });
      setScanState('denied');
    }
  };

  const resetScanner = () => {
    setManualCode('');
    setScanResult(null);
    setScanState('idle');
  };

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 218],
  });

  const isApproved = scanState === 'approved';
  const isDenied = scanState === 'denied';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View pointerEvents="none" style={styles.bgGridA} />
      <View pointerEvents="none" style={styles.bgGridB} />

      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>▣</Text>
          <Text style={styles.badgeText}>{t('MODO EVENTO', 'EVENT MODE')}</Text>
        </View>

        <TouchableOpacity onPress={() => setSoundEnabled((current) => !current)} style={[styles.soundButton, soundEnabled && styles.soundButtonActive]}>
          <Text style={[styles.soundText, soundEnabled && styles.soundTextActive]}>
            {soundEnabled ? t('SONIDO', 'SOUND') : t('SILENCIO', 'MUTED')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>{t('Scanner de puerta', 'Door scanner')}</Text>
      <Text style={styles.subtitle}>
        {t('Validación rápida con cámara, sonido y conteo en vivo.', 'Fast validation with camera, sound and live counts.')}
      </Text>

      <View style={styles.scannerCard}>
        {scanState === 'scanning' ? (
          <View style={styles.cameraFrame}>
            <View style={styles.cameraNoise} />
            <View style={styles.scanBox} />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanTranslateY }] }]} />
            <TouchableOpacity style={styles.stopButton} onPress={() => setScanState('idle')}>
              <Text style={styles.stopText}>{t('DETENER CÁMARA', 'STOP CAMERA')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.startPanel}>
            <View style={styles.cameraIcon}>
              <Text style={styles.cameraIconText}>▣</Text>
            </View>
            <TouchableOpacity style={styles.orangeButton} onPress={() => setScanState('scanning')}>
              <View pointerEvents="none" style={styles.orangeTopLine} />
              <View pointerEvents="none" style={styles.orangeBottomShade} />
              <Text style={styles.orangeButtonText}>{t('INICIAR SCANNER', 'START SCANNER')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {scanState === 'validating' && (
        <View style={styles.statusCard}>
          <View style={styles.spinner} />
          <Text style={styles.statusEyebrow}>{t('VERIFICANDO ENTRADA...', 'VERIFYING TICKET...')}</Text>
        </View>
      )}

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
            {isApproved
              ? t('Ticket válido. Puedes permitir el acceso.', 'Valid ticket. You can allow entry.')
              : t('Código no encontrado, usado o inválido.', 'Code not found, used or invalid.')}
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
            <Text style={styles.nextButtonText}>{t('VALIDAR SIGUIENTE ENTRADA', 'VALIDATE NEXT TICKET')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isApproved && !isDenied && scanState !== 'validating' && (
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
            />
          </View>

          <TouchableOpacity style={styles.blueButton} onPress={validateCode}>
            <Text style={styles.blueButtonText}>{t('VALIDAR CÓDIGO', 'VALIDATE CODE')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsPanel}>
        <View style={styles.statsHeader}>
          <View>
            <Text style={styles.statsEyebrow}>{t('CONTEO EN VIVO', 'LIVE COUNT')}</Text>
            <Text style={styles.statsTitle}>{t('Operación de puerta', 'Door operation')}</Text>
          </View>
          <TouchableOpacity style={styles.resetButton}>
            <Text style={styles.resetText}>{t('REINICIAR', 'RESET')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statGrid}>
          <Stat label={t('ENTRADAS EMITIDAS', 'ISSUED TICKETS')} value={String(eventStats?.totalIssued ?? '—')} tone="blue" />
          <Stat label={t('POR ESCANEAR', 'LEFT TO SCAN')} value={String(eventStats?.ticketsToScan ?? '—')} tone="orange" />
          <Stat label={t('YA INGRESARON', 'ALREADY ENTERED')} value={String(eventStats?.ticketsEntered ?? '—')} tone="green" />
        </View>

        <View style={styles.capacityCard}>
          <View>
            <Text style={styles.capacityLabel}>{t('CAPACIDAD DEL LUGAR', 'VENUE CAPACITY')}</Text>
            <Text style={styles.capacityValue}>{eventStats?.totalCapacity ?? '—'}</Text>
          </View>
          <Text style={styles.capacityPercent}>
            {eventStats?.totalCapacity && eventStats?.ticketsEntered != null
              ? `${Math.round((eventStats.ticketsEntered / eventStats.totalCapacity) * 100)}%`
              : '—'}
          </Text>
        </View>
      </View>

      <View style={styles.recentPanel}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>{t('Últimos escaneados', 'Last scanned')}</Text>
          <Text style={styles.recentClock}>◷</Text>
        </View>

        {recentScans.map((scan) => (
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
        ))}
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

function Stat({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'orange' | 'green' }) {
  return (
    <View style={[styles.statCard, tone === 'orange' && styles.statOrange, tone === 'green' && styles.statGreen]}>
      <Text style={[styles.statLabel, tone === 'orange' && styles.statLabelOrange, tone === 'green' && styles.statLabelGreen]}>{label}</Text>
      <Text style={[styles.statValue, tone === 'orange' && styles.statValueOrange, tone === 'green' && styles.statValueGreen]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 132 },
  bgGridA: { position: 'absolute', left: '28%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(125,211,252,0.035)' },
  bgGridB: { position: 'absolute', left: 0, right: 0, top: 220, height: 1, backgroundColor: 'rgba(125,211,252,0.030)' },

  topRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soundButton: { width: 88, height: 36, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030B14' },
  soundButtonActive: { backgroundColor: '#F97316' },
  soundText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, letterSpacing: 0 },
  soundTextActive: { color: '#FFFFFF' },

  badge: { height: 36, alignSelf: 'flex-start', borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeIcon: { color: '#F97316', fontSize: 14, fontWeight: '700' },
  badgeText: { color: '#F8FAFC', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 34, fontWeight: '700', marginTop: 14 },
  subtitle: { color: 'rgba(226,232,240,0.64)', fontSize: 13, lineHeight: 20, fontWeight: '400', marginTop: 8 },

  scannerCard: { marginTop: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  startPanel: { minHeight: 250, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(255,255,255,0.025)' },
  cameraIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', marginBottom: 20 },
  cameraIconText: { color: '#F97316', fontSize: 28, fontWeight: '700' },
  cameraFrame: { height: 300, backgroundColor: '#020617', overflow: 'hidden' },
  cameraNoise: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.35)' },
  scanBox: { position: 'absolute', left: 28, right: 28, top: 28, bottom: 44, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(249,115,22,0.82)', shadowColor: '#F97316', shadowOpacity: 0.42, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
  scanLine: { position: 'absolute', left: 36, right: 36, top: 0, height: 2, backgroundColor: '#F97316', shadowColor: '#F97316', shadowOpacity: 1, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  stopButton: { position: 'absolute', bottom: 14, alignSelf: 'center', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 18, paddingVertical: 10 },
  stopText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0 },

  orangeButton: { minHeight: 56, borderRadius: 16, backgroundColor: '#F97316', paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#F97316', shadowOpacity: 0.20, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  orangeTopLine: { position: 'absolute', top: 4, left: 14, right: 14, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.24)' },
  orangeBottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%', backgroundColor: 'rgba(154,52,18,0.18)' },
  orangeButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0, zIndex: 2 },

  statusCard: { marginTop: 16, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  spinner: { width: 44, height: 44, borderRadius: 22, borderWidth: 4, borderColor: '#F97316', borderTopColor: 'transparent' },
  statusEyebrow: { color: 'rgba(226,232,240,0.58)', fontSize: 11, fontWeight: '700', letterSpacing: 0 },

  manualSection: { marginTop: 18, gap: 12 },
  separator: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  separatorLine: { flex: 1, height: 1, backgroundColor: 'rgba(226,232,240,0.12)' },
  separatorText: { color: 'rgba(226,232,240,0.48)', fontSize: 10, fontWeight: '400', letterSpacing: 0 },
  inputShell: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  inputIcon: { color: 'rgba(148,163,184,0.9)', fontSize: 20 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0, outlineStyle: 'none' as any },
  blueButton: { minHeight: 56, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  blueButtonText: { color: '#F97316', fontSize: 12, fontWeight: '700', letterSpacing: 0 },

  validationCard: { marginTop: 18, borderRadius: 24, borderWidth: 1, padding: 20, alignItems: 'center' },
  approvedCard: { borderColor: 'rgba(16,185,129,0.38)', backgroundColor: 'rgba(16,185,129,0.10)' },
  deniedCard: { borderColor: 'rgba(239,68,68,0.38)', backgroundColor: 'rgba(239,68,68,0.10)' },
  validationIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  approvedIcon: { backgroundColor: '#10B981' },
  deniedIcon: { backgroundColor: '#EF4444' },
  validationIconText: { color: '#FFFFFF', fontSize: 42, fontWeight: '700', lineHeight: 46 },
  validationLabel: { color: 'rgba(255,255,255,0.70)', fontSize: 10, fontWeight: '400', letterSpacing: 0 },
  validationTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  validationCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '400', marginTop: 8 },
  ticketDetails: { alignSelf: 'stretch', marginTop: 18, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  detail: { flex: 1, minWidth: 0, paddingVertical: 6 },
  detailFeatured: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.10)', marginBottom: 8, paddingBottom: 12 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  detailLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '400', letterSpacing: 0 },
  detailValue: { color: '#E5E7EB', fontSize: 12, fontWeight: '400', marginTop: 4 },
  detailValueFeatured: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  detailValueOrange: { color: '#F97316', fontWeight: '700' },
  nextButton: { alignSelf: 'stretch', minHeight: 48, borderRadius: 16, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  nextButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0 },

  statsPanel: { marginTop: 22, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  statsHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statsEyebrow: { color: '#F97316', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  statsTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '700', marginTop: 6 },
  resetButton: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 12, paddingVertical: 9 },
  resetText: { color: '#CBD5E1', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  statGrid: { marginTop: 16, gap: 10 },
  statCard: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14 },
  statOrange: { borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(249,115,22,0.10)' },
  statGreen: { borderColor: 'rgba(249,115,22,0.18)', backgroundColor: '#030B14' },
  statLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '400', letterSpacing: 0 },
  statLabelOrange: { color: '#FB923C' },
  statLabelGreen: { color: '#CBD5E1' },
  statValue: { color: '#F8FAFC', fontSize: 32, fontWeight: '700', marginTop: 6 },
  statValueOrange: { color: '#F97316' },
  statValueGreen: { color: '#F8FAFC' },
  capacityCard: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  capacityLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 10, fontWeight: '400', letterSpacing: 0 },
  capacityValue: { color: '#F8FAFC', fontSize: 30, fontWeight: '700', marginTop: 4 },
  capacityPercent: { color: '#F97316', fontSize: 24, fontWeight: '700' },

  recentPanel: { marginTop: 22 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recentTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700' },
  recentClock: { color: '#F97316', fontSize: 22 },
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
