import { GestureResponderEvent, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useMemo, useState } from 'react';
import { colors } from '../../theme/colors';

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

const palette = ['#ff6b16', '#2f80ed', '#16b981', '#6366f1', '#ef4444', '#f59e0b'];

const initialItems: VenueItem[] = [
  { id: 'bar-1', type: 'bar', name: 'BAR', x: 95, y: 130, width: 260, height: 120, color: '#ff8138', price: 0, rows: 0, seatsPerRow: 0, fontSize: 18, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [] },
  { id: 'area-1', type: 'area', name: 'General Area', x: 135, y: 290, width: 205, height: 62, color: '#7474ee', price: 25, rows: 0, seatsPerRow: 0, fontSize: 15, shape: 'soft', saleMode: 'seat', locked: false, blockedSeats: [] },
  { id: 'table-31', type: 'table', name: '31', x: 500, y: 355, width: 86, height: 58, color: '#16b981', price: 100, rows: 2, seatsPerRow: 3, fontSize: 10, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [] },
  { id: 'table-30', type: 'table', name: '30', x: 650, y: 275, width: 96, height: 64, color: '#2f80ed', price: 100, rows: 2, seatsPerRow: 5, fontSize: 10, shape: 'rectangle', saleMode: 'seat', locked: false, blockedSeats: [] },
];

export function VenueMapEditor() {
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
      color: type === 'stage' ? '#16b981' : type === 'bar' ? '#ff8138' : type === 'area' ? '#7474ee' : '#2f80ed',
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
            <Text style={styles.brandText}>LPT</Text>
          </View>
          <View>
            <Text style={styles.brandEyebrow}>CHART</Text>
            <Text style={styles.brandTitle}>Disenador de Asientos</Text>
          </View>
          <View style={styles.capacityPill}>
            <Text style={styles.capacityText}>Capacidad: {capacity}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setSaved(true)} style={styles.saveButton}>
          <Text style={styles.saveText}>{saved ? 'GUARDADO' : 'GUARDAR'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.workbench}>
          <View style={styles.leftRail}>
          <Tool icon="▦" label="Mesa" onPress={() => addItem('table')} />
          <Tool icon="□" label="Area" onPress={() => addItem('area')} />
          <Tool icon="▬" label="Barra" onPress={() => addItem('bar')} />
          <Tool icon="▰" label="Stage" onPress={() => addItem('stage')} />
          <Tool icon="●" label="Asiento" onPress={() => addItem('seat')} />

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
                        borderColor: isSelected ? '#2563eb' : '#dbe3ef',
                        backgroundColor: item.type === 'table' || item.type === 'seat' ? '#ffffff' : item.color,
                      },
                      item.locked && styles.lockedItem,
                    ]}
                  >
                    {(item.type === 'table' || item.type === 'seat') && (
                      <SeatDots item={item} selectedSeat={selectedSeat} onSeatPress={toggleSeat} />
                    )}

                    <Text style={[styles.itemLabel, { fontSize: item.fontSize, color: item.type === 'table' || item.type === 'seat' ? colors.navy : '#ffffff' }]}>
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.inspector}>
            <View style={styles.inspectorHeader}>
              <Text style={styles.inspectorTitle}>INSPECTOR DE OBJETO</Text>
              <TouchableOpacity onPress={duplicateSelected}><Text style={styles.iconButton}>COPY</Text></TouchableOpacity>
              <TouchableOpacity onPress={deleteSelected}><Text style={styles.deleteText}>DEL</Text></TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inspectorContent}>
                <Text style={styles.sectionLabel}>TAMANO DEL TEXTO</Text>
                <View style={styles.sliderCard}>
                  <Text style={styles.sliderCopy}>Nombre visible en el mapa</Text>
                  <NumericMini value={selected.fontSize} min={8} max={28} step={1} onChange={(value) => updateSelected({ fontSize: value })} />
                </View>

                <Text style={styles.inputLabel}>Nombre</Text>
                <TextInput value={selected.name} onChangeText={(name) => updateSelected({ name })} style={styles.input} />

                <View style={styles.row2}>
                  <Field label="Precio/Silla" value={selected.price} step={5} min={0} onChange={(value) => updateSelected({ price: value })} />
                  <Field label="Total Mesa" value={selected.price * Math.max(1, getCapacity(selected))} step={5} min={0} onChange={() => undefined} readonly />
                </View>

                <TouchableOpacity onPress={() => updateSelected({ locked: !selected.locked })} style={styles.blockButton}>
                  <Text style={styles.blockText}>{selected.locked ? 'DESBLOQUEAR TODO' : 'BLOQUEAR / DESBLOQUEAR TODO'}</Text>
                </TouchableOpacity>

                {(selected.type === 'table' || selected.type === 'seat') && (
                  <>
                    <Text style={styles.sectionLabel}>DISENO (LAYOUT)</Text>
                    <View style={styles.row2}>
                      <Field label="Numero de Filas" value={selected.rows} step={1} min={1} max={8} onChange={(rows) => updateSelected({ rows })} />
                      <Field label="Asientos por Mesa" value={selected.seatsPerRow} step={1} min={1} max={16} onChange={(seatsPerRow) => updateSelected({ seatsPerRow })} />
                    </View>

                    <Text style={styles.inputLabel}>Forma de la Mesa</Text>
                    <View style={styles.segmentRow}>
                      <Segment label="Rectangular" active={selected.shape === 'rectangle'} onPress={() => updateSelected({ shape: 'rectangle' })} />
                      <Segment label="Redonda" active={selected.shape === 'round'} onPress={() => updateSelected({ shape: 'round' })} />
                      <Segment label="Suave" active={selected.shape === 'soft'} onPress={() => updateSelected({ shape: 'soft' })} />
                    </View>

                    <Text style={styles.inputLabel}>Modo de Venta</Text>
                    <View style={styles.segmentRow}>
                      <Segment label="Mesa Completa" active={selected.saleMode === 'whole'} onPress={() => updateSelected({ saleMode: 'whole' })} />
                      <Segment label="Por Silla" active={selected.saleMode === 'seat'} onPress={() => updateSelected({ saleMode: 'seat' })} />
                    </View>
                  </>
                )}

                <Text style={styles.sectionLabel}>TAMANO</Text>
                <View style={styles.row2}>
                  <Field label="W (px)" value={selected.width} step={10} min={34} max={420} onChange={(width) => resizeSelected(width, selected.height)} />
                  <Field label="H (px)" value={selected.height} step={10} min={34} max={260} onChange={(height) => resizeSelected(selected.width, height)} />
                </View>

                <Text style={styles.inputLabel}>Color</Text>
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
  if (item.shape === 'soft') return { borderRadius: 18 };
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
            { left, top, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: blocked ? '#94a3b8' : item.color },
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
  root: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#d7dee8', overflow: 'hidden' },
  topBar: { height: 56, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#d7dee8', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMark: { width: 34, height: 34, borderRadius: 5, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#ffffff', fontWeight: '900', fontSize: 11 },
  brandEyebrow: { color: '#94a3b8', fontSize: 9, fontWeight: '900' },
  brandTitle: { color: '#1f2937', fontSize: 13, fontWeight: '900' },
  capacityPill: { backgroundColor: '#eaf2ff', borderRadius: 10, paddingHorizontal: 9, height: 22, justifyContent: 'center' },
  capacityText: { color: '#2563eb', fontSize: 10, fontWeight: '900' },
  saveButton: { height: 34, borderRadius: 6, paddingHorizontal: 14, backgroundColor: '#2563eb', justifyContent: 'center' },
  saveText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  workbench: { width: 1030, height: 560, flexDirection: 'row', backgroundColor: '#f5f7fb' },
  leftRail: { width: 54, backgroundColor: '#ffffff', borderRightWidth: 1, borderRightColor: '#d7dee8', alignItems: 'center', paddingTop: 16, gap: 14 },
  tool: { alignItems: 'center', gap: 5 },
  toolIcon: { width: 22, height: 16, borderRadius: 4, backgroundColor: '#e9eef5', borderWidth: 1, borderColor: '#cbd5e1' },
  iconTable: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconSeatTop: { width: 22, height: 5, borderRadius: 4, backgroundColor: '#94a3b8' },
  iconTableBody: { width: 18, height: 10, borderRadius: 3, borderWidth: 2, borderColor: colors.navy, backgroundColor: '#ffffff' },
  iconSeatBottom: { width: 22, height: 5, borderRadius: 4, backgroundColor: '#94a3b8' },
  iconArea: { width: 25, height: 20, borderRadius: 5, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.navy, backgroundColor: '#ffffff' },
  iconBar: { width: 29, height: 13, borderRadius: 3, backgroundColor: colors.navy },
  iconStage: { width: 29, height: 20, borderRadius: 4, backgroundColor: '#334155' },
  iconSeat: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.navy, backgroundColor: '#ffffff' },
  railZoom: { marginTop: 8, alignItems: 'center', gap: 5 },
  railZoomButton: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  railZoomText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  railZoomValue: { color: '#64748b', fontSize: 9, fontWeight: '900' },
  toolText: { color: '#64748b', fontSize: 9, fontWeight: '800' },
  canvasViewport: { width: 704, height: 560, overflow: 'hidden', position: 'relative', backgroundColor: '#f4f6fa' },
  zoomControls: { position: 'absolute', right: 14, top: 14, height: 34, borderRadius: 17, backgroundColor: '#111827', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', zIndex: 20 },
  zoomButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' },
  zoomButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
  zoomValue: { width: 52, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, position: 'relative', backgroundColor: '#f4f6fa' },
  canvasTips: { position: 'absolute', left: 16, bottom: 14, gap: 6 },
  tipText: { color: '#cbd5e1', backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, fontSize: 10, fontWeight: '700' },
  tipTextOrange: { color: '#fbbf24', backgroundColor: '#8b6b4a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, fontSize: 10, fontWeight: '800' },
  mapItem: { position: 'absolute', borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, overflow: 'visible' },
  itemLabel: { fontWeight: '900', zIndex: 5 },
  lockedItem: { opacity: 0.62 },
  seatsLayer: { ...StyleSheet.absoluteFill, overflow: 'visible', zIndex: 4 },
  seatDot: { position: 'absolute', borderWidth: 2, borderColor: '#ffffff' },
  seatSelected: { borderColor: '#111827', borderWidth: 3 },
  corner: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#ffffff', borderWidth: 2, borderColor: '#2563eb', zIndex: 8 },
  cornerTL: { left: -7, top: -7 },
  cornerTR: { right: -7, top: -7 },
  cornerBL: { left: -7, bottom: -7 },
  cornerBR: { right: -7, bottom: -7 },
  inspector: { width: 272, backgroundColor: '#ffffff', borderLeftWidth: 1, borderLeftColor: '#d7dee8' },
  inspectorHeader: { height: 58, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  inspectorTitle: { flex: 1, color: '#1f2937', fontSize: 12, fontWeight: '900' },
  iconButton: { color: colors.navy, fontSize: 10, fontWeight: '900' },
  deleteText: { color: '#ef4444', fontSize: 10, fontWeight: '900' },
  inspectorContent: { padding: 14, paddingBottom: 28 },
  sectionLabel: { color: '#4b5563', fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 10, marginBottom: 10 },
  sliderCard: { backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  sliderCopy: { color: '#64748b', fontSize: 10, fontWeight: '700', marginBottom: 8 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniButton: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#ff6b16', alignItems: 'center', justifyContent: 'center' },
  miniText: { color: '#ffffff', fontWeight: '900' },
  fakeSlider: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#111827', overflow: 'hidden' },
  fakeFill: { height: 5, backgroundColor: '#ff6b16' },
  miniValue: { width: 54, height: 30, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  miniValueText: { color: '#ff6b16', fontSize: 11, fontWeight: '900' },
  inputLabel: { color: '#4b5563', fontSize: 11, fontWeight: '700', marginBottom: 6, marginTop: 8 },
  input: { height: 36, borderRadius: 5, borderWidth: 1, borderColor: '#dbe3ef', paddingHorizontal: 10, color: '#1f2937', fontSize: 12, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  numberBox: { height: 36, borderRadius: 5, borderWidth: 1, borderColor: '#dbe3ef', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: '#ffffff' },
  smallStepper: { width: 26, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  smallStepperText: { color: colors.navy, fontWeight: '900' },
  numberInput: { flex: 1, textAlign: 'center', color: '#1f2937', fontSize: 12, fontWeight: '800' },
  blockButton: { height: 38, borderRadius: 5, borderWidth: 1, borderColor: '#fed7aa', backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  blockText: { color: '#f97316', fontSize: 11, fontWeight: '900' },
  segmentRow: { gap: 8 },
  segment: { minHeight: 34, borderRadius: 5, borderWidth: 1, borderColor: '#dbe3ef', justifyContent: 'center', paddingHorizontal: 10, marginBottom: 6 },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentText: { color: '#4b5563', fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#ffffff' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#ffffff' },
});
