import { Alert, Dimensions, GestureResponderEvent, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { apiGet, apiPost } from '../../services/api';

type ItemType = 'table' | 'seat' | 'area' | 'bar' | 'stage';
type TableShape = 'rectangle' | 'round' | 'soft';
type SaleMode = 'whole' | 'seat';

// Backend SectionType <-> editor ItemType. Bars/areas are non-seated zones.
const TYPE_TO_SECTION: Record<ItemType, string> = {
  table: 'table',
  seat: 'seated',
  area: 'standing',
  bar: 'decor',
  stage: 'stage',
};
const SECTION_TO_TYPE: Record<string, ItemType> = {
  table: 'table',
  seated: 'seat',
  vip: 'seat',
  standing: 'area',
  decor: 'bar',
  stage: 'stage',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Map a persisted backend section onto the editor's local item shape.
function sectionToItem(s: any): VenueItem {
  const type = SECTION_TO_TYPE[String(s.sectionType).toLowerCase()] || 'table';
  return {
    id: s.id,
    type,
    name: s.name ?? '',
    x: Number(s.mapX) || 0,
    y: Number(s.mapY) || 0,
    width: Number(s.mapWidth) || 92,
    height: Number(s.mapHeight) || 64,
    color: s.color || '#f59e0b',
    price: Number(s.price) || 0,
    rows: Number(s.rows) || 0,
    seatsPerRow: Number(s.seatsPerRow) || 0,
    fontSize: Number(s.labelFontSize) || 12,
    shape: (s.tableShape as TableShape) || 'rectangle',
    saleMode: s.tablePurchaseMode === 'whole' ? 'whole' : 'seat',
    locked: false,
    blockedSeats: [],
  };
}

// Map an editor item onto the backend /sections/bulk payload shape.
function itemToSection(item: VenueItem, index: number) {
  const section: any = {
    name: item.name || `S${index + 1}`,
    sectionType: TYPE_TO_SECTION[item.type],
    rows: Number(item.rows) || 1,
    seatsPerRow: Number(item.seatsPerRow) || 1,
    capacity: item.type === 'area' ? 100 : 0,
    price: Number(item.price) || 0,
    color: item.color || '#6366f1',
    mapX: parseFloat(item.x.toFixed(2)),
    mapY: parseFloat(item.y.toFixed(2)),
    mapWidth: parseFloat(item.width.toFixed(2)),
    mapHeight: parseFloat(item.height.toFixed(2)),
    labelFontSize: Number(item.fontSize) || 0,
    tableShape: item.shape || 'round',
    tablePurchaseMode: item.saleMode === 'whole' ? 'whole' : 'individual',
    sortOrder: index,
  };
  // Only send the id for rows that already exist in the database.
  if (item.id && UUID_RE.test(item.id)) section.id = item.id;
  return section;
}

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

// Matches the web editor's SECTION_COLORS so sections look the same on both.
const palette = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#6366f1'];

const initialItems: VenueItem[] = [
  { id: 'bar-1', type: 'bar', name: 'BAR', x: 95, y: 130, width: 260, height: 120, color: '#ff8138', price: 0, rows: 0, seatsPerRow: 0, fontSize: 18, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [] },
  { id: 'area-1', type: 'area', name: 'General Area', x: 135, y: 290, width: 205, height: 62, color: '#64748b', price: 25, rows: 0, seatsPerRow: 0, fontSize: 15, shape: 'soft', saleMode: 'seat', locked: false, blockedSeats: [] },
  { id: 'table-31', type: 'table', name: '31', x: 500, y: 355, width: 86, height: 58, color: '#16b981', price: 100, rows: 2, seatsPerRow: 3, fontSize: 10, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [] },
  { id: 'table-30', type: 'table', name: '30', x: 650, y: 275, width: 96, height: 64, color: '#f59e0b', price: 100, rows: 2, seatsPerRow: 5, fontSize: 10, shape: 'rectangle', saleMode: 'seat', locked: false, blockedSeats: [] },
];

type Props = { eventId?: string };

const VP_H = 440; // canvas viewport height (matches styles.workbench height)

export function VenueMapEditor({ eventId }: Props) {
  const { t } = useLanguage();
  const vpW = Dimensions.get('window').width;
  const [items, setItems] = useState<VenueItem[]>(initialItems);
  const [selectedId, setSelectedId] = useState(initialItems[2].id);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [canvasDrag, setCanvasDrag] = useState<{ x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [objectDrag, setObjectDrag] = useState<{ id: string; x: number; y: number; pageX: number; pageY: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.5);

  // Compute pan+zoom so all items fit in the viewport.
  const fitToContent = useCallback((loadedItems: VenueItem[]) => {
    if (loadedItems.length === 0) return;
    const pad = 24;
    const x1 = Math.min(...loadedItems.map((i) => i.x)) - pad;
    const y1 = Math.min(...loadedItems.map((i) => i.y)) - pad;
    const x2 = Math.max(...loadedItems.map((i) => i.x + i.width)) + pad;
    const y2 = Math.max(...loadedItems.map((i) => i.y + i.height)) + pad;
    const cW = x2 - x1;
    const cH = y2 - y1;
    const s = Math.min(vpW / cW, VP_H / cH, 1.1);
    const cX = (x1 + x2) / 2;
    const cY = (y1 + y2) / 2;
    // RN transform [translateX, translateY, scale] maps canvas point (px,py) to viewport:
    // vp_x = tx + CANVAS_WIDTH/2 + (px - CANVAS_WIDTH/2) * s
    const tx = vpW / 2 - CANVAS_WIDTH / 2 + (CANVAS_WIDTH / 2 - cX) * s;
    const ty = VP_H / 2 - CANVAS_HEIGHT / 2 + (CANVAS_HEIGHT / 2 - cY) * s;
    setZoom(Number(s.toFixed(3)));
    setCanvasPan({ x: Number(tx.toFixed(1)), y: Number(ty.toFixed(1)) });
  }, [vpW]);

  // Fit default items on first render.
  useEffect(() => { fitToContent(initialItems); }, [fitToContent]);

  // Load the persisted seat map for the selected event.
  useEffect(() => {
    if (!eventId) return;
    let mounted = true;
    apiGet<any[]>(`/events/${eventId}/sections`)
      .then((data) => {
        if (!mounted) return;
        const loaded = Array.isArray(data) && data.length > 0 ? data.map(sectionToItem) : initialItems;
        setItems(loaded);
        setSelectedId(loaded[0].id);
        setSelectedSeat(null);
        setSaved(true);
        fitToContent(loaded);
      })
      .catch(() => fitToContent(initialItems));
    return () => { mounted = false; };
  }, [eventId, fitToContent]);

  const saveMap = async () => {
    if (!eventId) {
      Alert.alert(t('Sin evento', 'No event'), t('Selecciona un evento para guardar el mapa.', 'Select an event to save the map.'));
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const updated = await apiPost<any[]>(`/events/${eventId}/sections/bulk`, {
        sections: items.map(itemToSection),
        showStage: items.some((it) => it.type === 'stage'),
      });
      if (Array.isArray(updated) && updated.length > 0) {
        const reloaded = updated.map(sectionToItem);
        setItems(reloaded);
        setSelectedId((prev) => (reloaded.some((r) => r.id === prev) ? prev : reloaded[0].id));
      }
      setSaved(true);
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo guardar el mapa', 'Could not save the map'));
    } finally {
      setSaving(false);
    }
  };

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

        <TouchableOpacity onPress={saveMap} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
          <Text style={styles.saveText}>{saving ? t('GUARDANDO...', 'SAVING...') : saved ? t('GUARDADO', 'SAVED') : t('GUARDAR', 'SAVE')}</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal toolbar */}
      <View style={styles.toolbar}>
        <Tool icon="▦" label={t('Mesa', 'Table')} onPress={() => addItem('table')} />
        <Tool icon="□" label={t('Área', 'Area')} onPress={() => addItem('area')} />
        <Tool icon="▬" label={t('Barra', 'Bar')} onPress={() => addItem('bar')} />
        <Tool icon="▰" label={t('Escenario', 'Stage')} onPress={() => addItem('stage')} />
        <Tool icon="●" label={t('Asiento', 'Seat')} onPress={() => addItem('seat')} />
        <View style={styles.zoomGroup}>
          <TouchableOpacity onPress={() => setZoom((current) => Math.max(0.2, Number((current - 0.1).toFixed(2))))} style={styles.railZoomButton}>
            <Text style={styles.railZoomText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.railZoomValue}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity onPress={() => setZoom((current) => Math.min(2.4, Number((current + 0.1).toFixed(2))))} style={styles.railZoomButton}>
            <Text style={styles.railZoomText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => fitToContent(items)} style={styles.railZoomButton}>
            <Text style={styles.railZoomText}>⊡</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.workbench}>
          <View style={styles.canvasViewport}>
            {/* Grid covers the whole viewport (fixed), so the area around the
                canvas isn't a flat blue — the cuadrícula shows everywhere. */}
            <EditorGrid width={vpW} height={VP_H} />
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
              {items.map((item, index) => {
                const isSelected = selectedId === item.id;

                return (
                  <View
                    key={`${item.id || item.name || 'map-item'}-${index}`}
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
                        // Tables/seats draw their own central block + chairs, so
                        // the wrapper is transparent (like the client view). Only
                        // a selection outline is shown. Other items keep their fill.
                        borderColor: isSelected ? '#F97316' : (item.type === 'table' || item.type === 'seat') ? 'transparent' : 'rgba(255,255,255,0.30)',
                        borderWidth: isSelected ? 2 : (item.type === 'table' || item.type === 'seat') ? 0 : 2,
                        backgroundColor: item.type === 'table' || item.type === 'seat' ? 'transparent' : item.color,
                      },
                      item.locked && styles.lockedItem,
                    ]}
                  >
                    {(item.type === 'table' || item.type === 'seat') && (
                      <SeatDots item={item} selectedSeat={selectedSeat} onSeatPress={toggleSeat} />
                    )}

                    <Text style={[
                      styles.itemLabel,
                      { fontSize: item.fontSize, color: '#FFFFFF', zIndex: 6 },
                      (item.type === 'table' || item.type === 'seat') && { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
                    ]}>
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </View>
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
  );
}

function getCapacity(item: VenueItem) {
  if (item.type === 'seat') return 1;
  if (item.type !== 'table') return 0;
  return Math.max(1, item.rows) * Math.max(1, item.seatsPerRow);
}

function shapeStyle(item: VenueItem) {
  // 'round' tables are circular; everything else uses subtle corners like the
  // client view (standing/areas = 8). The old soft=16 looked like a pill on
  // large areas such as "General Área".
  if (item.shape === 'round' && (item.type === 'table' || item.type === 'seat')) {
    return { borderRadius: Math.min(item.width, item.height) / 2 };
  }
  return { borderRadius: 8 };
}

function SeatDots({ item, selectedSeat, onSeatPress }: { item: VenueItem; selectedSeat: string | null; onSeatPress: (seatId: string) => void }) {
  const seats = [];
  const rows = Math.max(1, item.rows);
  const cols = Math.max(1, item.seatsPerRow);
  const total = rows * cols;
  const w = item.width;
  const h = item.height;
  // Only a true 'round' table uses circular seat placement. 'soft' is just a
  // rounded-corner rectangle, so it uses the rectangular edge layout (otherwise
  // its chairs collapse into the centre and pile up).
  const isRound = item.shape === 'round';

  // Mirror ClientVenueMap's TableSection: chairs are arranged AROUND a central
  // table rather than in flat rows, so the editor looks like the client view.
  // Slightly larger/clamped so seats read as robust filled circles.
  const dot = Math.max(12, Math.min(22, Math.floor(Math.min(w, h) * 0.22)));

  // Central table block sized so the edge-hugging chairs sit just outside it.
  const vertical = h >= w;
  const tableW = isRound ? w * 0.60 : (vertical ? Math.max(w * 0.5, w - dot * 2.4) : w * 0.82);
  const tableH = isRound ? h * 0.60 : (vertical ? h * 0.82 : Math.max(h * 0.5, h - dot * 2.4));

  // Compute a (cx, cy) for each seat, hugging the table edges in an orderly way.
  const positions: { id: string; cx: number; cy: number }[] = [];

  if (isRound) {
    // Evenly distribute around a circle just outside the central block.
    let i = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const angle = (i * 360) / total;
        const rad = (angle * Math.PI) / 180;
        positions.push({
          id: `${row}-${col}`,
          cx: w / 2 + (w / 2 - dot / 2 - 1) * Math.sin(rad),
          cy: h / 2 - (h / 2 - dot / 2 - 1) * Math.cos(rad),
        });
        i++;
      }
    }
  } else {
    // Rectangular table: seats line the two LONG sides (one row of seats per
    // side). `cols` (seatsPerRow) seats are spaced along each side; `rows` is how
    // many sides are used (1 or 2). Tall tables get left/right columns; wide
    // tables get top/bottom rows. This matches the client look.
    // `vertical` computed above. tall table → seats on left & right.
    const sidesNeeded = Math.min(2, rows < 1 ? 1 : rows >= 2 ? 2 : 1);
    const perSide = cols;
    const spread = (n: number, length: number) =>
      n === 1 ? [length / 2] : Array.from({ length: n }, (_, k) => (length / (n + 1)) * (k + 1));

    let row = 0;
    if (vertical) {
      // left column, then right column
      const ys = spread(perSide, h);
      const sideX = [dot / 2 + 1, w - dot / 2 - 1];
      for (let s = 0; s < sidesNeeded; s++) {
        for (let k = 0; k < perSide; k++) positions.push({ id: `${row}-${k}`, cx: sideX[s], cy: ys[k] });
        row++;
      }
    } else {
      // top row, then bottom row
      const xs = spread(perSide, w);
      const sideY = [dot / 2 + 1, h - dot / 2 - 1];
      for (let s = 0; s < sidesNeeded; s++) {
        for (let k = 0; k < perSide; k++) positions.push({ id: `${row}-${k}`, cx: xs[k], cy: sideY[s] });
        row++;
      }
    }
    // Any remaining rows (3+) fall back to stacking just inside the table.
    for (let r = sidesNeeded; r < rows; r++) {
      const xs = spread(perSide, w);
      const y = (h / (rows + 1)) * (r + 1);
      for (let k = 0; k < perSide; k++) positions.push({ id: `${r}-${k}`, cx: xs[k], cy: y });
    }
  }

  positions.forEach(({ id, cx, cy }) => {
    const blocked = item.blockedSeats.includes(id);
    seats.push(
      <TouchableOpacity
        key={id}
        onPress={() => onSeatPress(id)}
        style={[
          styles.seatDot,
          { left: cx - dot / 2, top: cy - dot / 2, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: blocked ? '#9CA3AF' : item.color },
          selectedSeat === id && styles.seatSelected,
        ]}
      />
    );
  });

  // The central table block sits behind the chairs.
  seats.unshift(
    <View
      key="__table"
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: (w - tableW) / 2, top: (h - tableH) / 2, width: tableW, height: tableH,
        borderRadius: isRound ? tableW / 2 : 6,
        backgroundColor: '#22415C',
        borderWidth: 1, borderColor: 'rgba(246,198,95,0.28)',
        zIndex: 1,
      }}
    />
  );

  return <View pointerEvents="box-none" style={styles.seatsLayer}>{seats}</View>;
}

// Grid background that mirrors the web editor's CSS gradient pattern:
// a 100px major grid (rgba 0.10) over a 20px minor grid (rgba 0.05).
const EditorGrid = memo(function EditorGrid({ width, height }: { width: number; height: number }) {
  const cols100 = Math.ceil(width / 100) + 1;
  const rows100 = Math.ceil(height / 100) + 1;
  const cols20 = Math.ceil(width / 20) + 1;
  const rows20 = Math.ceil(height / 20) + 1;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: cols20 }, (_, i) => (
        <View key={`c20-${i}`} style={{ position: 'absolute', left: i * 20, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(148,163,184,0.05)' }} />
      ))}
      {Array.from({ length: rows20 }, (_, i) => (
        <View key={`r20-${i}`} style={{ position: 'absolute', top: i * 20, left: 0, right: 0, height: 1, backgroundColor: 'rgba(148,163,184,0.05)' }} />
      ))}
      {Array.from({ length: cols100 }, (_, i) => (
        <View key={`c100-${i}`} style={{ position: 'absolute', left: i * 100, top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(148,163,184,0.10)' }} />
      ))}
      {Array.from({ length: rows100 }, (_, i) => (
        <View key={`r100-${i}`} style={{ position: 'absolute', top: i * 100, left: 0, right: 0, height: 1, backgroundColor: 'rgba(148,163,184,0.10)' }} />
      ))}
    </View>
  );
});

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
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#030B14', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)', flexWrap: 'wrap' },
  zoomGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  workbench: { height: VP_H, backgroundColor: '#0d2138' },
  leftRail: { display: 'none', width: 0 },
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
  canvasViewport: { flex: 1, height: VP_H, overflow: 'hidden', position: 'relative', backgroundColor: '#0d2138' },
  zoomControls: { position: 'absolute', right: 14, top: 14, height: 34, borderRadius: 17, backgroundColor: '#0A375A', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', zIndex: 20 },
  zoomButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1f2937' },
  zoomButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  zoomValue: { width: 52, alignItems: 'center', justifyContent: 'center' },
  zoomText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  // Transparent so the viewport grid shows through the whole canvas area.
  canvas: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, position: 'relative', backgroundColor: 'transparent' },
  canvasTips: { position: 'absolute', left: 16, bottom: 14, gap: 6 },
  tipText: { color: '#cbd5e1', backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, fontSize: 10, fontWeight: '700' },
  tipTextOrange: { color: '#fbbf24', backgroundColor: '#8b6b4a', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 4, fontSize: 10, fontWeight: '700' },
  mapItem: { position: 'absolute', borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, overflow: 'visible' },
  itemLabel: { fontWeight: '700', zIndex: 5 },
  lockedItem: { opacity: 0.62 },
  seatsLayer: { ...StyleSheet.absoluteFill, overflow: 'visible', zIndex: 4 },
  // Match ClientVenueMap's chair look: solid colored dot with a thin white
  // border (not a dark heavy outline), so seats read as robust filled circles.
  seatDot: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)' },
  seatSelected: { borderColor: '#FFFFFF', borderWidth: 2 },
  corner: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#F97316', borderWidth: 2, borderColor: '#FFFFFF', zIndex: 8 },
  cornerTL: { left: -7, top: -7 },
  cornerTR: { right: -7, top: -7 },
  cornerBL: { left: -7, bottom: -7 },
  cornerBR: { right: -7, bottom: -7 },
  inspector: { backgroundColor: '#030B14', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  inspectorHeader: { minHeight: 52, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10, paddingVertical: 8 },
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
