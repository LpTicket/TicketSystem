import { Alert, Dimensions, GestureResponderEvent, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    seatConfig: parseSeatConfig(s.seatsConfig),
  };
}

// Parse the backend seatsConfig (JSON string) into our keyed override map.
function parseSeatConfig(raw: any): Record<string, SeatOverride> {
  if (!raw) return {};
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
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
    seatsConfig: item.seatConfig && Object.keys(item.seatConfig).length ? JSON.stringify(item.seatConfig) : undefined,
    sortOrder: index,
  };
  // Only send the id for rows that already exist in the database.
  if (item.id && UUID_RE.test(item.id)) section.id = item.id;
  return section;
}

// Per-seat overrides keyed by seat id ("row-col"), mirroring the web seatsConfig.
type SeatOverride = {
  isWheelchair?: boolean;
  reserved?: boolean;   // blocked / reserved for sale
  disabled?: boolean;   // hidden seat
  rowLabel?: string;    // custom row/prefix
  seatNumber?: string;  // custom number
  price?: number;       // individual price (undefined = use section price)
  xOffset?: number;
  yOffset?: number;
};

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
  seatConfig: Record<string, SeatOverride>;
};

const CANVAS_WIDTH = 920;
const CANVAS_HEIGHT = 640;

// Matches the web editor's SECTION_COLORS so sections look the same on both.
const palette = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#6366f1'];

const initialItems: VenueItem[] = [
  { id: 'bar-1', type: 'bar', name: 'BAR', x: 95, y: 130, width: 260, height: 120, color: '#ff8138', price: 0, rows: 0, seatsPerRow: 0, fontSize: 18, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [], seatConfig: {} },
  { id: 'area-1', type: 'area', name: 'General Area', x: 135, y: 290, width: 205, height: 62, color: '#64748b', price: 25, rows: 0, seatsPerRow: 0, fontSize: 15, shape: 'soft', saleMode: 'seat', locked: false, blockedSeats: [], seatConfig: {} },
  { id: 'table-31', type: 'table', name: '31', x: 500, y: 355, width: 86, height: 58, color: '#16b981', price: 100, rows: 2, seatsPerRow: 3, fontSize: 10, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [], seatConfig: {} },
  { id: 'table-30', type: 'table', name: '30', x: 650, y: 275, width: 96, height: 64, color: '#f59e0b', price: 100, rows: 2, seatsPerRow: 5, fontSize: 10, shape: 'rectangle', saleMode: 'seat', locked: false, blockedSeats: [], seatConfig: {} },
];

type Props = { eventId?: string };

const VP_H = 440; // canvas viewport height (matches styles.workbench height)

export function VenueMapEditor({ eventId }: Props) {
  const { t } = useLanguage();
  const vpW = Dimensions.get('window').width;
  const [items, setItems] = useState<VenueItem[]>(initialItems);
  // Edit mode (off = view only). Like the web, nothing moves/edits until the
  // pencil is tapped.
  const [editMode, setEditMode] = useState(false);
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
      seatConfig: {},
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

  // Tapping a chair now just selects it; its options live in the inspector.
  const toggleSeat = (seatId: string) => {
    if (!editMode || !selected) return;
    setSelectedSeat((current) => (current === seatId ? null : seatId));
  };

  // Update one override field for the currently selected seat.
  const updateSeatOverride = (field: keyof SeatOverride, value: any) => {
    if (!selected || !selectedSeat) return;
    const next = { ...(selected.seatConfig || {}) };
    const cur = { ...(next[selectedSeat] || {}) } as SeatOverride;
    if (value === undefined || value === '' || value === false) delete (cur as any)[field];
    else (cur as any)[field] = value;
    if (Object.keys(cur).length === 0) delete next[selectedSeat];
    else next[selectedSeat] = cur;
    updateSelected({ seatConfig: next });
  };

  const resetSeatOverride = () => {
    if (!selected || !selectedSeat) return;
    const next = { ...(selected.seatConfig || {}) };
    delete next[selectedSeat];
    updateSelected({ seatConfig: next });
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mapStatsScroller} contentContainerStyle={styles.mapStatsRow}>
            <View style={[styles.mapStatPill, styles.statBlue]}>
              <Text style={styles.mapStatLabel}>{t('Capacidad', 'Capacity')}</Text>
              <Text style={[styles.mapStatValue, { color: '#60a5fa' }]}>{capacity}</Text>
            </View>
            <View style={[styles.mapStatPill, styles.statGreen]}>
              <Text style={styles.mapStatLabel}>{t('Disponibles', 'Available')}</Text>
              <Text style={[styles.mapStatValue, { color: '#34d399' }]}>{availableSeats}</Text>
            </View>
            <View style={[styles.mapStatPill, styles.statOrange]}>
              <Text style={styles.mapStatLabel}>{t('Vendidas', 'Sold')}</Text>
              <Text style={[styles.mapStatValue, { color: '#fb923c' }]}>{soldSeats}</Text>
            </View>
          </ScrollView>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => { setEditMode((m) => { if (m) { setSelectedSeat(null); } return !m; }); }}
            style={[styles.editToggle, editMode && styles.editToggleActive]}
          >
            <Ionicons name={editMode ? 'pencil' : 'pencil-outline'} size={16} color={editMode ? '#FFFFFF' : '#fb923c'} />
            <Text style={[styles.editToggleText, editMode && styles.editToggleTextActive]}>
              {editMode ? t('Editando', 'Editing') : t('Editar', 'Edit')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={saveMap} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
            <Text style={styles.saveText}>{saving ? t('GUARDANDO...', 'SAVING...') : saved ? t('GUARDADO', 'SAVED') : t('GUARDAR', 'SAVE')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Horizontal toolbar — add-tools only in edit mode (like the web). */}
      <View style={styles.toolbar}>
        {editMode && (
          <>
            <Tool icon="▦" label={t('Mesa', 'Table')} onPress={() => addItem('table')} />
            <Tool icon="□" label={t('Área', 'Area')} onPress={() => addItem('area')} />
            <Tool icon="▬" label={t('Barra', 'Bar')} onPress={() => addItem('bar')} />
            <Tool icon="▰" label={t('Escenario', 'Stage')} onPress={() => addItem('stage')} />
            <Tool icon="●" label={t('Asiento', 'Seat')} onPress={() => addItem('seat')} />
          </>
        )}
        {!editMode && (
          <Text style={styles.viewModeHint}>{t('Toca el lápiz para editar', 'Tap the pencil to edit')}</Text>
        )}
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
                    // In view mode the item doesn't grab touches, so the canvas
                    // pans normally and nothing can be moved or selected.
                    onStartShouldSetResponder={() => editMode}
                    onMoveShouldSetResponder={() => editMode}
                    onResponderGrant={(event: GestureResponderEvent) => {
                      if (!editMode) return;
                      setCanvasDrag(null);
                      setSelectedId(item.id);
                      setSelectedSeat(null);
                      setDrag({ id: item.id, x: item.x, y: item.y, pageX: event.nativeEvent.pageX, pageY: event.nativeEvent.pageY });
                    }}
                    onResponderMove={(event: GestureResponderEvent) => {
                      if (!editMode || !drag || drag.id !== item.id) return;
                      const nextX = drag.x + event.nativeEvent.pageX - drag.pageX;
                      const nextY = drag.y + event.nativeEvent.pageY - drag.pageY;
                      moveItem(item, nextX, nextY);
                    }}
                    onResponderRelease={() => setDrag(null)}
                    style={[
                      styles.mapItem,
                      shapeStyle(item),
                      // Shadow only on solid items (area/bar/stage). Tables/seats
                      // are transparent, so a shadow would draw a ghost box around
                      // the chairs ("minifondo").
                      (item.type !== 'table' && item.type !== 'seat') && styles.itemShadow,
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

      {editMode && (
      <View style={styles.inspector}>
            <View style={styles.inspectorHeader}>
              <Text style={styles.inspectorTitle}>{t('INSPECTOR DE OBJETO', 'OBJECT INSPECTOR')}</Text>
              <TouchableOpacity onPress={duplicateSelected}><Text style={styles.iconButton}>{t('COPIAR', 'COPY')}</Text></TouchableOpacity>
              <TouchableOpacity onPress={deleteSelected}><Text style={styles.deleteText}>{t('BORRAR', 'DEL')}</Text></TouchableOpacity>
            </View>

            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.inspectorContent}>
                {selectedSeat && (selected.type === 'table' || selected.type === 'seat') && (() => {
                  const ov: SeatOverride = selected.seatConfig?.[selectedSeat] || {};
                  // Default row/number derived from the canonical key:
                  // "seat-{n}" → row "Mesa", number n; "{letter}-{n}" → letter, n.
                  const isTableKey = selectedSeat.startsWith('seat-');
                  const defRow = isTableKey ? (t('Mesa', 'Table')) : selectedSeat.split('-')[0];
                  const defNum = isTableKey ? selectedSeat.replace('seat-', '') : selectedSeat.split('-')[1];
                  return (
                    <View style={styles.seatPanel}>
                      <View style={styles.seatPanelHead}>
                        <View>
                          <Text style={styles.seatPanelEyebrow}>{t('ASIENTO SELECCIONADO', 'SELECTED SEAT')}</Text>
                          <Text style={styles.seatPanelTitle}>{(ov.rowLabel || defRow)}-{(ov.seatNumber || defNum)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedSeat(null)}><Text style={styles.seatPanelClose}>{t('Cerrar', 'Close')}</Text></TouchableOpacity>
                      </View>

                      <SeatToggle label={t('Silla de ruedas', 'Wheelchair')} value={!!ov.isWheelchair} onPress={() => updateSeatOverride('isWheelchair', !ov.isWheelchair)} tone="blue" />
                      <SeatToggle label={t('Bloquear para venta', 'Block / Reserve seat')} value={!!ov.reserved} onPress={() => updateSeatOverride('reserved', !ov.reserved)} tone="orange" />
                      <SeatToggle label={t('Ocultar silla', 'Hide seat')} value={!!ov.disabled} onPress={() => updateSeatOverride('disabled', !ov.disabled)} tone="gray" />

                      <Text style={styles.inputLabel}>{t('Personalizar nombre / etiqueta', 'Customize name / label')}</Text>
                      <View style={styles.row2}>
                        <View style={styles.field}>
                          <Text style={styles.seatMiniLabel}>{t('Fila / Prefijo', 'Row / Prefix')}</Text>
                          <TextInput value={ov.rowLabel ?? ''} placeholder={defRow} placeholderTextColor="rgba(148,163,184,0.5)" onChangeText={(v) => updateSeatOverride('rowLabel', v)} style={styles.input} />
                        </View>
                        <View style={styles.field}>
                          <Text style={styles.seatMiniLabel}>{t('Número', 'Number')}</Text>
                          <TextInput value={ov.seatNumber ?? ''} placeholder={defNum} placeholderTextColor="rgba(148,163,184,0.5)" keyboardType="numeric" onChangeText={(v) => updateSeatOverride('seatNumber', v)} style={styles.input} />
                        </View>
                      </View>

                      {selected.saleMode !== 'whole' && (
                        <>
                          <Text style={styles.inputLabel}>{t('Precio de este asiento ($)', 'Price of this seat ($)')}</Text>
                          <TextInput
                            value={ov.price !== undefined ? String(ov.price) : ''}
                            placeholder={String(selected.price || 0)}
                            placeholderTextColor="rgba(148,163,184,0.5)"
                            keyboardType="numeric"
                            onChangeText={(v) => updateSeatOverride('price', v === '' ? undefined : Number(v))}
                            style={styles.input}
                          />
                          <Text style={styles.seatHint}>{t('Vacío = usa el precio general de la sección.', 'Blank = use the general section price.')}</Text>
                        </>
                      )}

                      <Text style={styles.inputLabel}>{t('Ajuste fino de posición', 'Fine-tune position')}</Text>
                      <View style={styles.row2}>
                        <Field label="X Offset" value={ov.xOffset || 0} step={2} min={-200} max={200} onChange={(v) => updateSeatOverride('xOffset', v === 0 ? undefined : v)} />
                        <Field label="Y Offset" value={ov.yOffset || 0} step={2} min={-200} max={200} onChange={(v) => updateSeatOverride('yOffset', v === 0 ? undefined : v)} />
                      </View>

                      {Object.keys(ov).length > 0 && (
                        <TouchableOpacity onPress={resetSeatOverride} style={styles.seatResetBtn}>
                          <Text style={styles.seatResetText}>{t('Restablecer valores', 'Reset values')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })()}

                <Text style={styles.sectionLabel}>{t('TAMAÑO DEL TEXTO', 'TEXT SIZE')}</Text>
                <View style={styles.sliderCard}>
                  <Text style={styles.sliderCopy}>{t('Nombre visible en el mapa', 'Name visible on the map')}</Text>
                  <NumericMini value={selected.fontSize} min={8} max={28} step={1} onChange={(value) => updateSelected({ fontSize: value })} />
                </View>

                <Text style={styles.inputLabel}>{t('Nombre', 'Name')}</Text>
                <TextInput value={selected.name} onChangeText={(name) => updateSelected({ name })} style={styles.input} />

                <Text style={styles.inputLabel}>{t('Tipo', 'Type')}</Text>
                <View style={[styles.segmentRow, { flexWrap: 'wrap' }]}>
                  <Segment label={t('Mesa', 'Table')} active={selected.type === 'table'} onPress={() => updateSelected({ type: 'table' })} />
                  <Segment label={t('Asientos', 'Seats')} active={selected.type === 'seat'} onPress={() => updateSelected({ type: 'seat' })} />
                  <Segment label={t('General', 'General')} active={selected.type === 'area'} onPress={() => updateSelected({ type: 'area' })} />
                  <Segment label={t('Barra', 'Bar')} active={selected.type === 'bar'} onPress={() => updateSelected({ type: 'bar' })} />
                  <Segment label={t('Escenario', 'Stage')} active={selected.type === 'stage'} onPress={() => updateSelected({ type: 'stage' })} />
                </View>

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
                    <TouchableOpacity
                      key={color}
                      onPress={() => updateSelected({ color })}
                      style={[styles.swatch, { backgroundColor: color }, selected.color === color && styles.swatchActive]}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>
      )}
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

  // Chair size matches the web editor exactly.
  const dot = Math.max(10, Math.min(22, Math.min(w, h) * 0.18));

  // Central block proportions match the WEB editor exactly: 70%×45% for
  // rectangular tables, ~60% for round. Chairs ring it at the 12–88% bands.
  const tableW = w * (isRound ? 0.60 : 0.70);
  const tableH = h * (isRound ? 0.60 : 0.45);

  // Compute a (cx, cy) for each seat. We distribute ALL seats evenly around the
  // table perimeter (same approach as ClientVenueMap's TableSection), instead of
  // assuming rows/cols map to specific sides — that assumption made every chair
  // pile up on one edge.
  const positions: { id: string; cx: number; cy: number }[] = [];
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Canonical seat key, matching the backend/ClientVenueMap so per-seat
      // overrides set here are actually read when buying:
      //  - table  → "seat-{n}"          (n = 1-based linear index)
      //  - grid   → "{rowLetter}-{n}"   (e.g. "A-1", matching A,B,C… rows)
      const id = item.type === 'table'
        ? `seat-${i + 1}`
        : `${String.fromCharCode(65 + row)}-${col + 1}`;
      let cx: number; let cy: number;
      if (isRound) {
        // Same as ClientVenueMap: ring the chairs at 0.52 of the radius.
        const rad = ((i * 360) / total * Math.PI) / 180;
        cx = w / 2 + w * 0.52 * Math.sin(rad);
        cy = h / 2 - h * 0.52 * Math.cos(rad);
      } else {
        // EXACT same percentage layout ClientVenueMap uses, so the editor and
        // the buyer view look identical. Seats run top → right → bottom → left
        // in clean rows, not at arbitrary perimeter points.
        const step = (2 * (1 + 0.55)) / Math.max(1, total);
        const pos = i * step;
        let xPct = 50; let yPct = 50;
        if (pos < 1) { xPct = 15 + pos * 70; yPct = 12; }
        else if (pos < 1.55) { xPct = 88; yPct = 15 + ((pos - 1) / 0.55) * 70; }
        else if (pos < 2.55) { xPct = 85 - (pos - 1.55) * 70; yPct = 88; }
        else { xPct = 12; yPct = 85 - ((pos - 2.55) / 0.55) * 70; }
        cx = (w * xPct) / 100;
        cy = (h * yPct) / 100;
      }
      positions.push({ id, cx, cy });
      i++;
    }
  }

  positions.forEach(({ id, cx, cy }) => {
    const ov: SeatOverride = item.seatConfig?.[id] || {};
    if (ov.disabled) return; // hidden seat — don't render
    const blocked = item.blockedSeats.includes(id) || !!ov.reserved;
    const fill = blocked ? '#F97316' : ov.isWheelchair ? '#1a73e8' : item.color;
    const ox = ov.xOffset || 0;
    const oy = ov.yOffset || 0;
    seats.push(
      <TouchableOpacity
        key={id}
        onPress={() => onSeatPress(id)}
        style={[
          styles.seatDot,
          { left: cx - dot / 2 + ox, top: cy - dot / 2 + oy, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: fill, zIndex: 5 },
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
        {!readonly && <TouchableOpacity onPress={() => onChange(down)} style={styles.smallStepper}><Text style={styles.smallStepperText}>−</Text></TouchableOpacity>}
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
      <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))} style={styles.miniButton}>
        <Text style={styles.miniText}>−</Text>
      </TouchableOpacity>
      <View style={styles.fakeSlider}><View style={[styles.fakeFill, { width: `${Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))}%` }]} /></View>
      <View style={styles.miniValue}><Text style={styles.miniValueText}>{value}px</Text></View>
      <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))} style={styles.miniButton}>
        <Text style={styles.miniText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.segment, active && styles.segmentActive]}><Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text></TouchableOpacity>;
}

// A checkbox-style row for the per-seat options (wheelchair, block, hide).
function SeatToggle({ label, value, onPress, tone }: { label: string; value: boolean; onPress: () => void; tone: 'blue' | 'orange' | 'gray' }) {
  const accent = tone === 'blue' ? '#3b82f6' : tone === 'orange' ? '#F97316' : '#94a3b8';
  return (
    <TouchableOpacity onPress={onPress} style={styles.seatToggleRow} activeOpacity={0.8}>
      <View style={[styles.seatCheck, value && { backgroundColor: accent, borderColor: accent }]}>
        {value && <Text style={styles.seatCheckMark}>✓</Text>}
      </View>
      <Text style={styles.seatToggleLabel}>{label}</Text>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  mapStatsScroller: { flex: 1, minWidth: 0, marginRight: 2 },
  mapStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingLeft: 0, paddingRight: 6 },
  mapStatPill: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  statBlue: { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.30)' },
  statGreen: { backgroundColor: 'rgba(52,211,153,0.10)', borderColor: 'rgba(52,211,153,0.30)' },
  statOrange: { backgroundColor: 'rgba(249,115,22,0.10)', borderColor: 'rgba(249,115,22,0.30)' },
  mapStatAvailable: {},
  mapStatLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  mapStatValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
  root: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  topBar: { minHeight: 64, backgroundColor: '#071423', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.40)', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#F97316', fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },
  brandEyebrow: { color: '#F97316', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  brandTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  capacityPill: { flex: 1, maxWidth: 220, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 8, height: 34, justifyContent: 'center' },
  capacityText: { color: '#F97316', fontSize: 10, fontWeight: '700' },
  saveButton: { height: 38, borderRadius: 12, paddingHorizontal: 16, backgroundColor: '#F97316', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.30, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.40)', backgroundColor: 'rgba(249,115,22,0.10)' },
  editToggleActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  editToggleText: { color: '#fb923c', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  editToggleTextActive: { color: '#FFFFFF' },
  viewModeHint: { color: 'rgba(226,232,240,0.55)', fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#071423', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', flexWrap: 'wrap' },
  zoomGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  workbench: { height: VP_H, backgroundColor: '#0d2138' },
  leftRail: { display: 'none', width: 0 },
  tool: { alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.03)', minWidth: 56 },
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
  railZoomButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.14)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.40)', alignItems: 'center', justifyContent: 'center' },
  railZoomText: { color: '#fb923c', fontSize: 18, fontWeight: '800' },
  railZoomValue: { color: '#F8FAFC', fontSize: 11, fontWeight: '800', minWidth: 38, textAlign: 'center' },
  toolText: { color: 'rgba(226,232,240,0.70)', fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
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
  mapItem: { position: 'absolute', borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  itemShadow: { shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 } },
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
  inspector: { backgroundColor: '#071423', borderTopWidth: 1, borderTopColor: 'rgba(249,115,22,0.22)' },
  inspectorHeader: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.02)' },
  inspectorTitle: { flex: 1, color: '#F8FAFC', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  iconButton: { color: '#F97316', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.10)', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  deleteText: { color: '#f87171', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(239,68,68,0.34)', backgroundColor: 'rgba(239,68,68,0.10)', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  inspectorContent: { padding: 16, paddingBottom: 32 },
  sectionLabel: { color: '#F97316', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 18, marginBottom: 10, textTransform: 'uppercase' },
  sliderCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 14, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  sliderCopy: { color: 'rgba(226,232,240,0.55)', fontSize: 11, fontWeight: '500', marginBottom: 10 },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniButton: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  miniText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18, lineHeight: 20 },
  fakeSlider: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden' },
  fakeFill: { height: 6, backgroundColor: '#F97316', borderRadius: 3 },
  miniValue: { minWidth: 52, height: 32, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.10)' },
  miniValueText: { color: '#fb923c', fontSize: 12, fontWeight: '800' },
  inputLabel: { color: 'rgba(226,232,240,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 7, marginTop: 12 },
  input: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, color: '#F8FAFC', backgroundColor: 'rgba(255,255,255,0.05)', fontSize: 13, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: 10 },
  field: { flex: 1 },
  numberBox: { height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', flexDirection: 'row', alignItems: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  smallStepper: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.14)' },
  smallStepperText: { color: '#fb923c', fontWeight: '800', fontSize: 18, lineHeight: 20 },
  numberInput: { flex: 1, textAlign: 'center', color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  blockButton: { height: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(249,115,22,0.40)', backgroundColor: 'rgba(249,115,22,0.14)', alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  blockText: { color: '#fb923c', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  segmentRow: { flexDirection: 'row', gap: 7 },
  segment: { flex: 1, minHeight: 40, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6 },
  segmentActive: { backgroundColor: 'rgba(249,115,22,0.16)', borderColor: 'rgba(249,115,22,0.55)' },
  segmentText: { color: 'rgba(226,232,240,0.6)', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  segmentTextActive: { color: '#fb923c' },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  swatchActive: { borderColor: '#FFFFFF', borderWidth: 3, transform: [{ scale: 1.1 }] },

  // Per-seat panel
  seatPanel: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)', backgroundColor: 'rgba(59,130,246,0.07)', padding: 14, marginBottom: 6, gap: 6 },
  seatPanelHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 },
  seatPanelEyebrow: { color: '#60a5fa', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  seatPanelTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginTop: 2 },
  seatPanelClose: { color: 'rgba(226,232,240,0.7)', fontSize: 11, fontWeight: '700', textDecorationLine: 'underline' },
  seatToggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  seatCheck: { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.30)', alignItems: 'center', justifyContent: 'center' },
  seatCheckMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  seatToggleLabel: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', flex: 1 },
  seatMiniLabel: { color: 'rgba(226,232,240,0.55)', fontSize: 10, fontWeight: '700', marginBottom: 6, marginTop: 2 },
  seatHint: { color: 'rgba(148,163,184,0.6)', fontSize: 10, marginTop: 5 },
  seatResetBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  seatResetText: { color: '#60a5fa', fontSize: 11, fontWeight: '700' },
});
