import { Alert, Animated, Dimensions, Easing, GestureResponderEvent, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// Zoom/pan tuning — ported from ClientVenueMap so the editor navigates the same.
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.12;
const MAP_EDGE_PADDING = 80;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Matches the web editor's SECTION_COLORS so sections look the same on both.
const palette = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#6366f1'];

const initialItems: VenueItem[] = [
  { id: 'bar-1', type: 'bar', name: 'BAR', x: 95, y: 130, width: 260, height: 120, color: '#ff8138', price: 0, rows: 0, seatsPerRow: 0, fontSize: 18, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [], seatConfig: {} },
  { id: 'area-1', type: 'area', name: 'General Area', x: 135, y: 290, width: 205, height: 62, color: '#64748b', price: 25, rows: 0, seatsPerRow: 0, fontSize: 15, shape: 'soft', saleMode: 'seat', locked: false, blockedSeats: [], seatConfig: {} },
  { id: 'table-31', type: 'table', name: '31', x: 500, y: 355, width: 86, height: 58, color: '#16b981', price: 100, rows: 2, seatsPerRow: 3, fontSize: 10, shape: 'rectangle', saleMode: 'whole', locked: false, blockedSeats: [], seatConfig: {} },
  { id: 'table-30', type: 'table', name: '30', x: 650, y: 275, width: 96, height: 64, color: '#f59e0b', price: 100, rows: 2, seatsPerRow: 5, fontSize: 10, shape: 'rectangle', saleMode: 'seat', locked: false, blockedSeats: [], seatConfig: {} },
];

type Props = { eventId?: string; onScrollLock?: (locked: boolean) => void };

const VP_H = 440; // canvas viewport height (matches styles.workbench height)

export function VenueMapEditor({ eventId, onScrollLock }: Props) {
  const { t } = useLanguage();
  const vpW = Dimensions.get('window').width;
  const [items, setItems] = useState<VenueItem[]>(initialItems);
  // Live mirror of items for gesture callbacks (avoids stale closures).
  const itemsRef = useRef<VenueItem[]>(initialItems);
  itemsRef.current = items;
  // Edit mode (off = view only). Like the web, nothing moves/edits until the
  // pencil is tapped.
  const [editMode, setEditMode] = useState(false);
  // The camera view (pan + zoom) the buyer sees by default, set via "View".
  const [defaultView, setDefaultView] = useState<{ x: number; y: number; zoom: number } | null>(null);
  // Saved venue templates (reusable layouts).
  const [templates, setTemplates] = useState<{ id: string; name: string; sections: any[] }[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(initialItems[2].id);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; pageX: number; pageY: number } | null>(null);
  // Mirror of `drag` for gesture callbacks (they run outside React's render cycle
  // and would otherwise see a stale `drag` from the closure).
  const dragRef = useRef<typeof drag>(null);
  const setDragSafe = (d: typeof drag) => { dragRef.current = d; setDrag(d); };
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoomPct, setZoomPct] = useState(50); // for the % label only

  // ── Pan/zoom system ported from ClientVenueMap ──────────────────────────
  // Animated values move the canvas on the native side (no JS re-render per
  // frame). viewRef is the single source of truth for the pan/zoom math.
  const animZoom = useRef(new Animated.Value(0.5)).current;
  const animPanX = useRef(new Animated.Value(0)).current;
  const animPanY = useRef(new Animated.Value(0)).current;
  const halfCanvasW = useRef(new Animated.Value(CANVAS_WIDTH / 2)).current;
  const halfCanvasH = useRef(new Animated.Value(CANVAS_HEIGHT / 2)).current;
  const negOne = useRef(new Animated.Value(-1)).current;
  const viewRef = useRef({ zoom: 0.5, pan: { x: 0, y: 0 } });
  const fitRef = useRef({ zoom: 0.5, pan: { x: 0, y: 0 } });
  const animatingRef = useRef(false);

  const clampPan = useCallback((z: number, p: { x: number; y: number }, cb: { minX: number; minY: number; maxX: number; maxY: number }) => {
    // Allow free movement in BOTH axes: let the content travel from one edge of
    // the viewport to the other, plus a generous slack so you can always reach
    // around it. (The old logic locked an axis to centre when the content was
    // smaller than the viewport, which made it pan only side-to-side.)
    const slackX = vpW * 0.9;
    const slackY = VP_H * 0.9;
    const minPanX = vpW - cb.maxX * z - slackX;
    const maxPanX = -cb.minX * z + slackX;
    const minPanY = VP_H - cb.maxY * z - slackY;
    const maxPanY = -cb.minY * z + slackY;
    return {
      x: clamp(p.x, Math.min(minPanX, maxPanX), Math.max(minPanX, maxPanX)),
      y: clamp(p.y, Math.min(minPanY, maxPanY), Math.max(minPanY, maxPanY)),
    };
  }, [vpW]);

  const boundsRef = useRef({ minX: 0, minY: 0, maxX: CANVAS_WIDTH, maxY: CANVAS_HEIGHT });

  const syncAnimated = useCallback((z: number, p: { x: number; y: number }) => {
    const safePan = clampPan(z, p, boundsRef.current);
    animZoom.setValue(z);
    animPanX.setValue(safePan.x);
    animPanY.setValue(safePan.y);
    viewRef.current = { zoom: z, pan: safePan };
    // NOTE: no setState here — this runs on every gesture frame. Updating React
    // state per frame re-renders all items/grid and causes flicker/warp on real
    // devices. The % label is refreshed on gesture end / button taps instead.
  }, [animZoom, animPanX, animPanY, clampPan]);

  const animateTo = useCallback((newZ: number, newP: { x: number; y: number }, duration = 200) => {
    if (animatingRef.current) return;
    animatingRef.current = true;
    const safePan = clampPan(newZ, newP, boundsRef.current);
    viewRef.current = { zoom: newZ, pan: safePan };
    setZoomPct(Math.round(newZ * 100));
    Animated.parallel([
      Animated.timing(animZoom, { toValue: newZ, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(animPanX, { toValue: safePan.x, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(animPanY, { toValue: safePan.y, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start(() => { animatingRef.current = false; });
  }, [animZoom, animPanX, animPanY, clampPan]);

  // Compute the fit pan+zoom for the current items and apply it.
  const fitToContent = useCallback((loadedItems: VenueItem[]) => {
    if (loadedItems.length === 0) return;
    const pad = 40;
    const minX = Math.min(...loadedItems.map((i) => i.x)) - pad;
    const minY = Math.min(...loadedItems.map((i) => i.y)) - pad;
    const maxX = Math.max(...loadedItems.map((i) => i.x + i.width)) + pad;
    const maxY = Math.max(...loadedItems.map((i) => i.y + i.height)) + pad;
    boundsRef.current = { minX, minY, maxX, maxY };
    const z = clamp(Math.min((vpW - pad * 2) / Math.max(1, maxX - minX), (VP_H - pad * 2) / Math.max(1, maxY - minY)), MIN_ZOOM, MAX_ZOOM);
    const pan = { x: vpW / 2 - ((minX + maxX) / 2) * z, y: VP_H / 2 - ((minY + maxY) / 2) * z };
    fitRef.current = { zoom: z, pan };
    syncAnimated(z, pan);
  }, [vpW, syncAnimated]);

  const zoomBy = useCallback((delta: number) => {
    const oldZ = viewRef.current.zoom;
    const newZ = clamp(oldZ + delta, fitRef.current.zoom, MAX_ZOOM);
    if (newZ === oldZ) return;
    // Keep the visible centre fixed during zoom (same math as ClientVenueMap).
    const contentCx = (vpW / 2 - viewRef.current.pan.x) / oldZ;
    const contentCy = (VP_H / 2 - viewRef.current.pan.y) / oldZ;
    const newP = newZ <= fitRef.current.zoom + 0.001 ? fitRef.current.pan : {
      x: vpW / 2 - contentCx * newZ,
      y: VP_H / 2 - contentCy * newZ,
    };
    animateTo(newZ, newP);
  }, [vpW, animateTo]);

  const resetMap = useCallback(() => { animateTo(fitRef.current.zoom, fitRef.current.pan); }, [animateTo]);

  // Touch refs (pan + pinch) — same approach as ClientVenueMap.
  const touchRef = useRef({ x: 0, y: 0, panX: 0, panY: 0, isPinch: false, pinchDist: 0, pinchZoom: 1, pinchCx: 0, pinchCy: 0, moved: false });
  const responderStart = useRef({ x: 0, y: 0 });
  // When a touch lands on a draggable item in edit mode, the viewport must NOT
  // capture the pan — the item should own the gesture (drag/select).
  const touchedItemRef = useRef(false);
  // True while a chair is handling the touch, so the viewport ignores it.
  const seatTouchRef = useRef(false);

  // Only claim the move responder once the finger has actually moved a bit (or a
  // second finger lands), so a tap doesn't get captured. Mirrors the client.
  const shouldCapturePan = (e: any) => {
    if (dragRef.current) return false; // an item is being dragged
    if (touchedItemRef.current) return false; // touch started on an item — let it handle the gesture
    const touches = e.nativeEvent.touches || [];
    if (touches.length >= 2) return true;
    const t = touches[0];
    if (!t) return false;
    const dx = Math.abs((t.pageX || 0) - responderStart.current.x);
    const dy = Math.abs((t.pageY || 0) - responderStart.current.y);
    return dx > 2 || dy > 2;
  };

  const beginPinch = (touches: any[]) => {
    if (touches.length >= 2) {
      const t1 = touches[0], t2 = touches[1];
      const cx = ((t1.locationX ?? t1.pageX) + (t2.locationX ?? t2.pageX)) / 2;
      const cy = ((t1.locationY ?? t1.pageY) + (t2.locationY ?? t2.pageY)) / 2;
      touchRef.current = { x: 0, y: 0, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y, isPinch: true, pinchDist: Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY), pinchZoom: viewRef.current.zoom, pinchCx: cx, pinchCy: cy, moved: false };
    }
  };
  const beginPan = (touches: any[]) => {
    const t = touches[0];
    if (!t) return;
    touchRef.current = { x: t.locationX ?? t.pageX, y: t.locationY ?? t.pageY, panX: viewRef.current.pan.x, panY: viewRef.current.pan.y, isPinch: false, pinchDist: 0, pinchZoom: viewRef.current.zoom, pinchCx: 0, pinchCy: 0, moved: false };
  };
  const onCanvasTouchStart = (e: any) => {
    if (animatingRef.current) return;
    if (seatTouchRef.current || touchedItemRef.current) return; // an item/chair owns this touch
    onScrollLock?.(true); // stop the page from scrolling while moving the map
    const touches = e.nativeEvent.touches || [];
    const t0 = touches[0];
    responderStart.current = { x: t0?.pageX || 0, y: t0?.pageY || 0 };
    if (touches.length >= 2) beginPinch(touches);
    else if (!touchRef.current.isPinch) beginPan(touches);
  };
  const onCanvasTouchMove = (e: any) => {
    if (seatTouchRef.current || touchedItemRef.current) return; // an item/chair owns this touch
    const touches = e.nativeEvent.touches || [];
    if (!touchRef.current.isPinch && touches.length >= 2) { beginPinch(touches); return; }
    if (touchRef.current.isPinch && touches.length >= 2) {
      const t1 = touches[0], t2 = touches[1];
      const dist = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
      if (!touchRef.current.pinchDist) return;
      const cx = ((t1.locationX ?? t1.pageX) + (t2.locationX ?? t2.pageX)) / 2;
      const cy = ((t1.locationY ?? t1.pageY) + (t2.locationY ?? t2.pageY)) / 2;
      const newZ = clamp(touchRef.current.pinchZoom * Math.pow(dist / touchRef.current.pinchDist, 1.18), fitRef.current.zoom, MAX_ZOOM);
      const ratio = newZ / touchRef.current.pinchZoom;
      syncAnimated(newZ, { x: cx - (touchRef.current.pinchCx - touchRef.current.panX) * ratio, y: cy - (touchRef.current.pinchCy - touchRef.current.panY) * ratio });
    } else if (touchRef.current.isPinch && touches.length === 1) {
      beginPan(touches);
    } else if (!touchRef.current.isPinch && touches.length === 1) {
      const t = touches[0];
      const dx = (t.locationX ?? t.pageX) - touchRef.current.x;
      const dy = (t.locationY ?? t.pageY) - touchRef.current.y;
      syncAnimated(viewRef.current.zoom, { x: touchRef.current.panX + dx, y: touchRef.current.panY + dy });
    }
  };
  const onCanvasTouchEnd = (e: any) => {
    const touches = e?.nativeEvent?.touches || [];
    // Finished dragging an item.
    if (dragRef.current && touches.length === 0) {
      setDragSafe(null);
      touchedItemRef.current = false;
      onScrollLock?.(false);
      return;
    }
    if (touches.length === 1) { beginPan(touches); return; }
    if (touches.length === 0) {
      touchRef.current.isPinch = false;
      touchedItemRef.current = false; // reset for the next gesture
      onScrollLock?.(false); // re-enable page scroll once fingers are lifted
      // Refresh the % label once the gesture finishes (not per frame).
      setZoomPct(Math.round(viewRef.current.zoom * 100));
    }
  };

  // Canvas transform graph (stable nodes — built once).
  const canvasTranslateX = useRef(Animated.add(animPanX, Animated.multiply(halfCanvasW, Animated.add(negOne, animZoom)))).current;
  const canvasTranslateY = useRef(Animated.add(animPanY, Animated.multiply(halfCanvasH, Animated.add(negOne, animZoom)))).current;

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

  // ── Venue templates ────────────────────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    try {
      const data = await apiGet<any[]>('/venue-templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch { setTemplates([]); }
  }, []);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Apply a template's sections to the editor (replaces current items).
  const applyTemplate = (tmpl: { id: string; name: string; sections: any[] }) => {
    const loaded = (tmpl.sections || []).map((s) => sectionToItem({ ...s, id: undefined }));
    if (loaded.length === 0) {
      Alert.alert(t('Plantilla vacía', 'Empty template'), t('Esta plantilla no tiene secciones.', 'This template has no sections.'));
      return;
    }
    setItems(loaded);
    setSelectedId(loaded[0].id);
    setSelectedSeat(null);
    setSaved(false);
    setTemplatesOpen(false);
    fitToContent(loaded);
    Alert.alert(t('Plantilla cargada', 'Template loaded'), t('Recuerda guardar el mapa.', 'Remember to save the map.'));
  };

  // Save the current layout as a reusable template (admin only on the backend).
  const saveAsTemplate = async () => {
    const name = `Mapa ${new Date().toLocaleDateString()}`;
    try {
      await apiPost('/venue-templates', {
        name,
        description: 'Plantilla creada desde el editor móvil',
        sections: items.map(itemToSection),
        isSystem: false,
      });
      Alert.alert(t('Plantilla guardada', 'Template saved'), name);
      loadTemplates();
    } catch (err: any) {
      Alert.alert(t('No se pudo guardar', 'Could not save'), err?.message || t('Solo un administrador puede guardar plantillas.', 'Only an admin can save templates.'));
    }
  };

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
        ...(defaultView ? {
          defaultViewX: parseFloat(defaultView.x.toFixed(2)),
          defaultViewY: parseFloat(defaultView.y.toFixed(2)),
          defaultViewZoom: parseFloat(defaultView.zoom.toFixed(4)),
        } : {}),
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

  // Canvas transform: translate(pan) + scale, compensating RN's centre origin.
  const canvasTransformStyle = {
    transform: [
      { translateX: canvasTranslateX as any },
      { translateY: canvasTranslateY as any },
      { scale: animZoom as any },
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

  // Apply a drag delta to the item's CURRENT stored position (always correct,
  // no captured base that could go stale → no jumping to the corner).
  const moveItemBy = (id: string, dx: number, dy: number) => {
    setSaved(false);
    setItems((current) => current.map((entry) => {
      if (entry.id !== id || entry.locked) return entry;
      return {
        ...entry,
        x: Math.max(0, Math.min(CANVAS_WIDTH - entry.width, entry.x + dx)),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - entry.height, entry.y + dy)),
      };
    }));
  };

  // Drag a chair: update its xOffset/yOffset (baseX/baseY = offset when the drag began).
  const dragSeat = (seatId: string, itemId: string, baseX: number, baseY: number, dx: number, dy: number) => {
    setSaved(false);
    setItems((current) => current.map((it) => {
      if (it.id !== itemId) return it;
      const cfg = { ...(it.seatConfig || {}) };
      const cur = { ...(cfg[seatId] || {}) } as SeatOverride;
      cur.xOffset = Math.round(baseX + dx);
      cur.yOffset = Math.round(baseY + dy);
      if (cur.xOffset === 0) delete cur.xOffset;
      if (cur.yOffset === 0) delete cur.yOffset;
      cfg[seatId] = cur;
      return { ...it, seatConfig: cfg };
    }));
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

  type SeatInfoCard = { title: string; subtitle: string; status: string; price: number; tone: 'available' | 'reserved' | 'disabled'; px: number; py: number };
  const [activeSeatInfo, setActiveSeatInfo] = useState<SeatInfoCard | null>(null);
  const infoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<any>(null);
  const rootYRef = useRef(0);
  const canvasVpRef = useRef<any>(null);
  const canvasVpYRef = useRef(0);

  // Keep a ref so the card survives re-renders caused by zoom/pan state updates.
  const activeSeatInfoRef = useRef<SeatInfoCard | null>(null);

  const showSeatInfo = (info: SeatInfoCard) => {
    if (infoDismissRef.current) clearTimeout(infoDismissRef.current);
    activeSeatInfoRef.current = info;
    setActiveSeatInfo(info);
    infoDismissRef.current = setTimeout(() => {
      activeSeatInfoRef.current = null;
      setActiveSeatInfo(null);
      setSelectedSeat(null);
      setSelectedId('');
    }, 4000);
  };

  // Tapping a whole item (table/area/bar/stage) shows its summary card.
  const showItemInfo = (it: VenueItem, _px: number, _py: number) => {
    const typeLabel = it.type === 'table' ? t('Mesa', 'Table')
      : it.type === 'seat' ? t('Asientos', 'Seats')
      : it.type === 'area' ? t('Área general', 'General area')
      : it.type === 'bar' ? t('Barra', 'Bar')
      : it.type === 'stage' ? t('Escenario', 'Stage') : it.type;
    const totalSeats = it.rows > 0 && it.seatsPerRow > 0 ? it.rows * it.seatsPerRow : 0;
    const blocked = Object.values(it.seatConfig || {}).filter((v: SeatOverride) => v.reserved || v.disabled).length;
    const available = Math.max(0, totalSeats - blocked);
    const subtitle = totalSeats > 0
      ? `${available} ${t('disp.', 'avail.')} · ${blocked} ${t('bloq.', 'blocked')} · ${totalSeats} ${t('total', 'total')}`
      : typeLabel;
    showSeatInfo({
      title: `${it.name} · ${typeLabel}`,
      subtitle,
      status: it.saleMode === 'whole' ? t('Mesa completa', 'Whole table') : t('Por asiento', 'Per seat'),
      price: it.price || 0,
      tone: 'available',
      px: 0, py: 0,
    });
  };

  const toggleSeat = (seatId: string, pageX = 0, pageY = 0, itemId = '') => {
    if (editMode) {
      // Select the chair's item too, so the inspector targets the right table.
      if (itemId && itemId !== selectedId) setSelectedId(itemId);
      setSelectedSeat((current) => (current === seatId ? null : seatId));
      return;
    }
    // View mode: itemId is passed directly from SeatDots so we know exactly which table was tapped.
    const owner = items.find((it) => it.id === itemId);
    if (!owner) return;
    setSelectedId(owner.id);
    setSelectedSeat(seatId);
    const ov: SeatOverride = owner.seatConfig?.[seatId] || {};
    const isTableKey = seatId.startsWith('seat-');
    const seatNum = isTableKey ? seatId.replace('seat-', '') : seatId.split('-')[1];
    const rowLabel = isTableKey ? '' : seatId.split('-')[0];
    const status = ov.disabled ? t('Oculto', 'Hidden') : ov.reserved ? t('Bloqueado', 'Blocked') : t('Disponible', 'Available');
    const tone: SeatInfoCard['tone'] = ov.disabled ? 'disabled' : ov.reserved ? 'reserved' : 'available';
    showSeatInfo({
      title: `${owner.name} · ${t('Silla', 'Seat')} ${seatNum}`,
      subtitle: rowLabel ? `${t('Fila', 'Row')} ${rowLabel}` : '',
      status,
      price: owner.price || 0,
      tone,
      px: pageX,
      py: pageY - canvasVpYRef.current,
    });
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
    <View style={styles.root} ref={rootRef} onLayout={() => { rootRef.current?.measure((_x: number, _y: number, _w: number, _h: number, _px: number, py: number) => { rootYRef.current = py; }); }}>
      <View style={styles.topBar}>
        {/* Row 1: logo + title + save */}
        <View style={styles.topBarRow}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Text style={styles.brandText}>Lpt</Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.brandEyebrow}>Chart</Text>
              <Text style={styles.brandTitle} numberOfLines={1}>{t('Diseñador de Asientos', 'Seat Designer')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={saveMap} disabled={saving} style={[styles.saveButton, saving && { opacity: 0.6 }]}>
            <Text style={styles.saveText}>{saving ? t('GUARDANDO...', 'SAVING...') : saved ? t('GUARDADO', 'SAVED') : t('GUARDAR', 'SAVE')}</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: stats (all three visible) */}
        <View style={styles.mapStatsRow}>
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
        </View>
      </View>

      {/* Row A: actions (Edit, Set View, Templates) + zoom on the right. */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => { setEditMode((m) => { if (m) { setSelectedSeat(null); } return !m; }); }}
          style={[styles.editToggle, editMode && styles.editToggleActive]}
        >
          <Ionicons name="pencil" size={14} color={editMode ? '#FFFFFF' : '#fb923c'} />
          <Text style={[styles.editToggleText, editMode && styles.editToggleTextActive]}>
            {editMode ? t('Editando', 'Editing') : t('Editar', 'Edit')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setDefaultView({ x: viewRef.current.pan.x, y: viewRef.current.pan.y, zoom: viewRef.current.zoom });
            setSaved(false);
            Alert.alert(t('Vista fijada', 'View set'), t('Esta será la vista inicial que verán los clientes. Recuerda guardar.', 'This will be the initial view buyers see. Remember to save.'));
          }}
          style={styles.viewBtn}
        >
          <Ionicons name="eye-outline" size={14} color="#60a5fa" />
          <Text style={styles.viewBtnText}>{t('Vista', 'View')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { loadTemplates(); setTemplatesOpen(true); }} style={styles.tmplBtn}>
          <Ionicons name="albums-outline" size={16} color="#fb923c" />
          <Text style={styles.tmplBtnText}>{t('Plantillas', 'Templates')}</Text>
        </TouchableOpacity>
      </View>

      {/* Row B: add-tools, only in edit mode, in their own clean row. */}
      {editMode && (
        <View style={styles.toolsRow}>
          <Tool icon="grid-outline" label={t('Mesa', 'Table')} onPress={() => addItem('table')} />
          <Tool icon="square-outline" label={t('Área', 'Area')} onPress={() => addItem('area')} />
          <Tool icon="remove-outline" label={t('Barra', 'Bar')} onPress={() => addItem('bar')} />
          <Tool icon="tv-outline" label={t('Escenario', 'Stage')} onPress={() => addItem('stage')} />
          <Tool icon="ellipse-outline" label={t('Asiento', 'Seat')} onPress={() => addItem('seat')} />
        </View>
      )}

      <View style={styles.workbench}>
          {/* The VIEWPORT captures panning, so you can drag from anywhere in the
              visible area — including outside the content — not only from an
              empty spot on the moving canvas. Items still grab their own touches
              (in edit mode), so dragging an item doesn't also pan. */}
          <View
            ref={canvasVpRef}
            style={styles.canvasViewport}
            onLayout={() => { canvasVpRef.current?.measure((_x: number, _y: number, _w: number, _h: number, _px: number, py: number) => { canvasVpYRef.current = py; }); }}
            // The viewport claims the responder on START (not just move), so the
            // parent ScrollView can never steal a vertical gesture mid-drag. Items
            // and chairs sit above and win their own touches via their responders.
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onTouchStart={onCanvasTouchStart}
            onTouchMove={onCanvasTouchMove}
            onTouchEnd={onCanvasTouchEnd}
            onTouchCancel={onCanvasTouchEnd}
            onResponderGrant={onCanvasTouchStart}
            onResponderMove={onCanvasTouchMove}
            onResponderRelease={onCanvasTouchEnd}
            onResponderTerminate={onCanvasTouchEnd}
          >
            {/* Grid covers the whole viewport (fixed). */}
            <EditorGrid width={vpW} height={VP_H} />
            <Animated.View
            style={[styles.canvas, canvasTransformStyle]}
            pointerEvents="box-none"
          >
              {items.map((item, index) => {
                const isSelected = selectedId === item.id;

                return (
                  <ItemView
                    key={item.id || `map-item-${index}`}
                    item={item}
                    isSelected={isSelected}
                    editMode={editMode}
                    zoomRef={viewRef}
                    touchedItemRef={touchedItemRef}
                    onSelect={(id) => { setSelectedId(id); }}
                    onShowInfo={(it, px, py) => showItemInfo(it, px, py)}
                    onDragMove={(it, dx, dy) => moveItemBy(it.id, dx, dy)}
                    onDragEnd={() => onScrollLock?.(false)}
                    onScrollLock={onScrollLock}
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
                      <SeatDots item={item} selectedSeat={selectedSeat} selectedItemId={selectedId} editMode={editMode} zoomRef={viewRef} seatTouchRef={seatTouchRef} onSeatPress={toggleSeat} onSeatDrag={dragSeat} />
                    )}

                    <Text
                      pointerEvents="none"
                      style={[
                        styles.itemLabel,
                        { fontSize: item.fontSize, color: '#FFFFFF', zIndex: 6 },
                        (item.type === 'table' || item.type === 'seat') && { textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
                      ]}>
                      {item.name}
                    </Text>
                  </ItemView>
                );
              })}
            </Animated.View>

            {/* Floating zoom bar — bottom-right over canvas */}
            <View style={styles.zoomFloat} pointerEvents="box-none">
              <View style={styles.zoomControls}>
                <TouchableOpacity onPress={() => zoomBy(-ZOOM_STEP)} style={styles.zoomCtrlBtn}>
                  <Ionicons name="remove-outline" size={16} color="rgba(226,232,240,0.85)" />
                </TouchableOpacity>
                <View style={styles.zoomCtrlDivider} />
                <TouchableOpacity onPress={() => zoomBy(ZOOM_STEP)} style={styles.zoomCtrlBtn}>
                  <Ionicons name="add-outline" size={16} color="rgba(226,232,240,0.85)" />
                </TouchableOpacity>
                <View style={styles.zoomCtrlDivider} />
                <TouchableOpacity onPress={() => fitToContent(items)} style={styles.zoomCtrlBtn}>
                  <Ionicons name="contract-outline" size={14} color="rgba(226,232,240,0.85)" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Seat info card — floats over canvas; use ref as source of truth so zoom re-renders don't clear it */}
            {(activeSeatInfo || activeSeatInfoRef.current) && (() => {
              const card = activeSeatInfo || activeSeatInfoRef.current!;
              const toneColor = card.tone === 'reserved' ? '#facc15' : card.tone === 'disabled' ? '#94a3b8' : '#86efac';
              // Fixed position just above the zoom bar — never follows the finger.
              const cardTop = VP_H - 100;
              return (
                <View style={[styles.seatInfoCard, { top: cardTop }]} pointerEvents="none">
                  <View style={[styles.seatInfoTone, { backgroundColor: `${toneColor}22` }]}>
                    <Text style={[styles.seatInfoToneText, { color: toneColor }]}>{card.status}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seatInfoTitle} numberOfLines={1}>{card.title}</Text>
                    {!!card.subtitle && <Text style={styles.seatInfoSub} numberOfLines={1}>{card.subtitle}</Text>}
                  </View>
                  {card.price > 0 && <Text style={styles.seatInfoPrice}>${card.price.toFixed(2)}</Text>}
                </View>
              );
            })()}
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
              <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={true} nestedScrollEnabled contentContainerStyle={styles.inspectorContent}>
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

      {/* Saved templates picker */}
      <Modal visible={templatesOpen} transparent animationType="fade" onRequestClose={() => setTemplatesOpen(false)}>
        <View style={styles.tmplOverlay}>
          <View style={styles.tmplModal}>
            <View style={styles.tmplHeader}>
              <Text style={styles.tmplTitle}>{t('Plantillas guardadas', 'Saved templates')}</Text>
              <TouchableOpacity onPress={() => setTemplatesOpen(false)}>
                <Ionicons name="close" size={20} color="rgba(248,250,252,0.7)" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {templates.length === 0 ? (
                <Text style={styles.tmplEmpty}>{t('No hay plantillas guardadas.', 'No saved templates.')}</Text>
              ) : (
                templates.map((tmpl) => (
                  <TouchableOpacity key={tmpl.id} style={styles.tmplRow} onPress={() => applyTemplate(tmpl)} activeOpacity={0.8}>
                    <Ionicons name="albums-outline" size={18} color="#fb923c" />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.tmplName} numberOfLines={1}>{tmpl.name}</Text>
                      <Text style={styles.tmplMeta}>{(tmpl.sections || []).length} {t('secciones', 'sections')}</Text>
                    </View>
                    <View style={styles.tmplLoadChip}><Text style={styles.tmplLoadChipText}>{t('CARGAR', 'LOAD')}</Text></View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity onPress={saveAsTemplate} style={styles.tmplSaveBtn}>
              <Ionicons name="save-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.tmplSaveText}>{t('GUARDAR DISEÑO ACTUAL COMO PLANTILLA', 'SAVE CURRENT LAYOUT AS TEMPLATE')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

// An item (table/area/bar/stage). A tap always shows its info; in edit mode a
// drag moves it. Owns its own responder so it never fights the canvas pan: it
// flags `touchedItemRef` so the viewport ignores the gesture. Chairs sit above
// (higher zIndex) and win their own taps via SeatDot.
function ItemView({ item, isSelected, editMode, zoomRef, touchedItemRef, onSelect, onShowInfo, onDragMove, onDragEnd, onScrollLock, style, children }: {
  item: VenueItem; isSelected: boolean; editMode: boolean;
  zoomRef: React.MutableRefObject<{ zoom: number; pan: { x: number; y: number } }>;
  touchedItemRef: React.MutableRefObject<boolean>;
  onSelect: (id: string) => void;
  onShowInfo: (item: VenueItem, px: number, py: number) => void;
  onDragMove: (item: VenueItem, x: number, y: number) => void;
  onDragEnd: () => void;
  onScrollLock?: (locked: boolean) => void;
  style: any; children: React.ReactNode;
}) {
  // SAME mechanism as SeatDot (which works): move with an additive Animated
  // translate, NEVER relayout left/top. The canvas is scaled from its centre, so
  // changing left/top mid-drag reprojects the item (teleport). A translate child
  // composes cleanly with the parent scale. On release we commit the DELTA via
  // moveItemBy (applied to the item's live position) and reset the translate.
  const start = useRef({ x: 0, y: 0, dx: 0, dy: 0, moved: false });
  const draggingRef = useRef(false);
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  return (
    <Animated.View
      onStartShouldSetResponderCapture={() => { touchedItemRef.current = true; return false; }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => editMode}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        touchedItemRef.current = true;
        draggingRef.current = true;
        offset.setValue({ x: 0, y: 0 });
        start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, dx: 0, dy: 0, moved: false };
      }}
      onResponderMove={(e) => {
        if (!editMode) return;
        const z = zoomRef.current.zoom || 1;
        const dx = (e.nativeEvent.pageX - start.current.x) / z;
        const dy = (e.nativeEvent.pageY - start.current.y) / z;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) start.current.moved = true;
        if (start.current.moved) {
          start.current.dx = dx; start.current.dy = dy;
          offset.setValue({ x: dx, y: dy });
        }
      }}
      onResponderRelease={() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        if (start.current.moved) {
          offset.setValue({ x: 0, y: 0 });
          onDragMove(item, start.current.dx, start.current.dy);
        } else {
          onSelect(item.id);
          onShowInfo(item, start.current.x, start.current.y);
        }
        touchedItemRef.current = false;
        onDragEnd();
      }}
      onResponderTerminate={() => {
        if (draggingRef.current && start.current.moved) { offset.setValue({ x: 0, y: 0 }); onDragMove(item, start.current.dx, start.current.dy); }
        draggingRef.current = false;
        touchedItemRef.current = false;
        onDragEnd();
      }}
      style={[style, { transform: [{ translateX: offset.x }, { translateY: offset.y }] }]}
    >
      {children}
    </Animated.View>
  );
}

// One chair: a tap selects it (info/inspector); a drag adjusts its xOffset/yOffset
// (like the web editor). Uses its own responder so it doesn't fight the canvas.
function SeatDot({ id, itemId, baseX, baseY, left, top, size, fill, active, editMode, zoomRef, seatTouchRef, onSeatPress, onSeatDrag }: {
  id: string; itemId: string; baseX: number; baseY: number;
  left: number; top: number; size: number; fill: string; active: boolean;
  editMode: boolean; zoomRef: React.MutableRefObject<{ zoom: number; pan: { x: number; y: number } }>;
  seatTouchRef: React.MutableRefObject<boolean>;
  onSeatPress: (seatId: string, px: number, py: number, itemId: string) => void;
  onSeatDrag: (seatId: string, itemId: string, baseX: number, baseY: number, dx: number, dy: number) => void;
}) {
  const start = useRef({ x: 0, y: 0, dx: 0, dy: 0, moved: false });
  const offset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  return (
    <Animated.View
      onStartShouldSetResponderCapture={() => { seatTouchRef.current = true; return false; }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => editMode}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => { seatTouchRef.current = true; offset.setValue({ x: 0, y: 0 }); start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, dx: 0, dy: 0, moved: false }; }}
      onResponderMove={(e) => {
        if (!editMode) return;
        const z = zoomRef.current.zoom || 1;
        const dx = (e.nativeEvent.pageX - start.current.x) / z;
        const dy = (e.nativeEvent.pageY - start.current.y) / z;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) start.current.moved = true;
        if (start.current.moved) {
          start.current.dx = dx; start.current.dy = dy;
          offset.setValue({ x: dx, y: dy });
        }
      }}
      onResponderRelease={(e) => {
        if (start.current.moved) {
          offset.setValue({ x: 0, y: 0 });
          onSeatDrag(id, itemId, baseX, baseY, start.current.dx, start.current.dy);
        } else {
          onSeatPress(id, e.nativeEvent.pageX, e.nativeEvent.pageY, itemId);
        }
        seatTouchRef.current = false;
      }}
      onResponderTerminate={() => {
        if (start.current.moved) { offset.setValue({ x: 0, y: 0 }); onSeatDrag(id, itemId, baseX, baseY, start.current.dx, start.current.dy); }
        seatTouchRef.current = false;
      }}
      style={[
        styles.seatDot,
        {
          left, top, width: size, height: size, borderRadius: size / 2,
          backgroundColor: fill,
          zIndex: active ? 10 : 5,
          transform: [{ scale: active ? 1.35 : 1 }, { translateX: offset.x }, { translateY: offset.y }],
          borderColor: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
          borderWidth: active ? 2 : 1,
        },
      ]}
    />
  );
}

function SeatDots({ item, selectedSeat, selectedItemId, editMode, zoomRef, seatTouchRef, onSeatPress, onSeatDrag }: {
  item: VenueItem;
  selectedSeat: string | null;
  selectedItemId: string;
  editMode: boolean;
  zoomRef: React.MutableRefObject<{ zoom: number; pan: { x: number; y: number } }>;
  seatTouchRef: React.MutableRefObject<boolean>;
  onSeatPress: (seatId: string, px: number, py: number, itemId: string) => void;
  onSeatDrag: (seatId: string, itemId: string, baseX: number, baseY: number, dx: number, dy: number) => void;
}) {
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
        // Same fixed perimeter formula as web VenueMapBuilder.
        // xPct/yPct are percentages of w/h so they already scale with orientation.
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
    const isActiveSeat = selectedSeat === id && selectedItemId === item.id;
    seats.push(
      <SeatDot
        key={id}
        id={id}
        itemId={item.id}
        baseX={ox}
        baseY={oy}
        left={cx - dot / 2 + ox}
        top={cy - dot / 2 + oy}
        size={dot}
        fill={isActiveSeat ? '#f97316' : fill}
        active={isActiveSeat}
        editMode={editMode}
        zoomRef={zoomRef}
        seatTouchRef={seatTouchRef}
        onSeatPress={onSeatPress}
        onSeatDrag={onSeatDrag}
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

function Tool({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tool} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={20} color="#fb923c" />
      <Text style={styles.toolText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
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
  mapStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9 },
  mapStatPill: { flex: 1, minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  statBlue: { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.30)' },
  statGreen: { backgroundColor: 'rgba(52,211,153,0.10)', borderColor: 'rgba(52,211,153,0.30)' },
  statOrange: { backgroundColor: 'rgba(249,115,22,0.10)', borderColor: 'rgba(249,115,22,0.30)' },
  mapStatAvailable: {},
  mapStatLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  mapStatValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
  root: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  topBar: { backgroundColor: '#071423', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingTop: 11, paddingBottom: 12 },
  topBarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  brandMark: { width: 36, height: 36, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.40)', alignItems: 'center', justifyContent: 'center' },
  brandText: { color: '#F97316', fontWeight: '800', fontSize: 11, letterSpacing: 0.3 },
  brandEyebrow: { color: '#F97316', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  brandTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  capacityPill: { flex: 1, maxWidth: 220, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingHorizontal: 8, height: 34, justifyContent: 'center' },
  capacityText: { color: '#F97316', fontSize: 10, fontWeight: '700' },
  saveButton: { height: 38, borderRadius: 12, paddingHorizontal: 16, backgroundColor: '#F97316', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.30, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  saveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  editToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(249,115,22,0.40)', backgroundColor: 'rgba(249,115,22,0.10)' },
  editToggleActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
  editToggleText: { color: '#fb923c', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  editToggleTextActive: { color: '#FFFFFF' },
  viewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(59,130,246,0.40)', backgroundColor: 'rgba(59,130,246,0.10)' },
  viewBtnText: { color: '#60a5fa', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  tmplBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)', backgroundColor: 'rgba(249,115,22,0.07)' },
  tmplBtnText: { color: '#fb923c', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  // Floating zoom bar over the canvas (web-style).
  zoomFloat: { position: 'absolute', bottom: 12, right: 12, alignItems: 'flex-end', zIndex: 30 },
  zoomControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(13,33,56,0.92)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  zoomCtrlBtn: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  zoomCtrlDivider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.14)' },
  // Templates modal
  tmplOverlay: { flex: 1, backgroundColor: 'rgba(2,8,15,0.78)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  tmplModal: { width: '100%', maxWidth: 460, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0A1420', padding: 16 },
  tmplHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  tmplTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  tmplEmpty: { color: 'rgba(226,232,240,0.6)', fontSize: 13, textAlign: 'center', paddingVertical: 28 },
  tmplRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 8 },
  tmplName: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  tmplMeta: { color: 'rgba(148,163,184,0.7)', fontSize: 11, marginTop: 2 },
  tmplLoadChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)' },
  tmplLoadChipText: { color: '#fb923c', fontSize: 9, fontWeight: '800' },
  tmplSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 13, backgroundColor: '#F97316', marginTop: 8 },
  tmplSaveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#071423', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  toolsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 7, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#071423', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  zoomGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  workbench: { height: VP_H, backgroundColor: '#0d2138' },
  leftRail: { display: 'none', width: 0 },
  tool: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.22)', backgroundColor: 'rgba(249,115,22,0.06)' },
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
  seatInfoCard: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(11,34,54,0.96)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(246,198,95,0.20)', paddingHorizontal: 12, paddingVertical: 10, zIndex: 40 },
  seatInfoTone: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  seatInfoToneText: { fontSize: 10, fontWeight: '600' },
  seatInfoTitle: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  seatInfoSub: { color: '#94a3b8', fontSize: 10, fontWeight: '600', marginTop: 1 },
  seatInfoPrice: { color: '#F97316', fontSize: 14, fontWeight: '600', flexShrink: 0 },
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
