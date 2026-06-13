import { GestureResponderEvent, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

type ItemType = 'table' | 'seat' | 'area' | 'bar' | 'stage';
type TableShape = 'rectangle' | 'round' | 'soft';
type SaleMode = 'whole' | 'seat';

type VenueItem = {
  id: string;
  type: ItemType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  price: number;
  rows: number;
  seatsPerRow: number;
  fontSize: number;
  shape: TableShape;
  saleMode: SaleMode;
  locked: boolean;
  blockedSeats: string[];
};

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 640;

const palette = ['#ff6b16', '#f59e0b', '#10b981', '#64748b', '#ef4444', '#a855f7'];

const initialItems: VenueItem[] = [
  { id: 'bar-1', type: 'bar', name: 'BAR', x: 95, y: 130, width: 260, height: 120, color: '#ff8138', price: 0, rows: 0, seatsPerRow: 0, fontSize: 18, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [] },
  { id: 'area-1', type: 'area', name: 'General Area', x: 135, y: 290, width: 205, height: 62, color: '#64748b', price: 25, rows: 0, seatsPerRow: 0, fontSize: 15, shape: 'soft', saleMode: 'seat', locked: false, blockedSeats: [] },
  { id: 'table-31', type: 'table', name: '31', x: 500, y: 355, width: 86, height: 58, color: '#16b981', price: 100, rows: 2, seatsPerRow: 3, fontSize: 10, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [] },
  { id: 'table-30', type: 'table', name: '30', x: 650, y: 275, width: 96, height: 64, color: '#f59e0b', price: 100, rows: 2, seatsPerRow: 5, fontSize: 10, shape: 'rectangle', saleMode: 'seat', locked: false, blockedSeats: [] },
];

export function VenueMapEditor() {
  const { t } = useLanguage();
  const [items, setItems] = useState<VenueItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[2].id);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [canvasPan, setCanvasPan] = useState({ x: -60, y: -40 });
  const [canvasDrag, setCanvasDrag] = useState<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [objectDrag, setObjectDrag] = useState<{ id: string; x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);
  const capacity = items.reduce((sum, item) => sum + getCapacity(item), 0);
  const soldSeats = Math.min(8, capacity);
  const availableSeats = Math.max(capacity - soldSeats, 0);

  const canvasTransformStyle = {
    transform: [
      { translateX: canvasPan.x },
      { translateY: canvasPan.y },
      { scale: zoom },
    ],
  };

  const updateSelected = (patch: Partial<VenueItem>) => {
    if (!selected) return;
    setSaved(false);
    setItems((current) => current.map((item) => item.id === selected.id ? { ...item, ...patch } : item));
  };

  const addItem = (type: ItemType) => {
    const next = items.length + 1;
    const item: VenueItem = {
      id: `${type}-${Date.now()}`,
      type,
      name: type === 'table' ? `${next}` : type === 'seat' ? `S${next}` : type === 'area' ? 'General Area' : type === 'bar' ? 'BAR' : 'STAGE',
      x: 130 + (items.length % 4) * 45,
      y: 120 + (items.length % 5) * 42,
      width: type === 'table' ? 92 : type === 'seat' ? 34 : type === 'area' ? 190 : type === 'bar' ? 240 : 220,
      height: type === 'table' ? 64 : type === 'seat' ? 34 : type === 'area' ? 66 : type === 'bar' ? 90 : 42,
      color: type === 'stage' ? '#10b981' : type === 'bar' ? '#ff8138' : type === 'area' ? '#64748b' : '#f59e0b',
      price: type === 'table' ? 100 : type === 'seat' ? 20 : type === 'area' ? 25 : 0,
      rows: type === 'table' ? 2 : type === 'seat' ? 1 : 0,
      seatsPerRow: type === 'table' ? 4 : type === 'seat' ? 1 : 0,
      fontSize: type === 'table' ? 10 : 14,
      shape: type === 'table' ? 'rectangle' : 'soft',
      saleMode: type === 'table' ? 'whole' : 'seat',
      locked: false,
      blockedSeats: [],
    };

    setSaved(false);
    setItems((current) => [...current, item]);
    setSelectedId(item.id);
    setSelectedSeat(null);
  };

  const moveItem = (item: VenueItem, x: number, y: number) => {
    if (item.locked) return;
    setSaved(false);
    setItems((current) => current.map((entry) => entry.id === item.id ? {
      ...entry,
      x: Math.max(0, Math.min(CANVAS_WIDTH - entry.width, x)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - entry.height, y)),
    } : entry));
  };

  const resizeSelected = (width: number, height: number) => {
    updateSelected({
      width: Math.max(34, Math.min(420, width)),
      height: Math.max(34, Math.min(260, height)),
    });
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: `${selected.type}-${Date.now()}`, x: selected.x + 24, y: selected.y + 24, name: `${selected.name}` };
    setSaved(false);
    setItems((current) => [...current, copy]);
    setSelectedId(copy.id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    const next = items.filter((item) => item.id !== selected.id);
    setSaved(false);
    setItems(next);
    setSelectedId(next[0]?.id || '');
    setSelectedSeat(null);
  };

  const toggleSeat = (seatId: string) => {
    if (!selected) return;
    setSelectedSeat(seatId);
    updateSelected({
      blockedSeats: selected.blockedSeats.includes(seatId)
        ? selected.blockedSeats.filter((seat) => seat !== seatId)
        : [...selected.blockedSeats, seatId],
    });
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandText}>Lpt</Text>
          </View>
          <View>
            <Text style={styles.brandEyebrow}>Chart</Text>
            <Text style={styles.brandTitle}>{t('Diseñador de Asientos', 'Seat Designer')}</Text>
          </View>
          <View style={styles.capacityPill}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapStatsScroller} contentContainerStyle={styles.mapStatsRow}>
              <View style={styles.mapStatPill}>
                <Text style={styles.mapStatLabel}>{t('Capacidad', 'Capacity')}</Text>
                <Text style={styles.mapStatValue}>{capacity}</Text>
              </View>
              <View style={styles.mapStatPill}>
                <Text style={styles.mapStatLabel}>{t('Vendidas', 'Sold')}</Text>
                <Text style={styles.mapStatValue}>{soldSeats}</Text>
              </View>
              <View style={[styles.mapStatPill, styles.mapStatAvailable]}>
                <Text style={styles.mapStatLabel}>{t('Disponibles', 'Available')}</Text>
                <Text style={styles.mapStatValue}>{availableSeats}</Text>
              </View>
            </ScrollView>
          </View>
        </View>

        <TouchableOpacity onPress={() => setSaved(true)} style={styles.saveButton}>
          <Text style={styles.saveText}>{saved ? 'GUARDADO' : 'GUARDAR'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.workbench}>
          <View style={styles.leftRail}>
          <Tool icon="▦" label={t('Mesa', 'Table')} onPress={() => addItem('table')} />
          <Tool icon="□" label={t('Área', 'Area')} onPress={() => addItem('area')} />
          <Tool icon="▬" label={t('Barra', 'Bar')} onPress={() => addItem('bar')} />
          <Tool icon="▰" label={t('Escenario', 'Stage')} onPress={() => addItem('stage')} />
          <Tool icon="●" label={t('Asiento', 'Seat')} onPress={() => addItem('seat')} />

          <View style={styles.railZoom}>
            <TouchableOpacity onPress={() => setZoom((current) => Math.max(0.4, Number((current - 0.15).toFixed(2))))} style={styles.railZoomButton}>
              <Text style={styles.railZoomText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.railZoomValue}>{Math.round(zoom * 100)}%</Text>
            <TouchableOpacity onPress={() => setZoom((current) => Math.min(2.4, Number((current + 0.15).toFixed(2))))} style={styles.railZoomButton}>
              <Text style={styles.railZoomText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

          <View style={styles.canvasViewport}>
            <View
            style={[styles.canvas, canvasTransformStyle]}
            onStartShouldSetResponder={(event: any) => event.target === event.currentTarget}
            onMoveShouldSetResponder={(event: any) => event.target === event.currentTarget}
            onResponderGrant={(event: GestureResponderEvent) => {
              setCanvasDrag({ x: canvasPan.x, y: canvasPan.y, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY });
            }}
            onResponderMove={(event: GestureResponderEvent) => {
              if (!canvasDrag) return;
              setCanvasPan({
                x: Math.max(-700, Math.min(160, canvasDrag.x + event.nativeEvent.pageX - canvasDrag.pageX)),
                y: Math.max(-520, Math.min(160, canvasDrag.y + event.nativeEvent.pageY - canvasDrag.pageY)),
              });
            }}
            onResponderRelease={() => setCanvasDrag(null)}
          >
              {items.map((item) => {
                const isSelected = selectedId === item.id;

                return (
                  <View
                    key={item.id}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(event: GestureResponderEvent) => {
                      setCanvasDrag(null);
                      setSelectedId(item.id);
                      setSelectedSeat(null);
                      setDrag({ id: item.id, x: item.x, y: item.y, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY });
                    }}
                    onResponderMove={(event: GestureResponderEvent) => {
                      if (!drag || drag.id !== item.id) return;
                      const nextX = drag.x + event.nativeEvent.pageX - drag.pageX;
                      const nextY = drag.y + event.nativeEvent.pageY - drag.pageY;
                      moveItem(item, nextX, nextY);
                    }}
                    onResponderRelease={() => setDrag(null)}
                    style={[
                      styles.mapItem,
                      shapeStyle(item),
                      {
                        left: item.x,
                        top: item.y,
                        width: item.width,
                        height: item.height,
                        borderColor: isSelected ? '#F97316' : 'rgba(255,255,255,0.30)',
                        backgroundColor: item.type === 'table' || item.type === 'seat' ? '#030B14' : item.color,
                      },
                      item.locked && styles.lockedItem,
                    ]}
                  >
                    {(item.type === 'table' || item.type === 'seat') && (
                      <SeatDots item={item} selectedSeat={selectedSeat} onSeatPress={toggleSeat} />
                    )}

                    <Text style={[styles.itemLabel, { fontSize: item.fontSize, color: '#FFFFFF' }]}>
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.inspector}>
            <View style={styles.inspectorHeader}>
              <Text style={styles.inspectorTitle}>{t('INSPECTOR DE OBJETO', 'OBJECT INSPECTOR')}</Text>
              <TouchableOpacity onPress={duplicateSelected}><Text style={styles.iconButton}>{t('COPIAR', 'COPY')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={deleteSelected}><Text style={styles.deleteText}>{t('BORRAR', 'DEL')}</Text></TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inspectorContent}>
                <Text style={styles.sectionLabel}>{t('TAMAÑO DEL TEXTO', 'TEXT SIZE')}</Text>
                <View style={styles.sliderCard}>
                  <Text style={styles.sliderCopy}>{t('Nombre visible en el mapa', 'Name visible on the map')}</Text>
                  <NumericMini value={selected.fontSize} min={8} max={28} step={1} onChange={(value) => updateSelected({ fontSize: value })} />
                </View>

                <Text style={styles.inputLabel}>{t('Nombre', 'Name')}</Text>
                <TextInput value={selected.name} onChangeText={(name) => updateSelected({ name })} style={styles.input} />

                <View style={styles.row2}>
                  <Field label={t('Precio/Silla', 'Price/Seat')} value={selected.price} step={5} min={0} onChange={(value) => updateSelected({ price: value })} />
                  <Field label={t('Total Mesa', 'Table Total')} value={selected.price * Math.max(1, getCapacity(selected))} step={5} min={0} onChange={() => undefined} readonly />
                </View>

                <TouchableOpacity onPress={() => updateSelected({ locked: !selected.locked })} style={styles.blockButton}>
                  <Text style={styles.blockText}>{selected.locked ? 'DESBLOQUEAR TODO' : 'BLOQUEAR / DESBLOQUEAR TODO'}</Text>
                </TouchableOpacity>

                {(selected.type === 'table' || selected.type === 'seat') && (
                  <>
                    <Text style={styles.sectionLabel}>{t('DISEÑO (LAYOUT)', 'DESIGN (LAYOUT)')}</Text>
                    <View style={styles.row2}>
                      <Field label={t('Número de Filas', 'Number of Rows')} value={selected.rows} step={1} min={1} max={8} onChange={(rows) => updateSelected({ rows })} />
                      <Field label={t('Asientos por Mesa', 'Seats per Table')} value={selected.seatsPerRow} step={1} min={1} max={16} onChange={(seatsPerRow) => updateSelected({ seatsPerRow })} />
                    </View>

                    <Text style={styles.inputLabel}>{t('Forma de la Mesa', 'Table Shape')}</Text>
                    <View style={styles.segmentRow}>
                      <Segment label={t('Rectangular', 'Rectangle')} active={selected.shape === 'rectangle'} onPress={() => updateSelected({ shape: 'rectangle' })} />
                      <Segment label={t('Redonda', 'Round')} active={selected.shape === 'round'} onPress={() => updateSelected({ shape: 'round' })} />
                      <Segment label={t('Suave', 'Soft')} active={selected.shape === 'soft'} onPress={() => updateSelected({ shape: 'soft' })} />
                    </View>

                    <Text style={styles.inputLabel}>{t('Modo de Venta', 'Sale Mode')}</Text>
                    <View style={styles.segmentRow}>
                      <Segment label={t('Mesa Completa', 'Whole Table')} active={selected.saleMode === 'whole'} onPress={() => updateSelected({ saleMode: 'whole' })} />
                      <Segment label={t('Por Silla', 'Per Seat')} active={selected.saleMode === 'seat'} onPress={() => updateSelected({ saleMode: 'seat' })} />
                    </View>
                  </>
                )}

                <Text style={styles.sectionLabel}>{t('TAMAÑO', 'SIZE')}</Text>
                <View style={styles.row2}>
                  <Field label="W (px)" value={selected.width} step={10} min={34} max={420} onChange={(width) => resizeSelected(width, selected.height)} />
                  <Field label="H (px)" value={selected.height} step={10} min={34} max={260} onChange={(height) => resizeSelected(selected.width, height)} />
                </View>

                <Text style={styles.inputLabel}>{t('Color', 'Color')}</Text>
                <View style={styles.palette}>
                  {palette.map((color) => (
                    <TouchableOpacity key={color} onPress={() => updateSelected({ color })} style={[styles.swatch, { backgroundColor: color }]} />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function getCapacity(item: VenueItem) {
  if (item.type === 'seat') return 1;
  if (item.type !== 'table') return 0;
  return Math.max(1, item.rows) * Math.max(1, item.seatsPerRow);
}

function shapeStyle(item: VenueItem) {
  if (item.shape === 'round') return { borderRadius: Math.min(item.width, item.height) / 2 };
  if (item.shape === 'soft') return { borderRadius: 16 };
  return { borderRadius: 4 };
}

function SeatDots({ item, selectedSeat, onSeatPress }: { item: VenueItem; selectedSeat: string | null; onSeatPress: (seatId: string) => void }) {
  const seats = [];
  const rows = Math.max(1, item.rows);
  const cols = Math.max(1, item.seatsPerRow);
  const dot = Math.max(14, Math.min(22, Math.floor(item.width / (cols + 2))));
  const sidePad = dot * 0.75;
  const usable = Math.max(1, item.width - sidePad * 2);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const seatId = `${row}-${col}`;
      const blocked = item.blockedSeats.includes(seatId);
      const left = sidePad + (cols === 1 ? usable / 2 : (usable / (cols - 1)) * col) - dot / 2;
      const top = rows === 1 ? item.height / 2 - dot / 2 : row === 0 ? -dot / 2 : item.height - dot / 2;

      seats.push(
        <TouchableOpacity
          key={seatId}
          onPress={() => onSeatPress(seatId)}
          style={[
            styles.seatDot,
            { left, top, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: blocked ? '#9CA3AF' : item.color },
            selectedSeat === seatId && styles.seatSelected,
          ]}
        />
      );
    }
  }

  return <View pointerEvents="box-none" style={styles.seatsLayer}>{seats}</View>;
}

function Tool({ icon, label, onPress }: { icon?: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tool}>
      <ToolSymbol label={label} />
      <Text style={styles.toolText}>{label}</Text>
    </TouchableOpacity>
  );
}

function ToolSymbol({ label }: { label: string }) {
  if (label === 'Mesa') {
    return (
      <View style={styles.iconTable}>
        <View style={styles.iconSeatTop} />
        <View style={styles.iconTableBody} />
        <View style={styles.iconSeatBottom} />
      </View>
    );
  }

  if (label === 'Area') {
    return <View style={styles.iconArea} />;
  }

  if (label === 'Barra') {
    return <View style={styles.iconBar} />;
  }

  if (label === 'Stage') {
    return <View style={styles.iconStage} />;
  }

  return <View style={styles.iconSeat} />;
}

function Field({ label, value, step, min, max, onChange, readonly }: { label: string; value: number; step: number; min: number; max?: number; onChange: (value: number) => void; readonly?: boolean }) {
  const down = Math.max(min, value - step);
  const up = max ? Math.min(max, value + step) : value + step;

  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.numberBox}>
        {!readonly && <TouchableOpacity onPress={() => onChange(down)} style={styles.smallStepper}><Text style={styles.smallStepperText}>-</Text></TouchableOpacity>}
        <TextInput
          editable={!readonly}
          value={String(Number(value).toFixed(value % 1 ? 2 : 0))}
          keyboardType="numeric"
          onChangeText={(raw) => {
            const parsed = Number(raw);
            if (!Number.isNaN(parsed)) onChange(max ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed));
          }}
          style={styles.numberInput}
        />
        {!readonly && <TouchableOpacity onPress={() => onChange(up)} style={styles.smallStepper}><Text style={styles.smallStepperText}>+</Text></TouchableOpacity>}
      </View>
    </View>
  );
}

function NumericMini({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.miniRow}>
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={styles.miniButton}><Text style={styles.miniText}>-</Text></TouchableOpacity>
      <View style={styles.fakeSlider}><View style={[styles.fakeFill, { width: `${((value - min) / (max - min)) * 100}%` }]} /></View>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={styles.miniValue}><Text style={styles.miniValueText}>{value}px</Text></TouchableOpacity>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.segment, active && styles.segmentActive]}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text></TouchableOpacity>;
}


const styles = StyleSheet.create({
  mapStatsScroller: { flex: 1, minWidth: 0, marginRight: 2 },
  mapStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 0, paddingRight: 10 },
  mapStatPill: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapStatAvailable: {},
  mapStatLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 9, fontWeight: '700' },
  mapStatValue: { color: '#F8FAFC', fontSize: 11, fontWeight: '700' },
  root: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  topBar: { minHeight: 62, backgroundColor: '#030B14', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.36)', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#FFFFFF', fontWeight: '700', fontSize: 11 },
  brandEyebrow: { color: '#F97316', fontSize: 9, fontWeight: '700' },
  brandTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  capacityPill: { flex: 1, maxWidth: 220, backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 9, height: 30, justifyContent: 'center' },
  capacityText: { color: '#F97316', fontSize: 10, fontWeight: '700' },
  saveButton: { height: 36, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#F97316', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.20, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  workbench: { width: 1030, height: 560, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.018)' },
  leftRail: { width: 58, backgroundColor: '#030B14', borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.14)', alignItems: 'center', paddingTop: 16, gap: 14 },
  tool: { alignItems: 'center', gap: 5 },
  toolIcon: { width: 22, height: 16, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  iconTable: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconSeatTop: { width: 22, height: 5, borderRadius: 4, backgroundColor: '#F97316' },
  iconTableBody: { width: 18, height: 10, borderRadius: 3, borderWidth: 2, borderColor: '#F97316', backgroundColor: '#030B14' },
  iconSeatBottom: { width: 22, height: 5, borderRadius: 4, backgroundColor: '#F97316' },
  iconArea: { width: 25, height: 20, borderRadius: 5, borderWidth: 2, borderStyle: 'dashed', borderColor: '#F97316', backgroundColor: 'rgba(249,115,22,0.10)' },
  iconBar: { width: 29, height: 13, borderRadius: 3, backgroundColor: '#F97316' },
  iconStage: { width: 29, height: 20, borderRadius: 4, backgroundColor: '#64748B' },
  iconSeat: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#F97316', backgroundColor: '#030B14' },
  railZoom: { marginTop: 8, alignItems: 'center', gap: 5 },
  railZoomButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  railZoomText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  railZoomValue: { color: 'rgba(226,232,240,0.64)', fontSize: 9, fontWeight: '700' },
  toolText: { color: 'rgba(226,232,240,0.64)', fontSize: 9, fontWeight: '700' },
  canvasViewport: { width: 704, height: 560, overflow: 'hidden', position: 'relative', backgroundColor: '#020712' },
  zoomControls: { position: 'absolute', right: 14, top: 14, height: 34, borderRadius: 17, backgroundColor: '#0A375A', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', zIndex: 20 },
  zoomButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' },
  zoomButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  zoomValue: { width: 52, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, position: 'relative', backgroundColor: '#020712' },
  canvasTips: { position: 'absolute', left: 16, bottom: 14, gap: 6 },
  tipText: { color: '#cbd5e1', backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, fontSize: 10, fontWeight: '700' },
  tipTextOrange: { color: '#fbbf24', backgroundColor: '#8b6b4a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, fontSize: 10, fontWeight: '700' },
  mapItem: { position: 'absolute', borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, overflow: 'visible' },
  itemLabel: { fontWeight: '700', zIndex: 5 },
  lockedItem: { opacity: 0.62 },
  seatsLayer: { ...StyleSheet.absoluteFill, overflow: 'visible', zIndex: 4 },
  seatDot: { position: 'absolute', borderWidth: 2, borderColor: '#020712' },
  seatSelected: { borderColor: '#F97316', borderWidth: 3 },
  corner: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#F97316', borderWidth: 2, borderColor: '#FFFFFF', zIndex: 8 },
  cornerTL: { left: -7, top: -7 },
  cornerTR: { right: -7, top: -7 },
  cornerBL: { left: -7, bottom: -7 },
  cornerBR: { right: -7, bottom: -7 },
  inspector: { width: 272, backgroundColor: '#030B14', borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.14)' },
  inspectorHeader: { height: 58, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  inspectorTitle: { flex: 1, color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  iconButton: { color: '#F97316', fontSize: 10, fontWeight: '700' },
  deleteText: { color: '#ef4444', fontSize: 10, fontWeight: '700' },
  inspectorContent: { padding: 14, paddingBottom: 28 },
  sectionLabel: { color: '#F97316', fontSize: 11, fontWeight: '700', letterSpacing: 0, marginTop: 10, marginBottom: 10 },
  sliderCard: { backgroundColor: 'rgba(255,255,255,0.045)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 12, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  sliderCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 10, fontWeight: '700', marginBottom: 8 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ff6b16', alignItems: 'center', justifyContent: 'center' },
  miniText: { color: '#FFFFFF', fontWeight: '700' },
  fakeSlider: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fakeFill: { height: 5, backgroundColor: '#ff6b16' },
  miniValue: { width: 54, height: 30, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#030B14' },
  miniValueText: { color: '#ff6b16', fontSize: 11, fontWeight: '700' },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '400', marginBottom: 6, marginTop: 8 },
  input: { height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, color: '#F8FAFC', backgroundColor: 'rgba(255,255,255,0.045)', fontSize: 12, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  numberBox: { height: 38, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.045)' },
  smallStepper: { width: 28, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030B14' },
  smallStepperText: { color: '#F97316', fontWeight: '700' },
  numberInput: { flex: 1, textAlign: 'center', color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  blockButton: { height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  blockText: { color: '#f97316', fontSize: 11, fontWeight: '700' },
  segmentRow: { gap: 8 },
  segment: { minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.045)', justifyContent: 'center', paddingHorizontal: 10, marginBottom: 6 },
  segmentActive: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.28)' },
  segmentText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.72)' },
});
