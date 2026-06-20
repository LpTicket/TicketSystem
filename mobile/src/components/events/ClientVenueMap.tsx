import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

export type ClientSeat = {
  id: string;
  sectionId?: string;
  rowLabel?: string;
  seatNumber?: string | number;
  status?: string;
  lockExpiresAt?: string | null;
};

export type ClientVenueSection = {
  id: string;
  name?: string;
  label?: string;
  type?: string;
  sectionType?: string;
  tableShape?: 'round' | 'rectangle' | 'soft' | string;
  tablePurchaseMode?: string;
  rotation?: number;
  curve?: number;
  mapX?: number;
  mapY?: number;
  mapWidth?: number;
  mapHeight?: number;
  color?: string;
  price?: number | string;
  capacity?: number | string;
  seatsConfig?: string | null;
  seats?: ClientSeat[];
};

type Props = {
  seatMap: ClientVenueSection[];
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
  onToggleSeats?: (seats: ClientSeat[]) => void;
  defaultViewX?: number;
  defaultViewY?: number;
  defaultViewZoom?: number;
};

type ActiveInfo = {
  title: string;
  subtitle: string;
  status: string;
  price: number;
  tone: 'available' | 'selected' | 'sold' | 'reserved';
};

const MIN_ZOOM = 0.12;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.12;
const FIT_PADDING = 40;
const CANVAS_W = 2000;
const CANVAS_H = 1600;

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function parseCfg(raw?: string | null): Record<string, any> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
function isUnavailable(seat: ClientSeat, override: any) {
  const s = String(seat.status || 'available').toLowerCase();
  const expired = s === 'locked' && seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() <= Date.now();
  return !expired && (s === 'sold' || s === 'reserved' || s === 'locked' || !!override?.reserved);
}
function isSelected(seat: ClientSeat, sel: ClientSeat[]) { return sel.some((s) => s.id === seat.id); }
function seatBg(seat: ClientSeat, ov: any, color: string, selected: boolean) {
  if (selected) return '#f97316';
  const s = String(seat.status || 'available').toLowerCase();
  if (s === 'locked' && seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() > Date.now()) return '#facc15';
  if (isUnavailable(seat, ov)) return '#cbd5e1';
  return color || '#5667ff';
}
function seatBorder(seat: ClientSeat, ov: any, selected: boolean) {
  if (selected) return '#ffffff';
  const s = String(seat.status || 'available').toLowerCase();
  if (s === 'locked' && seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() > Date.now()) return '#eab308';
  if (isUnavailable(seat, ov)) return '#94a3b8';
  return 'rgba(255,255,255,0.55)';
}
function getSeatPrice(seat: ClientSeat, section: ClientVenueSection): number {
  const cfg = parseCfg(section.seatsConfig);
  const key = seat.rowLabel && seat.rowLabel !== 'GA' ? `${seat.rowLabel}-${seat.seatNumber}` : `seat-${seat.seatNumber}`;
  const ov = cfg[key];
  if (ov?.price !== undefined) return Number(ov.price);
  return Number(section.price || 0);
}
function tableLabel(name?: string | null) {
  const raw = String(name || '').trim();
  if (!raw) return 'Mesa';
  return /^(mesa|table)\b/i.test(raw) ? raw : `Mesa ${raw}`;
}
function getKind(s: ClientVenueSection) {
  const raw = `${s.sectionType || s.type || ''}`.toLowerCase();
  if (raw === 'stage') return 'stage';
  if (raw === 'decor') return 'decor';
  if (raw === 'standing') return 'standing';
  if (raw === 'table') return 'table';
  const name = `${s.name || s.label || ''}`.toLowerCase();
  if (name.includes('stage') || name.includes('escenario')) return 'stage';
  if (name.includes('standing')) return 'standing';
  if (name.includes('table') || name.includes('mesa')) return 'table';
  if (/^\d+$/.test(`${s.name || s.label || ''}`.trim())) return 'table';
  return 'seats';
}
function sectionColor(s: ClientVenueSection) {
  if (s.color) return s.color;
  return '#5667FF';
}

// ─── Chair ──────────────────────────────────────────────────────────────────
function Chair({ seat, section, override, sel, size, cx, cy, onToggle, onToggleMany, onInfo }: {
  seat: ClientSeat; section: ClientVenueSection; override: any;
  sel: ClientSeat[]; size: number; cx: number; cy: number;
  onToggle: (s: ClientSeat) => void; onToggleMany?: (seats: ClientSeat[]) => void; onInfo: (i: ActiveInfo) => void;
}) {
  const selected = isSelected(seat, sel);
  const unavail = isUnavailable(seat, override) && !selected;
  return (
    <TouchableOpacity
      disabled={unavail}
      activeOpacity={0.75}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={{
        position: 'absolute',
        left: cx - size / 2, top: cy - size / 2,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: seatBg(seat, override, sectionColor(section), selected),
        borderWidth: 0.8, borderColor: seatBorder(seat, override, selected),
        transform: [{ scale: selected ? 1.25 : 1 }],
        opacity: unavail ? 0.45 : 1,
        zIndex: 20,
      }}
      onPress={() => {
        onInfo({
          title: section.sectionType === 'table'
            ? `${tableLabel(section.name)} · Silla ${seat.seatNumber}`
            : `${section.name || ''} ${seat.rowLabel || ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim(),
          subtitle: section.name || '',
          status: selected ? 'Seleccionado' : isUnavailable(seat, override) ? 'No disponible' : 'Disponible',
          price: getSeatPrice(seat, section),
          tone: selected ? 'selected' : isUnavailable(seat, override) ? 'sold' : 'available',
        });
        const isTableSection = section.sectionType === 'table' || getKind(section) === 'table';
        if (isTableSection || section.tablePurchaseMode === 'whole') {
          const all = section.seats || [];
          const cfg = parseCfg(section.seatsConfig);
          const available = all.filter((s) => !isUnavailable(s, cfg[`seat-${s.seatNumber}`] || {}));
          if (onToggleMany) {
            onToggleMany(available);
          } else {
            onToggle(seat);
          }
        } else {
          onToggle(seat);
        }
      }}
    />
  );
}

// ─── TableSection ────────────────────────────────────────────────────────────
function TableSection({ section, sel, onToggle, onToggleMany, onInfo }: {
  section: ClientVenueSection; sel: ClientSeat[];
  onToggle: (s: ClientSeat) => void; onToggleMany?: (seats: ClientSeat[]) => void; onInfo: (i: ActiveInfo) => void;
}) {
  const seats = section.seats || [];
  const cfg = parseCfg(section.seatsConfig);
  const w = Number(section.mapWidth || 100);
  const h = Number(section.mapHeight || 100);
  const isRound = (section.tableShape || 'round') === 'round';
  const chairSize = clamp(Math.min(w, h) * 0.18, 8, 18);
  const tableW = w * (isRound ? 0.60 : 0.70);
  const tableH = h * (isRound ? 0.60 : 0.45);
  const allUnavail = seats.length > 0 && seats.every((s) => isUnavailable(s, cfg[`seat-${s.seatNumber}`] || {}));
  const anySel = seats.some((s) => isSelected(s, sel));

  return (
    <View style={{ width: w, height: h }}>
      <View style={{
        position: 'absolute',
        left: (w - tableW) / 2, top: (h - tableH) / 2,
        width: tableW, height: tableH,
        borderRadius: isRound ? tableW / 2 : 6,
        backgroundColor: '#22415C',
        borderWidth: 1, borderColor: 'rgba(246,198,95,0.28)',
        alignItems: 'center', justifyContent: 'center',
        opacity: allUnavail ? 0.5 : 1, zIndex: 10,
      }}>
        <Text style={{ color: '#F8FAFC', fontSize: clamp(Math.min(w, h) * 0.14, 6, 13), fontWeight: '900', textAlign: 'center' }}>
          {section.name || section.label || ''}
        </Text>
        {anySel && <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#f97316', marginTop: 2 }} />}
      </View>
      {isRound
        ? seats.map((seat, i) => {
            const ov = cfg[`seat-${seat.seatNumber}`] || {};
            if (ov.disabled) return null;
            const angle = (i * 360) / seats.length;
            const rad = (angle * Math.PI) / 180;
            return <Chair key={seat.id} seat={seat} section={section} override={ov} sel={sel} size={chairSize}
              cx={w / 2 + w * 0.52 * Math.sin(rad) + (ov.xOffset || 0)}
              cy={h / 2 - h * 0.52 * Math.cos(rad) + (ov.yOffset || 0)}
              onToggle={onToggle} onToggleMany={onToggleMany} onInfo={onInfo} />;
          })
        : (() => {
            const count = seats.length;
            const step = (2 * (1 + 0.55)) / Math.max(1, count);
            return seats.map((seat, i) => {
              const ov = cfg[`seat-${seat.seatNumber}`] || {};
              if (ov.disabled) return null;
              const pos = i * step;
              let xPct = 50, yPct = 50;
              if (pos < 1)         { xPct = 15 + pos * 70;           yPct = 12; }
              else if (pos < 1.55) { xPct = 88;                      yPct = 15 + ((pos - 1) / 0.55) * 70; }
              else if (pos < 2.55) { xPct = 85 - (pos - 1.55) * 70; yPct = 88; }
              else                 { xPct = 12;                       yPct = 85 - ((pos - 2.55) / 0.55) * 70; }
              return <Chair key={seat.id} seat={seat} section={section} override={ov} sel={sel} size={chairSize}
                cx={w * xPct / 100 + (ov.xOffset || 0)} cy={h * yPct / 100 + (ov.yOffset || 0)}
                onToggle={onToggle} onToggleMany={onToggleMany} onInfo={onInfo} />;
            });
          })()
      }
    </View>
  );
}

// ─── RowSection ──────────────────────────────────────────────────────────────
function RowSection({ section, sel, onToggle, onInfo }: {
  section: ClientVenueSection; sel: ClientSeat[];
  onToggle: (s: ClientSeat) => void; onInfo: (i: ActiveInfo) => void;
}) {
  const seats = section.seats || [];
  const cfg = parseCfg(section.seatsConfig);
  const w = Number(section.mapWidth || 100);
  const h = Number(section.mapHeight || 100);
  const curve = Number(section.curve || 0);
  const rows = Array.from(new Set(seats.map((s) => s.rowLabel || 'A'))).sort();
  const baseSpacingY = rows.length > 1 ? (h - 32) / (rows.length - 1) : 0;

  return (
    <View style={{ width: w, height: h }}>
      {seats.map((seat) => {
        const key = `${seat.rowLabel || 'A'}-${seat.seatNumber}`;
        const ov = cfg[key] || {};
        if (ov.disabled) return null;
        const rIdx = Math.max(0, rows.indexOf(seat.rowLabel || 'A'));
        const rowSeats = seats.filter((s) => (s.rowLabel || 'A') === (seat.rowLabel || 'A'))
          .sort((a, b) => Number(a.seatNumber || 0) - Number(b.seatNumber || 0));
        const sIdx = rowSeats.findIndex((s) => s.id === seat.id);
        const count = Math.max(1, rowSeats.length);
        const t = count > 1 ? (sIdx - (count - 1) / 2) / ((count - 1) / 2) : 0;
        const size = clamp((w - 24) / count - 2, 5, 14);
        const x = count > 1 ? 12 + sIdx * ((w - 24) / (count - 1)) : w / 2;
        const y = 16 + rIdx * baseSpacingY + curve * (t * t - 1);
        const selected = isSelected(seat, sel);
        const unavail = isUnavailable(seat, ov) && !selected;
        return (
          <TouchableOpacity
            key={seat.id} disabled={unavail} activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              position: 'absolute',
              left: x - size / 2 + (ov.xOffset || 0), top: y - size / 2 + (ov.yOffset || 0),
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: seatBg(seat, ov, sectionColor(section), selected),
              borderWidth: 0.8, borderColor: seatBorder(seat, ov, selected),
              transform: [{ scale: selected ? 1.25 : 1 }],
              opacity: unavail ? 0.45 : 1, zIndex: 20,
            }}
            onPress={() => {
              onInfo({
                title: `${section.name || ''} ${seat.rowLabel || ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim(),
                subtitle: section.name || '',
                status: selected ? 'Seleccionado' : isUnavailable(seat, ov) ? 'No disponible' : 'Disponible',
                price: getSeatPrice(seat, section), tone: selected ? 'selected' : isUnavailable(seat, ov) ? 'sold' : 'available',
              });
              onToggle(seat);
            }}
          />
        );
      })}
    </View>
  );
}

// ─── StaticGrid ──────────────────────────────────────────────────────────────
// Rendered once; props never change during gestures so no re-render cost.
const StaticGrid = memo(function StaticGrid({ width, height }: { width: number; height: number }) {
  const cols100 = Math.ceil(width / 100) + 1;
  const rows100 = Math.ceil(height / 100) + 1;
  const cols20  = Math.ceil(width / 20)  + 1;
  const rows20  = Math.ceil(height / 20) + 1;
  return (
    <>
      {Array.from({ length: cols100 }, (_, i) => (
        <View key={`c100-${i}`} style={{ position: 'absolute', left: i * 100, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(148,163,184,0.10)' }} />
      ))}
      {Array.from({ length: rows100 }, (_, i) => (
        <View key={`r100-${i}`} style={{ position: 'absolute', top: i * 100, left: 0, right: 0, height: 1, backgroundColor: 'rgba(148,163,184,0.10)' }} />
      ))}
      {Array.from({ length: cols20 }, (_, i) => (
        <View key={`c20-${i}`} style={{ position: 'absolute', left: i * 20, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(148,163,184,0.05)' }} />
      ))}
      {Array.from({ length: rows20 }, (_, i) => (
        <View key={`r20-${i}`} style={{ position: 'absolute', top: i * 20, left: 0, right: 0, height: 1, backgroundColor: 'rgba(148,163,184,0.05)' }} />
      ))}
    </>
  );
});

// ─── Main ────────────────────────────────────────────────────────────────────
export const ClientVenueMap = memo(function ClientVenueMap({ seatMap, selectedSeats, onToggleSeat, onToggleSeats, defaultViewX, defaultViewY, defaultViewZoom }: Props) {
  const { t } = useLanguage();
  const { width: screenW } = useWindowDimensions();

  const sections = useMemo(
    () => seatMap.filter((s) => Number.isFinite(Number(s.mapX)) && Number.isFinite(Number(s.mapY)) && Number(s.mapWidth || 0) > 0 && Number(s.mapHeight || 0) > 0),
    [seatMap],
  );

  const viewportH = Math.min(Math.max(screenW * 1.25, 420), 560);

  const fitView = useMemo(() => {
    if (!sections.length) return { zoom: 1, pan: { x: 0, y: 0 } };
    if (typeof defaultViewZoom === 'number' && typeof defaultViewX === 'number' && typeof defaultViewY === 'number') {
      return { zoom: defaultViewZoom, pan: { x: defaultViewX, y: defaultViewY } };
    }
    const minX = Math.min(...sections.map((s) => Number(s.mapX || 0)));
    const minY = Math.min(...sections.map((s) => Number(s.mapY || 0)));
    const maxX = Math.max(...sections.map((s) => Number(s.mapX || 0) + Number(s.mapWidth || 0)));
    const maxY = Math.max(...sections.map((s) => Number(s.mapY || 0) + Number(s.mapHeight || 0)));
    const z = clamp(Math.min((screenW - FIT_PADDING * 2) / Math.max(1, maxX - minX), (viewportH - FIT_PADDING * 2) / Math.max(1, maxY - minY)), MIN_ZOOM, MAX_ZOOM);
    return { zoom: z, pan: { x: screenW / 2 - ((minX + maxX) / 2) * z, y: viewportH / 2 - ((minY + maxY) / 2) * z } };
  }, [sections, screenW, viewportH, defaultViewX, defaultViewY, defaultViewZoom]);

  // Animated values — canvas moves on the UI thread, no JS re-render per frame
  const animZoom = useRef(new Animated.Value(fitView.zoom)).current;
  const animPanX = useRef(new Animated.Value(fitView.pan.x)).current;
  const animPanY = useRef(new Animated.Value(fitView.pan.y)).current;

  // Stable constant nodes — must NOT be recreated on every render or the
  // animated transform graph breaks and causes the canvas to jump on each re-render
  const halfCanvasW = useRef(new Animated.Value(CANVAS_W / 2)).current;
  const halfCanvasH = useRef(new Animated.Value(CANVAS_H / 2)).current;
  const negOne = useRef(new Animated.Value(-1)).current;

  // viewRef is the single source of truth for pan/zoom math — no React state
  // so drag/pinch never trigger re-renders and the canvas never jumps
  const viewRef = useRef({ zoom: fitView.zoom, pan: fitView.pan });
  const fitViewRef = useRef(fitView);

  // When fitView changes (sections loaded async), snap animated values to it
  // only if the user hasn't already panned/zoomed away from the default
  useEffect(() => {
    const prev = fitViewRef.current;
    fitViewRef.current = fitView;
    const atDefault =
      Math.abs(viewRef.current.zoom - prev.zoom) < 0.001 &&
      Math.abs(viewRef.current.pan.x - prev.pan.x) < 1 &&
      Math.abs(viewRef.current.pan.y - prev.pan.y) < 1;
    if (atDefault) {
      syncAnimated(fitView.zoom, fitView.pan);
    }
  }, [fitView]);

  const syncAnimated = (z: number, p: { x: number; y: number }) => {
    animZoom.setValue(z);
    animPanX.setValue(p.x);
    animPanY.setValue(p.y);
    viewRef.current = { zoom: z, pan: p };
  };

  const animatingRef = useRef(false);

  const animateTo = (newZ: number, newP: { x: number; y: number }, duration = 200) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    viewRef.current = { zoom: newZ, pan: newP };
    Animated.parallel([
      Animated.timing(animZoom, { toValue: newZ, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(animPanX, { toValue: newP.x, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(animPanY, { toValue: newP.y, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => { animatingRef.current = false; });
  };

  const resetMap = () => {
    animateTo(fitView.zoom, fitView.pan);
  };

  const zoomBy = (delta: number) => {
    const oldZ = viewRef.current.zoom;
    const newZ = clamp(oldZ + delta, fitView.zoom, MAX_ZOOM);
    if (newZ === oldZ) return;
    // Keep the visible center fixed during zoom
    const contentCx = (screenW / 2 - viewRef.current.pan.x) / oldZ;
    const contentCy = (viewportH / 2 - viewRef.current.pan.y) / oldZ;
    const newP = newZ <= fitView.zoom + 0.001 ? fitView.pan : {
      x: screenW / 2 - contentCx * newZ,
      y: viewportH / 2 - contentCy * newZ,
    };
    animateTo(newZ, newP);
  };

  // Touch — direct sync (no animation during drag/pinch)
  const touchRef = useRef({ x: 0, y: 0, panX: 0, panY: 0, isPinch: false, pinchDist: 0, pinchZoom: 1, pinchCx: 0, pinchCy: 0 });

  const onTouchStart = (e: any) => {
    if (animatingRef.current) return;
    const touches = e.nativeEvent.touches;
    if (touches.length >= 2) {
      const t1 = touches[0], t2 = touches[1];
      touchRef.current = { x: 0, y: 0, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y, isPinch: true, pinchDist: Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY), pinchZoom: viewRef.current.zoom, pinchCx: (t1.pageX + t2.pageX) / 2, pinchCy: (t1.pageY + t2.pageY) / 2 };
    } else {
      const t = touches[0];
      touchRef.current = { x: t.pageX, y: t.pageY, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y, isPinch: false, pinchDist: 0, pinchZoom: viewRef.current.zoom, pinchCx: 0, pinchCy: 0 };
    }
  };

  const onTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touchRef.current.isPinch && touches.length >= 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      if (!touchRef.current.pinchDist) return;
      const newZ = clamp(touchRef.current.pinchZoom * (dist / touchRef.current.pinchDist), fitView.zoom, MAX_ZOOM);
      const ratio = newZ / touchRef.current.pinchZoom;
      const newP = { x: touchRef.current.pinchCx - (touchRef.current.pinchCx - touchRef.current.panX) * ratio, y: touchRef.current.pinchCy - (touchRef.current.pinchCy - touchRef.current.panY) * ratio };
      syncAnimated(newZ, newP);
    } else if (!touchRef.current.isPinch && touches.length === 1) {
      const t = touches[0];
      const newP = { x: touchRef.current.panX + (t.pageX - touchRef.current.x), y: touchRef.current.panY + (t.pageY - touchRef.current.y) };
      syncAnimated(viewRef.current.zoom, newP);
    }
  };

  const [activeInfo, setActiveInfo] = useState<ActiveInfo | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const infoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showInfo = (info: ActiveInfo) => {
    if (infoDismissRef.current) clearTimeout(infoDismissRef.current);
    setActiveInfo(info);
    infoDismissRef.current = setTimeout(() => setActiveInfo(null), 2500);
  };

  const focusSection = (section: ClientVenueSection) => {
    if (activeSection === section.id) { setActiveSection(null); resetMap(); return; }
    setActiveSection(section.id!);
    const tw = Number(section.mapWidth || 100), th = Number(section.mapHeight || 100);
    const targetZ = clamp(Math.min((screenW * 0.85) / tw, (viewportH * 0.75) / th), fitView.zoom, MAX_ZOOM);
    animateTo(targetZ, { x: screenW / 2 - (Number(section.mapX || 0) + tw / 2) * targetZ, y: viewportH / 2 - (Number(section.mapY || 0) + th / 2) * targetZ - 40 });
  };

  if (!sections.length) {
    return (
      <View style={st.emptyCard}>
        <Ionicons name="map-outline" size={28} color="rgba(249,115,22,0.5)" style={{ marginBottom: 8 }} />
        <Text style={st.emptyTitle}>{t('Mapa visual no disponible', 'Visual map unavailable')}</Text>
        <Text style={st.emptyCopy}>{t('Este evento no tiene un mapa publicado.', 'This event has no published map.')}</Text>
      </View>
    );
  }

  const toneColor = (tone: ActiveInfo['tone']) =>
    tone === 'selected' ? '#f97316' : tone === 'sold' ? '#94a3b8' : tone === 'reserved' ? '#facc15' : '#86efac';

  // Canvas transform: translate(pan) then scale from top-left.
  // RN scales from center, so compensate: panX + (CANVAS_W/2) * (zoom - 1)
  // All nodes are stable refs — never recreated — so the animated graph is built once.
  const canvasTranslateX = useRef(Animated.add(animPanX, Animated.multiply(halfCanvasW, Animated.add(negOne, animZoom)))).current;
  const canvasTranslateY = useRef(Animated.add(animPanY, Animated.multiply(halfCanvasH, Animated.add(negOne, animZoom)))).current;

  const canvasStyle = {
    position: 'absolute' as const, top: 0, left: 0,
    width: CANVAS_W, height: CANVAS_H,
    transform: [
      { translateX: canvasTranslateX as any },
      { translateY: canvasTranslateY as any },
      { scale: animZoom as any },
    ],
  };

  return (
    <View style={st.wrap}>
      <View style={st.header}>
        <Text style={st.headerTitle}>{t('Selecciona tus asientos', 'Select your seats')}</Text>
        <View style={st.controls}>
          <TouchableOpacity style={st.ctrlBtn} onPress={() => zoomBy(-ZOOM_STEP)}>
            <Ionicons name="remove-outline" size={16} color="rgba(226,232,240,0.85)" />
          </TouchableOpacity>
          <View style={st.ctrlDivider} />
          <TouchableOpacity style={st.ctrlBtn} onPress={() => zoomBy(ZOOM_STEP)}>
            <Ionicons name="add-outline" size={16} color="rgba(226,232,240,0.85)" />
          </TouchableOpacity>
          <View style={st.ctrlDivider} />
          <TouchableOpacity style={st.ctrlBtn} onPress={resetMap}>
            <Ionicons name="contract-outline" size={14} color="rgba(226,232,240,0.85)" />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={st.hint}>{'👆 '}{t('Desliza para mover · Pellizca para zoom', 'Drag to pan · Pinch to zoom')}</Text>

      <View
        style={[st.viewport, { height: viewportH }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={() => {}}
      >
        {/* Static grid background — matches web's CSS linear-gradient pattern */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Platform.OS === 'web' ? (
            <View style={[StyleSheet.absoluteFill, {
              // @ts-ignore — web-only CSS backgroundImage
              backgroundImage: [
                'linear-gradient(rgba(148,163,184,0.10) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(148,163,184,0.10) 1px, transparent 1px)',
                'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px)',
                'linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
              ].join(', '),
              backgroundSize: '100px 100px, 100px 100px, 20px 20px, 20px 20px',
            } as any]} />
          ) : (
            <StaticGrid width={screenW} height={viewportH} />
          )}
        </View>

        {/* Animated canvas — sections at their map coords, transform handles pan+zoom */}
        <Animated.View style={canvasStyle} pointerEvents="box-none">
          {sections.map((section) => {
            const kind = getKind(section);
            const left = Number(section.mapX || 0);
            const top = Number(section.mapY || 0);
            const w = Number(section.mapWidth || 100);
            const h = Number(section.mapHeight || 100);
            const color = sectionColor(section);
            const isFocusable = kind === 'standing';
            const isInteractive = kind !== 'stage' && kind !== 'decor';

            const bg = kind === 'stage' ? '#0F172A'
              : kind === 'standing' ? (selectedSeats.some((s) => s.sectionId === section.id) ? '#f97316' : color)
              : kind === 'decor' ? (color || '#f8fafc')
              : 'transparent';

            return (
              <TouchableOpacity
                key={section.id}
                activeOpacity={isInteractive && isFocusable ? 0.8 : 1}
                disabled={!isInteractive}
                onPress={isFocusable ? () => focusSection(section) : undefined}
                style={{
                  position: 'absolute', left, top, width: w, height: h,
                  backgroundColor: bg,
                  borderRadius: kind === 'stage' ? 18 : kind === 'standing' ? 8 : kind === 'table' && (section.tableShape || 'round') === 'round' ? Math.min(w, h) / 2 : 4,
                  borderWidth: kind === 'stage' ? 2 : kind === 'standing' ? 2 : kind === 'decor' ? 1 : 0,
                  borderColor: kind === 'stage' ? '#3b82f6' : kind === 'standing' ? color : '#cbd5e1',
                  transform: [{ rotate: `${Number(section.rotation || 0)}deg` }],
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'visible', zIndex: kind === 'stage' ? 5 : 10,
                }}
              >
                {kind === 'stage' && <>
                  <Text style={st.stageLabel} numberOfLines={1}>{section.name}</Text>
                  <Text style={st.stageSub}>{t('ESCENARIO', 'STAGE')}</Text>
                </>}
                {kind === 'decor' && <Text style={st.decorLabel} numberOfLines={2}>{section.name}</Text>}
                {kind === 'standing' && <Text style={st.standingLabel} numberOfLines={1}>{section.name}</Text>}
                {kind === 'table' && (
                  <TableSection section={section} sel={selectedSeats} onToggle={onToggleSeat} onToggleMany={onToggleSeats}
                    onInfo={(info) => { setActiveSection(null); showInfo(info); }} />
                )}
                {kind === 'seats' && (
                  <RowSection section={section} sel={selectedSeats} onToggle={onToggleSeat}
                    onInfo={(info) => { setActiveSection(null); showInfo(info); }} />
                )}
              </TouchableOpacity>
            );
          })}
        </Animated.View>


        {activeSection && (() => {
          const sec = sections.find((s) => s.id === activeSection);
          if (!sec || getKind(sec) !== 'standing') return null;
          const cap = Number(sec.capacity) || 0;
          const sold = (sec.seats || []).filter((s) => s.status === 'sold' || (s.status === 'locked' && !s.lockExpiresAt)).length;
          const remaining = cap > 0 ? Math.max(0, cap - sold) : 10;
          const current = selectedSeats.filter((s) => s.sectionId === sec.id);
          return (
            <View style={st.toolbar}>
              <TouchableOpacity style={st.toolbarBack} onPress={() => { setActiveSection(null); resetMap(); }}>
                <Ionicons name="arrow-back" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={st.toolbarName}>{sec.name}</Text>
                <Text style={st.toolbarSub}>{remaining} {t('disponibles', 'available')}</Text>
              </View>
              <View style={st.qtyRow}>
                <TouchableOpacity style={st.qtyBtn} onPress={() => {
                  if (current.length > 0) onToggleSeat(current[current.length - 1]);
                  if (current.length <= 1) setActiveSection(null);
                }}><Text style={st.qtyBtnText}>－</Text></TouchableOpacity>
                <Text style={st.qtyVal}>{current.length}</Text>
                <TouchableOpacity style={[st.qtyBtn, st.qtyBtnOrange]} onPress={() => {
                  if (current.length < Math.min(10, remaining)) {
                    onToggleSeat({ id: `standing-${sec.id}-${current.length + 1}-${Date.now()}`, sectionId: sec.id, rowLabel: 'GA', seatNumber: current.length + 1, status: 'available' });
                  }
                }}><Text style={st.qtyBtnText}>＋</Text></TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Info toast — outside viewport so it never covers the map */}
      {activeInfo && (
        <View style={st.infoCard}>
          <View style={[st.infoTone, { backgroundColor: `${toneColor(activeInfo.tone)}22` }]}>
            <Text style={[st.infoToneText, { color: toneColor(activeInfo.tone) }]}>{activeInfo.status}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.infoTitle} numberOfLines={1}>{activeInfo.title}</Text>
            {!!activeInfo.subtitle && <Text style={st.infoSub} numberOfLines={1}>{activeInfo.subtitle}</Text>}
          </View>
          <Text style={st.infoPrice}>${activeInfo.price.toFixed(2)}</Text>
        </View>
      )}

      <View style={st.legend}>
        {([
          { color: '#ffffff', label: t('Disponible', 'Available'), border: true },
          { color: '#f97316', label: t('Seleccionado', 'Selected'), border: false },
          { color: '#cbd5e1', label: t('Vendido', 'Sold'), border: false },
        ] as { color: string; label: string; border: boolean }[]).map((item) => (
          <View key={item.label} style={st.legendItem}>
            <View style={[st.legendDot, { backgroundColor: item.color, borderWidth: item.border ? 1 : 0, borderColor: '#94a3b8' }]} />
            <Text style={st.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
});

const st = StyleSheet.create({
  wrap: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0d1f33' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  hint: { color: 'rgba(226,232,240,0.40)', fontSize: 10, paddingHorizontal: 14, paddingBottom: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  ctrlBtn: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  ctrlDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.14)' },
  viewport: { position: 'relative', overflow: 'hidden', backgroundColor: '#0d2138' },
  emptyCard: { borderRadius: 20, padding: 28, backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { color: 'rgba(226,232,240,0.55)', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  stageLabel: { color: '#60a5fa', fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  stageSub: { color: '#94a3b8', fontSize: 7, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 },
  decorLabel: { color: '#1e293b', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  standingLabel: { color: '#ffffff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center' },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginTop: 8, backgroundColor: 'rgba(11,34,54,0.96)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(246,198,95,0.20)', paddingHorizontal: 12, paddingVertical: 10 },
  infoTone: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  infoToneText: { fontSize: 10, fontWeight: '800' },
  infoTitle: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  infoSub: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginTop: 1 },
  infoPrice: { color: '#F97316', fontSize: 14, fontWeight: '900', flexShrink: 0 },
  toolbar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1e2228', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  toolbarBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  toolbarName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  toolbarSub: { color: '#94a3b8', fontSize: 11 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  qtyBtnOrange: { backgroundColor: colors.orange },
  qtyBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900', lineHeight: 20 },
  qtyVal: { color: '#ffffff', fontSize: 18, fontWeight: '900', minWidth: 24, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: 'rgba(203,213,225,0.70)', fontSize: 11, fontWeight: '600' },
});
