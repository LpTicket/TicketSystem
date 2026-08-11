'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import {
  HiOutlineArrowLeft,
  HiOutlinePhotograph,
  HiOutlineMap,
  HiOutlineX,
} from 'react-icons/hi';
import Link from 'next/link';
import VenueMapBuilder from '@/components/events/VenueMapBuilder';
import PremiumTimeSelect from '@/components/forms/PremiumTimeSelect';

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

const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? 'AM' : 'PM';

  return {
    value,
    label: `${displayHour}:${String(minute).padStart(2, '0')} ${period}`,
  };
});

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

export default function CreateEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, lang } = useLang();
  const { categories, refreshCategories } = useCategories();
  const organizerId = searchParams.get('organizerId');
  const isAdminCreate = Boolean(organizerId);
  const returnPath = isAdminCreate ? '/admin/events' : '/organizer/events';

  useEffect(() => { refreshCategories(); }, []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    venueName: '',
    venueAddress: '',
    eventDate: '',
    eventTime: '',
    eventEndTime: '', // optional; combined with eventDate to set eventEndDate
    eventTimezone: 'UTC',
    doorsOpen: '',
    maxTicketsPerTransaction: '10',
    generalTicketName: '',
    generalTicketPrice: '',
    generalTicketCapacity: '',
  });
  const [salesMode, setSalesMode] = useState<'map' | 'general'>('map');
  const [step, setStep] = useState<1 | 2>(1);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');

  const updateForm = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Guard: prevent duplicate event creation from double-clicks, Enter key,
    // or accidental re-submission after the first event is already created.
    if (creating || createdEventId) return;

    setError('');
    setCreating(true);

    try {
      if (!form.category) {
        setError(lang === 'es' ? 'Selecciona una categoría para el evento' : 'Select an event category');
        setCreating(false);
        return;
      }
      if (!form.eventTime) {
        setError(lang === 'es' ? 'Selecciona la hora del evento' : 'Select the event time');
        setCreating(false);
        return;
      }
      if (salesMode === 'general') {
        const capacity = Number(form.generalTicketCapacity);
        const price = Number(form.generalTicketPrice);
        if (!Number.isInteger(capacity) || capacity < 1) {
          setError(lang === 'es' ? 'Indica una capacidad válida para la entrada general' : 'Enter a valid general-admission capacity');
          setCreating(false);
          return;
        }
        if (!Number.isFinite(price) || price < 0) {
          setError(lang === 'es' ? 'Indica un precio válido para la entrada general' : 'Enter a valid general-admission price');
          setCreating(false);
          return;
        }
      }

      // Clean up empty optional fields
      const payload: any = { ...form, hasSeatMap: salesMode === 'map' };
      delete payload.generalTicketName;
      delete payload.generalTicketPrice;
      delete payload.generalTicketCapacity;
      payload.maxTicketsPerTransaction = form.maxTicketsPerTransaction ? parseInt(form.maxTicketsPerTransaction, 10) : 10;
      if (form.eventDate) {
        payload.eventDate = buildLocalEventDate(form.eventDate, form.eventTime, form.eventTimezone);
      }
      // Optional end time → eventEndDate. Same date as the event, rolling to the
      // next day when the end is at/before the start (e.g. 22:00 → 03:00).
      if (form.eventEndTime && form.eventDate) {
        let endDay = form.eventDate;
        if (form.eventTime && form.eventEndTime <= form.eventTime) {
          const [y, m, d] = form.eventDate.split('-').map(Number);
          const next = new Date(Date.UTC(y, m - 1, d + 1));
          endDay = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
        }
        payload.eventEndDate = buildLocalEventDate(endDay, form.eventEndTime, form.eventTimezone);
      }
      delete payload.eventEndTime;
      if (form.doorsOpen) {
        payload.doorsOpen = `${form.eventDate}T${form.doorsOpen}:00`;
      } else {
        delete payload.doorsOpen;
      }
      delete payload.eventTime;
      if (!payload.description) delete payload.description;
      if (!payload.venueAddress) delete payload.venueAddress;

      // 1. Create event
      const { data: event } = await api.post(
        isAdminCreate ? '/events/admin-create' : '/events',
        isAdminCreate ? { ...payload, organizerId } : payload,
      );

      // A general-admission event reuses the existing standing section model.
      // This adds no schema, pricing, payment, or existing-event changes.
      if (salesMode === 'general') {
        await api.post(`/events/${event.id}/sections/bulk`, {
          sections: [{
            name: form.generalTicketName.trim() || (lang === 'es' ? 'Entrada General' : 'General Admission'),
            sectionType: 'standing',
            rows: 1,
            seatsPerRow: 1,
            capacity: Number(form.generalTicketCapacity),
            price: Number(form.generalTicketPrice),
            color: '#6366f1',
            mapX: 0,
            mapY: 0,
            mapWidth: 160,
            mapHeight: 100,
            curve: 0,
            rotation: 0,
            labelFontSize: 0,
            isWheelchair: false,
            tableShape: 'round',
            tablePurchaseMode: 'individual',
            seatsConfig: null,
          }],
          showStage: false,
          defaultViewX: null,
          defaultViewY: null,
          defaultViewZoom: null,
        });
      }

      // 2. Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await api.post(`/events/${event.id}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 2b. Upload banner if selected
      if (bannerFile) {
        const formData = new FormData();
        formData.append('image', bannerFile);
        await api.post(`/events/${event.id}/image/banner`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setCreatedEventId(event.id);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'Error al crear el evento' : 'Error creating event'));
    } finally {
      setCreating(false);
    }
  };


  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <Link href={returnPath} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500 transition-colors mb-3">
          <HiOutlineArrowLeft className="w-4 h-4" />
          {isAdminCreate ? (lang === 'es' ? 'Eventos' : 'Events') : t('orgMyEvents')}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl lg:text-3xl text-gray-900">{step === 1 ? t('orgCreateEvent') : (salesMode === 'map' ? (lang === 'es' ? 'Diseño del Escenario' : 'Stage Design') : (lang === 'es' ? 'Entrada General' : 'General Admission'))}</h1>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`px-4 py-1.5 rounded-lg border transition-all ${step === 1 ? 'bg-gradient-to-b from-[#ff8a18] via-[#f46c00] to-[#c93f00] text-white border-[rgba(255,151,45,0.62)] shadow-[0_10px_24px_rgba(255,104,0,0.24)]' : 'bg-[rgba(8,31,51,0.6)] border-[rgba(246,198,95,0.18)] text-slate-300'}`}>{lang === 'es' ? '1. Detalles' : '1. Details'}</span>
            <span className="text-slate-500 font-bold">/</span>
            <span className={`px-4 py-1.5 rounded-lg border transition-all ${step === 2 ? 'bg-gradient-to-b from-[#ff8a18] via-[#f46c00] to-[#c93f00] text-white border-[rgba(255,151,45,0.62)] shadow-[0_10px_24px_rgba(255,104,0,0.24)]' : 'bg-[rgba(8,31,51,0.6)] border-[rgba(246,198,95,0.18)] text-slate-300'}`}>{salesMode === 'map' ? (lang === 'es' ? '2. Escenario' : '2. Stage') : (lang === 'es' ? '2. Entrada General' : '2. General Admission')}</span>
          </div>
        </div>
      </div>

      {step === 1 ? (
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2 animate-shake">
            <HiOutlineX className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Event Details (Expanded) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 shadow-sm">
              <h2 className="font-bold text-xl text-gray-900 mb-6">{lang === 'es' ? 'Información del Evento' : 'Event Information'}</h2>

              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgEventTitle')} *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm('title', e.target.value)}
                    className="input py-3 text-base"
                    placeholder={lang === 'es' ? 'Ej: Gran Concierto de Salsa' : 'Ex: Big Salsa Concert'}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgEventDesc')}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    className="input min-h-[160px] resize-y py-3 text-base"
                    placeholder={lang === 'es' ? 'Describe tu evento detalladamente...' : 'Describe your event in detail...'}
                  />
                </div>

                {/* Category + Venue + Address */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgCategory')} *</label>
                    <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="input py-3" required>
                      <option value="" disabled>{lang === 'es' ? '-- Selecciona una categoría --' : '-- Select a category --'}</option>
                      {categories.filter((cat) => cat.slug !== 'todos' && cat.slug !== 'todas').map((cat) => (
                        <option key={cat.id} value={cat.slug}>{cat.icon} {lang === 'en' ? cat.labelEn : cat.labelEs}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgVenue')} *</label>
                    <input
                      type="text"
                      value={form.venueName}
                      onChange={(e) => updateForm('venueName', e.target.value)}
                      className="input py-3"
                      placeholder={lang === 'es' ? 'Ej: Teatro Baralt' : 'Ex: Main Theater'}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgVenueAddress')}</label>
                    <input
                      type="text"
                      value={form.venueAddress}
                      onChange={(e) => updateForm('venueAddress', e.target.value)}
                      className="input py-3"
                      placeholder={lang === 'es' ? 'Ej: Miami, FL, Estados Unidos' : 'Ex: Miami, FL, United States'}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgEventDate')} *</label>
                    <input
                      type="date"
                      value={form.eventDate}
                      onChange={(e) => updateForm('eventDate', e.target.value)}
                      onClick={(e) => {
                        if (document.activeElement === e.currentTarget) {
                          e.currentTarget.blur();
                        }
                      }}
                      className="input py-3"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{lang === 'es' ? 'Hora del evento *' : 'Event Time *'}</label>
                    <PremiumTimeSelect
                      value={form.eventTime}
                      options={TIME_OPTIONS}
                      onChange={(value) => updateForm('eventTime', value)}
                      placeholder={lang === 'es' ? 'Selecciona la hora' : 'Select time'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{lang === 'es' ? 'Hora de finalización (opcional)' : 'End Time (optional)'}</label>
                    <PremiumTimeSelect
                      value={form.eventEndTime}
                      options={TIME_OPTIONS}
                      onChange={(value) => updateForm('eventEndTime', value)}
                      placeholder={lang === 'es' ? 'Sin hora de fin' : 'No end time'}
                    />
                    <p className="text-xs text-gray-400 mt-1 leading-tight">{lang === 'es' ? 'El evento se sigue mostrando y vendiendo hasta esta hora. Vacío = 6 h tras el inicio.' : 'The event stays listed and on sale until this time. Empty = 6h after start.'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{lang === 'es' ? 'Zona horaria del evento *' : 'Event Timezone *'}</label>
                    <select
                      value={form.eventTimezone}
                      onChange={(e) => updateForm('eventTimezone', e.target.value)}
                      className="input py-3"
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
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgDoorsOpen')}</label>
                    <PremiumTimeSelect
                      value={form.doorsOpen}
                      options={TIME_OPTIONS}
                      onChange={(value) => updateForm('doorsOpen', value)}
                      placeholder={t('orgDoorsOpen')}
                      clearLabel={lang === 'es' ? 'Sin hora definida' : 'No time set'}
                    />
                  </div>
                </div>

                {/* Ticket limits */}
                <div className="pt-6 border-t border-gray-100">
                  <h3 className="font-bold text-base text-slate-100 mb-2">{lang === 'es' ? 'Tipo de Venta' : 'Sales Type'}</h3>
                  <p className="text-sm text-slate-400 mb-4">{lang === 'es' ? 'Elige si este evento venderá ubicaciones en un mapa o una sola entrada general.' : 'Choose whether this event sells mapped seating or one general-admission ticket.'}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setSalesMode('map')}
                      className={`text-left rounded-xl border p-4 transition-all ${salesMode === 'map' ? 'border-[#ff7900] bg-[rgba(255,119,0,0.10)] ring-1 ring-[#ff7900]/45' : 'border-[rgba(77,117,151,0.45)] bg-[rgba(8,31,51,0.76)] hover:border-[#ff7900]/55'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${salesMode === 'map' ? 'bg-[#ff7900] text-white' : 'bg-[#12304a] text-slate-300'}`}><HiOutlineMap className="h-5 w-5" /></span>
                        <div>
                          <p className="font-bold text-white">{lang === 'es' ? 'Mapa visual' : 'Venue map'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{lang === 'es' ? 'Mesas, sillas y zonas con ubicación.' : 'Tables, seats, and positioned areas.'}</p>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSalesMode('general')}
                      className={`text-left rounded-xl border p-4 transition-all ${salesMode === 'general' ? 'border-[#ff7900] bg-[rgba(255,119,0,0.10)] ring-1 ring-[#ff7900]/45' : 'border-[rgba(77,117,151,0.45)] bg-[rgba(8,31,51,0.76)] hover:border-[#ff7900]/55'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-lg font-black text-sm ${salesMode === 'general' ? 'bg-[#ff7900] text-white' : 'bg-[#12304a] text-slate-300'}`}>GA</span>
                        <div>
                          <p className="font-bold text-white">{lang === 'es' ? 'Entrada general' : 'General admission'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{lang === 'es' ? 'Un precio y capacidad, sin mapa.' : 'One price and capacity, no map.'}</p>
                        </div>
                      </div>
                    </button>
                  </div>

                  {salesMode === 'general' && (
                    <div className="mt-4 rounded-xl border border-[rgba(77,117,151,0.58)] bg-[rgba(8,31,51,0.9)] p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-200 mb-2">{lang === 'es' ? 'Nombre de la entrada' : 'Ticket name'} *</label>
                          <input type="text" value={form.generalTicketName} onChange={(e) => updateForm('generalTicketName', e.target.value)} className="input py-3 !bg-[#112e47] !border-[#365874] !text-white placeholder:!text-slate-500" placeholder={lang === 'es' ? 'Entrada General' : 'General Admission'} required={salesMode === 'general'} maxLength={40} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-200 mb-2">{lang === 'es' ? 'Precio por entrada (USD)' : 'Ticket price (USD)'} *</label>
                          <input type="number" value={form.generalTicketPrice} onChange={(e) => updateForm('generalTicketPrice', e.target.value)} className="input py-3 !bg-[#112e47] !border-[#365874] !text-white placeholder:!text-slate-500" placeholder="0.00" min="0" step="0.01" required={salesMode === 'general'} />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-200 mb-2">{lang === 'es' ? 'Capacidad total' : 'Total capacity'} *</label>
                          <input type="number" value={form.generalTicketCapacity} onChange={(e) => updateForm('generalTicketCapacity', e.target.value)} className="input py-3 !bg-[#112e47] !border-[#365874] !text-white placeholder:!text-slate-500" placeholder="100" min="1" step="1" required={salesMode === 'general'} />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-3">{lang === 'es' ? 'Los clientes verán una entrada general y elegirán la cantidad que desean comprar.' : 'Customers will see one general-admission ticket and choose their quantity.'}</p>
                    </div>
                  )}

                  <h3 className="font-bold text-base text-gray-900 mb-4">{lang === 'es' ? 'Límites de Venta' : 'Sale Limits'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        {lang === 'es' ? 'Máx. entradas por persona/transacción *' : 'Max tickets per person/transaction *'}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={form.maxTicketsPerTransaction}
                        onChange={(e) => updateForm('maxTicketsPerTransaction', e.target.value)}
                        className="input py-3"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1 font-medium">
                        {lang === 'es' ? 'Establece el número máximo de entradas que un cliente puede comprar a la vez.' : 'Set the maximum number of tickets a customer can purchase at once.'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Right Column: Image & Sticky Submit */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-8 shadow-sm">
              <h2 className="font-bold text-lg text-gray-900 mb-4">{t('orgEventImage')}</h2>
              <div className="space-y-4">
                <div className="aspect-[3/4] w-full rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group hover:border-primary-300 transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <HiOutlinePhotograph className="w-16 h-16 text-gray-300 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <label className="btn-secondary w-full py-2.5 text-sm justify-center cursor-pointer font-bold flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <HiOutlinePhotograph className="w-4 h-4" />
                    {lang === 'es' ? 'Imagen Miniatura' : 'Thumbnail Image'}
                  </div>
                  <span className="text-[10px] opacity-60 font-medium">({lang === 'es' ? 'Recomendado: 900x1200px' : 'Recommended: 900x1200px'})</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>

                <h2 className="font-bold text-lg text-gray-900 mt-6 mb-4">{lang === 'es' ? 'Imagen Banner' : 'Banner Image'}</h2>
                <div className="aspect-[21/8] w-full rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group hover:border-primary-300 transition-colors">
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                  ) : (
                    <HiOutlinePhotograph className="w-16 h-16 text-gray-300 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <label className="btn-secondary w-full py-2.5 text-sm justify-center cursor-pointer font-bold flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <HiOutlinePhotograph className="w-4 h-4" />
                    {lang === 'es' ? 'Subir Banner' : 'Upload Banner'}
                  </div>
                  <span className="text-[10px] opacity-60 font-medium">({lang === 'es' ? 'Recomendado: 2520x960px' : 'Recommended: 2520x960px'})</span>
                  <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                </label>
                <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                  PNG, JPG · {lang === 'es' ? 'Máx 5MB' : 'Max 5MB'}
                </p>
                
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary w-full py-4 text-sm font-bold shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {creating ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Siguiente Paso' : 'Next Step')}
                  </button>
                  <Link href={returnPath} className="btn-secondary w-full text-center py-3 text-sm font-bold border-transparent hover:bg-red-50 hover:text-red-600">
                    {t('orgCancel')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      ) : (
        <div className="rounded-xl border border-[rgba(77,117,151,0.48)] bg-[rgba(8,31,51,0.90)] p-6 shadow-xl shadow-black/10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg text-white">{salesMode === 'map' ? (lang === 'es' ? 'Configura tu Escenario' : 'Configure Your Stage Layout') : (lang === 'es' ? 'Entrada general configurada' : 'General admission configured')}</h2>
              <p className="text-slate-400 text-sm">{salesMode === 'map' ? (lang === 'es' ? 'Organiza las mesas y áreas del evento como desees.' : 'Arrange the tables and areas of the event as you wish.') : (lang === 'es' ? 'Este evento venderá una sola entrada general, sin mesas ni mapa visual.' : 'This event will sell one general-admission ticket, without tables or a venue map.')}</p>
            </div>
            <button onClick={() => router.push(returnPath)} className="btn-secondary text-sm">
              {lang === 'es' ? 'Terminar y Salir' : 'Finish & Exit'}
            </button>
          </div>
          {salesMode === 'general' ? (
            <div className="rounded-2xl border border-[rgba(255,119,0,0.48)] bg-[rgba(255,119,0,0.08)] p-6 lg:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-[rgba(77,117,151,0.62)] bg-[#112e47] p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'es' ? 'Entrada' : 'Ticket'}</p><p className="mt-1 font-bold text-white">{form.generalTicketName.trim() || (lang === 'es' ? 'Entrada General' : 'General Admission')}</p></div>
                <div className="rounded-xl border border-[rgba(77,117,151,0.62)] bg-[#112e47] p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'es' ? 'Precio' : 'Price'}</p><p className="mt-1 font-bold text-white">${Number(form.generalTicketPrice || 0).toFixed(2)}</p></div>
                <div className="rounded-xl border border-[rgba(77,117,151,0.62)] bg-[#112e47] p-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">{lang === 'es' ? 'Capacidad' : 'Capacity'}</p><p className="mt-1 font-bold text-white">{form.generalTicketCapacity}</p></div>
              </div>
              <p className="mt-5 text-sm text-slate-300">{lang === 'es' ? 'No necesitas diseñar un mapa. Puedes terminar y administrar este evento desde Mis Eventos.' : 'No venue map is required. You can finish and manage this event from My Events.'}</p>
            </div>
          ) : createdEventId && (
            <VenueMapBuilder
              eventId={createdEventId}
              initialSections={[]}
              onSaved={() => router.push(returnPath)}
            />
          )}
        </div>
      )}
    </div>
  );
}
