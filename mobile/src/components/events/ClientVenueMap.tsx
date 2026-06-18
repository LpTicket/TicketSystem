import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
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

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 1600;
const VIEWPORT_HEIGHT = 640;
const FIT_PADDING = 54;
const MAX_ZOOM = 2.6;
const ZOOM_STEP = 0.22;

type SeatInfo = {
  title: string;
  subtitle: string;
  status: string;
  price: number;
  tone: 'available' | 'selected' | 'sold' | 'reserved';
};

function parseSeatConfig(raw?: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function seatKey(seat: ClientSeat) {
  return seat.rowLabel ? `${seat.rowLabel}-${seat.seatNumber}` : `seat-${seat.seatNumber || seat.id}`;
}

function getKind(section: ClientVenueSection) {
  const raw = `${section.sectionType || section.type || section.name || section.label || ''}`.toLowerCase();
  if (raw.includes('stage') || raw.includes('pantalla') || raw.includes('escenario')) return 'stage';
  if (raw.includes('decor') || raw.includes('general area') || raw.includes('entrada')) return 'decor';
  if (raw.includes('standing')) return 'standing';
  if (raw.includes('table') || raw.includes('mesa')) return 'table';
  if (/^\d+$/.test(`${section.name || section.label || ''}`.trim())) return 'table';
  return 'seats';
}

function sectionColor(section: ClientVenueSection) {
  const name = `${section.name || section.label || ''}`.toLowerCase();
  if (section.color) return section.color;
  if (name.includes('bar')) return '#F97316';
  if (name.includes('general')) return '#E8554F';
  if (name.includes('pantalla')) return '#58C783';
  return '#5667FF';
}

function isSeatUnavailable(seat: ClientSeat, override: any) {
  const status = String(seat.status || 'available').toLowerCase();
  const lockedExpired = status === 'locked' && seat.lockExpiresAt && new Date(seat.lockExpiresAt).getTime() <= Date.now();
  return !lockedExpired && (status === 'sold' || status === 'reserved' || status === 'locked' || override?.reserved || override?.sold || override?.locked);
}

function isSelected(seat: ClientSeat, selectedSeats: ClientSeat[]) {
  return selectedSeats.some((item) => item.id === seat.id);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function tableLabel(name?: string | null, es = true) {
  const word = es ? 'Mesa' : 'Table';
  const raw = String(name || '').trim();
  if (!raw) return word;
  return /^(mesa|table)\b/i.test(raw) ? raw : `${word} ${raw}`;
}

function seatPrice(seat: ClientSeat, section: ClientVenueSection) {
  const overrides = parseSeatConfig(section.seatsConfig);
  const override = overrides[seatKey(seat)] || overrides[`seat-${seat.seatNumber}`] || {};
  return Number(override?.price ?? section.price ?? 0);
}

function seatTitle(seat: ClientSeat, section: ClientVenueSection, es = true) {
  const kind = getKind(section);
  if (kind === 'table') {
    return `${tableLabel(section.name || section.label, es)} · ${es ? 'Silla' : 'Seat'} ${seat.seatNumber || ''}`.trim();
  }
  const row = seat.rowLabel && seat.rowLabel !== 'GA' ? `${seat.rowLabel}-` : '';
  return `${section.name || section.label || (es ? 'Seccion' : 'Section')} ${row}${seat.seatNumber || ''}`.trim();
}

function buildSeatInfo(seat: ClientSeat, section: ClientVenueSection, selectedSeats: ClientSeat[], es = true): SeatInfo {
  const overrides = parseSeatConfig(section.seatsConfig);
  const override = overrides[seatKey(seat)] || overrides[`seat-${seat.seatNumber}`] || {};
  const selected = isSelected(seat, selectedSeats);
  const unavailable = isSeatUnavailable(seat, override);
  const statusRaw = String(seat.status || 'available').toLowerCase();
  const reserved = statusRaw === 'reserved' || override?.reserved;
  return {
    title: seatTitle(seat, section, es),
    subtitle: section.name || section.label || '',
    status: selected
      ? (es ? 'Seleccionado' : 'Selected')
      : reserved
        ? (es ? 'Reservado' : 'Reserved')
        : unavailable
          ? (es ? 'No disponible' : 'Unavailable')
          : (es ? 'Disponible' : 'Available'),
    price: seatPrice(seat, section),
    tone: selected ? 'selected' : reserved ? 'reserved' : unavailable ? 'sold' : 'available',
  };
}

function SeatDot({
  seat,
  section,
  override,
  selectedSeats,
  onToggleSeat,
  onSeatInfo,
  x,
  y,
  size,
}: {
  seat: ClientSeat;
  section: ClientVenueSection;
  override: any;
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
  onSeatInfo: (info: SeatInfo) => void;
  x: number;
  y: number;
  size: number;
}) {
  const selected = isSelected(seat, selectedSeats);
  const unavailable = isSeatUnavailable(seat, override);
  const color = sectionColor(section);
  const reserved = String(seat.status || '').toLowerCase() === 'reserved' || override?.reserved;
  const seatBg = selected ? colors.orange : unavailable ? (reserved ? '#FACC15' : '#CBD5E1') : color;

  return (
    <TouchableOpacity
      key={seat.id}
      disabled={unavailable && !selected}
      activeOpacity={0.82}
      onPress={() => {
        onSeatInfo(buildSeatInfo(seat, section, selectedSeats));
        onToggleSeat(seat);
      }}
      style={[
        styles.seatDot,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: seatBg,
          borderColor: selected ? '#FFFFFF' : unavailable ? seatBg : '#FFFFFF',
          opacity: unavailable && !selected ? 0.62 : 1,
          shadowColor: selected ? colors.orange : color,
          shadowOpacity: selected ? 0.4 : unavailable ? 0 : 0.2,
          shadowRadius: selected ? 8 : 4,
          transform: [{ scale: selected ? 1.16 : 1 }],
        },
      ]}
    >
      {override?.isWheelchair ? <Text style={[styles.wheelchair, { fontSize: clamp(size * 0.52, 6, 10) }]}>♿</Text> : null}
    </TouchableOpacity>
  );
}

function TableSection({
  section,
  scale,
  selectedSeats,
  onToggleSeat,
  onSeatInfo,
}: {
  section: ClientVenueSection;
  scale: number;
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
  onSeatInfo: (info: SeatInfo) => void;
}) {
  const seats = section.seats || [];
  const overrides = parseSeatConfig(section.seatsConfig);
  const width = Number(section.mapWidth || 100) * scale;
  const height = Number(section.mapHeight || 100) * scale;
  const color = sectionColor(section);
  const isRound = (section.tableShape || 'round') === 'round';
  const chairSize = clamp(Math.min(width, height) * 0.18, 5, 16);
  const chairRadius = chairSize / 2;
  const centerW = width * (isRound ? 0.60 : 0.70);
  const centerH = height * (isRound ? 0.60 : 0.45);
  const centerX = width / 2 - centerW / 2;
  const centerY = height / 2 - centerH / 2;
  const availableSeats = seats.filter((seat) => !isSeatUnavailable(seat, overrides[seatKey(seat)] || overrides[`seat-${seat.seatNumber}`] || {}));
  const selectedCount = availableSeats.filter((seat) => isSelected(seat, selectedSeats)).length;
  const allUnavailable = seats.length > 0 && availableSeats.length === 0;
  const tableFill = allUnavailable ? '#E5E7EB' : '#22415C';
  const tableStroke = allUnavailable ? '#9CA3AF' : 'rgba(246,198,95,0.48)';
  const label = section.name || section.label || '';
  const selectTable = () => {
    const targetSeats = selectedCount > 0 ? availableSeats.filter((seat) => isSelected(seat, selectedSeats)) : availableSeats;
    onSeatInfo({
      title: tableLabel(label),
      subtitle: `${availableSeats.length} sillas disponibles`,
      status: selectedCount > 0 ? 'Seleccionada' : allUnavailable ? 'No disponible' : 'Disponible',
      price: Number(section.price || 0),
      tone: selectedCount > 0 ? 'selected' : allUnavailable ? 'sold' : 'available',
    });
    targetSeats.forEach(onToggleSeat);
  };

  return (
    <View style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <G onPress={allUnavailable ? undefined : selectTable}>
          {isRound ? (
            <Circle
              cx={width / 2}
              cy={height / 2}
              r={Math.min(centerW, centerH) / 2}
              fill={tableFill}
              stroke={tableStroke}
              strokeWidth={1.4}
            />
          ) : (
            <Rect
              x={centerX}
              y={centerY}
              width={centerW}
              height={centerH}
              rx={Math.max(3, Math.min(centerW, centerH) * 0.08)}
              fill={tableFill}
              stroke={tableStroke}
              strokeWidth={1.4}
            />
          )}
          <SvgText
            x={width / 2}
            y={height / 2 + clamp(Math.min(width, height) * 0.055, 3, 6)}
            fill={allUnavailable ? '#64748B' : '#F8FAFC'}
            fontSize={clamp(Math.min(width, height) * 0.16, 7, 13)}
            fontWeight="900"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        </G>

        {seats.map((seat, index) => {
          const override = overrides[seatKey(seat)] || overrides[`seat-${seat.seatNumber}`] || {};
          if (override.disabled) return null;

          let cx = width / 2;
          let cy = height / 2;

          if (isRound) {
            const angle = (index * Math.PI * 2) / Math.max(1, seats.length) - Math.PI / 2;
            const radius = Math.min(width, height) * 0.43;
            cx = width / 2 + Math.cos(angle) * radius;
            cy = height / 2 + Math.sin(angle) * radius;
          } else {
            const count = Math.max(1, seats.length);
            const perimeter = 2 * (1 + 0.55);
            const step = perimeter / count;
            const pos = index * step;
            let xPct = 50;
            let yPct = 50;

            if (pos < 1) {
              xPct = 15 + pos * 70;
              yPct = 12;
            } else if (pos < 1.55) {
              xPct = 88;
              yPct = 15 + ((pos - 1) / 0.55) * 70;
            } else if (pos < 2.55) {
              xPct = 85 - (pos - 1.55) * 70;
              yPct = 88;
            } else {
              xPct = 12;
              yPct = 85 - ((pos - 2.55) / 0.55) * 70;
            }

            cx = (xPct / 100) * width;
            cy = (yPct / 100) * height;
          }

          cx += Number(override.xOffset || 0) * scale;
          cy += Number(override.yOffset || 0) * scale;
          const selected = isSelected(seat, selectedSeats);
          const unavailable = isSeatUnavailable(seat, override);
          const reserved = String(seat.status || '').toLowerCase() === 'reserved' || override?.reserved;
          const fill = selected ? colors.orange : unavailable ? (reserved ? '#FACC15' : '#CBD5E1') : color;
          const stroke = selected ? '#FFFFFF' : unavailable ? fill : '#FFFFFF';

          return (
            <G
              key={seat.id}
              onPress={() => {
                if (unavailable && !selected) return;
                onSeatInfo(buildSeatInfo(seat, section, selectedSeats));
                onToggleSeat(seat);
              }}
            >
              <Circle
                cx={cx}
                cy={cy}
                r={selected ? chairRadius * 1.18 : chairRadius}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                opacity={unavailable && !selected ? 0.66 : 1}
              />
              {override?.isWheelchair ? (
                <SvgText x={cx} y={cy + chairRadius * 0.38} fill="#FFFFFF" fontSize={chairRadius} fontWeight="900" textAnchor="middle">♿</SvgText>
              ) : null}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

function RowSeatsSection({
  section,
  scale,
  selectedSeats,
  onToggleSeat,
  onSeatInfo,
}: {
  section: ClientVenueSection;
  scale: number;
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
  onSeatInfo: (info: SeatInfo) => void;
}) {
  const seats = section.seats || [];
  const overrides = parseSeatConfig(section.seatsConfig);
  const width = Number(section.mapWidth || 100) * scale;
  const height = Number(section.mapHeight || 100) * scale;
  const rows = Array.from(new Set(seats.map((seat) => seat.rowLabel || 'A'))).sort();
  const curve = Number(section.curve || 0) * scale;
  const baseSpacingY = rows.length > 1 ? (height - 32 * scale) / (rows.length - 1) : 0;

  return (
    <View style={StyleSheet.absoluteFill}>
      {seats.map((seat) => {
        const row = seat.rowLabel || 'A';
        const rowIndex = Math.max(0, rows.indexOf(row));
        const rowSeats = seats
          .filter((item) => (item.rowLabel || 'A') === row)
          .sort((a, b) => Number(a.seatNumber || 0) - Number(b.seatNumber || 0));
        const seatIndex = Math.max(0, rowSeats.findIndex((item) => item.id === seat.id));
        const count = Math.max(1, rowSeats.length);
        const override = overrides[seatKey(seat)] || {};
        if (override.disabled) return null;

        const size = clamp(((Number(section.mapWidth || 100) - 24) / count - 2) * scale, 5, 14);
        const x = count > 1 ? 12 * scale + seatIndex * ((width - 24 * scale) / (count - 1)) : width / 2;
        const t = count > 1 ? (seatIndex - (count - 1) / 2) / ((count - 1) / 2) : 0;
        const y = 16 * scale + rowIndex * baseSpacingY + curve * (t * t - 1);

        return (
          <SeatDot
            key={seat.id}
            seat={seat}
            section={section}
            override={override}
            selectedSeats={selectedSeats}
            onToggleSeat={onToggleSeat}
            onSeatInfo={onSeatInfo}
            x={x - size / 2 + Number(override.xOffset || 0) * scale}
            y={y - size / 2 + Number(override.yOffset || 0) * scale}
            size={size}
          />
        );
      })}
    </View>
  );
}

export function ClientVenueMap({ seatMap, selectedSeats, onToggleSeat }: Props) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const [activeInfo, setActiveInfo] = useState<SeatInfo | null>(null);
  const [focusedSectionId, setFocusedSectionId] = useState<string | null>(null);

  const sections = useMemo(
    () =>
      seatMap.filter(
        (section) =>
          Number.isFinite(Number(section.mapX)) &&
          Number.isFinite(Number(section.mapY)) &&
          Number(section.mapWidth || 0) > 0 &&
          Number(section.mapHeight || 0) > 0
      ),
    [seatMap]
  );

  // Full-width viewport matching web — no side margins
  const viewportWidth = width;
  // Fixed tall viewport like the web (content centers inside it)
  const viewportHeight = Math.min(Math.max(width * 1.35, 440), 560);

  const fitView = useMemo(() => {
    if (!sections.length) {
      return { scale: 0.28, offset: { x: 0, y: 0 } };
    }

    const minX = Math.min(...sections.map((s) => Number(s.mapX || 0)));
    const minY = Math.min(...sections.map((s) => Number(s.mapY || 0)));
    const maxX = Math.max(...sections.map((s) => Number(s.mapX || 0) + Number(s.mapWidth || 0)));
    const maxY = Math.max(...sections.map((s) => Number(s.mapY || 0) + Number(s.mapHeight || 0)));

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);

    const scale = clamp(
      Math.min(
        (viewportWidth - FIT_PADDING) / contentW,
        (viewportHeight - FIT_PADDING) / contentH
      ),
      0.12, 1.05
    );

    return {
      scale,
      offset: {
        x: viewportWidth / 2 - ((minX + maxX) / 2) * scale,
        y: viewportHeight / 2 - ((minY + maxY) / 2) * scale,
      },
    };
  }, [sections, viewportWidth, viewportHeight]);

  const [scale, setScale] = useState(fitView.scale);
  const [offset, setOffset] = useState(fitView.offset);
  const gestureStart = useRef({ x: fitView.offset.x, y: fitView.offset.y, scale: fitView.scale, distance: 0 });
  const viewRef = useRef({ scale: fitView.scale, offset: fitView.offset });
  const fitScaleRef = useRef(fitView.scale);

  useEffect(() => {
    setScale(fitView.scale);
    setOffset(fitView.offset);
    setFocusedSectionId(null);
    gestureStart.current = { x: fitView.offset.x, y: fitView.offset.y, scale: fitView.scale, distance: 0 };
    viewRef.current = { scale: fitView.scale, offset: fitView.offset };
    fitScaleRef.current = fitView.scale;
  }, [fitView]);

  const zoom = (amount: number) => {
    setScale((current) => {
      const next = clamp(current + amount, fitView.scale, MAX_ZOOM);
      viewRef.current.scale = next;
      return next;
    });
  };

  const resetMap = () => {
    setScale(fitView.scale);
    setOffset(fitView.offset);
    setFocusedSectionId(null);
    setActiveInfo(null);
    viewRef.current = { scale: fitView.scale, offset: fitView.offset };
  };

  const focusSection = (section: ClientVenueSection) => {
    const kind = getKind(section);
    if (kind === 'stage' || kind === 'decor') return;
    const widthRaw = Number(section.mapWidth || 100);
    const heightRaw = Number(section.mapHeight || 100);
    const targetScale = clamp(Math.min((viewportWidth * 0.80) / widthRaw, (viewportHeight * 0.65) / heightRaw), fitView.scale, MAX_ZOOM);
    const nextOffset = {
      x: viewportWidth / 2 - (Number(section.mapX || 0) + widthRaw / 2) * targetScale,
      y: viewportHeight / 2 - (Number(section.mapY || 0) + heightRaw / 2) * targetScale - 42,
    };
    setFocusedSectionId(section.id);
    setScale(targetScale);
    setOffset(nextOffset);
    setActiveInfo({
      title: section.name || section.label || t('Sección', 'Section'),
      subtitle: kind === 'standing' ? t('Acceso general', 'General admission') : `${section.seats?.length || 0} ${t('asientos', 'seats')}`,
      status: t('Selecciona en el mapa', 'Select on map'),
      price: Number(section.price || 0),
      tone: 'available',
    });
    viewRef.current = { scale: targetScale, offset: nextOffset };
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const touches = event.nativeEvent.touches;
        const distance =
          touches.length >= 2
            ? Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY)
            : 0;

        gestureStart.current = { x: viewRef.current.offset.x, y: viewRef.current.offset.y, scale: viewRef.current.scale, distance };
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;

        if (touches.length >= 2 && gestureStart.current.distance > 0) {
          const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          const nextScale = clamp(gestureStart.current.scale * (distance / gestureStart.current.distance), fitScaleRef.current, MAX_ZOOM);
          setScale(nextScale);
          viewRef.current.scale = nextScale;
          return;
        }

        const nextOffset = {
          x: gestureStart.current.x + gesture.dx,
          y: gestureStart.current.y + gesture.dy,
        };
        setOffset(nextOffset);
        viewRef.current.offset = nextOffset;
      },
    })
  ).current;

  if (!sections.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{t('Mapa visual no disponible', 'Visual map unavailable')}</Text>
        <Text style={styles.emptyCopy}>{t('Este evento todavía no tiene un mapa visual publicado.', 'This event does not have a published visual map yet.')}</Text>
      </View>
    );
  }

  const verticalLines = Array.from({ length: 41 }, (_, index) => index * 50);
  const horizontalLines = Array.from({ length: 33 }, (_, index) => index * 50);
  const selectedInFocus = focusedSectionId ? selectedSeats.filter((seat) => seat.sectionId === focusedSectionId).length : 0;

  return (
    <View style={styles.wrap}>

      <View style={[styles.viewport, { height: viewportHeight }]} {...panResponder.panHandlers}>
        <View
          style={[
            styles.canvas,
            {
              left: offset.x,
              top: offset.y,
              width: CANVAS_WIDTH * scale,
              height: CANVAS_HEIGHT * scale,
            },
          ]}
        >
          {verticalLines.map((x) => (
            <View key={`v-${x}`} style={[styles.gridLineV, { left: x * scale }]} />
          ))}
          {horizontalLines.map((y) => (
            <View key={`h-${y}`} style={[styles.gridLineH, { top: y * scale }]} />
          ))}

          {sections.map((section) => {
            const kind = getKind(section);
            const color = sectionColor(section);
            const name = section.name || section.label || t('Sección', 'Section');
            const left = Number(section.mapX || 0) * scale;
            const top = Number(section.mapY || 0) * scale;
            const sectionWidth = Number(section.mapWidth || 100) * scale;
            const sectionHeight = Number(section.mapHeight || 100) * scale;
            const focused = focusedSectionId === section.id;
            const dimmed = focusedSectionId && !focused && kind !== 'stage';

            return (
              <TouchableOpacity
                key={section.id}
                activeOpacity={kind === 'stage' || kind === 'decor' ? 1 : 0.9}
                disabled={kind === 'stage' || kind === 'decor'}
                onPress={() => focusSection(section)}
                style={[
                  styles.section,
                  kind === 'stage' && styles.stageSection,
                  kind === 'decor' && styles.decorSection,
                  kind === 'standing' && styles.standingSection,
                  focused && styles.focusedSection,
                  {
                    left,
                    top,
                    width: sectionWidth,
                    height: sectionHeight,
                    borderColor: kind === 'table' || kind === 'seats' ? 'transparent' : color,
                    borderWidth:
                      kind === 'table' || kind === 'seats'
                        ? 0
                        : kind === 'decor'
                          ? 1
                          : 2,
                    backgroundColor:
                      kind === 'stage'
                        ? '#0F172A'
                        : kind === 'standing' || kind === 'decor'
                          ? color
                          : 'transparent',
                    borderRadius:
                      kind === 'stage'
                        ? 18 * scale
                        : kind === 'table' && (section.tableShape || 'round') === 'round'
                          ? Math.min(sectionWidth, sectionHeight) / 2
                          : 4 * scale,
                    transform: [{ rotate: `${Number(section.rotation || 0)}deg` }],
                    opacity: dimmed ? 0.34 : 1,
                  },
                ]}
              >
                {kind === 'stage' && (
                  <>
                    <Text style={[styles.stageName, { fontSize: clamp(13 * scale, 5, 13) }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.stageSub, { fontSize: clamp(9 * scale, 4, 9) }]} numberOfLines={1}>{t('ESCENARIO', 'STAGE')}</Text>
                  </>
                )}

                {kind === 'decor' && (
                  <Text style={[styles.decorName, { fontSize: clamp(12 * scale, 5, 12) }]} numberOfLines={1}>{name}</Text>
                )}

                {kind === 'standing' && (
                  <Text style={[styles.standingName, { fontSize: clamp(12 * scale, 5, 12) }]} numberOfLines={1}>{name}</Text>
                )}

                {kind === 'table' && (
                  <TableSection section={section} scale={scale} selectedSeats={selectedSeats} onToggleSeat={onToggleSeat} onSeatInfo={setActiveInfo} />
                )}

                {kind === 'seats' && (
                  <RowSeatsSection section={section} scale={scale} selectedSeats={selectedSeats} onToggleSeat={onToggleSeat} onSeatInfo={setActiveInfo} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeInfo && (
          <View style={styles.infoCard} pointerEvents="none">
            <View style={styles.infoTop}>
              <View style={styles.infoTextBlock}>
                <Text style={styles.infoTitle} numberOfLines={1}>{activeInfo.title}</Text>
                <Text style={styles.infoSubtitle} numberOfLines={1}>{activeInfo.subtitle}</Text>
              </View>
              <Text style={styles.infoPrice}>${activeInfo.price.toFixed(2)}</Text>
            </View>
            <View style={[styles.infoStatus, styles[`infoStatus_${activeInfo.tone}` as const]]}>
              <Text style={[styles.infoStatusText, styles[`infoStatusText_${activeInfo.tone}` as const]]}>{activeInfo.status}</Text>
            </View>
          </View>
        )}

        {focusedSectionId && (
          <View style={styles.focusBar}>
            <TouchableOpacity style={styles.focusBack} onPress={resetMap}>
              <Text style={styles.focusBackText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.focusCopy}>
              <Text style={styles.focusTitle} numberOfLines={1}>
                {sections.find((section) => section.id === focusedSectionId)?.name || t('Sección', 'Section')}
              </Text>
              <Text style={styles.focusMeta}>{selectedInFocus} {t('seleccionado(s)', 'selected')}</Text>
            </View>
          </View>
        )}

        {/* Floating controls + hint — top right, exactly like web */}
        <View style={styles.floatingControls} pointerEvents="box-none">
          <Text style={styles.helpText}>
            {'👆 '}{t('Arrastra · pellizca', 'Drag to pan · Pinch to zoom')}
          </Text>
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => zoom(-ZOOM_STEP)}>
              <Ionicons name="search-outline" size={15} color="rgba(226,232,240,0.85)" />
              <View style={styles.controlMinus} />
            </TouchableOpacity>
            <View style={styles.controlDivider} />
            <TouchableOpacity style={styles.controlButton} onPress={() => zoom(ZOOM_STEP)}>
              <Ionicons name="search-outline" size={15} color="rgba(226,232,240,0.85)" />
              <View style={styles.controlPlus} />
            </TouchableOpacity>
            <View style={styles.controlDivider} />
            <TouchableOpacity style={styles.controlButton} onPress={resetMap}>
              <Ionicons name="contract-outline" size={15} color="rgba(226,232,240,0.85)" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendAvailable]} /><Text style={styles.legendText}>{t('Disponible', 'Available')}</Text></View>
        <View style={styles.legendSep} />
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendSelected]} /><Text style={styles.legendText}>{t('Seleccionado', 'Selected')}</Text></View>
        <View style={styles.legendSep} />
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendSold]} /><Text style={styles.legendText}>{t('Vendido', 'Sold')}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#0B1623',
  },
  floatingControls: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 6,
    zIndex: 50,
  },
  helpText: {
    color: 'rgba(226,232,240,0.55)',
    fontSize: 11.5,
    fontWeight: '500',
  },
  controls: {
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(11,22,35,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  controlButton: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlMinus: {
    position: 'absolute',
    bottom: 9,
    right: 7,
    width: 7,
    height: 1.5,
    backgroundColor: 'rgba(226,232,240,0.85)',
    borderRadius: 1,
  },
  controlPlus: {
    position: 'absolute',
    bottom: 9,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 0.5,
    // drawn via borderBottom trick — use the minus bar + vertical bar
  },
  controlDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.18)' },
  viewport: {
    overflow: 'hidden',
    backgroundColor: '#0B1A2B',
  },
  canvas: {
    position: 'absolute',
    backgroundColor: '#0B1A2B',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(100,160,220,0.08)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(100,160,220,0.08)',
  },
  section: {
    position: 'absolute',
    borderWidth: 2,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusedSection: {
    borderWidth: 2.6,
    shadowColor: colors.orange,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    zIndex: 40,
  },
  stageSection: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  decorSection: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  standingSection: {
    borderWidth: 2,
  },
  stageName: {
    color: '#60A5FA',
    fontWeight: '700',
    letterSpacing: 0,
  },
  stageSub: {
    color: '#94A3B8',
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 1,
  },
  decorName: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0,
  },
  standingName: {
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0,
  },
  tableCore: {
    position: 'absolute',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: '#22415C',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 8,
  },
  tableLabel: {
    color: '#F8FAFC',
    fontWeight: '900',
    textAlign: 'center',
  },
  seatDot: {
    position: 'absolute',
    borderWidth: 1.5,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
  },
  wheelchair: { color: '#FFFFFF', fontWeight: '900' },
  infoCard: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(246,198,95,0.24)',
    backgroundColor: 'rgba(8,31,51,0.94)',
    padding: 13,
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  infoTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  infoTextBlock: { flex: 1 },
  infoTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  infoSubtitle: { color: 'rgba(203,213,225,0.74)', fontSize: 11.5, fontWeight: '700', marginTop: 3 },
  infoPrice: { color: colors.orange, fontSize: 15, fontWeight: '900' },
  infoStatus: { alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5, marginTop: 10 },
  infoStatus_available: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.28)' },
  infoStatus_selected: { backgroundColor: 'rgba(249,115,22,0.14)', borderColor: 'rgba(249,115,22,0.36)' },
  infoStatus_sold: { backgroundColor: 'rgba(148,163,184,0.14)', borderColor: 'rgba(148,163,184,0.25)' },
  infoStatus_reserved: { backgroundColor: 'rgba(250,204,21,0.14)', borderColor: 'rgba(250,204,21,0.34)' },
  infoStatusText: { fontSize: 10.5, fontWeight: '900' },
  infoStatusText_available: { color: '#86EFAC' },
  infoStatusText_selected: { color: '#FDBA74' },
  infoStatusText_sold: { color: '#CBD5E1' },
  infoStatusText_reserved: { color: '#FDE68A' },
  focusBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    minHeight: 62,
    borderRadius: 20,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  focusBack: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  focusBackText: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: -2 },
  focusCopy: { flex: 1 },
  focusTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  focusMeta: { color: 'rgba(203,213,225,0.70)', fontSize: 12, fontWeight: '700', marginTop: 3 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSep: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4 },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  legendAvailable: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.45)' },
  legendSelected: { backgroundColor: colors.orange, borderColor: colors.orange },
  legendSold: { backgroundColor: '#94A3B8', borderColor: '#94A3B8' },
  legendText: { color: 'rgba(203,213,225,0.70)', fontSize: 12, fontWeight: '500' },
  emptyCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  emptyCopy: { color: 'rgba(226,232,240,0.72)', fontSize: 13, lineHeight: 20, marginTop: 8 },
});
