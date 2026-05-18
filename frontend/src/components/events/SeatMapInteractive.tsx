'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { VenueSection, Seat, SeatStatus } from '@/types';
import { HiOutlineZoomIn, HiOutlineZoomOut, HiOutlineArrowLeft } from 'react-icons/hi';
import { FaWheelchair } from 'react-icons/fa';
import { AnimatePresence, motion } from 'framer-motion';
import { useLang } from '@/context/LanguageContext';

/**
 * SeatMapInteractiveProps
 * @property seatMap Array of sections with their associated seats
 * @property selectedSeats Currently selected seats for the transaction
 * @property onToggleSeats Callback to handle selection/deselection of seats
 * @property filterSectionId If provided, restricts the view to a specific section
 * @property defaultViewX Starting X offset for the map
 * @property defaultViewY Starting Y offset for the map
 * @property defaultViewZoom Starting zoom level
 * @property showStage Whether to render the stage area
 */
interface SeatMapInteractiveProps {
  seatMap: (VenueSection & { seats: Seat[] })[];
  selectedSeats: Seat[];
  onToggleSeats: (seats: Seat[]) => void;
  filterSectionId?: string;
  defaultViewX?: number;
  defaultViewY?: number;
  defaultViewZoom?: number;
  showStage?: boolean;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;

/**
 * SeatMapInteractive Component
 * A high-performance interactive seat map component.
 * Uses a transformation-based approach (translate/scale) to allow smooth
 * panning and zooming across large venue layouts.
 */
export default function SeatMapInteractive({
  seatMap,
  selectedSeats,
  onToggleSeats,
  filterSectionId,
  defaultViewX,
  defaultViewY,
  defaultViewZoom,
  showStage = false,
}: SeatMapInteractiveProps) {
  const { lang } = useLang();
  
  // State for camera/view transformation
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  // focusedSection tracks if the user is "inside" a specific section view
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  
  // Interaction state
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * Memoized list of sections to render, filtered if necessary.
   */
  const sections = useMemo(() => {
    return filterSectionId
      ? seatMap.filter((s) => s.id === filterSectionId)
      : seatMap;
  }, [seatMap, filterSectionId]);

  const isSeatSelected = (id: string) => selectedSeats.some((s) => s.id === id);

  /**
   * Determines if a seat is considered "unavailable" based on status or admin overrides.
   */
  const isSeatUnavailable = (seat: Seat, seatOverride: any = {}) =>
    seat.status === SeatStatus.SOLD ||
    seat.status === SeatStatus.LOCKED ||
    !!seatOverride?.reserved;

  // --- Seat Styling Logic ---
  const getSeatBg = (seat: Seat, seatOverride: any, sectionColor: string, isWC: boolean, selected: boolean) => {
    if (selected) return '#f97316'; // Vivid orange for selected/cart state!
    if (isSeatUnavailable(seat, seatOverride)) return '#cbd5e1'; // Solid slate-200/gray for locked/sold
    return isWC ? '#1a73e8' : sectionColor; // Solid vibrant section color for available!
  };
  
  const getSeatBorder = (seat: Seat, seatOverride: any, sectionColor: string, isWC: boolean, selected: boolean) => {
    if (selected) return '#ffffff';
    if (isSeatUnavailable(seat, seatOverride)) return '#94a3b8'; // Solid slate-400 for locked/sold
    return '#ffffff'; // White border, exactly like the designer!
  };
  
  const getSeatShadow = (seat: Seat, seatOverride: any, sectionColor: string, selected: boolean) => {
    if (selected) return `0 0 0 2.5px #f97316, 0 4px 10px rgba(249,115,22,0.4)`;
    if (isSeatUnavailable(seat, seatOverride)) return 'none';
    return '0 1.5px 3px rgba(0,0,0,0.15)';
  };

  /**
   * Retrieves the effective price for a seat, checking for section overrides.
   */
  const getSeatPrice = (seat: any, section: VenueSection) => {
    try {
      if (section.seatsConfig) {
        const config = JSON.parse(section.seatsConfig);
        let seatKey = '';
        if (seat.rowLabel && seat.rowLabel !== 'GA') {
          seatKey = `${seat.rowLabel}-${seat.seatNumber}`;
        } else {
          seatKey = `seat-${seat.seatNumber}`;
        }
        const override = config[seatKey];
        if (override && override.price !== undefined && override.price !== null) {
          return Number(override.price);
        }
      }
    } catch (e) {
      // Silently fail and use default section price
    }
    return Number(section.price || 0);
  };

  /**
   * Zooms in relative to the container center.
   */
  const zoomIn = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const mx = cw / 2;
    const my = ch / 2;

    const oldZoom = zoom;
    const newZoom = Math.min(zoom + ZOOM_STEP, MAX_ZOOM);
    if (newZoom === oldZoom) return;

    const ratio = newZoom / oldZoom;
    const newX = mx - (mx - pan.x) * ratio;
    const newY = my - (my - pan.y) * ratio;

    setZoom(newZoom);
    setPan({
      x: Math.min(cw - 100, Math.max(-2000 * newZoom + 100, newX)),
      y: Math.min(ch - 100, Math.max(-1600 * newZoom + 100, newY)),
    });
  };

  /**
   * Zooms out relative to the container center.
   */
  const zoomOut = () => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    const mx = cw / 2;
    const my = ch / 2;

    const oldZoom = zoom;
    const newZoom = Math.max(zoom - ZOOM_STEP, MIN_ZOOM);
    if (newZoom === oldZoom) return;

    const ratio = newZoom / oldZoom;
    const newX = mx - (mx - pan.x) * ratio;
    const newY = my - (my - pan.y) * ratio;

    setZoom(newZoom);
    setPan({
      x: Math.min(cw - 100, Math.max(-2000 * newZoom + 100, newX)),
      y: Math.min(ch - 100, Math.max(-1600 * newZoom + 100, newY)),
    });
  };
  
  /**
   * Resets view to the initial state or provided defaults.
   */
  const resetView = () => {
    if (
      typeof defaultViewX === 'number' &&
      typeof defaultViewY === 'number' &&
      typeof defaultViewZoom === 'number'
    ) {
      setZoom(defaultViewZoom);
      setPan({ x: defaultViewX, y: defaultViewY });
    } else {
      setZoom(0.8);
      setPan({ x: 0, y: 0 });
    }
    setFocusedSection(null);
  };

  const initializedRef = useRef(false);

  /**
   * Automatically calculates an initial "fit-to-view" zoom and position
   * based on the bounding box of all sections.
   */
  useEffect(() => {
    if (initializedRef.current) return;
    if (!containerRef.current) return;
    
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    if (cw === 0 || ch === 0) return;

    if (
      typeof defaultViewX === 'number' &&
      typeof defaultViewY === 'number' &&
      typeof defaultViewZoom === 'number'
    ) {
      setPan({ x: defaultViewX, y: defaultViewY });
      setZoom(defaultViewZoom);
    } else {
      // Calculate map bounds
      let minX = 2000, minY = 1600, maxX = 0, maxY = 0;
      seatMap.forEach(sec => {
        if ((sec.mapX || 0) < minX) minX = sec.mapX || 0;
        if ((sec.mapY || 0) < minY) minY = sec.mapY || 0;
        if ((sec.mapX || 0) + (sec.mapWidth || 100) > maxX) maxX = (sec.mapX || 0) + (sec.mapWidth || 100);
        if ((sec.mapY || 0) + (sec.mapHeight || 100) > maxY) maxY = (sec.mapY || 0) + (sec.mapHeight || 100);
      });

      if (seatMap.length > 0 && maxX > minX) {
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const contentW = maxX - minX;
        const contentH = maxY - minY;
        const zoomX = cw / (contentW + 200);
        const zoomY = ch / (contentH + 200);
        const autoZoom = Math.min(zoomX, zoomY, 1.5);
        setZoom(autoZoom);
        setPan({
          x: cw / 2 - cx * autoZoom,
          y: ch / 2 - cy * autoZoom
        });
      } else {
        // Default fallback position
        setZoom(0.8);
        setPan({ x: cw / 2 - 1000 * 0.8, y: ch / 4 - 60 * 0.8 });
      }
    }
    initializedRef.current = true;
  }, [defaultViewX, defaultViewY, defaultViewZoom, seatMap]);

  /**
   * Smoothly pans and zooms the camera into a specific section.
   */
  const handleSectionClick = (section: VenueSection) => {
    if (focusedSection === section.id) return;
    setFocusedSection(section.id!);

    // For standing sections, auto-select a ticket if empty
    if (section.sectionType === 'standing') {
      const currentQty = selectedSeats.filter(s => s.sectionId === section.id).length;
      if (currentQty === 0) {
        onToggleSeats([{
          id: `standing-${section.id}-1-${Date.now()}`,
          sectionId: section.id!,
          rowLabel: 'GA',
          seatNumber: 1,
          status: SeatStatus.AVAILABLE,
        }]);
      }
    }

    if (containerRef.current) {
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      const targetZoom = Math.min(
        (cw * 0.8) / (section.mapWidth || 100),
        (ch * 0.8) / (section.mapHeight || 100)
      );
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
      setZoom(newZoom);
      setPan({
        x: cw / 2 - ((section.mapX || 0) + (section.mapWidth || 100) / 2) * newZoom,
        y: ch / 2 - ((section.mapY || 0) + (section.mapHeight || 100) / 2) * newZoom - 50,
      });
    }
  };

  /**
   * Mouse wheel handling for zooming relative to the cursor position.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      const oldZoom = zoom;
      const newZoom = Math.min(Math.max(oldZoom + delta, MIN_ZOOM), MAX_ZOOM);

      if (newZoom === oldZoom) return;

      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const ratio = newZoom / oldZoom;
      const newX = mx - (mx - pan.x) * ratio;
      const newY = my - (my - pan.y) * ratio;

      setZoom(newZoom);
      setPan({
        x: Math.min(rect.width - 100, Math.max(-2000 * newZoom + 100, newX)),
        y: Math.min(rect.height - 100, Math.max(-1600 * newZoom + 100, newY)),
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, pan]);

  // --- Drag Panning Events ---
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const newX = dragStart.current.panX + (e.clientX - dragStart.current.x);
    const newY = dragStart.current.panY + (e.clientY - dragStart.current.y);

    const cw = containerRef.current?.clientWidth || 800;
    const ch = containerRef.current?.clientHeight || 500;
    
    setPan({
      x: Math.min(cw - 100, Math.max(-2000 * zoom + 100, newX)),
      y: Math.min(ch - 100, Math.max(-1600 * zoom + 100, newY)),
    });
  };

  const onMouseUp = () => { isDragging.current = false; };

  // --- Touch Support (Pan & Pinch Zoom) ---
  const touchStart = useRef({ 
    x: 0, y: 0, panX: 0, panY: 0,
    isPinch: false, pinchDist: 0, pinchZoom: 1, pinchCenterX: 0, pinchCenterY: 0
  });

  const onTouchStart = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    if (e.touches.length === 2) {
      // Pinch to zoom initialization
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const rect = containerRef.current.getBoundingClientRect();
      const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
      const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
      
      touchStart.current = {
        x: 0, y: 0, panX: pan.x, panY: pan.y, isPinch: true,
        pinchDist: dist, pinchZoom: zoom, pinchCenterX: cx, pinchCenterY: cy
      };
    } else {
      // Single touch pan initialization
      const t = e.touches[0];
      touchStart.current = {
        x: t.clientX, y: t.clientY, panX: pan.x, panY: pan.y,
        isPinch: false, pinchDist: 0, pinchZoom: zoom, pinchCenterX: 0, pinchCenterY: 0
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current) return;
    if (e.cancelable) e.preventDefault();

    const rect = containerRef.current.getBoundingClientRect();
    const cw = rect.width || 800;
    const ch = rect.height || 500;

    if (touchStart.current.isPinch && e.touches.length === 2) {
      // Execute pinch zoom
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (touchStart.current.pinchDist === 0) return;

      const factor = dist / touchStart.current.pinchDist;
      const oldZoom = touchStart.current.pinchZoom;
      const newZoom = Math.min(Math.max(oldZoom * factor, MIN_ZOOM), MAX_ZOOM);

      const ratio = newZoom / oldZoom;
      const mx = touchStart.current.pinchCenterX;
      const my = touchStart.current.pinchCenterY;

      const newX = mx - (mx - touchStart.current.panX) * ratio;
      const newY = my - (my - touchStart.current.panY) * ratio;

      setZoom(newZoom);
      setPan({
        x: Math.min(cw - 100, Math.max(-2000 * newZoom + 100, newX)),
        y: Math.min(ch - 100, Math.max(-1600 * newZoom + 100, newY)),
      });
    } else if (!touchStart.current.isPinch && e.touches.length === 1) {
      // Execute touch pan
      const t = e.touches[0];
      const newX = touchStart.current.panX + (t.clientX - touchStart.current.x);
      const newY = touchStart.current.panY + (t.clientY - touchStart.current.y);

      setPan({
        x: Math.min(cw - 100, Math.max(-2000 * zoom + 100, newX)),
        y: Math.min(ch - 100, Math.max(-1600 * zoom + 100, newY)),
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* --- Viewport Controls --- */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-1 bg-white rounded-lg shadow-sm border border-gray-200 p-1">
          <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-700" title="Zoom Out">
            <HiOutlineZoomOut className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-700" title="Zoom In">
            <HiOutlineZoomIn className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={resetView} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-700 text-xs font-bold" title="Reset">
            ⌖
          </button>
        </div>
      </div>

      {/* Helper hints for mobile */}
      <p className="md:hidden text-[10px] text-gray-400 text-center -mt-1 mb-1 select-none">
        {lang === 'es' ? '👆 Desliza con un dedo para mover · Pellizca para zoom' : '👆 Drag to pan · Pinch to zoom'}
      </p>

      {/* --- Interactive Stage/Arena Canvas --- */}
      <div
        ref={containerRef}
        className="relative bg-[#f0f2f5] border border-gray-300 rounded overflow-hidden shadow-inner"
        style={{ height: '65vh', minHeight: 450, cursor: isDragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        {/* Visual Grid Layer */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: '100px 100px',
            backgroundPosition: 'center center'
          }}
        >
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(#f3f4f6 1px, transparent 1px), linear-gradient(90deg, #f3f4f6 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            backgroundPosition: 'center center'
          }} />
        </div>

        {/* --- Transformed content layer --- */}
        <div
          style={{
            position: 'absolute',
            width: 2000,
            height: 1600,
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            transition: isDragging.current ? 'none' : 'transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)',
            willChange: 'transform',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            backfaceVisibility: 'hidden',
          }}
        >
          {sections.map((section) => {
            const isStanding = section.sectionType === 'standing';
            const isStage = section.sectionType === 'stage';
            const isDecor = section.sectionType === 'decor';
            const isTable = section.sectionType === 'table';
            const tableShape = section.tableShape || 'round';

            return (
              <div 
                key={section.id} 
                className={`absolute flex flex-col items-center justify-center transition-opacity duration-300 opacity-100 ${focusedSection === null ? 'cursor-pointer hover:ring-2 hover:ring-offset-2 hover:ring-primary-500' : 'cursor-pointer'}`}
                style={{
                  left: section.mapX || 0,
                  top: section.mapY || 0,
                  width: section.mapWidth || 100,
                  height: section.mapHeight || 100,
                  transform: `rotate(${section.rotation || 0}deg)`,
                  background: isStage 
                    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' 
                    : isStanding 
                      ? (() => {
                          const isSelected = selectedSeats.some(s => s.sectionId === section.id);
                          if (isSelected) return '#f97316';
                          const sold = (section.seats || []).filter(s => s.status === SeatStatus.SOLD || s.status === SeatStatus.LOCKED).length;
                          const total = Number(section.capacity) || (section.seats?.length) || 0;
                          if (total > 0 && sold >= total) return '#9ca3af';
                          return section.color || '#8b5cf6';
                        })()
                      : isDecor 
                        ? (section.color || '#f8fafc')
                        : 'transparent',
                  borderRadius: isStage ? '0 0 40px 40px' : (isStanding ? 8 : (isTable && tableShape === 'round') ? '50%' : 4),
                  zIndex: isStage ? 5 : 10,
                  boxShadow: isStage ? '0 0 20px rgba(59, 130, 246, 0.4)' : (isStanding ? `0 4px 15px ${section.color || '#8b5cf6'}44` : 'none'),
                  border: isDecor ? '1px solid #cbd5e1' : (isStage ? '2.5px solid #3b82f6' : (isStanding ? `2px solid ${section.color || '#8b5cf6'}` : 'none')),
                }}
                onClick={() => !isStage && !isDecor && handleSectionClick(section as VenueSection)}
              >
                {/* --- Decor/Text-only sections --- */}
                {isDecor && (
                  <div className="flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest break-words leading-tight">
                      {section.name}
                    </span>
                  </div>
                )}

                {/* --- Stage visual representation --- */}
                {isStage && (
                  <>
                    <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 800, letterSpacing: 5, textTransform: 'uppercase', textShadow: '0 0 10px rgba(96, 165, 250, 0.5)' }}>
                      {section.name}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>
                      {lang === 'es' ? 'ESCENARIO' : 'STAGE'}
                    </span>
                  </>
                )}

                {/* --- Section Tooltip Label (Not for Tables) --- */}
                {!isStage && !isDecor && !isTable && (
                  <div
                    className="absolute -top-7 text-[12px] font-bold uppercase tracking-widest px-2 py-0.5 rounded opacity-85 group-hover/sec:opacity-100 transition-opacity"
                    style={{ backgroundColor: 'white', color: '#1e293b', border: `1px solid ${section.color}`, boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                  >
                    {section.name}
                  </div>
                )}

                {/* --- Table Rendering Logic --- */}
                {isTable ? (() => {
                  let overrides = {};
                  try {
                    overrides = section.seatsConfig ? JSON.parse(section.seatsConfig) : {};
                  } catch (e) {}

                  const allTableSeats = section.seats || [];
                  const isTableFullyUnavailable = allTableSeats.length > 0 && allTableSeats.every(s => {
                    const k = `seat-${s.seatNumber}`;
                    return isSeatUnavailable(s, overrides[k as keyof typeof overrides]);
                  });
                  const tableCenterBg = isTableFullyUnavailable ? '#e5e7eb' : '#fff';
                  const tableCenterBorder = isTableFullyUnavailable ? '#9ca3af' : section.color;
                  const tableLabelColor = '#6b7280';

                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      {tableShape === 'round' ? (
                        <>
                          <div 
                            className="absolute rounded-full bg-[#f8fafc] border border-slate-300 shadow-sm flex items-center justify-center z-10 transition-all hover:bg-slate-50" 
                            style={{
                              width: '60%', height: '60%',
                              cursor: isTableFullyUnavailable ? 'not-allowed' : 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isTableFullyUnavailable) return;
                              const allSeats = section.seats || [];
                              const isTableSelected = allSeats.some(s => isSeatSelected(s.id));
                              if (isTableSelected) {
                                onToggleSeats(allSeats.filter(s => isSeatSelected(s.id)));
                              } else {
                                const overrides = section.seatsConfig ? JSON.parse(section.seatsConfig) : {};
                                onToggleSeats(allSeats.filter(s => s.status === SeatStatus.AVAILABLE && !overrides[`seat-${s.seatNumber}`]?.reserved));
                              }
                            }}
                          >
                            <span 
                              className={`font-black uppercase tracking-tight text-center px-1 select-none leading-none ${
                                section.name.length > 8 
                                  ? 'text-[7px] text-slate-400' 
                                  : section.name.length > 5 
                                    ? 'text-[8px] text-slate-500' 
                                    : 'text-[9.5px] text-slate-600'
                              }`}
                              style={{
                                transform: `rotate(${-(section.rotation || 0)}deg)`,
                                display: 'inline-block'
                              }}
                            >
                              {section.name}
                            </span>
                          </div>
                          {section.seats?.map((seat, i) => {
                            const seatNumber = seat.seatNumber;
                            const seatKey = `seat-${seatNumber}`;
                            const seatOverride: any = (overrides as any)[seatKey] || {};
                            if (seatOverride.disabled) return null;

                            const angle = (i * 360) / section.seats!.length;
                            const selected = isSeatSelected(seat.id);
                            const finalXOffset = seatOverride.xOffset || 0;
                            const finalYOffset = seatOverride.yOffset || 0;
                            const isSeatWheelchair = seatOverride.isWheelchair || false;

                            return (
                              <div key={seat.id} className="absolute w-[18%] h-[18%]" style={{
                                transform: `rotate(${angle}deg) translate(0, -210%) rotate(-${angle}deg) translate(${finalXOffset}px, ${finalYOffset}px)`,
                                zIndex: 20
                              }}>
                                <button
                                  className="w-full h-full rounded-full border-[1.5px] shadow-sm hover:scale-125 transition-transform box-border flex items-center justify-center text-white"
                                  style={{
                                    backgroundColor: getSeatBg(seat, seatOverride, section.color, isSeatWheelchair, selected),
                                    borderColor: getSeatBorder(seat, seatOverride, section.color, isSeatWheelchair, selected),
                                    boxShadow: getSeatShadow(seat, seatOverride, section.color, selected),
                                    cursor: isSeatUnavailable(seat, seatOverride) && !selected ? 'not-allowed' : 'pointer',
                                    pointerEvents: 'auto'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const overrides = section.seatsConfig ? JSON.parse(section.seatsConfig) : {};
                                    const seatKey = `seat-${seat.seatNumber}`;
                                    const seatOverride = overrides[seatKey] || {};
                                    if (isSeatUnavailable(seat, seatOverride) && !selected) return;
                                    if (section.tablePurchaseMode === 'whole') {
                                      const allSeats = section.seats || [];
                                      const isTableSelected = allSeats.some(s => isSeatSelected(s.id));
                                      if (isTableSelected) {
                                        onToggleSeats(allSeats.filter(s => isSeatSelected(s.id)));
                                      } else {
                                        onToggleSeats(allSeats.filter(s => s.status === SeatStatus.AVAILABLE && !overrides[`seat-${s.seatNumber}`]?.reserved));
                                      }
                                      return;
                                    }
                                    onToggleSeats([seat]);
                                  }}
                                  disabled={isSeatUnavailable(seat, seatOverride) && !selected}
                                >
                                  {isSeatWheelchair && <FaWheelchair className="w-[65%] h-[65%] shrink-0 text-white" />}
                                </button>
                              </div>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <div 
                            className="absolute rounded bg-[#f8fafc] border border-slate-300 shadow-sm flex items-center justify-center z-10 transition-all hover:bg-slate-50" 
                            style={{
                              width: '70%', height: '45%',
                              cursor: isTableFullyUnavailable ? 'not-allowed' : 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isTableFullyUnavailable) return;
                              const allSeats = section.seats || [];
                              const isTableSelected = allSeats.some(s => isSeatSelected(s.id));
                              if (isTableSelected) {
                                onToggleSeats(allSeats.filter(s => isSeatSelected(s.id)));
                              } else {
                                const overrides = section.seatsConfig ? JSON.parse(section.seatsConfig) : {};
                                onToggleSeats(allSeats.filter(s => s.status === SeatStatus.AVAILABLE && !overrides[`seat-${s.seatNumber}`]?.reserved));
                              }
                            }}
                          >
                            <span 
                              className={`font-black uppercase tracking-tight text-center px-1 select-none leading-none ${
                                section.name.length > 8 
                                  ? 'text-[7.5px] text-slate-400' 
                                  : section.name.length > 5 
                                    ? 'text-[8.5px] text-slate-500' 
                                    : 'text-[10px] text-slate-600'
                              }`}
                              style={{
                                transform: `rotate(${-(section.rotation || 0)}deg)`,
                                display: 'inline-block'
                              }}
                            >
                              {section.name}
                            </span>
                          </div>
                          {section.seats?.map((seat, i) => {
                            const seatNumber = seat.seatNumber;
                            const seatKey = `seat-${seatNumber}`;
                            const seatOverride: any = (overrides as any)[seatKey] || {};
                            if (seatOverride.disabled) return null;

                            const seatsCount = section.seats!.length;
                            const perimeter = 2 * (1 + 0.55);
                            const step = perimeter / seatsCount;
                            const pos = i * step;
                            let xPos = 50;
                            let yPos = 50;
                            if (pos < 1) { // Top
                              xPos = 15 + pos * 70;
                              yPos = 12;
                            } else if (pos < 1.55) { // Right
                              xPos = 88;
                              yPos = 15 + (pos - 1) / 0.55 * 70;
                            } else if (pos < 2.55) { // Bottom
                              xPos = 85 - (pos - 1.55) * 70;
                              yPos = 88;
                            } else { // Left
                              xPos = 12;
                              yPos = 85 - (pos - 2.55) / 0.55 * 70;
                            }

                            const selected = isSeatSelected(seat.id);
                            const finalXOffset = seatOverride.xOffset || 0;
                            const finalYOffset = seatOverride.yOffset || 0;
                            const isSeatWheelchair = seatOverride.isWheelchair || false;

                            return (
                              <div key={seat.id} className="absolute w-[18%] h-[18%]" style={{
                                left: `${xPos}%`, top: `${yPos}%`,
                                transform: `translate(-50%, -50%) translate(${finalXOffset}px, ${finalYOffset}px)`,
                                zIndex: 20
                              }}>
                                <button
                                  className="w-full h-full rounded-full border-[1.5px] shadow-sm hover:scale-125 transition-transform box-border flex items-center justify-center text-white"
                                  style={{
                                    backgroundColor: getSeatBg(seat, seatOverride, section.color, isSeatWheelchair, selected),
                                    borderColor: getSeatBorder(seat, seatOverride, section.color, isSeatWheelchair, selected),
                                    boxShadow: getSeatShadow(seat, seatOverride, section.color, selected),
                                    cursor: isSeatUnavailable(seat, seatOverride) && !selected ? 'not-allowed' : 'pointer',
                                    pointerEvents: 'auto'
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const overrides = section.seatsConfig ? JSON.parse(section.seatsConfig) : {};
                                    if (isSeatUnavailable(seat, overrides[`seat-${seat.seatNumber}`]) && !selected) return;
                                    if (section.tablePurchaseMode === 'whole') {
                                      const allSeats = section.seats || [];
                                      const isTableSelected = allSeats.some(s => isSeatSelected(s.id));
                                      if (isTableSelected) {
                                        onToggleSeats(allSeats.filter(s => isSeatSelected(s.id)));
                                      } else {
                                        onToggleSeats(allSeats.filter(s => s.status === SeatStatus.AVAILABLE && !overrides[`seat-${s.seatNumber}`]?.reserved));
                                      }
                                      return;
                                    }
                                    onToggleSeats([seat]);
                                  }}
                                  disabled={isSeatUnavailable(seat, seatOverride) && !selected}
                                >
                                  {isSeatWheelchair && <FaWheelchair className="w-[65%] h-[65%] shrink-0 text-white" />}
                                </button>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                })() : (() => {
                  let overrides = {};
                  try {
                    overrides = section.seatsConfig ? JSON.parse(section.seatsConfig) : {};
                  } catch (e) {}

                  const rows = Array.from(new Set((section.seats ?? []).map(s => s.rowLabel))).sort();
                  const curve = section.curve || 0;
                  const baseSpacingY = rows.length > 1 ? (section.mapHeight! - 32) / (rows.length - 1) : 0;

                  const rowsData = rows.map(rowLabel => {
                    const rowSeats = (section.seats ?? [])
                      .filter((s) => s.rowLabel === rowLabel)
                      .sort((a, b) => a.seatNumber - b.seatNumber);
                    return { rowLabel, rowSeats };
                  });

                  return section.seats?.map((seat) => {
                    const rowLabel = seat.rowLabel;
                    const seatNumber = seat.seatNumber;
                    const seatKey = `${rowLabel}-${seatNumber}`;
                    const seatOverride: any = (overrides as any)[seatKey] || {};
                    if (seatOverride.disabled) return null;

                    const rIdx = rows.indexOf(rowLabel);
                    const rowData = rowsData[rIdx];
                    const rowSeats = rowData.rowSeats;
                    const sIdx = rowSeats.findIndex((s) => s.id === seat.id);

                    const seatsCount = rowSeats.length;
                    const t = seatsCount > 1 ? (sIdx - (seatsCount - 1) / 2) / ((seatsCount - 1) / 2) : 0;
                    const x = seatsCount > 1 ? 12 + sIdx * ((section.mapWidth! - 24) / (seatsCount - 1)) : section.mapWidth! / 2;
                    const baseY = 16 + rIdx * baseSpacingY;
                    const curveOffset = curve * (t * t - 1);
                    const y = baseY + curveOffset;
                    const angleRad = Math.atan2(2 * curve * t, section.mapWidth! / 2);
                    const angleDeg = angleRad * (180 / Math.PI);

                    const selected = isSeatSelected(seat.id);
                    const size = Math.max(8, Math.min(18, (section.mapWidth! - 24) / (seatsCount > 1 ? seatsCount : 1) - 2));
                    const isSeatWheelchair = seatOverride.isWheelchair || false;

                    return (
                      <div key={seat.id} className="absolute pointer-events-auto" style={{
                        left: x, top: y, width: size, height: size,
                        transform: `translate(-50%, -50%) translate(${seatOverride.xOffset || 0}px, ${seatOverride.yOffset || 0}px) rotate(${angleDeg}deg)`,
                        zIndex: 20
                      }}>
                        <button
                          className="w-full h-full rounded-full border-[1.5px] shadow-sm hover:scale-125 transition-transform box-border flex items-center justify-center text-white"
                          style={{
                            backgroundColor: getSeatBg(seat, seatOverride, section.color, isSeatWheelchair, selected),
                            borderColor: getSeatBorder(seat, seatOverride, section.color, isSeatWheelchair, selected),
                            boxShadow: getSeatShadow(seat, seatOverride, section.color, selected),
                            cursor: isSeatUnavailable(seat, seatOverride) && !selected ? 'not-allowed' : 'pointer',
                            pointerEvents: 'auto'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSeatUnavailable(seat, seatOverride) || selected) onToggleSeats([seat]);
                          }}
                          disabled={isSeatUnavailable(seat, seatOverride) && !selected}
                        >
                          {isSeatWheelchair && <FaWheelchair className="w-[65%] h-[65%] shrink-0 text-white" />}
                        </button>
                      </div>
                    );
                  });
                })()}
            </div>
          );
        })}

        </div>

        {/* Sticky Bottom Toolbar (Seats.io Style) */}
        <AnimatePresence>
          {focusedSection && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-[#1e2228] text-white p-4 shadow-2xl z-50 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => resetView()}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <HiOutlineArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-bold text-lg leading-tight">
                    {sections.find((s) => s.id === focusedSection)?.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {(() => {
                      const sec = sections.find((s) => s.id === focusedSection);
                      if (sec?.sectionType === 'standing') return lang === 'es' ? 'Entrada General' : 'General Admission';
                      return `${sec?.seats?.filter((s) => s.status === SeatStatus.AVAILABLE).length} ${lang === 'es' ? 'asientos disponibles' : 'available seats'}`;
                    })()}
                  </p>
                </div>
              </div>
              <div className="flex-1 flex justify-center">
                {sections.find((s) => s.id === focusedSection)?.sectionType === 'standing' ? (
                  <div className="flex items-center gap-4 bg-white/10 rounded-2xl p-1.5 px-4 border border-white/10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = selectedSeats.filter(s => s.sectionId === focusedSection);
                        if (current.length > 0) {
                          onToggleSeats([current[current.length - 1]]);
                          if (current.length === 1) {
                            setFocusedSection(null);
                          }
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all active:scale-90 font-bold text-lg"
                    >
                      －
                    </button>
                    <div className="flex flex-col items-center min-w-[40px]">
                      <span className="text-xl font-black">{selectedSeats.filter(s => s.sectionId === focusedSection).length}</span>
                      <span className="text-[9px] uppercase tracking-tighter text-gray-400 font-bold">Tickets</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const current = selectedSeats.filter(s => s.sectionId === focusedSection);
                        if (current.length < 10) {
                          onToggleSeats([{
                            id: `standing-${focusedSection}-${current.length + 1}-${Date.now()}`,
                            sectionId: focusedSection,
                            rowLabel: 'GA',
                            seatNumber: current.length + 1,
                            status: SeatStatus.AVAILABLE,
                          }]);
                        }
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-primary-500 hover:bg-primary-600 transition-all active:scale-90 font-bold text-lg"
                    >
                      ＋
                    </button>
                  </div>
                ) : (
                  <div className="hidden sm:block">
                    <p className="text-xs text-gray-400 font-medium">{lang === 'es' ? 'Selecciona tus asientos arriba' : 'Select your seats above'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white border border-gray-300" /> Disponible</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary-500 ring-2 ring-primary-200" /> Seleccionado</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300" /> Vendido</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400" /> Reservado</span>
      </div>
    </div>
  );
}
