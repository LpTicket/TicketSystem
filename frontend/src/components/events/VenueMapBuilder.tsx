'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { VenueSection, SectionType } from '@/types';
import {
  HiOutlinePlus,
  HiOutlineSave,
  HiOutlineTrash,
  HiOutlineZoomIn,
  HiOutlineZoomOut,
  HiOutlineEye,
  HiOutlineX,
  HiOutlineArrowLeft,
  HiOutlineCamera,
  HiOutlineDuplicate,
} from 'react-icons/hi';
import { FaWheelchair } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface VenueMapBuilderProps {
  eventId: string;
  initialSections: VenueSection[];
  onSaved: (sections: VenueSection[]) => void;
  onChange?: (sections: Partial<VenueSection>[]) => void;
  event?: any;
  isAdmin?: boolean;
}

const SECTION_COLORS = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#6366f1'];

// Stage is the anchor: centered horizontally at y=80 in canvas space
const STAGE_W = 400;
const STAGE_H = 80;
const CANVAS_W = 800;
const CANVAS_H = 600;
const STAGE_X = (CANVAS_W - STAGE_W) / 2;
const STAGE_Y = 60;

export default function VenueMapBuilder({ eventId, initialSections, onSaved, onChange, event, isAdmin }: VenueMapBuilderProps) {
  const { t, lang } = useLang();
  const [sections, setSections] = useState<Partial<VenueSection>[]>([]);
  const [dbTemplates, setDbTemplates] = useState<any[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [dismissWelcome, setDismissWelcome] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customViewport, setCustomViewport] = useState<{ x: number; y: number; scale: number } | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [showStage, setShowStage] = useState(event?.showStage ?? false);
  const [copiedSection, setCopiedSection] = useState<Partial<VenueSection> | null>(null);
  const templatesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templatesRef.current && !templatesRef.current.contains(event.target as Node)) {
        setTemplatesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pan & zoom state stored in refs so we don't re-render on every frame
  const viewRef = useRef({ x: 0, y: 0, scale: 0.6 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Pointer-based pan of the viewport
  const panningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });

  // Pointer-based drag/resize of a section
  const draggingRef = useRef<{ id: string; type: 'move' | 'resize'; startMx: number; startMy: number; origX: number; origY: number; origW: number; origH: number } | null>(null);

  // Dragging individual seat
  const draggingSeatRef = useRef<{ 
    secId: string; 
    seatKey: string; 
    startMx: number; 
    startMy: number; 
    origXOffset: number; 
    origYOffset: number;
    angleDeg?: number;
    isTableSeat?: boolean;
    tableAngle?: number;
    isRectTable?: boolean;
  } | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<{ secId: string; seatKey: string } | null>(null);

  const handleDuplicateSelected = useCallback((sec: Partial<VenueSection>) => {
    const pasted: Partial<VenueSection> = JSON.parse(JSON.stringify(sec));
    pasted.id = `temp-${Date.now()}`;
    
    const copyWord = lang === 'es' ? 'Copia' : 'Copy';
    const regex = new RegExp(`\\s+${copyWord}\\s+(\\d+)$`, 'i');
    const match = pasted.name?.match(regex);
    
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      pasted.name = pasted.name?.replace(regex, ` ${copyWord} ${nextNum}`);
    } else {
      const bareRegex = new RegExp(`\\s+${copyWord}$`, 'i');
      if (pasted.name && bareRegex.test(pasted.name)) {
        pasted.name = pasted.name.replace(bareRegex, ` ${copyWord} 1`);
      } else {
        pasted.name = `${pasted.name} ${copyWord} 1`;
      }
    }

    pasted.mapX = (pasted.mapX || 0) + 30;
    pasted.mapY = (pasted.mapY || 0) + 30;
    
    if (pasted.seats) {
      delete pasted.seats;
    }

    setSections(prev => [...prev, pasted]);
    setSelectedId(pasted.id);
    toast.success(lang === 'es' ? 'Sección duplicada' : 'Section duplicated');
  }, [lang]);

  // Global Keyboard shortcuts for Ctrl+C, Ctrl+V, Backspace/Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'SELECT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      // Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedId) {
          e.preventDefault();
          const toCopy = sections.find(s => s.id === selectedId);
          if (toCopy) {
            setCopiedSection(JSON.parse(JSON.stringify(toCopy)));
            toast.success(lang === 'es' ? 'Copia guardada en portapapeles local' : 'Copy saved to local clipboard');
          }
        }
      }

      // Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (copiedSection) {
          e.preventDefault();
          handleDuplicateSelected(copiedSection);
        }
      }

      // Backspace or Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !selectedSeat) {
          e.preventDefault();
          setShowConfirm(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, sections, copiedSection, lang, selectedSeat, handleDuplicateSelected]);

  // Multi-touch tracking
  const activePointersRef = useRef<Map<number, { x: number, y: number }>>(new Map());
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialPinchScaleRef = useRef<number>(1);
  const initialPinchMidpointRef = useRef<{ x: number, y: number } | null>(null);

  const getSeatsConfig = (sec: Partial<VenueSection>): Record<string, { xOffset?: number; yOffset?: number; isWheelchair?: boolean; disabled?: boolean; reserved?: boolean; price?: number; rowLabel?: string; seatNumber?: number }> => {
    try {
      return sec.seatsConfig ? JSON.parse(sec.seatsConfig) : {};
    } catch (e) {
      return {};
    }
  };

  const getSeatStatus = (section: Partial<VenueSection>, seatKey: string) => {
    const overrides = getSeatsConfig(section);
    const seatOverride = overrides[seatKey] || {};
    
    // 1. Check if it's explicitly reserved in the design config
    if (seatOverride.reserved) return 'reserved';
    
    // 2. Otherwise, check the actual seat status from the database if available
    if (section.seats) {
      let foundSeat;
      if (section.sectionType === 'table') {
        const num = parseInt(seatKey.replace('seat-', ''), 10);
        foundSeat = section.seats.find(s => s.seatNumber === num);
      } else {
        const [row, num] = seatKey.split('-');
        foundSeat = section.seats.find(s => s.rowLabel === row && s.seatNumber === parseInt(num, 10));
      }
      
      if (foundSeat) {
        if (foundSeat.status === 'sold') return 'sold';
        // Permanent block if locked and no expiry
        if (foundSeat.status === 'locked' && !foundSeat.lockExpiresAt) return 'reserved';
      }
    }
    
    return 'available';
  };

  const updateSeatConfig = useCallback((secId: string, seatKey: string, key: string, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== secId) return s;
      const currentConfig = getSeatsConfig(s);
      const seatOverride = currentConfig[seatKey] || {};
      const newConfig = {
        ...currentConfig,
        [seatKey]: {
          ...seatOverride,
          [key]: value
        }
      };
      return {
        ...s,
        seatsConfig: JSON.stringify(newConfig)
      };
    }));
  }, []);

  // Apply the CSS transform without a React re-render
  const applyTransform = useCallback(() => {
    if (!canvasRef.current) return;
    const { x, y, scale } = viewRef.current;
    canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }, []);

  const initializedRef = useRef(false);
  const centeredRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && initialSections.length > 0) {
      const syncedSections = initialSections.map(s => {
        if (!s.seats || s.seats.length === 0) return s;
        
        const config = s.seatsConfig ? JSON.parse(s.seatsConfig) : {};
        let changed = false;
        
        s.seats.forEach(seat => {
          const key = s.sectionType === 'table' ? `seat-${seat.seatNumber}` : `${seat.rowLabel}-${seat.seatNumber}`;
          const isDBBlocked = seat.status === 'locked' && !seat.lockExpiresAt;
          
          // If DB says blocked but config doesn't, sync it.
          if (isDBBlocked && !config[key]?.reserved) {
            config[key] = { ...config[key], reserved: true };
            changed = true;
          }
          // If DB says available but config says reserved, respect the DB (the viceversa part)
          if (seat.status === 'available' && config[key]?.reserved) {
             config[key] = { ...config[key], reserved: false };
             changed = true;
          }
        });
        
        return changed ? { ...s, seatsConfig: JSON.stringify(config) } : s;
      });

      setSections(JSON.parse(JSON.stringify(syncedSections)));
      initializedRef.current = true;
    }
  }, [initialSections]);

  useEffect(() => {
    if (onChange) onChange(sections);
  }, [sections, onChange]);

  const loadDbTemplates = useCallback(async () => {
    try {
      const { data } = await api.get('/venue-templates');
      setDbTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  }, []);

  useEffect(() => {
    loadDbTemplates();
  }, [loadDbTemplates]);

  const handleSaveAsTemplate = async () => {
    const name = prompt(lang === 'es' ? 'Nombre de la plantilla:' : 'Template name:');
    if (!name) return;
    
    setSavingTemplate(true);
    try {
      const payload = {
        name,
        description: `Template created from event ${eventId}`,
        sections: sections.map(s => {
          const copy = { ...s };
          if (copy.id?.startsWith('temp-')) delete copy.id;
          return copy;
        }),
        isSystem: false
      };
      await api.post('/venue-templates', payload);
      toast.success(lang === 'es' ? 'Plantilla guardada' : 'Template saved');
      loadDbTemplates();
    } catch (err) {
      toast.error('Error saving template');
    } finally {
      setSavingTemplate(false);
    }
  };

  useEffect(() => {
    if (centeredRef.current) return;
    if (!viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    if (vw === 0 || vh === 0) return; // Wait until layout is fully ready
    
    if (event && typeof event.defaultViewX === 'number' && typeof event.defaultViewY === 'number' && typeof event.defaultViewZoom === 'number') {
      viewRef.current = {
        x: event.defaultViewX,
        y: event.defaultViewY,
        scale: event.defaultViewZoom,
      };
      setCustomViewport({
        x: event.defaultViewX,
        y: event.defaultViewY,
        scale: event.defaultViewZoom
      });
    } else {
      const scale = 1.0;
      // Center so stage top-center is visible
      viewRef.current = {
        scale,
        x: vw / 2 - (STAGE_X + STAGE_W / 2) * scale,
        y: vh / 4 - STAGE_Y * scale,
      };
    }
    applyTransform();
    centeredRef.current = true;
  }, [applyTransform, event]);

  // ── Viewport pointer events (pan + zoom) ─────────────────────────────────
  const onViewportPointerDown = useCallback((e: React.PointerEvent) => {
    // Add to active pointers
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Only pan when clicking the viewport background, not a section or welcome screen
    if ((e.target as HTMLElement).closest('[data-section]')) return;
    if ((e.target as HTMLElement).closest('[data-welcome]')) return;

    if (activePointersRef.current.size === 1) {
      panningRef.current = true;
      setHasMoved(false);
      // Store raw clientX/Y — delta is computed in PointerMove so no rect offset needed here
      panStartRef.current = { mx: e.clientX, my: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
      (e.currentTarget as HTMLElement).style.cursor = 'grabbing';
    } else if (activePointersRef.current.size === 2) {
      // Start pinch — cancel single-finger pan
      panningRef.current = false;
      const pointers = Array.from(activePointersRef.current.values());
      const p1 = pointers[0];
      const p2 = pointers[1];
      initialPinchDistanceRef.current = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      initialPinchScaleRef.current = viewRef.current.scale;

      // Midpoint relative to the viewport element — use currentTarget so it's always correct
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      initialPinchMidpointRef.current = {
        x: ((p1.x + p2.x) / 2) - rect.left,
        y: ((p1.y + p2.y) / 2) - rect.top,
      };
    }

    // Always capture the pointer to receive events even outside the element
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);


  const onViewportPointerMove = useCallback((e: React.PointerEvent) => {
    // Update pointer position
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (activePointersRef.current.size === 2 && initialPinchDistanceRef.current !== null) {
      // Handle Pinch Zoom
      const pointers = Array.from(activePointersRef.current.values());
      const p1 = pointers[0];
      const p2 = pointers[1];
      const currentDist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const ratio = currentDist / initialPinchDistanceRef.current;
      
      const oldScale = viewRef.current.scale;
      const newScale = Math.min(3, Math.max(0.35, initialPinchScaleRef.current * ratio));
      
      if (newScale !== oldScale) {
        const midpoint = initialPinchMidpointRef.current!;
        const scaleRatio = newScale / oldScale;
        viewRef.current.x = midpoint.x - (midpoint.x - viewRef.current.x) * scaleRatio;
        viewRef.current.y = midpoint.y - (midpoint.y - viewRef.current.y) * scaleRatio;
        viewRef.current.scale = newScale;
        applyTransform();
      }
      return;
    }
    if (draggingSeatRef.current) {
      const { secId, seatKey, startMx, startMy, origXOffset, origYOffset, angleDeg, isTableSeat, tableAngle, isRectTable } = draggingSeatRef.current as any;
      const scale = viewRef.current.scale;
      const dx = (e.clientX - startMx) / scale;
      const dy = (e.clientY - startMy) / scale;

      const el = document.getElementById(`seat-dot-${secId}-${seatKey}`);
      if (el) {
        const dx = Math.abs(e.clientX - startMx);
        const dy = Math.abs(e.clientY - startMy);
        if (dx > 5 || dy > 5) setHasMoved(true);

        const newX = origXOffset + (e.clientX - startMx) / scale;
        const newY = origYOffset + (e.clientY - startMy) / scale;
        
        if (isTableSeat) {
          if (isRectTable) {
            el.style.transform = `translate(-50%, -50%) translate(${newX}px, ${newY}px)`;
          } else {
            el.style.transform = `rotate(${tableAngle}deg) translate(0, -210%) rotate(-${tableAngle}deg) translate(${newX}px, ${newY}px)`;
          }
        } else {
          el.style.transform = `translate(-50%, -50%) translate(${newX}px, ${newY}px) rotate(${angleDeg || 0}deg)`;
        }

        (draggingSeatRef.current as any)._pendingX = newX;
        (draggingSeatRef.current as any)._pendingY = newY;
      }
      return;
    }
    if (draggingRef.current) {
      const { id, type, startMx, startMy, origX, origY, origW, origH } = draggingRef.current;
      const scale = viewRef.current.scale;
      const dx = (e.clientX - startMx) / scale;
      const dy = (e.clientY - startMy) / scale;

      const el = document.getElementById(`sec-${id}`);
      if (el) {
        const dx_abs = Math.abs(e.clientX - startMx);
        const dy_abs = Math.abs(e.clientY - startMy);
        if (dx_abs > 5 || dy_abs > 5) setHasMoved(true);

        if (type === 'move') {
          const newX = Math.max(0, origX + dx);
          const newY = Math.max(STAGE_Y + STAGE_H + 10, origY + dy);
          el.style.left = `${newX}px`;
          el.style.top = `${newY}px`;
          (draggingRef.current as any)._pendingX = newX;
          (draggingRef.current as any)._pendingY = newY;
        } else {
          const newW = Math.max(40, origW + dx);
          const newH = Math.max(40, origH + dy);
          el.style.width = `${newW}px`;
          el.style.height = `${newH}px`;
          (draggingRef.current as any)._pendingW = newW;
          (draggingRef.current as any)._pendingH = newH;
        }
      }
      return;
    }
    if (panningRef.current) {
      const { mx, my, vx, vy } = panStartRef.current;
      
      // Calculate movement
      const dx = Math.abs(e.clientX - mx);
      const dy = Math.abs(e.clientY - my);
      if (dx > 5 || dy > 5) setHasMoved(true);

      // Calculate new position
      const newX = vx + (e.clientX - mx);
      const newY = vy + (e.clientY - my);
      
      // Apply boundaries so the user doesn't lose the canvas infinitely
      const LIMIT = 1000;
      viewRef.current.x = Math.max(-LIMIT, Math.min(LIMIT, newX));
      viewRef.current.y = Math.max(-LIMIT, Math.min(LIMIT, newY));
      
      applyTransform();
    }
  }, [applyTransform]);

  const onViewportPointerUp = useCallback((e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      initialPinchDistanceRef.current = null;
      initialPinchMidpointRef.current = null;
    }

    if (draggingSeatRef.current) {
      const { secId, seatKey } = draggingSeatRef.current;
      const pX = (draggingSeatRef.current as any)._pendingX;
      const pY = (draggingSeatRef.current as any)._pendingY;

      if (pX !== undefined && pY !== undefined) {
        updateSeatConfig(secId, seatKey, 'xOffset', pX);
        updateSeatConfig(secId, seatKey, 'yOffset', pY);
      } else {
        // If it didn't move at all, treat it as a click/tap to select the seat.
        // This is much more reliable on mobile touch screens than native onClick
        // after calling setPointerCapture().
        setSelectedId(secId);
        setSelectedSeat({ secId, seatKey });
      }

      draggingSeatRef.current = null;
      (e.currentTarget as HTMLElement).style.cursor = 'default';
      return;
    }
    if (draggingRef.current) {
      const { id } = draggingRef.current;
      const pX = (draggingRef.current as any)._pendingX;
      const pY = (draggingRef.current as any)._pendingY;
      const pW = (draggingRef.current as any)._pendingW;
      const pH = (draggingRef.current as any)._pendingH;
      
      setSections(prev => prev.map(s => {
        if (s.id !== id) return s;
        return {
          ...s,
          mapX: pX ?? s.mapX,
          mapY: pY ?? s.mapY,
          mapWidth: pW ?? s.mapWidth,
          mapHeight: pH ?? s.mapHeight,
        };
      }));
      draggingRef.current = null;
      (e.currentTarget as HTMLElement).style.cursor = 'default';
      return;
    }
    panningRef.current = false;
    (e.currentTarget as HTMLElement).style.cursor = 'default';
  }, [updateSeatConfig]);

  const onViewportWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomSpeed = 0.001;
    const delta = -e.deltaY * zoomSpeed;
    const oldScale = viewRef.current.scale;
    const newScale = Math.min(3, Math.max(0.35, oldScale + delta));
    
    if (newScale === oldScale) return;

    const rect = viewportRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Correct zoom centering logic:
    // We want the point (mx, my) in screen coordinates to map to the same 
    // point in world coordinates before and after the zoom.
    const ratio = newScale / oldScale;
    viewRef.current.x = mx - (mx - viewRef.current.x) * ratio;
    viewRef.current.y = my - (my - viewRef.current.y) * ratio;
    viewRef.current.scale = newScale;

    applyTransform();
  }, [applyTransform]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.addEventListener('wheel', onViewportWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onViewportWheel);
  }, [onViewportWheel]);

  const zoomIn = () => { viewRef.current.scale = Math.min(3, viewRef.current.scale + 0.1); applyTransform(); };
  const zoomOut = () => { viewRef.current.scale = Math.max(0.35, viewRef.current.scale - 0.1); applyTransform(); };
  const resetView = () => {
    if (!viewportRef.current) return;
    const vw = viewportRef.current.clientWidth;
    const vh = viewportRef.current.clientHeight;
    const scale = 1.0;
    viewRef.current = { scale, x: vw / 2 - (STAGE_X + STAGE_W / 2) * scale, y: vh / 4 - STAGE_Y * scale };
    applyTransform();
  };

  // ── Seat pointer events ──────────────────────────────────────────────────
  const onSeatPointerDown = (
    e: React.PointerEvent,
    secId: string,
    seatKey: string,
    currentXOffset: number,
    currentYOffset: number,
    angleDeg = 0,
    isTableSeat = false,
    tableAngle = 0,
    isRectTable = false
  ) => {
    e.stopPropagation();
    // Don't select immediately, wait for pointer up to see if it was a drag or tap
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setHasMoved(false);

    draggingSeatRef.current = {
      secId,
      seatKey,
      startMx: e.clientX,
      startMy: e.clientY,
      origXOffset: currentXOffset,
      origYOffset: currentYOffset,
      angleDeg,
      isTableSeat,
      tableAngle,
      isRectTable
    };

    const viewport = viewportRef.current;
    if (viewport) {
      viewport.style.cursor = 'move';
    }
  };

  // ── Section pointer events ───────────────────────────────────────────────
  const onSectionPointerDown = useCallback((e: React.PointerEvent, sec: Partial<VenueSection>, type: 'move' | 'resize' = 'move') => {
    e.stopPropagation();
    setSelectedId(sec.id!);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = {
      id: sec.id!,
      type,
      startMx: e.clientX,
      startMy: e.clientY,
      origX: sec.mapX || 0,
      origY: sec.mapY || 0,
      origW: sec.mapWidth || 100,
      origH: sec.mapHeight || 100,
    };
  }, []);

  // ── Section management ──────────────────────────────────────────────────
  const handleAddSection = (type: string) => {
    const colorIndex = sections.length % SECTION_COLORS.length;
    let defaultName = '';
    if (type === 'stage') {
      defaultName = lang === 'es' ? 'Escenario' : 'Stage';
    } else if (type === 'table') {
      defaultName = lang === 'es' ? 'Nueva Mesa' : 'New Table';
    } else if (type === 'standing') {
      defaultName = lang === 'es' ? 'Área General' : 'General Admission';
    } else if (type === 'vip') {
      defaultName = lang === 'es' ? 'Nueva Zona VIP' : 'New VIP Section';
    } else if (type === 'decor') {
      defaultName = lang === 'es' ? 'Barra / Estructura' : 'Decor / Structure';
    } else {
      defaultName = lang === 'es' ? 'Nueva Sección' : 'New Section';
    }

    const w = type === 'table' ? 80 : (type === 'stage' ? 400 : 160);
    const h = type === 'table' ? 80 : (type === 'stage' ? 80 : (type === 'decor' ? 40 : 100));

    const newSection: Partial<VenueSection> = {
      id: `temp-${Date.now()}`,
      eventId,
      name: defaultName,
      sectionType: type as any,
      rows: type === 'table' ? 1 : 5,
      seatsPerRow: type === 'table' ? 4 : 10,
      price: (type === 'stage' || type === 'decor') ? 0 : 50,
      color: type === 'stage' ? '#1e293b' : (type === 'decor' ? '#f1f5f9' : SECTION_COLORS[colorIndex]),
      mapX: viewportRef.current 
        ? ((viewportRef.current.clientWidth / 2) - viewRef.current.x) / viewRef.current.scale - (w / 2)
        : (CANVAS_W / 2) - (w / 2),
      mapY: viewportRef.current 
        ? ((viewportRef.current.clientHeight / 2) - viewRef.current.y) / viewRef.current.scale - (h / 2)
        : (CANVAS_H / 2) - (h / 2),
      mapWidth: w,
      mapHeight: h,
      capacity: 0,
    };
    setSections(prev => [...prev, newSection]);
    setSelectedId(newSection.id!);
  };

  const updateSelected = (field: string, value: any) => {
    setSections(prev => prev.map(s => s.id === selectedId ? { ...s, [field]: value } : s));
  };

  const loadTemplate = (tmpl: any) => {
    const templateSections = tmpl.sections.map((s: any) => ({
      ...s,
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      eventId
    }));
    setSections(templateSections);
    setShowStage(true);
    setSelectedId(null);
    setSelectedSeat(null);
    setTemplatesOpen(false);
    toast.success(
      lang === 'es' 
        ? 'Plantilla cargada con éxito. ¡No olvides guardarla!' 
        : 'Template loaded successfully. Remember to save!'
    );
  };



  const handleDeleteSelected = () => {
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    setSections(prev => prev.filter(s => s.id !== selectedId));
    setSelectedId(null);
    setShowConfirm(false);
  };

  const handleSetDefaultView = () => {
    setCustomViewport({
      x: viewRef.current.x,
      y: viewRef.current.y,
      scale: viewRef.current.scale
    });
    toast.success(
      lang === 'es' 
        ? 'Vista de clientes establecida en base a tu pantalla actual' 
        : 'Initial user view established based on your current screen'
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const sectPayload = sections.map(s => {
        // Clean the object to ensure only valid fields are sent to the backend
        // This avoids issues with relations or extra frontend state causing 500 errors
        const clean: any = {
          name: s.name || (lang === 'es' ? 'Nueva Sección' : 'New Section'),
          sectionType: s.sectionType || 'seated',
          rows: Number(s.rows) || 1,
          seatsPerRow: Number(s.seatsPerRow) || 1,
          capacity: Number(s.capacity) || 0,
          price: Number(s.price) || 0,
          color: s.color || '#6366f1',
          mapX: s.mapX ? parseFloat(Number(s.mapX).toFixed(2)) : 0,
          mapY: s.mapY ? parseFloat(Number(s.mapY).toFixed(2)) : 0,
          mapWidth: s.mapWidth ? parseFloat(Number(s.mapWidth).toFixed(2)) : 100,
          mapHeight: s.mapHeight ? parseFloat(Number(s.mapHeight).toFixed(2)) : 100,
          curve: Number(s.curve) || 0,
          isWheelchair: !!s.isWheelchair,
          tableShape: s.tableShape || 'round',
          tablePurchaseMode: s.tablePurchaseMode || 'individual',
          seatsConfig: s.seatsConfig || null,
        };
        
        // Only include ID if it's a real database UUID (not a temp one)
        if (s.id && !s.id.startsWith('temp-')) {
          clean.id = s.id;
        }
        
        return clean;
      });

      const payload = {
        sections: sectPayload,
        showStage: !!showStage,
        defaultViewX: customViewport ? parseFloat(customViewport.x.toFixed(2)) : (event?.defaultViewX ?? null),
        defaultViewY: customViewport ? parseFloat(customViewport.y.toFixed(2)) : (event?.defaultViewY ?? null),
        defaultViewZoom: customViewport ? parseFloat(customViewport.scale.toFixed(4)) : (event?.defaultViewZoom ?? null),
      };

      const { data } = await api.post(`/events/${eventId}/sections/bulk`, payload);
      toast.success(lang === 'es' ? 'Mapa guardado correctamente' : 'Map saved successfully');
      onSaved(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving map');
    } finally {
      setSaving(false);
    }
  };

  const selectedSection = sections.find(s => s.id === selectedId);

  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);

  return (
    <div className="flex flex-col h-[100vh] md:h-[800px] border border-gray-300 rounded-lg overflow-hidden bg-white relative font-sans">
      {/* ── Top Bar (Seats.io Style) ─────────────────────────────────── */}
      <div className="h-14 bg-white border-b border-gray-300 flex items-center justify-between px-4 shrink-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1a73e8] rounded flex items-center justify-center text-white font-black text-xs tracking-tighter">
            LPT
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold tracking-wider uppercase">Chart</span>
            <h2 className="font-semibold text-gray-800 text-sm leading-tight">{lang === 'es' ? 'Diseñador de Asientos' : 'Seat Designer'}</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Preset Templates Selector - Now visible on mobile */}
          <div ref={templatesRef} className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); setTemplatesOpen(!templatesOpen); }}
              className="bg-white hover:bg-gray-50 text-[#1a73e8] text-xs font-bold py-1.5 px-3 sm:px-4 rounded border border-blue-200 shadow-sm transition-colors flex items-center gap-2"
            >
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
              <span className="hidden sm:inline">{lang === 'es' ? 'Plantillas' : 'Templates'}</span>
              <svg className={`w-4 h-4 transition-transform ${templatesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
            </button>
            <div className={`absolute top-full right-0 mt-1.5 w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-50 animate-fade-in divide-y divide-gray-100 ${templatesOpen ? 'block' : 'hidden'}`}>
              <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{lang === 'es' ? 'Plantillas del Sistema' : 'System Templates'}</div>
              {dbTemplates.length > 0 ? dbTemplates.map(tmpl => (
                <button key={tmpl.id} onClick={() => loadTemplate(tmpl)} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-xs font-semibold text-gray-700 flex items-start gap-3 transition-colors">
                  <span className="text-xl">🗺️</span>
                  <div>
                    <div className="font-bold text-gray-900">{tmpl.name}</div>
                    <div className="text-[10px] text-gray-400 font-medium">{tmpl.description}</div>
                  </div>
                </button>
              )) : (
                <div className="px-4 py-3 text-[10px] text-gray-400 italic">{lang === 'es' ? 'No hay plantillas guardadas' : 'No saved templates'}</div>
              )}
              
              {isAdmin && (
                <div className="pt-2 mt-2 px-2 border-t border-gray-100">
                  <button 
                    onClick={handleSaveAsTemplate}
                    disabled={savingTemplate}
                    className="w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                  >
                    <HiOutlinePlus className="w-3.5 h-3.5" />
                    {lang === 'es' ? 'Guardar como Plantilla' : 'Save as Template'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs sm:text-sm font-medium py-1.5 px-3 sm:px-5 rounded shadow-sm transition-colors flex items-center gap-2">
            {saving ? (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <HiOutlineSave className="w-4 h-4" />
            )}
            <span className="hidden xs:inline">{lang === 'es' ? 'Guardar' : 'Save'}</span>
          </button>

          <button 
            onClick={() => setMobileToolsOpen(!mobileToolsOpen)}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-900 bg-gray-50 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 relative min-h-0 bg-[#f3f4f6]">
        {/* Infinite Grid Background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            backgroundPosition: 'center center'
          }}
        />

      {/* ── Left Sidebar (Tools - Seats.io Style) ─────────────────────────────────────────────────── */}
      <div className={`${mobileToolsOpen ? 'flex absolute inset-y-0 left-0 shadow-2xl animate-slide-in-left' : 'hidden'} lg:flex w-[55px] bg-[#f9fafb] border-r border-[#e5e7eb] flex-col shrink-0 z-50 lg:z-30 py-4 items-center`}>
        {/* Mobile Close Sidebar Button */}
        <button 
          onClick={() => setMobileToolsOpen(false)}
          className="lg:hidden absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600"
        >
          <HiOutlineX className="w-4 h-4" />
        </button>

        <div className="flex flex-col gap-4 w-full px-2">
          <button 
            onClick={() => handleAddSection('seated')} 
            className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:text-[#1a73e8] hover:bg-[#f8f9fa] transition-colors group"
            title={lang === 'es' ? 'Gradería / Filas' : 'Rows'}
          >
            <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M3 15h18M8 5v14M16 5v14"/></svg>
            <span className="text-[9px] font-medium leading-none">{lang === 'es' ? 'Filas' : 'Rows'}</span>
          </button>

          <button 
            onClick={() => handleAddSection('table')} 
            className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:text-[#1a73e8] hover:bg-[#f8f9fa] transition-colors group"
            title={lang === 'es' ? 'Mesa' : 'Table'}
          >
            <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="2"/><circle cx="12" cy="20" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="20" cy="12" r="2"/></svg>
            <span className="text-[9px] font-medium leading-none">{lang === 'es' ? 'Mesa' : 'Table'}</span>
          </button>

          <button 
            onClick={() => handleAddSection('standing')} 
            className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:text-[#1a73e8] hover:bg-[#f8f9fa] transition-colors group"
            title={lang === 'es' ? 'Área General' : 'General Admission'}
          >
            <svg className="w-6 h-6 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            <span className="text-[9px] font-medium leading-none">{lang === 'es' ? 'Área' : 'Area'}</span>
          </button>

          <button 
            onClick={() => handleAddSection('stage')} 
            className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors group"
            title={lang === 'es' ? 'Escenario / Stage' : 'Stage'}
          >
            <div className="w-8 h-6 bg-slate-700 rounded-sm mb-1 border border-blue-400/30 flex items-center justify-center">
              <div className="w-4 h-0.5 bg-blue-400/50" />
            </div>
            <span className="text-[9px] font-bold leading-none uppercase">{lang === 'es' ? 'Stage' : 'Stage'}</span>
          </button>

          <button 
            onClick={() => handleAddSection('decor')} 
            className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors group border-b border-gray-100"
            title={lang === 'es' ? 'Barra / Estructura' : 'Decor / Structure'}
          >
            <div className="w-8 h-5 bg-gray-200 rounded-sm mb-1 border border-gray-300 flex items-center justify-center relative overflow-hidden">
               <div className="absolute inset-x-0 bottom-0 h-1 bg-gray-400" />
            </div>
            <span className="text-[9px] font-bold leading-none uppercase">{lang === 'es' ? 'Barra' : 'Decor'}</span>
          </button>

          <div className="w-full h-px bg-gray-200 my-1" />

          <button 
            onClick={() => {
              const colorIndex = sections.length % SECTION_COLORS.length;
              const newSection: Partial<VenueSection> = {
                id: `temp-${Date.now()}`,
                eventId,
                name: lang === 'es' ? 'Nuevo Asiento' : 'New Seat',
                sectionType: SectionType.SEATED,
                price: 25,
                color: SECTION_COLORS[colorIndex],
                mapX: viewportRef.current 
                  ? ((viewportRef.current.clientWidth / 2) - viewRef.current.x) / viewRef.current.scale - 15
                  : (CANVAS_W / 2) - 15,
                mapY: viewportRef.current 
                  ? ((viewportRef.current.clientHeight / 2) - viewRef.current.y) / viewRef.current.scale - 15
                  : (CANVAS_H / 2) - 15,
                mapWidth: 30,
                mapHeight: 30,
                rows: 1,
                seatsPerRow: 1,
                capacity: 1,
              };
              setSections(prev => [...prev, newSection]);
              setSelectedId(newSection.id!);
            }}
            className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:text-[#1a73e8] hover:bg-[#f8f9fa] transition-colors group"
            title={lang === 'es' ? 'Nuevo Asiento' : 'New Seat'}
          >
            <svg className="w-5 h-5 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="6"/></svg>
            <span className="text-[9px] font-medium leading-none">{lang === 'es' ? 'Asiento' : 'Seat'}</span>
          </button>
          
          {copiedSection && (
            <button 
              onClick={() => handleDuplicateSelected(copiedSection)}
              className="w-full aspect-square rounded flex flex-col items-center justify-center text-green-600 hover:text-green-800 hover:bg-green-50 transition-colors group border border-green-200 bg-green-50/30 shadow-sm"
              title={lang === 'es' ? 'Pegar sección copiada (Ctrl+V)' : 'Paste copied section (Ctrl+V)'}
            >
              <HiOutlineDuplicate className="w-5 h-5 mb-1" />
              <span className="text-[9px] font-bold leading-none">{lang === 'es' ? 'Pegar' : 'Paste'}</span>
            </button>
          )}

          {/* Mobile-only action buttons */}
          <div className="lg:hidden w-full space-y-4 pt-4 border-t border-gray-200">
            <button 
              onClick={handleSave}
              className="w-full aspect-square rounded flex flex-col items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors"
              title={lang === 'es' ? 'Guardar' : 'Save'}
            >
              <HiOutlineSave className="w-6 h-6 mb-1" />
              <span className="text-[9px] font-bold">SAVE</span>
            </button>
            <button 
              onClick={handleSetDefaultView}
              className="w-full aspect-square rounded flex flex-col items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
              title={lang === 'es' ? 'Fijar Vista' : 'Set View'}
            >
              <HiOutlineEye className="w-6 h-6 mb-1" />
              <span className="text-[9px] font-bold">VIEW</span>
            </button>
          </div>
        </div>
      </div>

        {/* ── Right Properties Panel (Seats.io Style Inspector) ─────────────────────────────────── */}
        {selectedSection ? (
          <div className="absolute inset-y-0 right-0 w-[280px] md:w-[320px] bg-[#ffffff] border-l border-[#e5e7eb] z-[60] md:z-40 overflow-y-auto flex flex-col shadow-2xl md:shadow-none animate-slide-in-right">
            <div className="p-4 border-b border-[#e5e7eb] bg-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedId(null)}
                  className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"
                >
                  <HiOutlineArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h3 className="font-bold text-gray-800 text-[13px] uppercase tracking-wide">{lang === 'es' ? 'Inspector de Objeto' : 'Object Inspector'}</h3>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleDuplicateSelected(selectedSection)} 
                  className="w-8 h-8 flex items-center justify-center text-blue-500 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
                  title={lang === 'es' ? 'Duplicar sección (Ctrl+C / Ctrl+V)' : 'Duplicate section (Ctrl+C / Ctrl+V)'}
                >
                  <HiOutlineDuplicate className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleDeleteSelected} 
                  className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-700 rounded transition-colors"
                  title="Eliminar"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Selected Seat Inspector Overlay */}
            {selectedSeat && selectedSeat.secId === selectedSection.id && (() => {
              const seatKey = selectedSeat.seatKey;
              const overrides = getSeatsConfig(selectedSection);
              const seatOverride = overrides[seatKey] || {};
              const isSeatWheelchair = seatOverride.isWheelchair || false;
              const isDisabled = seatOverride.disabled || false;
              
              return (
                <div className="bg-[#eff6ff] border-b border-[#bfdbfe] p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#1d4ed8] uppercase tracking-wider">{lang === 'es' ? 'Asiento Seleccionado' : 'Selected Seat'}</span>
                      <h4 className="text-[16px] font-black text-[#1e3a8a]">
                        {(() => {
                          const row = seatOverride.rowLabel || seatKey.split('-')[0];
                          const num = seatOverride.seatNumber !== undefined ? seatOverride.seatNumber : seatKey.split('-')[1];
                          return `${row}-${num}`;
                        })()}
                      </h4>
                    </div>
                    <button 
                      onClick={() => setSelectedSeat(null)}
                      className="text-[11px] text-gray-500 hover:text-gray-800 underline font-semibold"
                    >
                      {lang === 'es' ? 'Cerrar' : 'Close'}
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {/* Wheelchair toggle */}
                    <label className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-blue-200 cursor-pointer select-none shadow-sm hover:bg-blue-50/50">
                      <input 
                        type="checkbox"
                        checked={isSeatWheelchair}
                        onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'isWheelchair', e.target.checked)}
                        className="w-4 h-4 text-[#1a73e8] rounded focus:ring-blue-500"
                      />
                      <span className="text-[12px] font-bold text-gray-700 flex items-center gap-1.5">
                        <FaWheelchair className="text-blue-500" />
                        {lang === 'es' ? 'Silla de ruedas' : 'Wheelchair'}
                      </span>
                    </label>

                    {/* Reserved/Blocked toggle */}
                    <label className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-orange-100 cursor-pointer select-none shadow-sm hover:bg-orange-50/50">
                      <input 
                        type="checkbox"
                        checked={getSeatStatus(selectedSection, seatKey) === 'reserved'}
                        onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'reserved', e.target.checked)}
                        className="w-4 h-4 text-orange-500 rounded focus:ring-orange-500"
                      />
                      <span className="text-[12px] font-bold text-gray-700">
                        {lang === 'es' ? 'Bloquear para venta' : 'Block / Reserve seat'}
                      </span>
                    </label>

                    {/* Disable/Hide toggle */}
                    <label className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-100 cursor-pointer select-none shadow-sm hover:bg-gray-50">
                      <input 
                        type="checkbox"
                        checked={isDisabled}
                        onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'disabled', e.target.checked)}
                        className="w-4 h-4 text-gray-400 rounded focus:ring-gray-500"
                      />
                      <span className="text-[12px] font-bold text-gray-500">
                        {lang === 'es' ? 'Ocultar silla' : 'Hide seat'}
                      </span>
                    </label>

                    {/* Seat Custom Row and Number inputs */}
                    <div className="bg-white p-3 rounded border border-blue-200 shadow-sm space-y-2">
                      <span className="text-[11px] font-bold text-[#1e3a8a] block">
                        {lang === 'es' ? 'Personalizar Nombre / Etiqueta' : 'Customize Seat Name / Label'}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold mb-0.5">
                            {lang === 'es' ? 'Fila / Prefijo' : 'Row / Prefix'}
                          </label>
                          <input 
                            type="text"
                            placeholder={seatKey.split('-')[0]}
                            value={seatOverride.rowLabel || ''}
                            onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'rowLabel', e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none text-gray-800 font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 font-bold mb-0.5">
                            {lang === 'es' ? 'Número' : 'Number'}
                          </label>
                          <input 
                            type="number"
                            placeholder={seatKey.split('-')[1]}
                            value={seatOverride.seatNumber !== undefined && seatOverride.seatNumber !== null ? seatOverride.seatNumber : ''}
                            onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'seatNumber', e.target.value === '' ? undefined : +e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none text-gray-800 font-semibold"
                          />
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-400 block leading-tight">
                        {lang === 'es' 
                          ? 'Ejemplo: "VIP" y "12" resultará en "VIP-12".' 
                          : 'Example: "VIP" and "12" results in "VIP-12".'}
                      </span>
                    </div>

                    {/* Individual Price override */}
                    {selectedSection.tablePurchaseMode !== 'whole' && (
                      <div className="bg-white p-3 rounded border border-blue-200 shadow-sm space-y-1.5">
                        <label className="block text-[11px] font-bold text-[#1e3a8a]">
                          {lang === 'es' ? 'Precio de este asiento ($)' : 'Price of this seat ($)'}
                        </label>
                        <input 
                          type="number"
                          placeholder={String(selectedSection.price || 0)}
                          value={seatOverride.price !== undefined && seatOverride.price !== null ? seatOverride.price : ''}
                          onChange={e => {
                            const val = e.target.value === '' ? undefined : +e.target.value;
                            updateSeatConfig(selectedSection.id!, seatKey, 'price', val);
                          }}
                          className="w-full bg-white border border-gray-300 rounded px-2.5 py-1 text-xs focus:border-blue-500 outline-none font-medium text-gray-800"
                        />
                        <span className="text-[10px] text-gray-400 block leading-tight">
                          {lang === 'es' 
                            ? 'Dejar vacío para usar el precio general de la sección.' 
                            : 'Leave blank to use the general section price.'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Position Fine-tuning */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-gray-600 block">{lang === 'es' ? 'Ajuste Fino de Posición' : 'Fine-tuning (Drag or slide)'}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block">X Offset (px)</label>
                        <input 
                          type="number" 
                          value={seatOverride.xOffset || 0}
                          onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'xOffset', +e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Y Offset (px)</label>
                        <input 
                          type="number" 
                          value={seatOverride.yOffset || 0}
                          onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'yOffset', +e.target.value)}
                          className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                      {selectedSection.tablePurchaseMode !== 'whole' && (
                        <div>
                          <label className="text-[10px] text-gray-500 block">{lang === 'es' ? 'Precio Individual' : 'Individual Price'}</label>
                          <input 
                            type="number" 
                            value={seatOverride.price !== undefined ? seatOverride.price : selectedSection.price || 0}
                            onChange={e => updateSeatConfig(selectedSection.id!, seatKey, 'price', +e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-bold text-blue-600"
                          />
                        </div>
                      )}
                    </div>
                    {(seatOverride.xOffset || seatOverride.yOffset || seatOverride.price !== undefined) ? (
                      <button 
                        onClick={() => {
                          updateSeatConfig(selectedSection.id!, seatKey, 'xOffset', 0);
                          updateSeatConfig(selectedSection.id!, seatKey, 'yOffset', 0);
                          updateSeatConfig(selectedSection.id!, seatKey, 'price', undefined);
                        }}
                        className="w-full text-center text-[11px] text-blue-600 hover:text-blue-800 font-semibold pt-1"
                      >
                        {lang === 'es' ? 'Restablecer Valores' : 'Reset Values'}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })()}

            <div className="p-5 flex-1 space-y-6">
              {/* Category / Colors */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">{lang === 'es' ? 'Categoría' : 'Category'}</h4>
                <div className="flex flex-wrap gap-2">
                  {SECTION_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => updateSelected('color', color)}
                      className={`w-7 h-7 rounded-full transition-transform border-2 ${selectedSection.color === color ? 'border-gray-800 scale-110 shadow-sm' : 'border-transparent hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Labels & Pricing */}
              <div className="space-y-4">
                <h4 className="text-[12px] font-bold text-[#4b5563] uppercase tracking-wider">{lang === 'es' ? 'Etiquetas & Precio' : 'Labels & Pricing'}</h4>
                <div>
                  <label className="block text-[12px] text-[#4b5563] mb-1.5">{t('orgSectionName')}</label>
                  <input type="text" value={selectedSection.name || ''} onChange={e => updateSelected('name', e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-1 text-[13px] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none" />
                </div>
                <div>
                  <label className="block text-[12px] text-[#4b5563] mb-1.5">{lang === 'es' ? 'Tipo' : 'Type'}</label>
                  <select value={selectedSection.sectionType} onChange={e => updateSelected('sectionType', e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-1 text-[13px] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none">
                    <option value="seated">Asientos</option>
                    <option value="standing">General</option>
                    <option value="table">Mesa</option>
                    <option value="vip">VIP</option>
                    <option value="stage">Stage</option>
                    <option value="decor">{lang === 'es' ? 'Barra / Decor' : 'Decor'}</option>
                  </select>
                </div>

                {/* Price fields */}
                {selectedSection.sectionType !== 'stage' && selectedSection.sectionType !== 'decor' && (
                  <div className={`grid gap-3 ${selectedSection.sectionType === 'table' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className="block text-[12px] text-[#4b5563] mb-1.5">
                      {selectedSection.sectionType === 'table' ? (lang === 'es' ? 'Precio/Silla' : 'Price/Seat') : (lang === 'es' ? 'Precio ($)' : 'Price ($)')}
                    </label>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        value={selectedSection.price || 0}
                        onChange={e => updateSelected('price', +e.target.value)}
                        className="w-full bg-white border border-[#e5e7eb] rounded-[4px] pl-5 pr-2 py-1 text-[13px] focus:border-[#2563eb] outline-none font-bold text-[#1a73e8]"
                      />
                    </div>
                  </div>

                  {selectedSection.sectionType === 'table' && (
                    <div>
                      <label className="block text-[12px] text-[#4b5563] mb-1.5">{lang === 'es' ? 'Total Mesa' : 'Table Total'}</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          value={(() => {
                            const seatsCount = selectedSection.seatsPerRow || 0;
                            let total = 0;
                            const config = getSeatsConfig(selectedSection);
                            for (let i = 1; i <= seatsCount; i++) {
                              const key = `seat-${i}`;
                              total += config[key]?.price !== undefined ? Number(config[key].price) : Number(selectedSection.price || 0);
                            }
                            return total.toFixed(2);
                          })()}
                          onChange={e => {
                            const total = +e.target.value;
                            const perSeat = total / (selectedSection.seatsPerRow || 1);
                            const config = getSeatsConfig(selectedSection);
                            const newConfig = { ...config };
                            for (let i = 1; i <= (selectedSection.seatsPerRow || 1); i++) {
                              if (newConfig[`seat-${i}`]) delete newConfig[`seat-${i}`].price;
                            }
                            updateSelected('seatsConfig', JSON.stringify(newConfig));
                            updateSelected('price', perSeat);
                          }}
                          className="w-full bg-white border border-green-200 rounded-[4px] pl-5 pr-2 py-1 text-[13px] focus:border-green-500 outline-none font-bold text-green-600"
                        />
                      </div>
                    </div>
                  )}
                </div>
                )}
              

                {selectedSection.sectionType !== 'stage' && selectedSection.sectionType !== 'decor' && (
                <button
                  onClick={() => {
                    const allReserved = !selectedSection.isWheelchair; // Using isWheelchair as a proxy for "All Blocked" for now or just toggle
                    // Actually, let's just toggle a new property or iterate all seats
                    // For simplicity, let's add a button that updates the seatsConfig for ALL seats
                    const rows = selectedSection.rows || 1;
                    const seatsPerRow = selectedSection.seatsPerRow || 1;
                    const config = { ...getSeatsConfig(selectedSection) };
                    
                    let anyUnreserved = false;
                    for(let r=1; r<=rows; r++) {
                      const rowLabel: string = selectedSection?.sectionType === 'table' ? 'Mesa' : String.fromCharCode(64 + r);
                      for(let s=1; s<=seatsPerRow; s++) {
                        const key = selectedSection?.sectionType === 'table' ? `seat-${s}` : `${rowLabel}-${s}`;
                        if (!config[key]?.reserved) anyUnreserved = true;
                      }
                    }

                    for(let r=1; r<=rows; r++) {
                      const rowLabel: string = selectedSection?.sectionType === 'table' ? 'Mesa' : String.fromCharCode(64 + r);
                      for(let s=1; s<=seatsPerRow; s++) {
                        const key = selectedSection?.sectionType === 'table' ? `seat-${s}` : `${rowLabel}-${s}`;
                        config[key] = { ...config[key], reserved: anyUnreserved };
                      }
                    }
                    updateSelected('seatsConfig', JSON.stringify(config));
                  }}
                  className="w-full py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded text-xs font-bold hover:bg-orange-100 transition-colors"
                >
                  {lang === 'es' ? 'BLOQUEAR / DESBLOQUEAR TODO' : 'BLOCK / UNBLOCK ALL SEATS'}
                </button>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Layout Config */}
              <div className="space-y-4">
                <h4 className="text-[12px] font-bold text-[#4b5563] uppercase tracking-wider">{lang === 'es' ? 'Diseño (Layout)' : 'Layout'}</h4>
                {selectedSection.sectionType !== 'standing' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] text-[#4b5563] mb-1.5">{lang === 'es' ? 'Número de Filas' : 'Rows'}</label>
                      <input type="number" min="1" value={selectedSection.rows || 1} onChange={e => updateSelected('rows', +e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-1 text-[13px] focus:border-[#2563eb] outline-none text-center" />
                    </div>
                    <div>
                      <label className="block text-[12px] text-[#4b5563] mb-1.5">{lang === 'es' ? (selectedSection.sectionType === 'table' ? 'Asientos por Mesa' : 'Asientos / Fila') : (selectedSection.sectionType === 'table' ? 'Seats per Table' : 'Seats/Row')}</label>
                      <input type="number" min="1" value={selectedSection.seatsPerRow || 1} onChange={e => updateSelected('seatsPerRow', +e.target.value)} className="w-full bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-1 text-[13px] focus:border-[#2563eb] outline-none text-center" />
                    </div>
                  </div>
                )}
                {selectedSection.sectionType === 'standing' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">{t('orgCapacity')}</label>
                    <input type="number" value={selectedSection.capacity || 100} onChange={e => updateSelected('capacity', +e.target.value)} className="w-full bg-white border border-gray-300 rounded px-3 py-2 text-sm focus:border-[#1a73e8] outline-none" />
                  </div>
                )}

                {/* Seats.io specific properties: Curvature */}
                {(selectedSection.sectionType === 'seated' || selectedSection.sectionType === 'vip') && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[12px] text-[#4b5563] font-medium">{lang === 'es' ? 'Curvatura' : 'Curvature'}</label>
                        <span className="text-[11px] text-gray-500 font-mono font-bold">{selectedSection.curve || 0}px</span>
                      </div>
                      <input 
                        type="range" 
                        min="-150" 
                        max="150" 
                        value={selectedSection.curve || 0} 
                        onChange={e => updateSelected('curve', +e.target.value)} 
                        className="w-full accent-[#1a73e8]" 
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input 
                        type="checkbox" 
                        id="isWheelchairCheck"
                        checked={selectedSection.isWheelchair || false} 
                        onChange={e => updateSelected('isWheelchair', e.target.checked)} 
                        className="w-4 h-4 rounded text-[#1a73e8] focus:ring-[#2563eb]" 
                      />
                      <label htmlFor="isWheelchairCheck" className="text-[12px] text-[#4b5563] font-medium select-none">{lang === 'es' ? 'Acceso de Silla de Ruedas' : 'Wheelchair Accessible'}</label>
                    </div>
                  </div>
                )}

                {/* Seats.io specific properties: Table Shape */}
                {selectedSection.sectionType === 'table' && (
                  <div>
                    <label className="block text-[12px] text-[#4b5563] mb-1.5">{lang === 'es' ? 'Forma de la Mesa' : 'Table Shape'}</label>
                    <select 
                      value={selectedSection.tableShape || 'round'} 
                      onChange={e => updateSelected('tableShape', e.target.value)} 
                      className="w-full bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-1 text-[13px] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none"
                    >
                      <option value="round">{lang === 'es' ? 'Redonda' : 'Round'}</option>
                      <option value="rectangular">{lang === 'es' ? 'Rectangular' : 'Rectangular'}</option>
                    </select>
                  </div>
                )}

                {/* Table Purchase Mode */}
                {selectedSection.sectionType === 'table' && (
                  <div>
                    <label className="block text-[12px] text-[#4b5563] mb-1.5">{lang === 'es' ? 'Modo de Venta' : 'Purchase Mode'}</label>
                    <select 
                      value={selectedSection.tablePurchaseMode || 'individual'} 
                      onChange={e => updateSelected('tablePurchaseMode', e.target.value)} 
                      className="w-full bg-white border border-[#e5e7eb] rounded-[4px] px-2 py-1 text-[13px] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] outline-none"
                    >
                      <option value="individual">{lang === 'es' ? 'Por Silla' : 'By Seat'}</option>
                      <option value="whole">{lang === 'es' ? 'Por Mesa Completa' : 'Whole Table'}</option>
                    </select>
                  </div>
                )}

                {/* Section Rotation */}
                <div className="pt-1.5 pb-1">
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[12px] text-[#4b5563] font-medium">{lang === 'es' ? 'Rotación / Giro' : 'Rotation'}</label>
                    <span className="text-[11px] text-gray-500 font-mono font-bold">{selectedSection.rotation || 0}°</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="360" 
                    step="5"
                    value={selectedSection.rotation || 0} 
                    onChange={e => updateSelected('rotation', +e.target.value)} 
                    className="w-full accent-[#1a73e8]" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">W (px)</label>
                    <input type="number" value={selectedSection.mapWidth || 100} onChange={e => updateSelected('mapWidth', +e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm outline-none" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1.5">H (px)</label>
                    <input type="number" value={selectedSection.mapHeight || 100} onChange={e => updateSelected('mapHeight', +e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded px-3 py-1.5 text-sm outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

      {/* ── Canvas Viewport (Seats.io Light Grid Style) ─────────────────────────────────────────── */}
      <div
        ref={viewportRef}
        className="flex-1 relative overflow-hidden bg-[#f3f4f6]"
        style={{ cursor: 'default', userSelect: 'none', touchAction: 'none' }}
        onPointerDown={onViewportPointerDown}
        onPointerMove={onViewportPointerMove}
        onPointerUp={onViewportPointerUp}
        onPointerLeave={onViewportPointerUp}
        onPointerCancel={onViewportPointerUp}
        onClick={() => { setSelectedId(null); setSelectedSeat(null); }}
      >
        {/* Canvas Content */}

        {/* Infinite Ruler/Grid Background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)`,
            backgroundSize: '100px 100px',
            backgroundPosition: 'center center'
          }}
        >
          {/* Subtle minor grid */}
          <div className="absolute inset-0" style={{
            backgroundImage: `linear-gradient(#f3f4f6 1px, transparent 1px), linear-gradient(90deg, #f3f4f6 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            backgroundPosition: 'center center'
          }} />
        </div>
        {/* Zoom Controls — safe-area aware so they don't overlap mobile browser chrome */}
        <div
          className="absolute right-3 z-20 flex bg-white rounded shadow border border-gray-200 overflow-hidden"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button onClick={zoomOut} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors" title="Zoom Out">
            <HiOutlineZoomOut className="w-5 h-5" />
          </button>
          <div className="w-px bg-gray-200" />
          <button onClick={zoomIn} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 text-gray-600 transition-colors" title="Zoom In">
            <HiOutlineZoomIn className="w-5 h-5" />
          </button>
          <div className="w-px bg-gray-200" />
          <button onClick={resetView} className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 text-gray-600 text-[10px] font-bold uppercase transition-colors" title="Reset">
            FIT
          </button>
          <div className="w-px bg-gray-200" />
          <button
            onClick={handleSetDefaultView}
            className="h-10 px-3 flex items-center gap-2 hover:bg-blue-50 text-blue-600 transition-colors"
            title={lang === 'es' ? 'Fijar vista para clientes' : 'Set client default view'}
          >
            <HiOutlineCamera className="w-5 h-5" />
            <span className="hidden sm:inline text-[10px] font-bold uppercase whitespace-nowrap">{lang === 'es' ? 'Fijar Vista' : 'Set View'}</span>
          </button>
        </div>

        {/* Hints — hidden on small screens to avoid overlap */}
        <div
          className="hidden sm:flex absolute left-4 z-20 flex-col gap-2 items-start pointer-events-none"
          style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="text-[10px] text-gray-400 bg-[#0f172a]/80 backdrop-blur-md rounded-md px-3 py-1.5 border border-white/10 flex items-center gap-2 shadow-lg">
            <div className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
            {lang === 'es' ? 'Rueda: zoom · Arrastrar fondo: mover' : 'Wheel: zoom · Drag bg: pan'}
          </div>
          {!customViewport && (
            <div className="text-[10px] text-amber-400 bg-amber-950/80 backdrop-blur-md rounded-md px-3 py-1.5 border border-amber-500/30 flex items-center gap-2 shadow-lg animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {lang === 'es' ? 'Tip: Encuadra el mapa y pulsa "FIJAR VISTA" para los clientes' : 'Tip: Frame the map & click "SET VIEW" for buyers'}
            </div>
          )}
          {customViewport && (
            <div className="text-[10px] text-green-400 bg-green-950/90 backdrop-blur-md rounded-md px-3 py-1.5 border border-green-500/30 flex items-center gap-2 shadow-lg animate-bounce pointer-events-auto">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {lang === 'es' ? '✓ Vista inicial fijada (guarda para aplicar)' : '✓ Initial view fixed (save to apply)'}
            </div>
          )}
        </div>

        {/* Canvas (transformed) */}
        <div
          ref={canvasRef}
          style={{
            position: 'absolute',
            width: CANVAS_W,
            height: CANVAS_H,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          onClick={e => e.stopPropagation()}
        >


          {sections.map(sec => {
            const isSelected = selectedId === sec.id;
            const isTable = sec.sectionType === 'table';
            const isStanding = sec.sectionType === 'standing';
            const isStage = sec.sectionType === 'stage';
            const isDecor = sec.sectionType === 'decor';
            const isSeated = sec.sectionType === 'seated' || sec.sectionType === 'vip';
            const rowsCount = sec.rows || 1;
            const seatsCount = sec.seatsPerRow || 1;
            
            // Curve Math
            const curve = sec.curve || 0;
            const isWheelchair = sec.isWheelchair || false;
            const tableShape = sec.tableShape || 'round';

            return (
              <div
                key={sec.id}
                id={`sec-${sec.id}`}
                data-section="true"
                onPointerDown={e => { e.stopPropagation(); setHasMoved(false); onSectionPointerDown(e, sec); }}
                onClick={e => { 
                  if (hasMoved) return;
                  e.stopPropagation(); 
                  setSelectedId(sec.id!); 
                }}
                style={{
                  position: 'absolute',
                  left: sec.mapX ?? ((CANVAS_W / 2) - (sec.mapWidth || 100) / 2),
                  top: sec.mapY ?? ((CANVAS_H / 2) - (sec.mapHeight || 100) / 2),
                  width: sec.mapWidth || 100,
                  height: sec.mapHeight || 100,
                  transform: `rotate(${sec.rotation || 0}deg)`,
                  background: isStage ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' : (isStanding || isDecor ? sec.color : 'transparent'),
                  opacity: (isStanding || isDecor) ? 0.85 : 1,
                  border: isStage ? (isSelected ? '2.5px solid #60a5fa' : '2.5px solid #3b82f6') : (isDecor ? (isSelected ? '2.5px solid #1a73e8' : '1.5px solid #cbd5e1') : (isStanding ? `none` : isSelected ? `2px solid #1a73e8` : `1px solid transparent`)),
                  borderRadius: isStage ? '0 0 40px 40px' : (isStanding || isDecor ? 8 : (isTable && tableShape === 'round') ? '50%' : 4),
                  cursor: 'move',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: 'none',
                  zIndex: isSelected ? 20 : (isStanding || isDecor) ? 5 : 10,
                  willChange: 'left, top',
                  touchAction: 'none',
                  boxShadow: (isStage || isDecor) ? '0 0 20px rgba(0,0,0,0.1)' : (isStanding ? '0 4px 10px rgba(0,0,0,0.08)' : 'none'),
                }}
              >
                {isDecor && (
                  <div className="flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest break-words leading-tight">
                      {sec.name}
                    </span>
                  </div>
                )}
                {isStage && (
                  <>
                    <span style={{ color: '#60a5fa', fontSize: 13, fontWeight: 800, letterSpacing: 5, textTransform: 'uppercase', textShadow: '0 0 10px rgba(96, 165, 250, 0.5)' }}>
                      {sec.name}
                    </span>
                    <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 1 }}>
                      {lang === 'es' ? 'ESCENARIO' : 'STAGE'}
                    </span>
                  </>
                )}
                {/* Visual Representation of Seats (Seats.io Style circles) */}
                {isSeated && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Render exact dots curved */}
                    {Array.from({ length: rowsCount }).map((_, rIdx) => {
                      const rowLabel: string = String.fromCharCode(64 + rIdx + 1); // A, B, C...
                      return Array.from({ length: seatsCount }).map((_, sIdx) => {
                        const seatNumber = sIdx + 1;
                        const seatKey = `${rowLabel}-${seatNumber}`;
                        const overrides = getSeatsConfig(sec);
                        const seatOverride = overrides[seatKey] || {};

                        // Math for curving seats
                        const t = seatsCount > 1 ? (sIdx - (seatsCount - 1) / 2) / ((seatsCount - 1) / 2) : 0;
                        const x = seatsCount > 1 
                          ? 12 + sIdx * ((sec.mapWidth! - 24) / (seatsCount - 1))
                          : sec.mapWidth! / 2;
                        
                        const baseSpacingY = rowsCount > 1 ? (sec.mapHeight! - 32) / (rowsCount - 1) : 0;
                        const baseY = 16 + rIdx * baseSpacingY;
                        const curveOffset = curve * (t * t - 1);
                        const y = baseY + curveOffset;
                        
                        const angleRad = Math.atan2(2 * curve * t, sec.mapWidth! / 2);
                        const angleDeg = angleRad * (180 / Math.PI);

                        // Position with drag offsets
                        const finalXOffset = seatOverride.xOffset || 0;
                        const finalYOffset = seatOverride.yOffset || 0;
                        const isSeatWheelchair = seatOverride.isWheelchair !== undefined ? seatOverride.isWheelchair : isWheelchair;
                        const isDisabled = seatOverride.disabled || false;
                        const sStatus = getSeatStatus(sec, seatKey);
                        const isReserved = sStatus === 'reserved';
                        const isSold = sStatus === 'sold';
                        const isSeatSelected = selectedSeat?.secId === sec.id && selectedSeat?.seatKey === seatKey;

                        return (
                          <div
                            key={seatKey}
                            id={`seat-dot-${sec.id}-${seatKey}`}
                            className="absolute rounded-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing group/seat"
                            onPointerDown={e => onSeatPointerDown(e, sec.id!, seatKey, finalXOffset, finalYOffset, angleDeg, false, 0, false)}
                            onClick={e => {
                              if (hasMoved) return;
                              e.stopPropagation();
                              setSelectedSeat({ secId: sec.id!, seatKey });
                              setSelectedId(sec.id!);
                            }}
                            style={{
                              left: x,
                              top: y,
                              width: Math.max(10, Math.min(22, (sec.mapWidth! - 24) / seatsCount - 2)),
                              height: Math.max(10, Math.min(22, (sec.mapWidth! - 24) / seatsCount - 2)),
                              transform: `translate(-50%, -50%) translate(${finalXOffset}px, ${finalYOffset}px) rotate(${angleDeg}deg)`,
                              backgroundColor: isSold ? '#94a3b8' : (isReserved ? '#f97316' : (isSeatWheelchair ? '#1a73e8' : sec.color)),
                              boxShadow: isSeatSelected ? '0 0 0 3px #3b82f6, 0 4px 10px rgba(59,130,246,0.5)' : '0 1px 3px rgba(0,0,0,0.15)',
                              border: isSeatSelected ? '2px solid #fff' : '1.5px solid #fff',
                              opacity: isDisabled ? 0.25 : 1,
                              zIndex: isSeatSelected ? 30 : 10,
                            }}
                          >
                            {isReserved && <div className="w-[60%] h-[60%] bg-white rounded-full flex items-center justify-center text-[8px] font-bold text-orange-600">B</div>}
                            {isSold && <div className="w-[60%] h-[60%] bg-white rounded-full flex items-center justify-center text-[8px] font-bold text-slate-500">S</div>}
                            {isSeatWheelchair && !isReserved && (
                              <FaWheelchair className="w-[70%] h-[70%] text-white" />
                            )}
                            {/* Seat label on hover */}
                            <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover/seat:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                              {(() => {
                                const row = seatOverride.rowLabel || rowLabel;
                                const num = seatOverride.seatNumber !== undefined ? seatOverride.seatNumber : seatNumber;
                                return `${row}-${num}`;
                              })()}
                            </div>
                          </div>
                        );
                      });
                    })}
                  </div>
                )}

                {isTable && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {/* Table Surface */}
                    {tableShape === 'round' ? (
                      <>
                        <div className="absolute rounded-full bg-[#f1f5f9] border shadow-inner flex items-center justify-center pointer-events-none" style={{
                          width: '60%', height: '60%', borderColor: '#cbd5e1'
                        }}>
                          <span className="text-[10px] font-bold text-gray-400">TABLE</span>
                        </div>
                        {/* Seats around the round table */}
                        {Array.from({ length: seatsCount }).map((_, i) => {
                          const seatNumber = i + 1;
                          const seatKey = `seat-${seatNumber}`;
                          const overrides = getSeatsConfig(sec);
                          const seatOverride = overrides[seatKey] || {};

                          const angle = (i * 360) / seatsCount;
                          const finalXOffset = seatOverride.xOffset || 0;
                          const finalYOffset = seatOverride.yOffset || 0;
                          const isSeatWheelchair = seatOverride.isWheelchair || false;
                          const isDisabled = seatOverride.disabled || false;
                          const sStatus = getSeatStatus(sec, seatKey);
                          const isReserved = sStatus === 'reserved';
                          const isSold = sStatus === 'sold';
                          const isSeatSelected = selectedSeat?.secId === sec.id && selectedSeat?.seatKey === seatKey;

                          return (
                            <div
                              key={seatKey}
                              id={`seat-dot-${sec.id}-${seatKey}`}
                              className="absolute rounded-full pointer-events-auto cursor-grab active:cursor-grabbing group/seat"
                              onPointerDown={e => onSeatPointerDown(e, sec.id!, seatKey, finalXOffset, finalYOffset, 0, true, angle, false)}
                              onClick={e => {
                                if (hasMoved) return;
                                e.stopPropagation();
                                setSelectedSeat({ secId: sec.id!, seatKey });
                                setSelectedId(sec.id!);
                              }}
                              style={{
                                width: '20%',
                                height: '20%',
                                backgroundColor: isSold ? '#94a3b8' : (isReserved ? '#f97316' : (isSeatWheelchair ? '#1a73e8' : sec.color)),
                                transform: `rotate(${angle}deg) translate(0, -210%) rotate(-${angle}deg) translate(${finalXOffset}px, ${finalYOffset}px)`,
                                boxShadow: isSeatSelected ? '0 0 0 3px #3b82f6, 0 4px 10px rgba(59,130,246,0.5)' : '0 1px 3px rgba(0,0,0,0.15)',
                                border: isSeatSelected ? '2px solid #fff' : '1.5px solid #fff',
                                opacity: isDisabled ? 0.25 : 1,
                                zIndex: isSeatSelected ? 30 : 10,
                              }}
                            >
                              {isReserved && <div className="w-[70%] h-[70%] bg-white rounded-full flex items-center justify-center text-[8px] font-bold text-orange-600 absolute inset-0 m-auto">B</div>}
                              {isSeatWheelchair && !isReserved && (
                                <FaWheelchair className="w-[70%] h-[70%] text-white absolute inset-0 m-auto" />
                              )}
                              <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover/seat:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                {(() => {
                                  const row = seatOverride.rowLabel || 'Mesa';
                                  const num = seatOverride.seatNumber !== undefined ? seatOverride.seatNumber : seatNumber;
                                  return `${row}-${num}`;
                                })()}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    ) : (
                      <>
                        <div className="absolute rounded bg-[#f1f5f9] border shadow-inner flex items-center justify-center pointer-events-none" style={{
                          width: '70%', height: '45%', borderColor: '#cbd5e1'
                        }}>
                          <span className="text-[10px] font-bold text-gray-400">TABLE</span>
                        </div>
                        {/* Seats around the rectangular table */}
                        {Array.from({ length: seatsCount }).map((_, i) => {
                          const seatNumber = i + 1;
                          const seatKey = `seat-${seatNumber}`;
                          const overrides = getSeatsConfig(sec);
                          const seatOverride = overrides[seatKey] || {};

                          const perimeter = 2 * (1 + 0.55);
                          const step = perimeter / seatsCount;
                          const pos = i * step;
                          let x = 50;
                          let y = 50;
                          if (pos < 1) { // Top
                            x = 15 + pos * 70;
                            y = 12;
                          } else if (pos < 1.55) { // Right
                            x = 88;
                            y = 15 + (pos - 1) / 0.55 * 70;
                          } else if (pos < 2.55) { // Bottom
                            x = 85 - (pos - 1.55) * 70;
                            y = 88;
                          } else { // Left
                            x = 12;
                            y = 85 - (pos - 2.55) / 0.55 * 70;
                          }

                          const finalXOffset = seatOverride.xOffset || 0;
                          const finalYOffset = seatOverride.yOffset || 0;
                          const isSeatWheelchair = seatOverride.isWheelchair || false;
                          const isDisabled = seatOverride.disabled || false;
                          const sStatus = getSeatStatus(sec, seatKey);
                          const isReserved = sStatus === 'reserved';
                          const isSold = sStatus === 'sold';
                          const isSeatSelected = selectedSeat?.secId === sec.id && selectedSeat?.seatKey === seatKey;

                          return (
                            <div
                              key={seatKey}
                              id={`seat-dot-${sec.id}-${seatKey}`}
                              className="absolute rounded-full pointer-events-auto cursor-grab active:cursor-grabbing group/seat"
                              onPointerDown={e => onSeatPointerDown(e, sec.id!, seatKey, finalXOffset, finalYOffset, 0, true, 0, true)}
                              onClick={e => {
                                if (hasMoved) return;
                                e.stopPropagation();
                                setSelectedSeat({ secId: sec.id!, seatKey });
                                setSelectedId(sec.id!);
                              }}
                              style={{
                                width: '18%',
                                height: '18%',
                                backgroundColor: isSold ? '#94a3b8' : (isReserved ? '#f97316' : (isSeatWheelchair ? '#1a73e8' : sec.color)),
                                left: `${x}%`,
                                top: `${y}%`,
                                transform: `translate(-50%, -50%) translate(${finalXOffset}px, ${finalYOffset}px)`,
                                boxShadow: isSeatSelected ? '0 0 0 3px #3b82f6, 0 4px 10px rgba(59,130,246,0.5)' : '0 1px 3px rgba(0,0,0,0.15)',
                                border: isSeatSelected ? '2px solid #fff' : '1.5px solid #fff',
                                opacity: isDisabled ? 0.25 : 1,
                                zIndex: isSeatSelected ? 30 : 10,
                              }}
                            >
                              {isReserved && <div className="w-[70%] h-[70%] bg-white rounded-full flex items-center justify-center text-[8px] font-bold text-orange-600 absolute inset-0 m-auto">B</div>}
                              {isSold && <div className="w-[70%] h-[70%] bg-white rounded-full flex items-center justify-center text-[8px] font-bold text-slate-500 absolute inset-0 m-auto">S</div>}
                              {isSeatWheelchair && !isReserved && !isSold && (
                                <FaWheelchair className="w-[70%] h-[70%] text-white absolute inset-0 m-auto" />
                              )}
                              <div className="absolute bottom-full mb-1 bg-gray-900 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover/seat:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                                {(() => {
                                  const row = seatOverride.rowLabel || 'Mesa';
                                  const num = seatOverride.seatNumber !== undefined ? seatOverride.seatNumber : seatNumber;
                                  return `${row}-${num}`;
                                })()}
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )}

                {/* Section Label overlay */}
                {!isStage && !isDecor && (
                  <div className="relative z-10 flex flex-col items-center justify-center pointer-events-none">
                    <span style={{ 
                      fontWeight: 800, 
                      fontSize: 12, 
                      textAlign: 'center', 
                      color: isStanding ? '#fff' : '#1e293b', 
                      backgroundColor: isStanding ? 'transparent' : 'rgba(255,255,255,0.9)', 
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      boxShadow: isStanding ? 'none' : '0 2px 5px rgba(0,0,0,0.1)',
                    }}>
                      {sec.name}
                    </span>
                  </div>
                )}

                {/* Resize Handle */}
                {isSelected && (
                  <div
                    onPointerDown={e => { e.stopPropagation(); onSectionPointerDown(e, sec, 'resize'); }}
                    style={{
                      position: 'absolute',
                      bottom: -4,
                      right: -4,
                      width: 12,
                      height: 12,
                      backgroundColor: '#fff',
                      border: `2px solid #1a73e8`,
                      borderRadius: '50%',
                      cursor: 'nwse-resize',
                      zIndex: 100,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      touchAction: 'none'
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HiOutlineTrash className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {lang === 'es' ? '¿Eliminar sección?' : 'Delete section?'}
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                {lang === 'es' 
                  ? 'Esta acción no se puede deshacer. Los asientos asociados también serán eliminados al guardar.' 
                  : 'This action cannot be undone. Associated seats will also be removed upon saving.'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 btn-secondary py-2.5 justify-center"
                >
                  {t('orgCancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl py-2.5 transition-all shadow-lg shadow-red-500/20"
                >
                  {lang === 'es' ? 'Eliminar' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
