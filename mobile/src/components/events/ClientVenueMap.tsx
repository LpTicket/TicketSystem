import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
const VIEWPORT_HEIGHT = 620;
const FIT_PADDING = 54;

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

function SeatDot({
  seat,
  section,
  override,
  selectedSeats,
  onToggleSeat,
  x,
  y,
  size,
}: {
  seat: ClientSeat;
  section: ClientVenueSection;
  override: any;
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
  x: number;
  y: number;
  size: number;
}) {
  const selected = isSelected(seat, selectedSeats);
  const unavailable = isSeatUnavailable(seat, override);
  const color = sectionColor(section);

  return (
    <TouchableOpacity
      key={seat.id}
      disabled={unavailable && !selected}
      onPress={() => onToggleSeat(seat)}
      style={[
        styles.seatDot,
        {
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: selected ? colors.orange : unavailable ? '#DCE3EA' : '#DCE3EA',
          borderColor: selected ? '#FFFFFF' : unavailable ? '#DCE3EA' : color,
          opacity: unavailable && !selected ? 0.62 : 1,
        },
      ]}
    />
  );
}

function TableSection({
  section,
  scale,
  selectedSeats,
  onToggleSeat,
}: {
  section: ClientVenueSection;
  scale: number;
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
}) {
  const seats = section.seats || [];
  const overrides = parseSeatConfig(section.seatsConfig);
  const width = Number(section.mapWidth || 100) * scale;
  const height = Number(section.mapHeight || 100) * scale;
  const color = sectionColor(section);
  const isRound = (section.tableShape || 'round') === 'round';
  const chairSize = clamp(Math.min(width, height) * 0.18, 5, 16);
  const centerW = width * (isRound ? 0.60 : 0.70);
  const centerH = height * (isRound ? 0.60 : 0.45);
  const centerX = width / 2 - centerW / 2;
  const centerY = height / 2 - centerH / 2;
  const allUnavailable = seats.length > 0 && seats.every((seat) => isSeatUnavailable(seat, overrides[seatKey(seat)] || {}));

  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={[
          styles.tableCore,
          {
            left: centerX,
            top: centerY,
            width: centerW,
            height: centerH,
            borderRadius: isRound ? Math.min(centerW, centerH) / 2 : 4,
            borderColor: allUnavailable ? '#9CA3AF' : color,
            backgroundColor: allUnavailable ? '#E5E7EB' : '#F8FAFC',
          },
        ]}
      >
        <Text style={[styles.tableLabel, { fontSize: clamp(Math.min(width, height) * 0.16, 7, 13) }]} numberOfLines={1}>
          {section.name || section.label}
        </Text>
      </View>

      {seats.map((seat, index) => {
        const override = overrides[seatKey(seat)] || overrides[`seat-${seat.seatNumber}`] || {};
        if (override.disabled) return null;

        let x = width / 2 - chairSize / 2;
        let y = height / 2 - chairSize / 2;

        if (isRound) {
          const angle = (index * Math.PI * 2) / Math.max(1, seats.length) - Math.PI / 2;
          const radius = Math.min(width, height) * 0.43;
          x = width / 2 + Math.cos(angle) * radius - chairSize / 2;
          y = height / 2 + Math.sin(angle) * radius - chairSize / 2;
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

          x = (xPct / 100) * width - chairSize / 2;
          y = (yPct / 100) * height - chairSize / 2;
        }

        return (
          <SeatDot
            key={seat.id}
            seat={seat}
            section={section}
            override={override}
            selectedSeats={selectedSeats}
            onToggleSeat={onToggleSeat}
            x={x + Number(override.xOffset || 0) * scale}
            y={y + Number(override.yOffset || 0) * scale}
            size={chairSize}
          />
        );
      })}
    </View>
  );
}

function RowSeatsSection({
  section,
  scale,
  selectedSeats,
  onToggleSeat,
}: {
  section: ClientVenueSection;
  scale: number;
  selectedSeats: ClientSeat[];
  onToggleSeat: (seat: ClientSeat) => void;
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

  const viewportWidth = Math.max(280, width - 64);

  const fitView = useMemo(() => {
    if (!sections.length) {
      return { scale: 0.28, offset: { x: 0, y: 0 } };
    }

    const minX = Math.min(...sections.map((section) => Number(section.mapX || 0)));
    const minY = Math.min(...sections.map((section) => Number(section.mapY || 0)));
    const maxX = Math.max(...sections.map((section) => Number(section.mapX || 0) + Number(section.mapWidth || 0)));
    const maxY = Math.max(...sections.map((section) => Number(section.mapY || 0) + Number(section.mapHeight || 0)));

    const contentW = Math.max(1, maxX - minX);
    const contentH = Math.max(1, maxY - minY);
    const scale = clamp(
      Math.min((viewportWidth - FIT_PADDING) / contentW, (VIEWPORT_HEIGHT - FIT_PADDING) / contentH),
      0.18,
      0.9
    );

    return {
      scale,
      offset: {
        x: viewportWidth / 2 - ((minX + maxX) / 2) * scale,
        y: VIEWPORT_HEIGHT / 2 - ((minY + maxY) / 2) * scale,
      },
    };
  }, [sections, viewportWidth]);

  const [scale, setScale] = useState(fitView.scale);
  const [offset, setOffset] = useState(fitView.offset);
  const gestureStart = useRef({ x: fitView.offset.x, y: fitView.offset.y, scale: fitView.scale, distance: 0 });

  useEffect(() => {
    setScale(fitView.scale);
    setOffset(fitView.offset);
    gestureStart.current = { x: fitView.offset.x, y: fitView.offset.y, scale: fitView.scale, distance: 0 };
  }, [fitView]);

  const zoom = (amount: number) => {
    setScale((current) => clamp(current + amount, fitView.scale, 2.4));
  };

  const resetMap = () => {
    setScale(fitView.scale);
    setOffset(fitView.offset);
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

        gestureStart.current = { x: offset.x, y: offset.y, scale, distance };
      },
      onPanResponderMove: (event, gesture) => {
        const touches = event.nativeEvent.touches;

        if (touches.length >= 2 && gestureStart.current.distance > 0) {
          const distance = Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
          setScale(clamp(gestureStart.current.scale * (distance / gestureStart.current.distance), fitView.scale, 2.4));
          return;
        }

        setOffset({
          x: gestureStart.current.x + gesture.dx,
          y: gestureStart.current.y + gesture.dy,
        });
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

  return (
    <View style={styles.wrap}>
      <View style={styles.topBar}>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={() => zoom(-0.12)}>
            <Text style={styles.controlText}>−</Text>
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity style={styles.controlButton} onPress={() => zoom(0.12)}>
            <Text style={styles.controlText}>+</Text>
          </TouchableOpacity>
          <View style={styles.controlDivider} />
          <TouchableOpacity style={styles.controlButton} onPress={resetMap}>
            <Text style={styles.controlText}>⌖</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.helpText}>{t('👆 Arrastra para mover · pellizca para zoom', '👆 Drag to pan · pinch to zoom')}</Text>
      </View>

      <View style={styles.viewport} {...panResponder.panHandlers}>
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

            return (
              <View
                key={section.id}
                style={[
                  styles.section,
                  kind === 'stage' && styles.stageSection,
                  kind === 'decor' && styles.decorSection,
                  kind === 'standing' && styles.standingSection,
                  {
                    left,
                    top,
                    width: sectionWidth,
                    height: sectionHeight,
                    borderColor: color,
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
                  <TableSection section={section} scale={scale} selectedSeats={selectedSeats} onToggleSeat={onToggleSeat} />
                )}

                {kind === 'seats' && (
                  <RowSeatsSection section={section} scale={scale} selectedSeats={selectedSeats} onToggleSeat={onToggleSeat} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.available]} /><Text style={styles.legendText}>{t('Disponible', 'Available')}</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.selected]} /><Text style={styles.legendText}>{t('Seleccionado', 'Selected')}</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.sold]} /><Text style={styles.legendText}>{t('Vendido', 'Sold')}</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendDot, styles.reserved]} /><Text style={styles.legendText}>{t('Reservado', 'Reserved')}</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(8,31,51,0.58)',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 12,
  },
  controls: {
    alignSelf: 'flex-end',
    height: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  controlButton: { width: 46, height: 42, alignItems: 'center', justifyContent: 'center' },
  controlText: { color: 'rgba(226,232,240,0.82)', fontSize: 22, fontWeight: '800' },
  controlDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.22)' },
  helpText: {
    color: 'rgba(226,232,240,0.62)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  viewport: {
    height: VIEWPORT_HEIGHT,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#12243A',
  },
  canvas: {
    position: 'absolute',
    backgroundColor: '#14263D',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  section: {
    position: 'absolute',
    borderWidth: 2,
    overflow: 'visible',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  stageSub: {
    color: '#94A3B8',
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 1,
  },
  decorName: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  standingName: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  tableCore: {
    position: 'absolute',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tableLabel: {
    color: '#64748B',
    fontWeight: '900',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  seatDot: {
    position: 'absolute',
    borderWidth: 1.5,
    zIndex: 30,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  available: { backgroundColor: '#13263D' },
  selected: { backgroundColor: colors.orange },
  sold: { backgroundColor: '#DCE3EA' },
  reserved: { backgroundColor: '#FFD166' },
  legendText: { color: 'rgba(226,232,240,0.72)', fontSize: 11, fontWeight: '600' },
  emptyCard: {
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  emptyCopy: { color: 'rgba(226,232,240,0.72)', fontSize: 13, lineHeight: 20, marginTop: 8 },
});
