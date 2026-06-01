'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { parseSafeDate, formatDateInTimezone, getTimezoneAbbr } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { formatSeatLabel } from '@/lib/seatLabel';
import { Event, SalesReport, VenueSection } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { format, type Locale } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  HiOutlineArrowLeft,
  HiOutlineCurrencyDollar,
  HiOutlineTicket,
  HiOutlineShoppingCart,
  HiOutlineDownload,
  HiOutlineGlobe,
  HiOutlineTrash,
  HiOutlineUsers,
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineMap,
  HiOutlinePencil,
  HiOutlineXCircle,
  HiOutlineCheckCircle,
  HiOutlineCamera,
  HiOutlineX,
  HiOutlineBan,
  HiOutlineMail,
  HiOutlineBell,
  HiOutlineChartBar,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
} from 'react-icons/hi';
import VenueMapBuilder from '@/components/events/VenueMapBuilder';
import toast from 'react-hot-toast';

interface Attendee {
  id: string;
  ticketCode: string;
  sectionName: string;
  rowLabel: string;
  seatNumber: number;
  status: string;
  user?: { firstName: string; lastName: string; email: string };
}

const TIMEZONE_GROUPS = [
  {
    region: 'Americas - North & Central',
    zones: [
      { value: 'America/Anchorage', label: 'Anchorage (AKST/AKDT)' },
      { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
      { value: 'America/Denver', label: 'Denver (MST/MDT)' },
      { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
      { value: 'America/New_York', label: 'New York (EST/EDT)' },
      { value: 'America/Toronto', label: 'Toronto (EST/EDT)' },
      { value: 'America/Mexico_City', label: 'Mexico City (CST/CDT)' },
    ],
  },
  {
    region: 'Americas - South',
    zones: [
      { value: 'America/Bogota', label: 'Bogota (COT)' },
      { value: 'America/Lima', label: 'Lima (PET)' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
      { value: 'America/Santiago', label: 'Santiago (CLT)' },
      { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
    ],
  },
  {
    region: 'Europe',
    zones: [
      { value: 'Europe/London', label: 'London (GMT/BST)' },
      { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)' },
      { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
      { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
      { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
      { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
      { value: 'Europe/Brussels', label: 'Brussels (CET/CEST)' },
      { value: 'Europe/Vienna', label: 'Vienna (CET/CEST)' },
      { value: 'Europe/Prague', label: 'Prague (CET/CEST)' },
      { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)' },
      { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
      { value: 'Europe/Athens', label: 'Athens (EET/EEST)' },
      { value: 'Europe/Istanbul', label: 'Istanbul (EET/EEST)' },
    ],
  },
  {
    region: 'Africa',
    zones: [
      { value: 'Africa/Cairo', label: 'Cairo (EET)' },
      { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
      { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)' },
      { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
    ],
  },
  {
    region: 'Middle East & Central Asia',
    zones: [
      { value: 'Asia/Dubai', label: 'Dubai (GST)' },
      { value: 'Asia/Tehran', label: 'Tehran (IRST)' },
      { value: 'Asia/Kolkata', label: 'India (IST)' },
      { value: 'Asia/Karachi', label: 'Karachi (PKT)' },
      { value: 'Asia/Almaty', label: 'Almaty (ALMT)' },
    ],
  },
  {
    region: 'Asia - East & Southeast',
    zones: [
      { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
      { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh (ICT)' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT)' },
      { value: 'Asia/Manila', label: 'Manila (PHT)' },
      { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Asia/Seoul', label: 'Seoul (KST)' },
      { value: 'Asia/Taipei', label: 'Taipei (CST)' },
    ],
  },
  {
    region: 'Oceania',
    zones: [
      { value: 'Australia/Perth', label: 'Perth (AWST)' },
      { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
      { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)' },
      { value: 'Pacific/Auckland', label: 'Auckland (NZDT/NZST)' },
      { value: 'Pacific/Fiji', label: 'Fiji (FJT)' },
    ],
  },
];

const getCurrentTimeInTimezone = (timezone: string): string => {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('es', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return formatter.format(now);
  } catch {
    return '??:??';
  }
};

const getPartsInTimezone = (date: Date, timezone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const map: Record<string, string> = {};
  formatter.formatToParts(date).forEach((p) => { map[p.type] = p.value; });
  return map;
};

const getDateKeyInTimezone = (dateVal: any, timezone: string) => {
  const date = parseSafeDate(dateVal);
  if (Number.isNaN(date.getTime())) return '';
  const parts = getPartsInTimezone(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatDateKeyLabel = (dateKey: string, locale: Locale) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return format(new Date(year, month - 1, day), 'dd MMM yyyy', { locale });
};

const formatDateInput = (value?: string, timezone: string = 'UTC') => {
  if (!value) return '';
  const date = parseSafeDate(value);
  if (Number.isNaN(date.getTime())) return value.substring(0, 10);
  const parts = getPartsInTimezone(date, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatTimeInput = (value?: string, timezone: string = 'UTC') => {
  if (!value) return '';
  const date = parseSafeDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = getPartsInTimezone(date, timezone);
  // Intl returns "24" at midnight in some locales — normalize to "00"
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${hour}:${parts.minute}`;
};

const buildLocalEventDate = (date: string, time: string, timezone: string = 'UTC') => {
  const safeTime = time || '00:00';
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = safeTime.split(':').map(Number);

  // Start with the input treating it as UTC
  let utcDate = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  // Format this UTC date in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(utcDate);
  const tzTime: Record<string, number> = {};
  parts.forEach(p => {
    tzTime[p.type] = parseInt(p.value);
  });

  // Calculate the offset between what we want and what we have
  const tzDateStr = `${String(tzTime.year).padStart(4, '0')}-${String(tzTime.month).padStart(2, '0')}-${String(tzTime.day).padStart(2, '0')}T${String(tzTime.hour).padStart(2, '0')}:${String(tzTime.minute).padStart(2, '0')}:${String(tzTime.second).padStart(2, '0')}Z`;
  const desiredDateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;

  const offsetMs = new Date(desiredDateStr).getTime() - new Date(tzDateStr).getTime();

  // Apply the offset to get the correct UTC date
  const correctUtcDate = new Date(utcDate.getTime() + offsetMs);

  return correctUtcDate.toISOString();
};

type EventCode = {
  id: string;
  code: string;
  commissionFixed: number;
  isActive: boolean;
  ticketCount?: number;
  totalGenerated?: number;
  owner?: { firstName: string; lastName: string; email: string };
  orders?: {
    id: string;
    ticketCount: number;
    total: number;
    paidAt: string;
    commissionGenerated: number;
    buyer?: { firstName: string; lastName: string; email: string } | null;
  }[];
};

function CreatorRewardsBlock({
  event,
  sections,
  lang,
  onSaved,
}: {
  event: Event;
  sections: import('@/types').VenueSection[];
  lang: string;
  onSaved: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState(Number(event.creatorCommission || 0).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState<EventCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeSaving, setCodeSaving] = useState<string | null>(null);

  const ticketSections = sections.filter(s => s.sectionType !== 'stage' && s.sectionType !== 'decor');

  const loadCodes = () => {
    import('@/lib/api').then(({ default: api }) =>
      api.get(`/special-codes/by-event/${event.id}`)
        .then(r => {
          const data: EventCode[] = r.data || [];
          setCodes(data);
          const inputs: Record<string, string> = {};
          data.forEach(c => { inputs[c.id] = Number(c.commissionFixed || 0).toFixed(2); });
          setCodeInputs(inputs);
        })
        .catch(() => setCodes([]))
        .finally(() => setLoadingCodes(false))
    );
  };

  useEffect(() => { loadCodes(); }, [event.id]);

  const handleSaveCodeReward = async (code: EventCode) => {
    const amount = parseFloat(codeInputs[code.id] ?? '0');
    if (isNaN(amount) || amount < 0) return;
    setCodeSaving(code.id);
    try {
      const { default: apiLib } = await import('@/lib/api');
      await apiLib.patch(`/special-codes/by-event/${event.id}/${code.id}/reward`, { commissionFixed: Math.round(amount * 100) / 100 });
      const toastLib = (await import('react-hot-toast')).default;
      toastLib.success(lang === 'es' ? 'Recompensa actualizada' : 'Reward updated');
      loadCodes();
    } catch (err: any) {
      const toastLib = (await import('react-hot-toast')).default;
      toastLib.error(err.response?.data?.message || 'Error');
    } finally {
      setCodeSaving(null);
    }
  };

  const calcEarning = (ticketPrice: number) => {
    const v = parseFloat(value) || 0;
    if (mode === 'percent') return ticketPrice * (v / 100);
    return v;
  };

  const handleSave = async () => {
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) return;
    const amount = mode === 'percent'
      ? (ticketSections.length > 0 ? (ticketSections.reduce((sum, s) => sum + Number(s.price), 0) / ticketSections.length) * (v / 100) : 0)
      : v;
    setSaving(true);
    try {
      await import('@/lib/api').then(({ default: api }) =>
        api.patch(`/events/${event.id}/creator-commission`, { amount: Math.round(amount * 100) / 100 })
      );
      const toastLib = (await import('react-hot-toast')).default;
      toastLib.success(
        event.status === 'published'
          ? (lang === 'es' ? 'Solicitud enviada al admin para aprobación' : 'Request sent to admin for approval')
          : (lang === 'es' ? 'Recompensa guardada' : 'Reward saved')
      );
      await onSaved();
    } catch (err: any) {
      const toastLib = (await import('react-hot-toast')).default;
      toastLib.error(err.response?.data?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const activeReward = Number(event.creatorCommission || 0);
  const pendingReward = event.pendingCreatorCommission;



  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-2xl border border-orange-100">
        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
          <HiOutlineCurrencyDollar className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-extrabold text-gray-900">
            {lang === 'es' ? 'Recompensas para Creadores' : 'Creator Rewards'}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
            {lang === 'es'
              ? 'El admin crea los códigos y asigna creadores a tu evento. Cada vez que alguien compra una entrada con el código de un creador, se le acumula una recompensa. Los pagos son realizados directamente por el administrador.'
              : 'The admin creates codes and assigns creators to your event. Every time someone buys a ticket using a creator\'s code, their reward accumulates. Payments are handled directly by the administrator.'}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

      {/* LEFT — Event base reward */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            {lang === 'es' ? 'Recompensa base del evento' : 'Event base reward'}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {lang === 'es'
              ? 'Se aplica a creadores sin monto propio.'
              : "Applies to creators without their own rate."}
          </p>
        </div>
        <div className="p-4 space-y-3">
          {activeReward > 0 && pendingReward == null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs min-h-[52px] justify-center rounded-2xl border border-transparent text-center leading-tight transition-all duration-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-800 font-semibold">
                {lang === 'es' ? 'Activa:' : 'Active:'}{' '}
                <span className="font-extrabold">${activeReward.toFixed(2)}</span>{' '}
                {lang === 'es' ? 'por entrada' : 'per ticket'}
              </span>
            </div>
          )}
          {pendingReward != null && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              <span className="text-amber-800 font-semibold">
                {lang === 'es' ? 'Pendiente:' : 'Pending:'}{' '}
                <span className="font-extrabold">${Number(pendingReward).toFixed(2)}</span>{' '}
                {lang === 'es' ? 'por entrada' : 'per ticket'}
              </span>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <div className="flex rounded-xl overflow-hidden border border-gray-200 shrink-0 text-xs font-bold">
              <button type="button" onClick={() => setMode('fixed')}
                className={`px-3 py-2 transition-colors ${mode === 'fixed' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                $ {lang === 'es' ? 'Fijo' : 'Fixed'}
              </button>
              <button type="button" onClick={() => setMode('percent')}
                className={`px-3 py-2 transition-colors ${mode === 'percent' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                %
              </button>
            </div>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">{mode === 'fixed' ? '$' : '%'}</span>
              <input
                type="number" step="0.01" min="0" max={mode === 'percent' ? 100 : undefined}
                value={value}
                onChange={e => setValue(e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-orange-400 text-sm focus:outline-none"
              />
            </div>
            <button type="button" disabled={saving} onClick={handleSave}
              className="px-3 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap shrink-0">
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : event.status === 'published'
                  ? (lang === 'es' ? 'Solicitar' : 'Request')
                  : (lang === 'es' ? 'Guardar' : 'Save')}
            </button>
          </div>

          {/* Per-section preview */}
          {ticketSections.length > 0 && parseFloat(value) > 0 && (
            <div className="rounded-xl border border-gray-100 overflow-hidden mt-1">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {lang === 'es' ? 'Vista previa por sección' : 'Preview per section'}
                </p>
              </div>
              <div className="overflow-y-auto max-h-64">
              {ticketSections.map(sec => {
                const earning = calcEarning(Number(sec.price));
                const pct = Number(sec.price) > 0 ? (earning / Number(sec.price)) * 100 : 0;
                return (
                  <div key={sec.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">{sec.name}</p>
                      <p className="text-[10px] text-gray-400">{lang === 'es' ? 'Precio:' : 'Price:'} <span className="font-semibold">${Number(sec.price).toFixed(2)}</span></p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-extrabold text-emerald-700">${earning.toFixed(2)}</p>
                      <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — Creators list */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            {lang === 'es' ? 'Creadores en este evento' : 'Creators on this event'}
          </p>
          <span className="text-[10px] text-gray-400 font-medium">
            {lang === 'es' ? 'Creados por el admin' : 'Created by admin'}
          </span>
        </div>
        {loadingCodes ? (
          <div className="px-4 py-6 text-center">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-400 rounded-full animate-spin mx-auto" />
          </div>
        ) : codes.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-gray-400">
              {lang === 'es' ? 'No hay códigos asignados a este evento todavía.' : 'No codes assigned to this event yet.'}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              {lang === 'es' ? 'El administrador puede crear códigos desde el panel de admin.' : 'The administrator can create codes from the admin panel.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {codes.map(code => (
              <div key={code.id} className="px-4 py-4 space-y-3">
                {/* Creator info */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-sm font-bold text-gray-500">
                    {(code.owner?.firstName?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {code.owner ? `${code.owner.firstName} ${code.owner.lastName}` : lang === 'es' ? 'Sin asignar' : 'Unassigned'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono">{code.code}</p>
                  </div>
                  <div className="text-right shrink-0 min-w-[86px]">
                    <p className="text-base font-extrabold text-emerald-700">
                      ${Number(codeInputs[code.id] ?? code.commissionFixed ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {Number(code.commissionFixed) > 0
                        ? (lang === 'es' ? 'monto propio' : 'own rate')
                        : (lang === 'es' ? 'usa base evento' : 'uses event base')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-0 sm:pl-12">
                  <div className="rounded-xl bg-gray-50 px-3 py-2 min-h-[58px]">
                    <p className="text-[10px] font-black uppercase text-gray-400">
                      {lang === 'es' ? 'Entradas vendidas' : 'Tickets sold'}
                    </p>
                    <p className="text-sm font-extrabold text-gray-900">{Number(code.ticketCount || 0)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 min-h-[58px]">
                    <p className="text-[10px] font-black uppercase text-gray-400">
                      {lang === 'es' ? 'Recompensa generada' : 'Reward generated'}
                    </p>
                    <p className="text-sm font-extrabold text-[#0A375A]">
                      ${Number(code.totalGenerated || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <details className="pl-0 sm:pl-12">
                  <summary className="cursor-pointer list-none rounded-xl bg-gray-100 px-3 py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-200 text-center sm:text-left">
                    {lang === 'es' ? 'Ver compradores' : 'View buyers'} ({code.orders?.length || 0})
                  </summary>
                  <div className="mt-2 overflow-hidden rounded-xl border border-gray-100">
                    {(code.orders || []).length === 0 ? (
                      <div className="px-3 py-3 text-xs text-gray-400">
                        {lang === 'es' ? 'Todavía no hay compradores con este código.' : 'There are no buyers with this code yet.'}
                      </div>
                    ) : (
                      (code.orders || []).map((order) => {
                        const buyerName = order.buyer ? `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim() : '';
                        return (
                          <div key={order.id} className="grid grid-cols-1 gap-3 border-b border-gray-50 px-3 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <div>
                              <p className="text-xs font-bold text-gray-900 truncate">
                                {buyerName || (lang === 'es' ? 'Comprador' : 'Buyer')}
                              </p>
                              <p className="text-[11px] text-gray-500 truncate">{order.buyer?.email || '-'}</p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-right sm:min-w-[210px]">
                              <div>
                                <p className="text-[9px] font-black uppercase text-gray-400">
                                  {lang === 'es' ? 'Entradas' : 'Tickets'}
                                </p>
                                <p className="text-xs font-black text-gray-900">{order.ticketCount}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black uppercase text-gray-400">
                                  {lang === 'es' ? 'Pagado' : 'Paid'}
                                </p>
                                <p className="text-xs font-black text-gray-900">${Number(order.total || 0).toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-black uppercase text-gray-400">
                                  {lang === 'es' ? 'Recompensa' : 'Reward'}
                                </p>
                                <p className="text-xs font-black text-emerald-700">
                                  ${Number(order.commissionGenerated || 0).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </details>
                {/* Inline input */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center pl-0 sm:pl-12">
                  <div className="relative w-full sm:flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={codeInputs[code.id] ?? '0'}
                      onChange={e => setCodeInputs(p => ({ ...p, [code.id]: e.target.value }))}
                      className="w-full pl-6 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-orange-400"
                      placeholder="0.00"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={codeSaving === code.id}
                    onClick={() => handleSaveCodeReward(code)}
                    className="w-full sm:w-auto px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    {codeSaving === code.id
                      ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : (lang === 'es' ? 'Guardar' : 'Save')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>{/* end grid */}
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const router = useRouter();
  const { categories, getCategoryInfo, refreshCategories } = useCategories();

  const [event, setEvent] = useState<Event | null>(null);
  const [sections, setSections] = useState<VenueSection[]>([]);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [activeTab, setActiveTab] = useState<'analytics' | 'details' | 'overview' | 'attendees' | 'map' | 'blocks' | 'reminders' | 'commission'>('analytics');
  const [selectedBlockSection, setSelectedBlockSection] = useState('');
  const [selectedBlockSeats, setSelectedBlockSeats] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [blockingActionLoading, setBlockingActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedAttendee, setExpandedAttendee] = useState<string | null>(null);

  // Email Reminder States
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderDays, setReminderDays] = useState(0);
  const [reminderMessage, setReminderMessage] = useState('');
  const [sendingReminder, setSendingReminder] = useState(false);

  // Automatic Email Reminder Settings
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(false);
  const [autoReminderDays, setAutoReminderDays] = useState(0);
  const [autoReminderMessage, setAutoReminderMessage] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Edit Event States
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    venueName: '',
    venueAddress: '',
    eventDate: '',
    eventTime: '',
    eventTimezone: 'UTC',
    category: '',
    hasSeatMap: false,
    bannerPosition: 'center',
    maxTicketsPerTransaction: 10,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const handleMapSaved = useCallback((newSections: VenueSection[]) => {
    setSections(newSections);
  }, []);

  const handleMapChange = useCallback((updatedSections: any[]) => {
    setSections(updatedSections as VenueSection[]);
  }, []);

  useEffect(() => { loadEvent(); refreshCategories(); }, [id]);

  useEffect(() => {
    if (event) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDateOnly = new Date(event.eventDate);
      eventDateOnly.setHours(0, 0, 0, 0);
      const timeDiff = eventDateOnly.getTime() - today.getTime();
      setReminderDays(Math.ceil(timeDiff / (1000 * 3600 * 24)));
    }
  }, [event]);

  const loadEvent = async () => {
    try {
      // Load event details
      const { data: events } = await api.get('/events', { params: { limit: 100 } });
      const ev = (events.events || []).find((e: Event) => e.id === id);
      if (!ev || (ev.organizerId !== user?.id && user?.role !== 'admin')) { router.push('/organizer/events'); return; }
      setEvent(ev);
      setEditForm({
        title: ev.title || '',
        description: ev.description || '',
        venueName: ev.venueName || '',
        venueAddress: ev.venueAddress || '',
        eventDate: formatDateInput(ev.eventDate, ev.eventTimezone || 'UTC'),
        eventTime: formatTimeInput(ev.eventDate, ev.eventTimezone || 'UTC'),
        eventTimezone: ev.eventTimezone || 'UTC',
        category: ev.pendingCategory || ev.category || '',
        hasSeatMap: ev.hasSeatMap || false,
        bannerPosition: ev.bannerPosition || 'center',
        maxTicketsPerTransaction: ev.maxTicketsPerTransaction || 10,
      });

      // Load reminder settings
      setAutoReminderEnabled(ev.autoReminderEnabled || false);
      setAutoReminderDays(ev.autoReminderDays || 0);
      setAutoReminderMessage(ev.autoReminderMessage || '');

      // Load sections and seats
      try {
        const { data: secs } = await api.get(`/events/${id}/seatmap`);
        setSections(secs);
      } catch {
        try {
          const { data: secs } = await api.get(`/events/${id}/sections`);
          setSections(secs);
        } catch {}
      }

      // Load sales
      try {
        const { data: salesData } = await api.get(`/orders/event/${id}/sales`);
        setSales(salesData);
      } catch {}

      // Load attendees
      try {
        const { data: att } = await api.get(`/orders/event/${id}/attendees`);
        setAttendees(att);
      } catch {}
    } catch {
      router.push('/organizer/events');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      await api.post(`/events/${id}/publish`);
      toast.success(lang === 'es' ? '¡Evento publicado con éxito!' : 'Event published successfully!');
      await loadEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async () => {
    if (!confirm(lang === 'es' ? '¿Eliminar este evento permanentemente?' : 'Delete this event permanently?')) return;
    try {
      await api.delete(`/events/${id}`);
      toast.success(lang === 'es' ? 'Evento eliminado con éxito' : 'Event deleted successfully');
      router.push('/organizer/events');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleBulkBlockSeats = async () => {
    if (selectedBlockSeats.length === 0) return;
    setBlockingActionLoading(true);
    try {
      for (const seatId of selectedBlockSeats) {
        await api.post(`/orders/seats/${seatId}/toggle-block`);
      }
      toast.success(lang === 'es' ? '¡Estado de bloqueo de asientos actualizado!' : 'Seat block statuses updated successfully!');
      setSelectedBlockSeats([]);
      await loadEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error updating seat blocks');
    } finally {
      setBlockingActionLoading(false);
    }
  };

  const handleSendFreeInvitations = async () => {
    if (selectedBlockSeats.length === 0) return;
    if (!inviteForm.name || !inviteForm.email) {
      toast.error(lang === 'es' ? 'Por favor ingresa nombre y correo del invitado' : 'Please fill in the guest name and email address');
      return;
    }
    setBlockingActionLoading(true);
    try {
      await api.post(`/orders/event/${id}/free-tickets`, {
        seatIds: selectedBlockSeats,
        email: inviteForm.email,
        name: inviteForm.name,
      });
      toast.success(lang === 'es' ? '¡Invitación enviada con éxito por correo!' : 'Complimentary tickets issued and sent successfully!');
      setInviteForm({ name: '', email: '' });
      setSelectedBlockSeats([]);
      await loadEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error issuing free tickets');
    } finally {
      setBlockingActionLoading(false);
    }
  };

  const handleSaveReminderSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put(`/orders/event/${id}/reminder-settings`, {
        autoReminderEnabled,
        autoReminderDays,
        autoReminderMessage: autoReminderMessage.trim() || undefined,
      });
      toast.success(
        lang === 'es'
          ? '✅ Configuración de recordatorios guardada con éxito'
          : '✅ Reminder settings saved successfully'
      );
      await loadEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error al guardar recordatorios' : 'Error saving reminders'));
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendReminder = async () => {
    if (!event) return;
    setSendingReminder(true);
    try {
      const result = await api.post(`/orders/event/${id}/send-reminder`, {
        daysUntilEvent: reminderDays,
        customMessage: reminderMessage.trim() || undefined,
      });
      toast.success(
        lang === 'es'
          ? `✅ Recordatorios enviados a ${result.data.sent} asistentes`
          : `✅ Reminders sent to ${result.data.sent} attendees`
      );
      setShowReminderModal(false);
      setReminderMessage('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error al enviar recordatorios' : 'Error sending reminders'));
    } finally {
      setSendingReminder(false);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.category) {
      toast.error(lang === 'es' ? 'Selecciona una categoría antes de guardar' : 'Select a category before saving');
      return;
    }
    setSavingEdit(true);
    try {
      // 1. Save text fields
      await api.patch(`/events/${id}`, {
        title: editForm.title,
        description: editForm.description,
        venueName: editForm.venueName,
        venueAddress: editForm.venueAddress,
        eventDate: buildLocalEventDate(editForm.eventDate, editForm.eventTime, editForm.eventTimezone),
        eventTimezone: editForm.eventTimezone,
        category: editForm.category,
        hasSeatMap: true,
        bannerPosition: editForm.bannerPosition,
        maxTicketsPerTransaction: editForm.maxTicketsPerTransaction ? Number(editForm.maxTicketsPerTransaction) : 10,
      });

      // 2. Upload cover image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await api.post(`/events/${id}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 3. Upload banner image if selected
      if (bannerFile) {
        const formData = new FormData();
        formData.append('image', bannerFile);
        await api.post(`/events/${id}/image/banner`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setImageFile(null);
      setBannerFile(null);
      
      const isAutoApproved = user?.role === 'admin' || event?.status === 'draft';
      const successMsg = isAutoApproved 
        ? (lang === 'es' ? '¡Cambios guardados y publicados con éxito!' : 'Changes saved and published successfully!')
        : (lang === 'es' ? '¡Cambios guardados! Debes esperar la aprobación del administrador.' : 'Changes saved! Waiting for admin approval.');
      
      toast.success(successMsg);
      await loadEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm(lang === 'es' ? '¿Estás seguro de que quieres eliminar esta imagen?' : 'Are you sure you want to delete this image?')) return;
    try {
      await api.delete(`/events/${id}/image`);
      toast.success(lang === 'es' ? 'Imagen eliminada' : 'Image deleted');
      await loadEvent();
    } catch (err: any) {
      toast.error(lang === 'es' ? 'Error al eliminar la imagen' : 'Error deleting image');
    }
  };

  const handleDeleteBanner = async () => {
    if (!confirm(lang === 'es' ? '¿Estás seguro de que quieres eliminar el banner?' : 'Are you sure you want to delete the banner?')) return;
    try {
      await api.delete(`/events/${id}/image/banner`);
      toast.success(lang === 'es' ? 'Banner eliminado' : 'Banner deleted');
      await loadEvent();
    } catch (err: any) {
      toast.error(lang === 'es' ? 'Error al eliminar el banner' : 'Error deleting banner');
    }
  };

  const exportCSV = () => {
    const csv = [
      `${t('orgAttendeeName')},${t('orgAttendeeEmail')},${t('orgAttendeeSection')},${t('orgAttendeeRow')},${t('orgAttendeeSeat')},${t('orgAttendeeCode')},${t('orgAttendeeStatus')}`,
      ...attendees.map((a) =>
        `${a.user?.firstName} ${a.user?.lastName},${a.user?.email},${a.sectionName},${a.rowLabel},${a.seatNumber},${a.ticketCode},${a.status}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendees-${event?.title || id}.csv`;
    a.click();
  };

  const exportSalesCSV = () => {
    if (!sales?.orders) return;
    const csv = [
      lang === 'es' ? 'Cliente,Email,Cantidad Boletos,Total Pagado,Fecha' : 'Client,Email,Ticket Count,Total Paid,Date',
      ...sales.orders.map((o: any) =>
        `"${o.user?.firstName || ''} ${o.user?.lastName || ''}","${o.user?.email || ''}",${o.ticketCount},"${Number(o.total).toFixed(2)}","${format(parseSafeDate(o.paidAt || o.createdAt), 'yyyy-MM-dd HH:mm')}"`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ventas-${event?.title || id}.csv`;
    a.click();
  };

  const dateFnsLocale = lang === 'es' ? es : enUS;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return { label: t('orgPublished'), classes: 'bg-green-100 text-green-700' };
      case 'draft': return { label: t('orgDraft'), classes: 'bg-yellow-100 text-yellow-700' };
      case 'pending_approval': return { label: t('orgPending'), classes: 'bg-[rgba(10,55,90,0.10)] text-[#0A375A]' };
      default: return { label: status, classes: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading || !event) {
    return (
      <div className="premium-shell p-6 lg:p-8 space-y-4">
        <div className="h-6 skeleton rounded w-1/4 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
        <div className="h-64 skeleton rounded-xl" />
      </div>
    );
  }

  const badge = getStatusBadge(event.status);
  const catInfo = getCategoryInfo(event.category);
  const catLabel = catInfo ? (lang === 'en' ? catInfo.labelEn : catInfo.labelEs) : event.category;

  const salesOrders = ((sales?.orders || []) as any[]);
  const complimentaryOrders = salesOrders.filter((order: any) => Number(order.total || 0) === 0 && Number(order.ticketCount || 0) > 0);
  const totalRevenue = Number(sales?.totalRevenue || 0);
  const totalOrders = Number(sales?.totalOrders || salesOrders.length || 0);
  const totalTickets = Number(sales?.totalTickets || attendees.length || 0);

  // Map each sold seat to its buyer name so the seat map can show it on hover.
  const seatBuyers = attendees.reduce<Record<string, string>>((map, a) => {
    if (!a.sectionName || a.rowLabel == null || a.seatNumber == null) return map;
    if (a.status === 'cancelled') return map;
    const name = `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim();
    if (!name) return map;
    map[`${a.sectionName}|${a.rowLabel}|${a.seatNumber}`.toLowerCase()] = name;
    return map;
  }, {});

  const scannedTickets = attendees.filter((a) => a.status === 'used').length;
  const pendingTickets = attendees.filter((a) => a.status === 'active').length;
  const cancelledTickets = attendees.filter((a) => a.status === 'cancelled').length;
  const totalEventCapacity = sections.reduce((sum, section) => {
    const sectionType = String(section.sectionType || '').toLowerCase();

    if (sectionType === 'stage' || sectionType === 'decor') {
      return sum;
    }

    if (sectionType === 'standing') {
      return sum + (Number(section.capacity) || 100);
    }

    const realSeatCount = Array.isArray(section.seats) ? section.seats.length : 0;
    if (realSeatCount > 0) {
      return sum + realSeatCount;
    }

    return sum + (Number(section.rows || 0) * Number(section.seatsPerRow || 0));
  }, 0);
  const remainingEventCapacity = Math.max(totalEventCapacity - totalTickets, 0);
  const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const scanRate = totalTickets > 0 ? Math.round((scannedTickets / totalTickets) * 100) : 0;
  const estimatedNetRevenue = Math.max(totalRevenue - (totalRevenue * 0.029) - (totalOrders * 0.30), 0);
  const formatSectionAnalyticsLabel = (sectionName: string) => {
    const cleanName = String(sectionName || '').trim();
    if (/^\d+$/.test(cleanName)) return lang === 'es' ? `Mesa ${cleanName}` : `Table ${cleanName}`;
    return cleanName || (lang === 'es' ? 'General' : 'General');
  };
  const analyticsTimezone = event.eventTimezone || 'America/Chicago';

  const rawSalesByDay = salesOrders.reduce<Record<string, { date: string; orders: number; tickets: number; revenue: number }>>((acc, order) => {
    const key = getDateKeyInTimezone(order.paidAt || order.createdAt, analyticsTimezone);
    if (!key) return acc;
    if (!acc[key]) acc[key] = { date: key, orders: 0, tickets: 0, revenue: 0 };
    acc[key].orders += 1;
    acc[key].tickets += Number(order.ticketCount || 0);
    acc[key].revenue += Number(order.subtotal ?? order.total ?? 0);
    return acc;
  }, {});

  const today = new Date();
  const recentDayKeys = Array.from({ length: 3 }).map((_, index) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (2 - index));
    return getDateKeyInTimezone(d, analyticsTimezone);
  });

  const salesByDay = recentDayKeys.map((date) => (
    rawSalesByDay[date] || { date, orders: 0, tickets: 0, revenue: 0 }
  ));


  const salesBySection = Object.values(
    attendees.reduce<Record<string, { section: string; tickets: number; scanned: number; pending: number }>>((acc, attendee) => {
      const key = attendee.sectionName || (lang === 'es' ? 'General' : 'General');
      if (!acc[key]) acc[key] = { section: key, tickets: 0, scanned: 0, pending: 0 };
      acc[key].tickets += 1;
      if (attendee.status === 'used') acc[key].scanned += 1;
      if (attendee.status === 'active') acc[key].pending += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.tickets - a.tickets);

  const exportAnalyticsCSV = () => {
    const rows = [
      [lang === 'es' ? 'Métrica' : 'Metric', lang === 'es' ? 'Valor' : 'Value'],
      [lang === 'es' ? 'Ingresos brutos' : 'Gross revenue', totalRevenue.toFixed(2)],
      [lang === 'es' ? 'Ingreso neto estimado' : 'Estimated net revenue', estimatedNetRevenue.toFixed(2)],
      [lang === 'es' ? 'Órdenes' : 'Orders', String(totalOrders)],
      [lang === 'es' ? 'Tickets vendidos' : 'Tickets sold', String(totalTickets)],
      [lang === 'es' ? 'Tickets escaneados' : 'Scanned tickets', String(scannedTickets)],
      [lang === 'es' ? 'Asistentes pendientes' : 'Pending attendees', String(pendingTickets)],
      [lang === 'es' ? 'Cancelados' : 'Cancelled', String(cancelledTickets)],
      [lang === 'es' ? 'Promedio por orden' : 'Average order', averageOrder.toFixed(2)],
      [],
      [lang === 'es' ? 'Ventas por día' : 'Sales by day'],
      [lang === 'es' ? 'Fecha' : 'Date', lang === 'es' ? 'Órdenes' : 'Orders', lang === 'es' ? 'Tickets' : 'Tickets', lang === 'es' ? 'Ingresos' : 'Revenue'],
      ...salesByDay.map((day) => [day.date, String(day.orders), String(day.tickets), day.revenue.toFixed(2)]),
      [],
      [lang === 'es' ? 'Tickets por sección' : 'Tickets by section'],
      [lang === 'es' ? 'Sección' : 'Section', lang === 'es' ? 'Tickets' : 'Tickets', lang === 'es' ? 'Escaneados' : 'Scanned', lang === 'es' ? 'Pendientes' : 'Pending'],
      ...salesBySection.map((section) => [formatSectionAnalyticsLabel(section.section), String(section.tickets), String(section.scanned), String(section.pending)]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `analytics-${event?.title || id}.csv`;
    a.click();
  };

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Back & Header */}
      <div>
        <Link href="/organizer/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500 transition-colors mb-3">
          <HiOutlineArrowLeft className="w-4 h-4" />
          {t('orgMyEvents')}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="premium-page-title font-black text-2xl">{event.title}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[1.5rem] border border-gray-200 bg-white/85 p-2 shadow-sm backdrop-blur sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-2 gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><HiOutlineCalendar className="w-4 h-4" /> {formatDateInTimezone(event.eventDate, event.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}{event.eventTimezone && <span className="text-gray-400 ml-1">({getTimezoneAbbr(event.eventTimezone, event.eventDate)})</span>}</span>
              <span className="flex items-center gap-1"><HiOutlineLocationMarker className="w-4 h-4" /> {event.venueName}</span>
              <span className="flex items-center gap-1">{catInfo?.icon || '🎫'} {catLabel}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {event.status === 'draft' && (
              <button onClick={handlePublish} className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5">
                <HiOutlineGlobe className="w-4 h-4" /> {t('orgSendApproval')}
              </button>
            )}
            <button onClick={handleDelete} className="btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 !text-red-600 !border-red-300 hover:!bg-red-50">
              <HiOutlineTrash className="w-4 h-4" /> {t('orgDeleteEvent')}
            </button>
          </div>
        </div>
      </div>



      {/* Event Submission Notice */}
      {event.status === 'pending_approval' && (
        <div className="p-4 bg-[rgba(10,55,90,0.06)] border border-[rgba(10,55,90,0.18)] rounded-2xl flex items-start gap-3 text-sm text-[#0A375A] shadow-sm animate-fade-in">
          <span className="text-lg">✨</span>
          <div className="space-y-1">
            <p className="font-bold text-[#0A375A]">{lang === 'es' ? 'Evento en espera de aprobación' : 'Event pending approval'}</p>
            <p className="text-xs text-[#0A375A] leading-relaxed">
              {lang === 'es' 
                ? 'Este evento ha sido enviado al administrador para su aprobación. Se publicará automáticamente en la plataforma una vez sea autorizado por el administrador.'
                : 'This event has been submitted to the administrator for approval. It will be automatically published on the platform once authorized.'}
            </p>
          </div>
        </div>
      )}

      {/* Pending Changes Notice */}
      {user?.role !== 'admin' && (event.pendingTitle || event.pendingDescription || event.pendingImageUrl || event.pendingBannerImageUrl || event.pendingVenueName || event.pendingCategory || event.pendingEventDate) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-sm text-amber-800 shadow-sm animate-fade-in">
          <span className="text-lg">⏳</span>
          <div className="space-y-1">
            <p className="font-bold text-amber-900">{lang === 'es' ? 'Cambios en espera de aprobación' : 'Edits pending admin approval'}</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              {lang === 'es' 
                ? 'Has guardado cambios en la información o imágenes de este evento. El administrador debe aprobarlos individualmente antes de que se actualicen públicamente. Mientras tanto, el evento sigue visible con su información original.'
                : 'You have updated information or images for this event. The administrator must approve the edits before they become public. Until approved, the event remains visible with its original details.'}
            </p>
          </div>
        </div>
      )}


      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-[1.35rem] border border-gray-200 bg-white/90 p-1.5 shadow-sm backdrop-blur sm:grid-cols-3 lg:grid-cols-4">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'analytics' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <HiOutlineChartBar className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
          <span className="min-w-0 truncate">{lang === 'es' ? 'Analíticas' : 'Analytics'}</span>
        </button>
        <button
          onClick={() => setActiveTab('details')}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'details' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <HiOutlinePencil className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
          <span className="min-w-0 truncate">{lang === 'es' ? 'Detalles e Imágenes' : 'Details & Media'}</span>
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'overview' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <span className="min-w-0 truncate">{t('orgSections')}</span>
        </button>
        <button
          onClick={() => setActiveTab('attendees')}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'attendees' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <HiOutlineUsers className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
          <span className="min-w-0 truncate">{lang === 'es' ? 'Asistentes y Ventas' : 'Attendees & Sales'}</span>
          {attendees.length > 0 && <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-[#F97316] sm:text-xs">{attendees.length} / {sales?.orders?.length || 0}</span>}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'map' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <HiOutlineMap className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
          <span className="min-w-0 truncate">{lang === 'es' ? 'Mapa Visual' : 'Venue Map'}</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('blocks');
            setSelectedBlockSection('');
            setSelectedBlockSeats([]);
          }}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'blocks' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <HiOutlineBan className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
          <span className="hidden min-w-0 truncate sm:inline">{lang === 'es' ? 'Bloqueos e Invitaciones' : 'Blocks & Invitations'}</span>
          <span className="min-w-0 truncate sm:hidden">{lang === 'es' ? 'Bloqueos' : 'Blocks'}</span>
        </button>
        <button
          onClick={() => setActiveTab('commission')}
          className={`group relative flex min-h-[48px] w-full min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-center text-[13px] font-extrabold leading-tight shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] sm:min-h-[46px] sm:px-3 sm:text-sm ${activeTab === 'commission' ? 'border-[#F97316] bg-orange-50 text-[#F97316] shadow-md shadow-orange-500/10' : 'border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:bg-orange-50/80 hover:text-[#F97316] hover:shadow-md'}`}
        >
          <HiOutlineCurrencyDollar className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
          <span className="min-w-0 truncate">{lang === 'es' ? 'Recompensas' : 'Rewards'}</span>
          {(Number(event.pendingCreatorCommission) > 0) && (
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          )}
          {(Number(event.creatorCommission) > 0 && event.pendingCreatorCommission == null) && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          )}
        </button>
      </div>

      {/* Event Analytics Tab */}
      {activeTab === 'analytics' && sales && (
        <div className="space-y-5 animate-fade-in">
          <div className="overflow-hidden rounded-2xl border border-[rgba(10,55,90,0.10)] bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-gray-100 bg-gradient-to-r from-[#0A375A] to-[#0A375A] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-orange-300">
                  {lang === 'es' ? 'Analytics del evento' : 'Event analytics'}
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {lang === 'es' ? 'Rendimiento en vivo' : 'Live performance'}
                </h2>
                <p className="mt-1 text-xs font-semibold text-white/70">
                  {lang === 'es' ? 'Ventas, acceso, asistentes y comportamiento por sección.' : 'Sales, access, attendees and section performance.'}
                </p>
              </div>
              <button
                onClick={exportAnalyticsCSV}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-black/10 transition hover:bg-[#EA6C10]"
              >
                <HiOutlineDownload className="h-4 w-4" />
                {lang === 'es' ? 'Export premium' : 'Premium export'}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                {
                  label: lang === 'es' ? 'Ingresos brutos' : 'Gross revenue',
                  value: `$${totalRevenue.toFixed(2)}`,
                  note: `${totalOrders} ${lang === 'es' ? 'órdenes' : 'orders'}`,
                  icon: HiOutlineCurrencyDollar,
                },
                {
                  label: lang === 'es' ? 'Neto estimado' : 'Estimated net',
                  value: `$${estimatedNetRevenue.toFixed(2)}`,
                  note: lang === 'es' ? 'después de fee estimado' : 'after estimated fees',
                  icon: HiOutlineChartBar,
                },
                {
                  label: lang === 'es' ? 'Tickets vendidos' : 'Tickets sold',
                  value: String(totalTickets),
                  note: `$${averageOrder.toFixed(2)} ${lang === 'es' ? 'promedio/orden' : 'avg/order'}`,
                  icon: HiOutlineTicket,
                },
                {
                  label: lang === 'es' ? 'Entrada escaneada' : 'Entry scanned',
                  value: `${scanRate}%`,
                  note: `${scannedTickets} ${lang === 'es' ? 'escaneados' : 'scanned'} · ${pendingTickets} ${lang === 'es' ? 'pendientes' : 'pending'}`,
                  icon: HiOutlineCheckCircle,
                },
                {
                  label: lang === 'es' ? 'Capacidad total' : 'Total capacity',
                  value: String(totalEventCapacity),
                  note: `${remainingEventCapacity} ${lang === 'es' ? 'por vender o asignar' : 'left to sell or assign'}`,
                  icon: HiOutlineUsers,
                },
              ].map((card) => (
                <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{card.label}</p>
                      <p className="mt-2 text-2xl font-black text-[#0A375A]">{card.value}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">{card.note}</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(249,115,22,0.12)] text-[#0A375A]">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <div className="premium-section-card p-5 transition-all">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900">{lang === 'es' ? 'Ventas por día' : 'Sales by day'}</h3>
                  <p className="text-xs font-semibold text-gray-500">{lang === 'es' ? 'Órdenes, tickets e ingresos diarios' : 'Daily orders, tickets and revenue'}</p>
                </div>
                <HiOutlineCalendar className="h-5 w-5 text-[#F97316]" />
              </div>

              {salesByDay.length > 0 ? (
                <div className="space-y-3">
                  {salesByDay.map((day) => {
                    const maxRevenue = Math.max(...salesByDay.map((d) => d.revenue), 1);
                    return (
                      <div key={day.date}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-700">{formatDateKeyLabel(day.date, dateFnsLocale)}</span>
                          <span className="font-black text-[#0A375A]">${day.revenue.toFixed(2)}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${Math.max(6, (day.revenue / maxRevenue) * 100)}%` }} />
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-gray-500">
                          {day.orders} {lang === 'es' ? 'órdenes' : 'orders'} · {day.tickets} tickets
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-500">
                  {lang === 'es' ? 'Aún no hay ventas para graficar.' : 'No sales to chart yet.'}
                </div>
              )}
            </div>

            <div className="premium-section-card p-5 transition-all">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-gray-900">{lang === 'es' ? 'Tickets por sección' : 'Tickets by section'}</h3>
                  <p className="text-xs font-semibold text-gray-500">{lang === 'es' ? 'Vendido, escaneado y pendiente por área' : 'Sold, scanned and pending by area'}</p>
                </div>
                <HiOutlineUsers className="h-5 w-5 text-[#F97316]" />
              </div>

              {salesBySection.length > 0 ? (
                <div className="space-y-3">
                  {salesBySection.slice(0, 8).map((section) => {
                    const maxTickets = Math.max(...salesBySection.map((item) => item.tickets), 1);
                    return (
                      <div key={section.section} className="rounded-lg border border-[rgba(10,55,90,0.10)] bg-white p-3 shadow-sm">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <span className="truncate text-xs font-black text-gray-800">{formatSectionAnalyticsLabel(section.section)}</span>
                          <span className="text-xs font-black text-[#0A375A]">{section.tickets} tickets</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white">
                          <div className="h-full rounded-full bg-[#0A375A]" style={{ width: `${Math.max(8, (section.tickets / maxTickets) * 100)}%` }} />
                        </div>
                        <p className="mt-2 text-[11px] font-semibold text-gray-500">
                          {section.scanned} {lang === 'es' ? 'escaneados' : 'scanned'} · {section.pending} {lang === 'es' ? 'pendientes' : 'pending'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm font-semibold text-gray-500">
                  {lang === 'es' ? 'Aún no hay tickets por sección.' : 'No section ticket data yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Sections Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.length > 0 ? sections.map((sec) => (
            <div key={sec.id} className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopWidth: 4, borderTopColor: sec.color }}>
              <h3 className="font-bold text-gray-900 mb-2">{sec.sectionType === 'table' ? `${lang === 'es' ? 'Mesa' : 'Table'} ${sec.name}` : sec.name}</h3>
              <div className="space-y-1 text-sm text-gray-600">
                <p>{t('orgSectionType')}: <span className="font-medium text-gray-800 capitalize">{sec.sectionType}</span></p>
                <p>{t('orgCapacity')}: <span className="font-medium text-gray-800">{sec.capacity || sec.rows * sec.seatsPerRow}</span></p>
                <p>{t('orgRows')}: <span className="font-medium text-gray-800">{sec.rows}</span> · {t('orgSeatsPerRow')}: <span className="font-medium text-gray-800">{sec.seatsPerRow}</span></p>
                <p className="text-lg font-bold text-primary-600 pt-1">${Number(sec.price).toFixed(2)}</p>
              </div>
            </div>
          )) : (
            <div className="col-span-full text-center py-8 text-gray-500 text-sm">
              {lang === 'es' ? 'No hay secciones creadas para este evento' : 'No sections created for this event'}
            </div>
          )}
        </div>
      )}

      {/* Map Builder Tab */}
      {activeTab === 'map' && (
        <VenueMapBuilder
          eventId={id}
          initialSections={sections}
          event={event}
          isAdmin={user?.role === 'admin'}
          seatBuyers={seatBuyers}
          onSaved={handleMapSaved}
          onChange={handleMapChange}
        />
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-4xl p-6 sm:p-8 space-y-6 animate-fade-in mt-4 sm:mt-8 mb-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <HiOutlineBell className="w-6 h-6 text-[#F97316]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xl text-gray-900">
                    {lang === 'es' ? 'Gestión de Recordatorios' : 'Reminder Management'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {lang === 'es' 
                      ? 'Configura el envío automático o envía notificaciones por correo de forma manual a tus asistentes' 
                      : 'Configure automated dispatch or send email notifications manually to your attendees'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowReminderModal(false)} 
                className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
              
              {/* Left Column: Automated Reminder Configuration */}
              <div className="space-y-6 lg:pr-4 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-orange-50 text-[#F97316] font-black text-[10px] uppercase tracking-wider">
                      {lang === 'es' ? 'Automático' : 'Automated'}
                    </span>
                    <h4 className="font-black text-sm text-gray-800 uppercase tracking-wider">
                      {lang === 'es' ? 'Configurar Envío Programado' : 'Schedule Auto Reminder'}
                    </h4>
                  </div>

                  {/* State Toggle */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      {lang === 'es' ? 'Estado del Recordatorio Automático' : 'Automated Reminder Status'}
                    </label>
                    <div className="flex items-center gap-3 bg-gray-50/50 border border-gray-100 rounded-2xl p-4">
                      <input
                        type="checkbox"
                        id="autoReminderEnabled"
                        checked={autoReminderEnabled}
                        onChange={(e) => setAutoReminderEnabled(e.target.checked)}
                        className="w-5 h-5 accent-orange-500 cursor-pointer rounded-lg font-bold"
                      />
                      <label htmlFor="autoReminderEnabled" className="text-sm font-black text-gray-800 cursor-pointer select-none">
                        {autoReminderEnabled 
                          ? (lang === 'es' ? '🟢 Activado' : '🟢 Activated') 
                          : (lang === 'es' ? '🔴 Desactivado' : '🔴 Deactivated')}
                      </label>
                    </div>
                  </div>

                  {/* Dropdown days/hours before */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      {lang === 'es' ? '¿Cuándo se enviará?' : 'When will it be sent?'}
                    </label>
                    <select
                      value={autoReminderDays}
                      onChange={(e) => setAutoReminderDays(Number(e.target.value))}
                      disabled={!autoReminderEnabled}
                      className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <optgroup label={lang === 'es' ? 'Horas antes' : 'Hours before'}>
                        <option value={-1}>{lang === 'es' ? '1 hora antes del evento' : '1 hour before the event'}</option>
                        <option value={-2}>{lang === 'es' ? '2 horas antes del evento' : '2 hours before the event'}</option>
                        <option value={-3}>{lang === 'es' ? '3 horas antes del evento' : '3 hours before the event'}</option>
                        <option value={-6}>{lang === 'es' ? '6 horas antes del evento' : '6 hours before the event'}</option>
                        <option value={-12}>{lang === 'es' ? '12 horas antes del evento' : '12 hours before the event'}</option>
                      </optgroup>
                      <optgroup label={lang === 'es' ? 'Días antes' : 'Days before'}>
                        <option value={0}>{lang === 'es' ? 'El mismo día del evento (0 días)' : 'Same day of the event (0 days)'}</option>
                        <option value={1}>{lang === 'es' ? '1 día antes' : '1 day before'}</option>
                        <option value={3}>{lang === 'es' ? '3 días antes' : '3 days before'}</option>
                        <option value={7}>{lang === 'es' ? '7 días antes' : '7 days before'}</option>
                        <option value={14}>{lang === 'es' ? '14 días antes' : '14 days before'}</option>
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-gray-400">
                      {autoReminderDays < 0
                        ? (lang === 'es' ? `⚡ El correo dirá: ¡El evento empieza en ${Math.abs(autoReminderDays)} hora(s)!` : `⚡ Email will say: The event starts in ${Math.abs(autoReminderDays)} hour(s)!`)
                        : autoReminderDays === 0 
                          ? (lang === 'es' ? '⚡ El correo dirá: ¡HOY ES EL EVENTO!' : '⚡ Email will say: TODAY IS THE EVENT!') 
                          : autoReminderDays === 1 
                            ? (lang === 'es' ? '📅 El correo dirá: ¡MAÑANA ES EL EVENTO!' : '📅 Email will say: TOMORROW IS THE EVENT!')
                            : (lang === 'es' ? `📅 El correo dirá: Faltan ${autoReminderDays} días para el evento` : `📅 Email will say: ${autoReminderDays} days until the event`)}
                    </p>
                  </div>

                  {/* Message Custom */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      {lang === 'es' ? 'Mensaje Personalizado Opcional' : 'Optional Custom Message'}
                    </label>
                    <textarea
                      value={autoReminderMessage}
                      onChange={(e) => setAutoReminderMessage(e.target.value)}
                      disabled={!autoReminderEnabled}
                      placeholder={lang === 'es' ? 'Ej: Recuerda traer ropa abrigada...' : 'E.g: Remember to wear warm clothes...'}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white h-20 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                </div>

                {/* Save settings Button */}
                <button
                  onClick={handleSaveReminderSettings}
                  disabled={savingSettings}
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-black py-3 px-6 rounded-lg transition-all shadow-sm disabled:opacity-60"
                >
                  {savingSettings ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {lang === 'es' ? 'Guardando...' : 'Saving...'}</>
                  ) : (
                    <>{lang === 'es' ? 'Guardar Configuración Automática' : 'Save Automated Configuration'}</>
                  )}
                </button>
              </div>

              {/* Right Column: Send Manual Reminder Now */}
              <div className="space-y-6 pt-6 lg:pt-0 lg:pl-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-orange-50 text-[#F97316] font-black text-[10px] uppercase tracking-wider">
                      {lang === 'es' ? 'Manual' : 'Manual'}
                    </span>
                    <h4 className="font-black text-sm text-gray-800 uppercase tracking-wider">
                      {lang === 'es' ? 'Enviar Notificación Inmediata' : 'Send Immediate Notification'}
                    </h4>
                  </div>

                  <div className="bg-orange-50/70 border border-[rgba(249,115,22,0.22)]/50 rounded-2xl p-4 text-sm text-orange-900 space-y-2">
                    <p className="font-extrabold flex items-center gap-2">
                      <span>📢</span>
                      <span>{event?.title}</span>
                    </p>
                    <p className="text-xs text-orange-700">
                      {lang === 'es'
                        ? `Se enviará un recordatorio manual de forma inmediata a los asistentes con entradas activas (${attendees.length} ticket${attendees.length !== 1 ? 's' : ''}).`
                        : `Will send a manual reminder immediately to all active ticket holders (${attendees.length} ticket${attendees.length !== 1 ? 's' : ''}).`}
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                        {lang === 'es' ? '¿Qué mostrará el correo?' : 'What will the email show?'}
                      </label>
                      <select
                        value={reminderDays}
                        onChange={(e) => setReminderDays(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-[rgba(249,115,22,0.28)] rounded-2xl text-sm font-bold focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                      >
                        <optgroup label={lang === 'es' ? 'Horas antes' : 'Hours before'}>
                          <option value={-1}>{lang === 'es' ? '1 hora antes del evento' : '1 hour before the event'}</option>
                          <option value={-2}>{lang === 'es' ? '2 horas antes del evento' : '2 hours before the event'}</option>
                          <option value={-3}>{lang === 'es' ? '3 horas antes del evento' : '3 hours before the event'}</option>
                          <option value={-6}>{lang === 'es' ? '6 horas antes del evento' : '6 hours before the event'}</option>
                          <option value={-12}>{lang === 'es' ? '12 horas antes del evento' : '12 hours before the event'}</option>
                        </optgroup>
                        <optgroup label={lang === 'es' ? 'Días antes' : 'Days before'}>
                          <option value={0}>{lang === 'es' ? 'El mismo día del evento' : 'Same day of the event'}</option>
                          <option value={1}>{lang === 'es' ? '1 día antes' : '1 day before'}</option>
                          <option value={3}>{lang === 'es' ? '3 días antes' : '3 days before'}</option>
                          <option value={7}>{lang === 'es' ? '7 días antes' : '7 days before'}</option>
                          <option value={14}>{lang === 'es' ? '14 días antes' : '14 days before'}</option>
                        </optgroup>
                      </select>
                      <p className="text-[10px] text-[#F97316]">
                        {reminderDays < 0
                          ? (lang === 'es' ? `⚡ El correo dirá: Faltan ${Math.abs(reminderDays)} hora(s) para el evento` : `⚡ Email will say: ${Math.abs(reminderDays)} hour(s) until the event`)
                          : reminderDays === 0
                            ? (lang === 'es' ? '⚡ El correo dirá: ¡Hoy es el gran día del evento!' : '⚡ Email will say: Today is the big day!')
                            : reminderDays === 1
                              ? (lang === 'es' ? '📅 El correo dirá: ¡Mañana es el evento!' : '📅 Email will say: Tomorrow is the event!')
                              : (lang === 'es' ? `📅 El correo dirá: Faltan ${reminderDays} días para el evento` : `📅 Email will say: ${reminderDays} days until the event`)}
                      </p>
                    </div>
                  </div>

                  {/* Message Custom */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                      {lang === 'es' ? 'Mensaje Personalizado (opcional)' : 'Custom message (optional)'}
                    </label>
                    <textarea
                      value={reminderMessage}
                      onChange={(e) => setReminderMessage(e.target.value)}
                      placeholder={lang === 'es' ? 'Ej: Recuerda traer ropa abrigada...' : 'E.g: Remember to wear warm clothes...'}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white h-20 resize-none"
                    />
                  </div>
                </div>

                {/* Send button */}
                <button
                  onClick={handleSendReminder}
                  disabled={sendingReminder || attendees.length === 0}
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#F97316] text-white text-xs font-black py-3 px-6 rounded-lg transition-all shadow-md shadow-orange-500/10 disabled:opacity-60"
                >
                  {sendingReminder ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {lang === 'es' ? 'Enviando...' : 'Sending...'}</>
                  ) : (
                    <><HiOutlineMail className="w-4 h-4" /> {lang === 'es' ? 'Enviar Recordatorio Manual Ahora' : 'Send Manual Reminder Now'}</>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Attendees & Sales Tab */}
      {activeTab === 'attendees' && (
        <div className="space-y-8">
          {/* Attendees Section */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <HiOutlineUsers className="w-5 h-5 text-primary-500" />
                  {lang === 'es' ? 'Lista de Asistentes' : 'Attendee List'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(() => {
                    const uniqueEmails = new Set(attendees.map(a => a.user?.email)).size;
                    return lang === 'es'
                      ? `${uniqueEmails} ${uniqueEmails === 1 ? 'comprador' : 'compradores'} · ${attendees.length} tickets`
                      : `${uniqueEmails} ${uniqueEmails === 1 ? 'buyer' : 'buyers'} · ${attendees.length} tickets`;
                  })()}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA6C10] text-white text-xs font-bold py-1.5 px-3 rounded-lg transition-all shadow-sm"
                  title={lang === 'es' ? 'Enviar recordatorio por email a los asistentes' : 'Send email reminder to attendees'}
                >
                  <HiOutlineBell className="w-4 h-4" />
                  {lang === 'es' ? 'Enviar Recordatorio' : 'Send Reminder'}
                </button>
                <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <HiOutlineDownload className="w-4 h-4" />
                  {t('orgExportCSV')}
                </button>
                <button onClick={exportSalesCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <HiOutlineDownload className="w-4 h-4" />
                  {lang === 'es' ? 'Exportar Ventas' : 'Export Sales'}
                </button>
              </div>
            </div>
            
            {attendees.length > 0 ? (() => {
              // Group attendees by email
              const grouped: Record<string, { name: string; email: string; tickets: Attendee[]; totalSpent: number; orderCount: number }> = {};
              attendees.forEach((a) => {
                const email = a.user?.email || 'unknown';
                if (!grouped[email]) {
                  grouped[email] = {
                    name: `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim(),
                    email,
                    tickets: [],
                    totalSpent: 0,
                    orderCount: 0,
                  };
                }
                grouped[email].tickets.push(a);
              });

              // Enrich with order totals
              if (sales?.orders) {
                sales.orders.forEach((o: any) => {
                  const email = o.user?.email || 'unknown';
                  if (grouped[email]) {
                    grouped[email].totalSpent += Number(o.subtotal ?? o.total ?? 0);
                    grouped[email].orderCount += 1;
                  }
                });
              }

              const groupedEntries = Object.values(grouped).sort((a, b) => b.tickets.length - a.tickets.length);
              const selectedGroup = expandedAttendee ? grouped[expandedAttendee] : null;

              return (
                <>
                  <div className="divide-y divide-gray-100">
                    {groupedEntries.map((group) => {
                      const usedCount = group.tickets.filter(t => t.status === 'used').length;
                      const activeCount = group.tickets.filter(t => t.status === 'active').length;

                      return (
                        <button
                          key={group.email}
                          onClick={() => setExpandedAttendee(group.email)}
                          className="w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50/80 transition-colors text-left group"
                        >
                          {/* Avatar */}
                          <div className="shrink-0 w-9 h-9 rounded-full bg-[#0A375A] flex items-center justify-center text-white text-xs font-black uppercase">
                            {group.name.charAt(0)}{group.name.split(' ')[1]?.charAt(0) || ''}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{group.name}</p>
                            <p className="text-xs text-gray-500 truncate">{group.email}</p>
                          </div>

                          {/* Stats */}
                          <div className="shrink-0 flex items-center gap-3">
                            {group.totalSpent > 0 && (
                              <div className="text-right hidden sm:block">
                                <p className="text-sm font-black text-[#0A375A]">${group.totalSpent.toFixed(2)}</p>
                                <p className="text-[10px] text-gray-400 font-semibold">{group.orderCount} {group.orderCount === 1 ? 'orden' : (lang === 'es' ? '\u00f3rdenes' : 'orders')}</p>
                              </div>
                            )}
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-black text-gray-700">{group.tickets.length}</p>
                              <p className="text-[10px] text-gray-400 font-semibold">{group.tickets.length === 1 ? 'ticket' : 'tickets'}</p>
                            </div>
                            <div className="flex gap-1">
                              {activeCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-green-100 text-green-700 text-[10px] font-bold">
                                  {activeCount} {lang === 'es' ? 'act' : 'act'}
                                </span>
                              )}
                              {usedCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">
                                  {usedCount} {lang === 'es' ? 'esc' : 'used'}
                                </span>
                              )}
                            </div>
                            <span className="sm:hidden text-xs font-black text-[#0A375A]">{group.tickets.length}</span>
                            <HiOutlineChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Buyer Detail Modal — rendered via portal to escape overflow clipping */}
                  {selectedGroup && createPortal(
                    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
                      {/* Backdrop */}
                      <div 
                        className="absolute inset-0 bg-gray-950/40 backdrop-blur-md transition-opacity"
                        onClick={() => setExpandedAttendee(null)}
                      />
                      
                      {/* Centered Modal Panel */}
                      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col z-10 max-h-[85vh] overflow-hidden animate-[scaleIn_0.2s_ease-out]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-base shrink-0 uppercase">
                              {selectedGroup.name.charAt(0)}{selectedGroup.name.split(' ')[1]?.charAt(0) || ''}
                            </div>
                            <div>
                              <h2 className="font-bold text-base text-gray-900 leading-tight">{selectedGroup.name}</h2>
                              <p className="text-xs text-gray-500 mt-0.5">{selectedGroup.email}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setExpandedAttendee(null)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            <HiOutlineX className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                          {/* Stats Card */}
                          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3.5">
                            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Resumen de Compras' : 'Purchase Summary'}</h3>
                            
                            <div className="grid grid-cols-3 gap-3">
                              <div className="text-center">
                                <p className="text-2xl font-black text-gray-900">{selectedGroup.tickets.length}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Tickets</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-black text-gray-900">${selectedGroup.totalSpent.toFixed(2)}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{lang === 'es' ? 'Gastado' : 'Spent'}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-2xl font-black text-gray-900">{selectedGroup.tickets.filter(t => t.status === 'used').length}<span className="text-gray-300 font-bold">/{selectedGroup.tickets.length}</span></p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{lang === 'es' ? 'Escaneados' : 'Scanned'}</p>
                              </div>
                            </div>
                          </div>

                          {/* Tickets List */}
                          <div className="space-y-3">
                            <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">
                              {lang === 'es' ? `${selectedGroup.tickets.length} Entradas Compradas` : `${selectedGroup.tickets.length} Tickets Purchased`}
                            </h3>
                            
                            <div className="min-h-[120px] max-h-[340px] overflow-y-auto pr-1 select-none mt-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {selectedGroup.tickets.map((ticket) => (
                                  <div key={ticket.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-[0_4px_15px_rgba(0,0,0,0.015)] hover:border-gray-200 transition-all">
                                    <div className="min-w-0 space-y-1">
                                      <p className="font-bold text-xs text-gray-900 truncate">{ticket.sectionName}</p>
                                      <p className="text-[10px] text-gray-500">
                                        {lang === 'es' ? 'Asiento' : 'Seat'}: <span className="font-bold text-gray-700">{formatSeatLabel({ rowLabel: ticket.rowLabel, seatNumber: ticket.seatNumber }, undefined, lang)}</span>
                                      </p>
                                      <p className="text-[10px] font-mono text-primary-600 font-semibold">{ticket.ticketCode}</p>
                                    </div>
                                    <div className="text-right shrink-0 space-y-1.5">
                                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                        ticket.status === 'active' ? 'bg-green-100 text-green-700' :
                                        ticket.status === 'used' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {ticket.status === 'active' ? (lang === 'es' ? 'Activo' : 'Active') : ticket.status === 'used' ? (lang === 'es' ? 'Escaneado' : 'Scanned') : ticket.status}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
                          <button
                            onClick={() => setExpandedAttendee(null)}
                            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-sm cursor-pointer"
                          >
                            {lang === 'es' ? 'Cerrar' : 'Close'}
                          </button>
                        </div>
                      </div>
                    </div>
                  , document.body)}
                </>
              );
            })() : (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                {lang === 'es' ? 'No hay asistentes registrados' : 'No attendees registered'}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Blocks & Invitations Tab */}
      {activeTab === 'blocks' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-lg text-gray-900">{lang === 'es' ? 'Gestión de Bloqueos e Invitaciones' : 'Blocks & Free Invitations'}</h2>
              <p className="text-xs text-gray-500 mt-1">{lang === 'es' ? 'Selecciona una sección para bloquear mesas/sillas o enviar cortesías gratis' : 'Select a section to block seats or tables or send free complimentary tickets'}</p>
            </div>
            
            {/* Section Selector */}
            <div className="shrink-0">
              <select
                value={selectedBlockSection}
                onChange={(e) => {
                  setSelectedBlockSection(e.target.value);
                  setSelectedBlockSeats([]);
                }}
                className="w-full sm:w-64 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">{lang === 'es' ? 'Selecciona una sección...' : 'Select a section...'}</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.sectionType === 'table' ? `${lang === 'es' ? 'Mesa' : 'Table'} ${s.name}` : s.name} (${Number(s.price).toFixed(2)})</option>
                ))}
              </select>
            </div>
          </div>

          {(() => {
            const blockedSections = sections
              .map((section) => {
                const blockedSeats = (section.seats || []).filter((seat) => seat.status === 'locked' && !seat.lockExpiresAt);
                return { section, blockedSeats };
              })
              .filter((item) => item.blockedSeats.length > 0);

            if (blockedSections.length === 0) return null;

            return (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.22em] text-amber-800">
                    {lang === 'es' ? 'Mesas bloqueadas' : 'Blocked tables'}
                  </h3>
                  <p className="mt-1 text-xs text-amber-700">
                    {lang === 'es' ? 'Selecciona una mesa para verla y administrarla sin buscar en el selector.' : 'Select a table to open and manage it without searching the selector.'}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {blockedSections.map(({ section, blockedSeats }) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        setSelectedBlockSection(section.id);
                        setSelectedBlockSeats(blockedSeats.map((seat) => seat.id));
                      }}
                      className={`text-left rounded-xl border px-4 py-3 transition-all ${
                        selectedBlockSection === section.id
                          ? 'border-amber-500 bg-white shadow-sm'
                          : 'border-amber-200 bg-white/80 hover:border-amber-400 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-black text-sm text-gray-900 truncate">{section.sectionType === 'table' ? `${lang === 'es' ? 'Mesa' : 'Table'} ${section.name}` : section.name}</span>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
                          {blockedSeats.length}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-500">
                        {blockedSeats.length} {lang === 'es' ? 'asientos bloqueados' : 'blocked seats'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}


          {complimentaryOrders.length > 0 && (
            <div className="rounded-[26px] border border-orange-200/80 bg-white p-5 sm:p-6 shadow-[0_22px_55px_rgba(15,23,42,0.08)]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0A375A] text-base font-black text-white shadow-lg shadow-[#0A375A]/20">
                    LP
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-[#F97316]">
                      {lang === 'es' ? 'Cortesías enviadas' : 'Sent complimentary tickets'}
                    </p>
                    <h3 className="mt-1 text-2xl font-black leading-tight text-gray-950">
                      {lang === 'es' ? 'Entradas de invitación' : 'Invitation tickets'}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-gray-500">
                      {lang === 'es'
                        ? 'Consulta el recibo general y abre cada boleto digital enviado como cortesía.'
                        : 'Review the main receipt and open each digital ticket sent as a complimentary invitation.'}
                    </p>
                  </div>
                </div>

                <div className="grid min-w-[220px] grid-cols-1 rounded-2xl border border-orange-100 bg-orange-50/40 px-5 py-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-400">
                    {lang === 'es' ? 'Total cortesías' : 'Total comps'}
                  </p>
                  <p className="mt-1 text-4xl font-black leading-none text-[#0A375A]">
                    {complimentaryOrders.reduce((sum: number, order: any) => sum + Number(order.ticketCount || 0), 0)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {complimentaryOrders.map((order: any) => (
                  <div key={order.id} className="rounded-[22px] border border-gray-200 bg-gradient-to-br from-white to-slate-50/70 p-4 sm:p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(460px,auto)] xl:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="min-w-0 truncate text-xl font-black capitalize text-gray-950">
                            {order.user?.firstName} {order.user?.lastName}
                          </p>
                          <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">
                            $0.00
                          </span>
                        </div>

                        <p className="mt-2 max-w-full truncate text-sm font-semibold text-gray-500">
                          {order.user?.email}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                          <span className="inline-flex h-10 min-w-[150px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-[#0A375A]">
                            {order.ticketCount} {lang === 'es' ? 'entradas' : 'tickets'}
                          </span>
                          <span className="inline-flex h-10 min-w-[150px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-xs font-black text-gray-500">
                            {format(parseSafeDate(order.paidAt || order.createdAt), 'dd MMM yyyy')}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3 xl:justify-items-stretch">
                        <Link
                          href={`/orders/${order.id}/receipt`}
                          className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-[#F97316] bg-white px-4 text-sm font-black text-[#F97316] shadow-sm transition-all hover:bg-orange-50"
                        >
                          {lang === 'es' ? 'Recibo' : 'Receipt'}
                        </Link>

                        {(order.tickets || []).map((ticket: any, index: number) => (
                          <Link
                            key={ticket.id || ticket.ticketCode}
                            href={`/verify/${ticket.ticketCode}`}
                            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#0A375A] px-4 text-sm font-black text-white shadow-sm transition-all hover:bg-[#082b47]"
                          >
                            {lang === 'es' ? `Entrada ${index + 1}` : `Ticket ${index + 1}`}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedBlockSection ? (
            (() => {
              const sec = sections.find(s => s.id === selectedBlockSection);
              if (!sec) return null;
              const seats = sec.seats || [];
              
              return (
                <div className="space-y-6">
                  {/* Grid of seats */}
                  <div className="p-6 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col items-center">
                    <h3 className="font-bold text-xs text-gray-500 uppercase tracking-widest mb-4">{lang === 'es' ? 'Escenario / Stage' : 'Stage / Front'}</h3>
                    <div className="w-full max-w-md bg-gray-300 h-2 rounded-full mb-10" />
                    
                    <div className="flex justify-between items-center w-full mb-6 max-w-lg select-none">
                      <span className="text-xs font-semibold text-gray-500">
                        {lang === 'es' ? 'Haz clic en los asientos para seleccionarlos' : 'Click seats to select them'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const availableSeatIds = seats.filter(s => s.status !== 'sold').map(s => s.id);
                            setSelectedBlockSeats(availableSeatIds);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold bg-white border border-gray-200 hover:border-gray-300 rounded-lg text-gray-700 transition-colors shadow-sm cursor-pointer"
                        >
                          {sec.sectionType === 'table' 
                            ? (lang === 'es' ? '✓ Seleccionar Mesa Completa' : '✓ Select Entire Table') 
                            : (lang === 'es' ? '✓ Seleccionar Todos' : '✓ Select All')}
                        </button>
                        {selectedBlockSeats.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSelectedBlockSeats([])}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white border border-red-200 hover:border-red-300 text-red-600 rounded-lg transition-colors shadow-sm cursor-pointer"
                          >
                            {lang === 'es' ? '✕ Deseleccionar' : '✕ Deselect'}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid gap-3 justify-center" style={{ gridTemplateColumns: `repeat(${sec.seatsPerRow || 8}, minmax(0, 1fr))` }}>
                      {seats.map((seat) => {
                        const isBlocked = seat.status === 'locked' && !seat.lockExpiresAt;
                        const isSold = seat.status === 'sold';
                        const isSelected = selectedBlockSeats.includes(seat.id);
                        
                        let bgClass = 'bg-white border-gray-200 hover:border-blue-500 text-gray-700';
                        if (isBlocked) bgClass = 'bg-amber-100 border-amber-300 text-amber-800 font-bold';
                        if (isSold) bgClass = 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed';
                        if (isSelected) bgClass = 'bg-[#0A375A] border-blue-600 text-white font-bold scale-105 shadow-md shadow-blue-500/20';

                        return (
                          <button
                            key={seat.id}
                            disabled={isSold && !isSelected}
                            onClick={() => {
                              if (selectedBlockSeats.includes(seat.id)) {
                                setSelectedBlockSeats(prev => prev.filter(id => id !== seat.id));
                              } else {
                                setSelectedBlockSeats(prev => [...prev, seat.id]);
                              }
                            }}
                            className={`w-10 h-10 rounded-xl border flex flex-col items-center justify-center text-xs transition-all relative group ${bgClass}`}
                            title={`${seat.rowLabel}-${seat.seatNumber} (${seat.status})`}
                          >
                            <span className="text-[9px] opacity-75">{seat.rowLabel}</span>
                            <span className="font-bold">{seat.seatNumber}</span>
                            
                            {/* Hover tooltip */}
                            <div className="absolute bottom-11 scale-0 group-hover:scale-100 transition-all bg-gray-900 text-white text-[9px] py-1 px-2 rounded shadow-md z-10 whitespace-nowrap">
                              {formatSeatLabel({ rowLabel: seat.rowLabel, seatNumber: seat.seatNumber }, undefined, lang)} — {isBlocked ? (lang === 'es' ? 'Bloqueado permanentemente' : 'Permanently Blocked') : isSold ? (lang === 'es' ? 'Vendido' : 'Sold') : (lang === 'es' ? 'Disponible' : 'Available')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions for selected seats */}
                  {selectedBlockSeats.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-800">
                          {selectedBlockSeats.length} {lang === 'es' ? 'asientos seleccionados' : 'seats selected'}
                        </p>
                        <button 
                          onClick={() => setSelectedBlockSeats([])}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          {lang === 'es' ? 'Limpiar Selección' : 'Clear Selection'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                        {/* Block / Unblock Toggle */}
                        <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                          <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Bloquear / Desbloquear' : 'Block / Unblock'}</h4>
                          <p className="text-xs text-gray-500">{lang === 'es' ? 'Bloquea estos asientos permanentemente para evitar que salgan a la venta general.' : 'Permanently blocks these seats from general public sales.'}</p>
                          <button
                            onClick={handleBulkBlockSeats}
                            disabled={blockingActionLoading}
                            className="btn-secondary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                          >
                            <HiOutlineBan className="w-4 h-4" />
                            {lang === 'es' ? 'Alternar Bloqueo de Asientos' : 'Toggle Permanently Blocked'}
                          </button>
                        </div>

                        {/* Send Free Invitation Tickets */}
                        <div className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50 space-y-3">
                          <h4 className="font-bold text-xs text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Enviar Invitaciones de Cortesía (Gratis)' : 'Send Complimentary Tickets (Free)'}</h4>
                          <p className="text-xs text-gray-500">{lang === 'es' ? 'Emite entradas a costo cero y envíalas directamente por correo a un cliente.' : 'Issue tickets at zero cost and send them via email to a guest.'}</p>
                          
                          <div className="space-y-2.5">
                            <input
                              type="text"
                              placeholder={lang === 'es' ? 'Nombre completo del invitado' : 'Guest Full Name'}
                              value={inviteForm.name}
                              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none"
                            />
                            <input
                              type="email"
                              placeholder={lang === 'es' ? 'Correo electrónico' : 'Email Address'}
                              value={inviteForm.email}
                              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none"
                            />
                            <button
                              onClick={handleSendFreeInvitations}
                              disabled={blockingActionLoading}
                              className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5"
                            >
                              <HiOutlineMail className="w-4 h-4" />
                              {blockingActionLoading ? (lang === 'es' ? 'Enviando...' : 'Sending...') : (lang === 'es' ? 'Emitir y Enviar Entradas Gratis' : 'Issue & Send Free Tickets')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="py-12 text-center text-gray-400 text-sm font-medium">
              {lang === 'es' ? 'Selecciona una sección para ver la distribución y comenzar' : 'Select a section to view layout and begin'}
            </div>
          )}
        </div>
      )}



      {/* Edit Event Tab Content */}
      {activeTab === 'details' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 animate-fade-in">
          <div className="mb-6 border-b border-gray-100 pb-4">
            <h2 className="font-bold text-lg text-gray-900">{lang === 'es' ? 'Editar Información del Evento' : 'Edit Event Information'}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{lang === 'es' ? 'Actualiza los campos de texto y las imágenes del evento' : 'Update text fields and event images'}</p>
          </div>

          <form onSubmit={handleSaveEvent} className="space-y-6 max-w-3xl">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Título' : 'Title'}</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Descripción' : 'Description'}</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none h-32 resize-none"
                required
              />
            </div>

            {/* Row: Category & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Categoría' : 'Category'}</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                  required
                >
                  <option value="" disabled>{lang === 'es' ? 'Seleccionar categoría' : 'Select category'}</option>
                  {categories.map(cat => (
                    <option key={cat.slug} value={cat.slug}>
                      {lang === 'es' ? cat.labelEs : cat.labelEn}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Fecha del Evento' : 'Event Date'}</label>
                <input
                  type="date"
                  value={editForm.eventDate}
                  onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })}
                  onClick={(e) => {
                    if (document.activeElement === e.currentTarget) {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Hora del Evento' : 'Event Time'}</label>
                <input
                  type="time"
                  value={editForm.eventTime}
                  onChange={(e) => setEditForm({ ...editForm, eventTime: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Zona Horaria' : 'Timezone'}</label>
                <select
                  value={editForm.eventTimezone}
                  onChange={(e) => setEditForm({ ...editForm, eventTimezone: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                  required
                >
                  {TIMEZONE_GROUPS.map(group => (
                    <optgroup key={group.region} label={group.region}>
                      {group.zones.map(tz => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label} • {getCurrentTimeInTimezone(tz.value)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Venue Name & Address */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Lugar / Venue' : 'Venue Name'}</label>
                <input
                  type="text"
                  value={editForm.venueName}
                  onChange={(e) => setEditForm({ ...editForm, venueName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Ciudad / Dirección' : 'City / Address'}</label>
                <input
                  type="text"
                  value={editForm.venueAddress}
                  onChange={(e) => setEditForm({ ...editForm, venueAddress: e.target.value })}
                  placeholder={lang === 'es' ? 'Ej: Miami, FL, Estados Unidos' : 'Ex: Miami, FL, United States'}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Ticket limits */}
            <div className="pt-4 border-t border-gray-100 space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                {lang === 'es' ? 'Límite de Venta (Máx. entradas por transacción)' : 'Sale Limits (Max tickets per transaction)'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editForm.maxTicketsPerTransaction}
                    onChange={(e) => setEditForm({ ...editForm, maxTicketsPerTransaction: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                    required
                  />
                  <p className="text-[10px] text-gray-400 font-medium">
                    {lang === 'es' ? 'Establece el número máximo de entradas que un cliente puede comprar a la vez.' : 'Set the maximum number of tickets a customer can purchase at once.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              {/* Cover Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Foto de Portada' : 'Cover Image'}</label>
                <p className="text-[10px] text-gray-400 font-medium mb-1.5">{lang === 'es' ? 'Tamaño recomendado: 900 x 1200 px (3:4)' : 'Recommended size: 900 x 1200 px (3:4)'}</p>
                
                {/* Active Preview */}
                {(imageFile || event.imageUrl) && (
                  <div className="w-full relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden mb-3 shadow-inner group/preview aspect-[3/4]">
                    <img 
                      src={imageFile ? URL.createObjectURL(imageFile) : getImageUrl(event.imageUrl, event.updatedAt)} 
                      alt="Current Cover" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[10px] font-black text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      {imageFile ? (lang === 'es' ? 'Nueva Selección' : 'New Selection') : (lang === 'es' ? 'Foto Actual' : 'Current Photo')}
                    </div>
                    
                    {/* Delete Action Overlay */}
                    {!imageFile && event.imageUrl && (
                      <button
                        type="button"
                        onClick={handleDeleteImage}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity"
                      >
                        <div className="bg-white/90 backdrop-blur-md p-3 rounded-full text-red-600 shadow-xl hover:scale-110 transition-transform">
                          <HiOutlineTrash className="w-6 h-6" />
                        </div>
                      </button>
                    )}
                    
                    {imageFile && (
                      <button
                        type="button"
                        onClick={() => setImageFile(null)}
                        className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                      >
                        <HiOutlineXCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                <div className="border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-2xl p-6 transition-all text-center relative cursor-pointer group bg-gray-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <HiOutlineCamera className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                  <p className="text-sm text-gray-600 font-medium">
                    {imageFile ? imageFile.name : (lang === 'es' ? 'Seleccionar archivo de imagen' : 'Select an image file')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{lang === 'es' ? 'Formatos recomendados: JPG, PNG' : 'Recommended formats: high-res JPG, PNG'}</p>
                </div>
              </div>

              {/* Banner Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Foto de Banner de Inicio' : 'Homepage Banner Image'}</label>
                <p className="text-[10px] text-gray-400 font-medium mb-1.5">{lang === 'es' ? 'Tamaño recomendado: 2520 x 960 px (21:8)' : 'Recommended size: 2520 x 960 px (21:8)'}</p>

                {/* Active Preview */}
                {(bannerFile || event?.bannerImageUrl) && (
                  <div className="space-y-4 mb-3">
                    <div className="w-full aspect-[21/8] relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden shadow-inner group/preview">
                      <img 
                        src={bannerFile ? URL.createObjectURL(bannerFile) : getImageUrl(event?.bannerImageUrl, event.updatedAt)} 
                        alt="Current Banner" 
                        className="w-full h-full object-cover transition-all duration-300" 
                        style={{ objectPosition: editForm.bannerPosition || 'center' }}
                      />
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[10px] font-black text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                        {bannerFile ? (lang === 'es' ? 'Nueva Selección' : 'New Selection') : (lang === 'es' ? 'Banner Actual' : 'Current Banner')}
                      </div>

                      {/* Delete Action Overlay */}
                      {!bannerFile && event?.bannerImageUrl && (
                        <button
                          type="button"
                          onClick={handleDeleteBanner}
                          className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-opacity"
                        >
                          <div className="bg-white/90 backdrop-blur-md p-3 rounded-full text-red-600 shadow-xl hover:scale-110 transition-transform">
                            <HiOutlineTrash className="w-6 h-6" />
                          </div>
                        </button>
                      )}

                      {bannerFile && (
                        <button
                          type="button"
                          onClick={() => setBannerFile(null)}
                          className="absolute top-3 right-3 bg-red-600 text-white p-1.5 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                        >
                          <HiOutlineXCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Vertical Alignment Selector Controls */}
                    <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-3 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          {lang === 'es' ? 'Enfoque / Alineación Vertical' : 'Focal / Vertical Alignment'}
                        </span>
                        <span className="text-xs font-extrabold text-[#0A375A] font-mono bg-[rgba(10,55,90,0.06)] px-2.5 py-1 rounded-md border border-[rgba(10,55,90,0.14)]">
                          {editForm.bannerPosition === 'center' ? '50% (Centro)' : 
                           editForm.bannerPosition === 'top' ? '0% (Arriba)' :
                           editForm.bannerPosition === 'bottom' ? '100% (Abajo)' : 
                           editForm.bannerPosition}
                        </span>
                      </div>

                      <div className="flex gap-2">
                        {[
                          { labelEs: 'Arriba', labelEn: 'Top', val: 'top' },
                          { labelEs: 'Centro', labelEn: 'Center', val: 'center' },
                          { labelEs: 'Abajo', labelEn: 'Bottom', val: 'bottom' }
                        ].map((btn) => (
                          <button
                            key={btn.val}
                            type="button"
                            onClick={() => setEditForm(prev => ({ ...prev, bannerPosition: btn.val }))}
                            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all border shadow-sm ${
                              editForm.bannerPosition === btn.val 
                                ? 'bg-[#0A375A] text-white border-blue-600 font-extrabold' 
                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {lang === 'es' ? btn.labelEs : btn.labelEn}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase tracking-wider px-1">
                          <span>{lang === 'es' ? 'Arriba' : 'Top'}</span>
                          <span>{lang === 'es' ? 'Centro' : 'Center'}</span>
                          <span>{lang === 'es' ? 'Abajo' : 'Bottom'}</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={
                            editForm.bannerPosition === 'top' ? 0 : 
                            editForm.bannerPosition === 'center' ? 50 : 
                            editForm.bannerPosition === 'bottom' ? 100 : 
                            parseInt(editForm.bannerPosition || '50')
                          }
                          onChange={(e) => {
                            const val = `${e.target.value}%`;
                            setEditForm(prev => ({ ...prev, bannerPosition: val }));
                          }}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                        {lang === 'es' 
                          ? 'Ajusta el encuadre vertical de la imagen en el Banner del Home. Verás los cambios aplicados en vivo en la vista previa de arriba.'
                          : 'Adjust vertical framing of the Homepage Carousel Banner. Preview updates in real-time above.'}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-2 border-dashed border-gray-200 hover:border-gray-300 rounded-2xl p-6 transition-all text-center relative cursor-pointer group bg-gray-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <HiOutlineCamera className="w-8 h-8 text-gray-400 mx-auto mb-2 group-hover:scale-105 transition-transform" />
                  <p className="text-sm text-gray-600 font-medium">
                    {bannerFile ? bannerFile.name : (lang === 'es' ? 'Seleccionar banner promocional' : 'Select a promotional banner')}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{lang === 'es' ? 'Formato panorámico ideal para carrusel' : 'Panoramic aspect ratio ideal for carousel'}</p>
                </div>
              </div>
            </div>

            {/* Save & Cancel */}
            <div className="pt-6 border-t border-gray-100 flex gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className="w-1/3 py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="w-2/3 py-3 text-sm font-bold text-white bg-[#0A375A] hover:bg-[#0A375A] rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {savingEdit ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  lang === 'es' ? 'Guardar Cambios' : 'Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Commission Tab */}
      {activeTab === 'commission' && (
        <div className="animate-fade-in">
          <CreatorRewardsBlock event={event} sections={sections} lang={lang} onSaved={loadEvent} />
        </div>
      )}

    </div>
  );
}
