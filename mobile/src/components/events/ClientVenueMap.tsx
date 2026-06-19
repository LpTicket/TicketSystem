import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
const ZOOM_STEP = 0.25;
const FIT_PADDING = 48;
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
  return !expired && (s === 'sold' || s === 'reserved' || s === 'locked' || !!override?.reserved || !!override?.sold || !!override?.locked);
}

function isSelected(seat: ClientSeat, sel: ClientSeat[]) {
  return sel.some((s) => s.id === seat.id);
}

function seatBg(seat: ClientSeat, override: any, color: string, selected: boolean) {
  if (selected) return '#f97316';
  const s = String(seat.status || 'available').toLowerCase();
  const hold = s === 'locked' && seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() > Date.now();
  if (hold) return '#facc15';
  if (isUnavailable(seat, override)) return '#cbd5e1';
  return color || '#5667ff';
}

function seatBorder(seat: ClientSeat, override: any, selected: boolean) {
  if (selected) return '#ffffff';
  const s = String(seat.status || 'available').toLowerCase();
  const hold = s === 'locked' && seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() > Date.now();
  if (hold) return '#eab308';
  if (isUnavailable(seat, override)) return '#94a3b8';
  return '#ffffff';
}

function getSeatPrice(seat: ClientSeat, section: ClientVenueSection): number {
  const cfg = parseCfg(section.seatsConfig);
  const key = seat.rowLabel && seat.rowLabel !== 'GA' ? `${seat.rowLabel}-${seat.seatNumber}` : `seat-${seat.seatNumber}`;
  const ov = cfg[key];
  if (ov?.price !== undefined && ov.price !== null) return Number(ov.price);
  return Number(section.price || 0);
}

function tableLabel(name?: string | null, es = true) {
  const word = es ? 'Mesa' : 'Table';
  const raw = String(name || '').trim();
  if (!raw) return word;
  return /^(mesa|table)\b/i.test(raw) ? raw : `${word} ${raw}`;
}

function getKind(section: ClientVenueSection) {
  const raw = `${section.sectionType || section.type || ''}`.toLowerCase();
  if (raw === 'stage') return 'stage';
  if (raw === 'decor') return 'decor';
  if (raw === 'standing') return 'standing';
  if (raw === 'table') return 'table';
  const name = `${section.name || section.label || ''}`.toLowerCase();
  if (name.includes('stage') || name.includes('escenario') || name.includes('pantalla')) return 'stage';
  if (name.includes('decor') || name.includes('general area') || name.includes('entrada')) return 'decor';
  if (name.includes('standing')) return 'standing';
  if (name.includes('table') || name.includes('mesa')) return 'table';
  if (/^\d+$/.test(`${section.name || section.label || ''}`.trim())) return 'table';
  return 'seats';
}

function sectionColor(section: ClientVenueSection) {
  if (section.color) return section.color;
  const name = `${section.name || section.label || ''}`.toLowerCase();
  if (name.includes('bar')) return '#F97316';
  if (name.includes('general')) return '#E8554F';
  if (name.includes('pantalla')) return '#58C783';
  return '#5667FF';
}

// ─── Chair component for tables ─────────────────────────────────────────────
function Chair({
  seat, section, override, sel, size, style, onToggle, onInfo,
}: {
  seat: ClientSeat; section: ClientVenueSection; override: any;
  sel: ClientSeat[]; size: number;
  style: any;
  onToggle: (s: ClientSeat) => void;
  onInfo: (info: ActiveInfo) => void;
}) {
  const selected = isSelected(seat, sel);
  const unavail = isUnavailable(seat, override) && !selected;
  const bg = seatBg(seat, override, sectionColor(section), selected);
  const bd = seatBorder(seat, override, selected);
  return (
    <TouchableOpacity
      style={[style, {
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: bg, borderWidth: 1.5, borderColor: bd,
        alignItems: 'center', justifyContent: 'center',
        transform: [{ scale: selected ? 1.2 : 1 }],
        opacity: unavail ? 0.5 : 1,
      }]}
      disabled={unavail}
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      onPress={() => {
        onInfo({
          title: section.sectionType === 'table'
            ? `${tableLabel(section.name)} · ${seat.seatNumber}`
            : `${section.name || ''} ${seat.rowLabel || ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim(),
          subtitle: section.name || '',
          status: selected ? 'Seleccionado' : isUnavailable(seat, override) ? 'No disponible' : 'Disponible',
          price: getSeatPrice(seat, section),
          tone: selected ? 'selected' : isUnavailable(seat, override) ? 'sold' : 'available',
        });
        if (section.tablePurchaseMode === 'whole') {
          const allSeats = section.seats || [];
          const anySel = allSeats.some((s) => isSelected(s, sel));
          const cfg = parseCfg(section.seatsConfig);
          const toToggle = anySel
            ? allSeats.filter((s) => isSelected(s, sel))
            : allSeats.filter((s) => !isUnavailable(s, cfg[`seat-${s.seatNumber}`] || {}));
          toToggle.forEach(onToggle);
        } else {
          onToggle(seat);
        }
      }}
    />
  );
}

// ─── Table section ───────────────────────────────────────────────────────────
function TableSection({ section, sel, onToggle, onInfo }: {
  section: ClientVenueSection; sel: ClientSeat[];
  onToggle: (s: ClientSeat) => void; onInfo: (i: ActiveInfo) => void;
}) {
  const seats = section.seats || [];
  const cfg = parseCfg(section.seatsConfig);
  const w = Number(section.mapWidth || 100);
  const h = Number(section.mapHeight || 100);
  const isRound = (section.tableShape || 'round') === 'round';
  const chairSize = clamp(Math.min(w, h) * 0.20, 9, 20);
  const tableW = w * (isRound ? 0.60 : 0.70);
  const tableH = h * (isRound ? 0.60 : 0.45);
  const allUnavail = seats.length > 0 && seats.every((s) => {
    const ov = cfg[`seat-${s.seatNumber}`] || {};
    return isUnavailable(s, ov);
  });
  const anySel = seats.some((s) => isSelected(s, sel));

  return (
    <View style={{ width: w, height: h }}>
      {/* Table body */}
      <View style={{
        position: 'absolute',
        left: (w - tableW) / 2, top: (h - tableH) / 2,
        width: tableW, height: tableH,
        borderRadius: isRound ? tableW / 2 : 6,
        backgroundColor: '#22415C',
        borderWidth: 1, borderColor: 'rgba(246,198,95,0.28)',
        alignItems: 'center', justifyContent: 'center',
        opacity: allUnavail ? 0.5 : 1,
      }}>
        <Text style={{ color: '#F8FAFC', fontSize: clamp(Math.min(w, h) * 0.12, 6, 11), fontWeight: '900', textAlign: 'center' }}>
          {section.name || section.label || ''}
        </Text>
        {anySel && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#f97316', marginTop: 2 }} />}
      </View>

      {/* Chairs — positioned around the table using same % math as web */}
      {isRound
        ? seats.map((seat, i) => {
            if ((cfg[`seat-${seat.seatNumber}`] || {}).disabled) return null;
            const ov = cfg[`seat-${seat.seatNumber}`] || {};
            const angle = (i * 360) / seats.length;
            const rad = (angle * Math.PI) / 180;
            const cx = w / 2 + (w * 0.50) * Math.sin(rad) - chairSize / 2 + (ov.xOffset || 0);
            const cy = h / 2 - (h * 0.50) * Math.cos(rad) - chairSize / 2 + (ov.yOffset || 0);
            return (
              <Chair key={seat.id} seat={seat} section={section} override={ov}
                sel={sel} size={chairSize}
                style={{ position: 'absolute', left: cx, top: cy }}
                onToggle={onToggle} onInfo={onInfo}
              />
            );
          })
        : (() => {
            const count = seats.length;
            const perimeter = 2 * (1 + 0.55);
            const step = perimeter / count;
            return seats.map((seat, i) => {
              if ((cfg[`seat-${seat.seatNumber}`] || {}).disabled) return null;
              const ov = cfg[`seat-${seat.seatNumber}`] || {};
              const pos = i * step;
              let xPct = 50, yPct = 50;
              if (pos < 1)            { xPct = 15 + pos * 70;              yPct = 12; }
              else if (pos < 1.55)    { xPct = 88;                         yPct = 15 + ((pos - 1) / 0.55) * 70; }
              else if (pos < 2.55)    { xPct = 85 - (pos - 1.55) * 70;    yPct = 88; }
              else                    { xPct = 12;                          yPct = 85 - ((pos - 2.55) / 0.55) * 70; }
              const cx = (w * xPct / 100) - chairSize / 2 + (ov.xOffset || 0);
              const cy = (h * yPct / 100) - chairSize / 2 + (ov.yOffset || 0);
              return (
                <Chair key={seat.id} seat={seat} section={section} override={ov}
                  sel={sel} size={chairSize}
                  style={{ position: 'absolute', left: cx, top: cy }}
                  onToggle={onToggle} onInfo={onInfo}
                />
              );
            });
          })()
      }
    </View>
  );
}

// ─── Row-seats section ───────────────────────────────────────────────────────
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
        const size = clamp((w - 24) / count - 2, 9, 18);
        const x = count > 1 ? 12 + sIdx * ((w - 24) / (count - 1)) : w / 2;
        const y = 16 + rIdx * baseSpacingY + curve * (t * t - 1);
        const selected = isSelected(seat, sel);
        const unavail = isUnavailable(seat, ov) && !selected;
        const bg = seatBg(seat, ov, sectionColor(section), selected);
        const bd = seatBorder(seat, ov, selected);
        return (
          <TouchableOpacity
            key={seat.id}
            disabled={unavail}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              position: 'absolute',
              left: x - size / 2 + (ov.xOffset || 0),
              top: y - size / 2 + (ov.yOffset || 0),
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: bg, borderWidth: 1.5, borderColor: bd,
              transform: [{ scale: selected ? 1.2 : 1 }],
              opacity: unavail ? 0.45 : 1,
            }}
            onPress={() => {
              onInfo({
                title: `${section.name || ''} ${seat.rowLabel || ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim(),
                subtitle: section.name || '',
                status: selected ? 'Seleccionado' : isUnavailable(seat, ov) ? 'No disponible' : 'Disponible',
                price: getSeatPrice(seat, section),
                tone: selected ? 'selected' : isUnavailable(seat, ov) ? 'sold' : 'available',
              });
              onToggle(seat);
            }}
          />
        );
      })}
    </View>
  );
}

// ─── Main map component ──────────────────────────────────────────────────────
export function ClientVenueMap({ seatMap, selectedSeats, onToggleSeat }: Props) {
  const { t } = useLanguage();
  const { width: screenW } = useWindowDimensions();

  const sections = useMemo(
    () => seatMap.filter(
      (s) => Number.isFinite(Number(s.mapX)) && Number.isFinite(Number(s.mapY))
        && Number(s.mapWidth || 0) > 0 && Number(s.mapHeight || 0) > 0,
    ),
    [seatMap],
  );

  const viewportH = Math.min(Math.max(screenW * 1.2, 420), 540);

  // Fit-view calculation (mirrors web getFitView)
  const fitView = useMemo(() => {
    if (!sections.length) return { zoom: 0.28, pan: { x: 0, y: 0 } };
    const minX = Math.min(...sections.map((s) => Number(s.mapX || 0)));
    const minY = Math.min(...sections.map((s) => Number(s.mapY || 0)));
    const maxX = Math.max(...sections.map((s) => Number(s.mapX || 0) + Number(s.mapWidth || 0)));
    const maxY = Math.max(...sections.map((s) => Number(s.mapY || 0) + Number(s.mapHeight || 0)));
    const cw = screenW, ch = viewportH;
    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const z = clamp(Math.min((cw - FIT_PADDING * 2) / contentW, (ch - FIT_PADDING * 2) / contentH), MIN_ZOOM, MAX_ZOOM);
    return {
      zoom: z,
      pan: {
        x: cw / 2 - ((minX + maxX) / 2) * z,
        y: ch / 2 - ((minY + maxY) / 2) * z,
      },
    };
  }, [sections, screenW, viewportH]);

  const [zoom, setZoom] = useState(fitView.zoom);
  const [pan, setPan] = useState(fitView.pan);
  const [activeInfo, setActiveInfo] = useState<ActiveInfo | null>(null);

  // Touch state refs (mirrors web touchStart ref)
  const touchRef = useRef({
    x: 0, y: 0, panX: 0, panY: 0,
    isPinch: false, pinchDist: 0, pinchZoom: 1,
    pinchCx: 0, pinchCy: 0, moved: false,
  });
  const viewRef = useRef({ zoom: fitView.zoom, pan: fitView.pan });
  const fitZoomRef = useRef(fitView.zoom);

  const resetMap = () => {
    setZoom(fitView.zoom);
    setPan(fitView.pan);
    setActiveInfo(null);
    viewRef.current = { zoom: fitView.zoom, pan: fitView.pan };
  };

  const zoomBy = (delta: number) => {
    const next = clamp(viewRef.current.zoom + delta, fitZoomRef.current, MAX_ZOOM);
    viewRef.current.zoom = next;
    setZoom(next);
  };

  // Touch handlers — mirrors web onTouchStart/onTouchMove exactly
  const onTouchStart = (e: any) => {
    const touches = e.nativeEvent.touches;
    if (touches.length >= 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      touchRef.current = {
        x: 0, y: 0, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y,
        isPinch: true, pinchDist: dist, pinchZoom: viewRef.current.zoom,
        pinchCx: (t1.pageX + t2.pageX) / 2, pinchCy: (t1.pageY + t2.pageY) / 2,
        moved: false,
      };
    } else {
      const t = touches[0];
      touchRef.current = {
        x: t.pageX, y: t.pageY, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y,
        isPinch: false, pinchDist: 0, pinchZoom: viewRef.current.zoom,
        pinchCx: 0, pinchCy: 0, moved: false,
      };
    }
  };

  const onTouchMove = (e: any) => {
    const touches = e.nativeEvent.touches;
    touchRef.current.moved = true;
    if (touchRef.current.isPinch && touches.length >= 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      if (touchRef.current.pinchDist === 0) return;
      const factor = dist / touchRef.current.pinchDist;
      const oldZ = touchRef.current.pinchZoom;
      const newZ = clamp(oldZ * factor, fitZoomRef.current, MAX_ZOOM);
      const ratio = newZ / oldZ;
      const mx = touchRef.current.pinchCx;
      const my = touchRef.current.pinchCy;
      const newPan = {
        x: mx - (mx - touchRef.current.panX) * ratio,
        y: my - (my - touchRef.current.panY) * ratio,
      };
      viewRef.current = { zoom: newZ, pan: newPan };
      setZoom(newZ);
      setPan(newPan);
    } else if (!touchRef.current.isPinch && touches.length === 1) {
      const t = touches[0];
      const newPan = {
        x: touchRef.current.panX + (t.pageX - touchRef.current.x),
        y: touchRef.current.panY + (t.pageY - touchRef.current.y),
      };
      viewRef.current.pan = newPan;
      setPan(newPan);
    }
  };

  const [activeSection, setActiveSection] = useState<string | null>(null);

  const focusSection = (section: ClientVenueSection) => {
    if (activeSection === section.id) { setActiveSection(null); resetMap(); return; }
    setActiveSection(section.id);
    const sw = screenW, sh = viewportH;
    const tw = Number(section.mapWidth || 100);
    const th = Number(section.mapHeight || 100);
    const targetZ = clamp(Math.min((sw * 0.85) / tw, (sh * 0.75) / th), fitZoomRef.current, MAX_ZOOM);
    const newPan = {
      x: sw / 2 - (Number(section.mapX || 0) + tw / 2) * targetZ,
      y: sh / 2 - (Number(section.mapY || 0) + th / 2) * targetZ - 40,
    };
    viewRef.current = { zoom: targetZ, pan: newPan };
    setZoom(targetZ);
    setPan(newPan);
  };

  if (!sections.length) {
    return (
      <View style={s.emptyCard}>
        <Ionicons name="map-outline" size={28} color="rgba(249,115,22,0.5)" style={{ marginBottom: 8 }} />
        <Text style={s.emptyTitle}>{t('Mapa visual no disponible', 'Visual map unavailable')}</Text>
        <Text style={s.emptyCopy}>{t('Este evento no tiene un mapa publicado.', 'This event has no published map.')}</Text>
      </View>
    );
  }

  const toneColor = (tone: ActiveInfo['tone']) =>
    tone === 'selected' ? '#f97316' : tone === 'sold' ? '#94a3b8' : tone === 'reserved' ? '#facc15' : '#86efac';

  return (
    <View style={s.wrap}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t('Selecciona tus asientos', 'Select your seats')}</Text>
        <View style={s.controls}>
          <TouchableOpacity style={s.ctrlBtn} onPress={() => zoomBy(-ZOOM_STEP)}>
            <Ionicons name="search-outline" size={14} color="rgba(226,232,240,0.85)" />
            <View style={s.ctrlMinus} />
          </TouchableOpacity>
          <View style={s.ctrlDivider} />
          <TouchableOpacity style={s.ctrlBtn} onPress={() => zoomBy(ZOOM_STEP)}>
            <Ionicons name="search-outline" size={14} color="rgba(226,232,240,0.85)" />
            <View style={s.ctrlPlus} />
          </TouchableOpacity>
          <View style={s.ctrlDivider} />
          <TouchableOpacity style={s.ctrlBtn} onPress={resetMap}>
            <Ionicons name="contract-outline" size={14} color="rgba(226,232,240,0.85)" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.hint}>{'👆 '}{t('1 dedo para mover · pellizca para zoom', '1 finger to pan · pinch to zoom')}</Text>

      {/* Viewport */}
      <View
        style={[s.viewport, { height: viewportH }]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={onTouchStart}
        onResponderMove={onTouchMove}
        onResponderRelease={() => { touchRef.current.moved = false; }}
      >
        {/* Grid */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={s.gridLarge} />
          <View style={s.gridSmall} />
        </View>

        {/* Canvas — same transform as web: translate then scale from origin 0,0 */}
        <View
          style={[s.canvas, {
            width: CANVAS_W,
            height: CANVAS_H,
            transform: [
              { translateX: pan.x + (CANVAS_W / 2) * (zoom - 1) },
              { translateY: pan.y + (CANVAS_H / 2) * (zoom - 1) },
              { scale: zoom },
            ],
          }]}
          pointerEvents="box-none"
        >
          {sections.map((section) => {
            const kind = getKind(section);
            const left = Number(section.mapX || 0);
            const top = Number(section.mapY || 0);
            const w = Number(section.mapWidth || 100);
            const h = Number(section.mapHeight || 100);
            const color = sectionColor(section);
            const isInteractive = kind !== 'stage' && kind !== 'decor';
            const isFocusable = kind === 'standing';

            const bg = kind === 'stage' ? '#0F172A'
              : kind === 'standing' ? (selectedSeats.some((s) => s.sectionId === section.id) ? '#f97316' : color)
              : kind === 'decor' ? (color || '#f8fafc')
              : 'transparent';

            return (
              <TouchableOpacity
                key={section.id}
                activeOpacity={isInteractive ? (isFocusable ? 0.8 : 1) : 1}
                disabled={!isInteractive}
                onPress={isFocusable ? () => focusSection(section) : undefined}
                style={{
                  position: 'absolute', left, top, width: w, height: h,
                  backgroundColor: bg,
                  borderRadius: kind === 'stage' ? 18 : kind === 'standing' ? 8 : kind === 'table' && (section.tableShape || 'round') === 'round' ? Math.min(w, h) / 2 : 4,
                  borderWidth: kind === 'stage' ? 2.5 : kind === 'standing' ? 2 : kind === 'decor' ? 1 : 0,
                  borderColor: kind === 'stage' ? '#3b82f6' : kind === 'standing' ? color : kind === 'decor' ? '#cbd5e1' : 'transparent',
                  transform: [{ rotate: `${Number(section.rotation || 0)}deg` }],
                  alignItems: 'center', justifyContent: 'center',
                  overflow: 'visible',
                  zIndex: kind === 'stage' ? 5 : 10,
                }}
              >
                {kind === 'stage' && (
                  <>
                    <Text style={s.stageLabel}>{section.name}</Text>
                    <Text style={s.stageSub}>{t('ESCENARIO', 'STAGE')}</Text>
                  </>
                )}
                {kind === 'decor' && (
                  <Text style={s.decorLabel} numberOfLines={2}>{section.name}</Text>
                )}
                {kind === 'standing' && (
                  <Text style={s.standingLabel} numberOfLines={1}>{section.name}</Text>
                )}
                {kind === 'table' && (
                  <TableSection section={section} sel={selectedSeats} onToggle={onToggleSeat}
                    onInfo={(info) => { setActiveSection(null); setActiveInfo(info); }}
                  />
                )}
                {kind === 'seats' && (
                  <RowSection section={section} sel={selectedSeats} onToggle={onToggleSeat}
                    onInfo={(info) => { setActiveSection(null); setActiveInfo(info); }}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info tooltip */}
        {activeInfo && (
          <View style={s.infoCard} pointerEvents="none">
            <Text style={s.infoTitle} numberOfLines={1}>{activeInfo.title}</Text>
            {!!activeInfo.subtitle && <Text style={s.infoSub} numberOfLines={1}>{activeInfo.subtitle}</Text>}
            <View style={s.infoBottom}>
              <View style={[s.infoStatus, { backgroundColor: `${toneColor(activeInfo.tone)}22` }]}>
                <Text style={[s.infoStatusText, { color: toneColor(activeInfo.tone) }]}>{activeInfo.status}</Text>
              </View>
              <Text style={s.infoPrice}>${activeInfo.price.toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Bottom toolbar when standing section is focused */}
        {activeSection && (() => {
          const sec = sections.find((s) => s.id === activeSection);
          if (!sec || getKind(sec) !== 'standing') return null;
          const cap = Math.max(0, Number(sec.capacity) || 0);
          const sold = (sec.seats || []).filter((s) => s.status === 'sold' || (s.status === 'locked' && !s.lockExpiresAt)).length;
          const remaining = cap > 0 ? Math.max(0, cap - sold) : 10;
          const current = selectedSeats.filter((s) => s.sectionId === sec.id);
          return (
            <View style={s.toolbar}>
              <TouchableOpacity style={s.toolbarBack} onPress={() => { setActiveSection(null); resetMap(); }}>
                <Ionicons name="arrow-back" size={18} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={s.toolbarName}>{sec.name}</Text>
                <Text style={s.toolbarSub}>{remaining} {t('disponibles', 'available')}</Text>
              </View>
              <View style={s.qtyRow}>
                <TouchableOpacity style={s.qtyBtn} onPress={() => {
                  if (current.length > 0) onToggleSeat(current[current.length - 1]);
                  if (current.length <= 1) setActiveSection(null);
                }}>
                  <Text style={s.qtyBtnText}>－</Text>
                </TouchableOpacity>
                <Text style={s.qtyVal}>{current.length}</Text>
                <TouchableOpacity style={[s.qtyBtn, s.qtyBtnOrange]} onPress={() => {
                  if (current.length < Math.min(10, remaining)) {
                    onToggleSeat({
                      id: `standing-${sec.id}-${current.length + 1}-${Date.now()}`,
                      sectionId: sec.id,
                      rowLabel: 'GA',
                      seatNumber: current.length + 1,
                      status: 'available',
                    });
                  }
                }}>
                  <Text style={s.qtyBtnText}>＋</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {([
          { color: '#ffffff', label: t('Disponible', 'Available') },
          { color: '#f97316', label: t('Seleccionado', 'Selected') },
          { color: '#cbd5e1', label: t('Vendido', 'Sold') },
        ] as { color: string; label: string }[]).map((item) => (
          <View key={item.label} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: item.color, borderWidth: item.color === '#ffffff' ? 1 : 0, borderColor: '#94a3b8' }]} />
            <Text style={s.legendText}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#0d1f33' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  headerTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  hint: { color: 'rgba(226,232,240,0.45)', fontSize: 10, fontWeight: '500', paddingHorizontal: 14, paddingBottom: 6 },
  controls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  ctrlBtn: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  ctrlDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  ctrlMinus: { position: 'absolute', width: 7, height: 1.5, backgroundColor: 'rgba(226,232,240,0.85)', bottom: 8, right: 6 },
  ctrlPlus: { position: 'absolute', width: 7, height: 1.5, backgroundColor: 'rgba(226,232,240,0.85)', bottom: 8, right: 6 },
  viewport: { position: 'relative', overflow: 'hidden', backgroundColor: '#0d2138' },
  gridLarge: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gridSmall: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  canvas: { position: 'absolute', top: 0, left: 0 },
  emptyCard: { borderRadius: 20, padding: 28, backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { color: 'rgba(226,232,240,0.55)', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  stageLabel: { color: '#60a5fa', fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
  stageSub: { color: '#94a3b8', fontSize: 7, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 },
  decorLabel: { color: '#1e293b', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', textAlign: 'center' },
  standingLabel: { color: '#ffffff', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center' },
  infoCard: { position: 'absolute', bottom: 52, left: 12, right: 12, backgroundColor: 'rgba(11,34,54,0.96)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(246,198,95,0.20)', padding: 12, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 12 },
  infoTitle: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  infoSub: { color: '#94a3b8', fontSize: 11, fontWeight: '600', marginTop: 1 },
  infoBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  infoStatus: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  infoStatusText: { fontSize: 10, fontWeight: '800' },
  infoPrice: { color: '#F97316', fontSize: 15, fontWeight: '900' },
  toolbar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#1e2228', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 12 },
  toolbarBack: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  toolbarName: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  toolbarSub: { color: '#94a3b8', fontSize: 11, fontWeight: '500' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  qtyBtnOrange: { backgroundColor: colors.orange },
  qtyBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '900', lineHeight: 20 },
  qtyVal: { color: '#ffffff', fontSize: 18, fontWeight: '900', minWidth: 24, textAlign: 'center' },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: 'rgba(203,213,225,0.70)', fontSize: 11, fontWeight: '600' },
});
