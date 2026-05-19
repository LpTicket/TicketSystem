'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { parseSafeDate } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { formatSeatLabel } from '@/lib/seatLabel';
import { Event, SalesReport, VenueSection } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { format } from 'date-fns';
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

const formatDateInput = (value?: string) => {
  if (!value) return '';
  const date = parseSafeDate(value);
  if (Number.isNaN(date.getTime())) return value.substring(0, 10);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTimeInput = (value?: string) => {
  if (!value) return '';
  const date = parseSafeDate(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const buildLocalEventDate = (date: string, time: string) => {
  const safeTime = time || '00:00';
  return `${date}T${safeTime}:00`;
};

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
  const [activeTab, setActiveTab] = useState<'details' | 'overview' | 'attendees' | 'map' | 'blocks' | 'reminders'>('details');
  const [selectedBlockSection, setSelectedBlockSection] = useState('');
  const [selectedBlockSeats, setSelectedBlockSeats] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [blockingActionLoading, setBlockingActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

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
        eventDate: formatDateInput(ev.eventDate),
        eventTime: formatTimeInput(ev.eventDate),
        eventTimezone: ev.eventTimezone || 'UTC',
        category: ev.category || '',
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
    setSavingEdit(true);
    try {
      // 1. Save text fields
      await api.patch(`/events/${id}`, {
        title: editForm.title,
        description: editForm.description,
        venueName: editForm.venueName,
        venueAddress: editForm.venueAddress,
        eventDate: buildLocalEventDate(editForm.eventDate, editForm.eventTime),
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
        `"${o.user?.firstName || ''} ${o.user?.lastName || ''}","${o.user?.email || ''}",${o.ticketCount},"${Number(o.total).toFixed(2)}","${format(parseSafeDate(o.createdAt), 'yyyy-MM-dd HH:mm')}"`
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
      case 'pending_approval': return { label: t('orgPending'), classes: 'bg-blue-100 text-blue-700' };
      default: return { label: status, classes: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading || !event) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
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

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Back & Header */}
      <div>
        <Link href="/organizer/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500 transition-colors mb-3">
          <HiOutlineArrowLeft className="w-4 h-4" />
          {t('orgMyEvents')}
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-bold text-2xl text-gray-900">{event.title}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><HiOutlineCalendar className="w-4 h-4" /> {format(parseSafeDate(event.eventDate), "dd MMM yyyy — HH:mm", { locale: dateFnsLocale })}</span>
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

      {/* Sales Stats */}
      {sales && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{t('orgRevenue')}</span>
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
                <HiOutlineCurrencyDollar className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">${sales.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{t('orgTickets')}</span>
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                <HiOutlineTicket className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sales.totalTickets}</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{t('orgOrders')}</span>
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                <HiOutlineShoppingCart className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{sales.totalOrders}</p>
          </div>
        </div>
      )}

      {/* Event Submission Notice */}
      {event.status === 'pending_approval' && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-sm text-blue-800 shadow-sm animate-fade-in">
          <span className="text-lg">✨</span>
          <div className="space-y-1">
            <p className="font-bold text-blue-900">{lang === 'es' ? 'Evento en espera de aprobación' : 'Event pending approval'}</p>
            <p className="text-xs text-blue-700 leading-relaxed">
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
      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-px">
        <button
          onClick={() => setActiveTab('details')}
          className={`flex-1 sm:flex-none justify-center sm:justify-start px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'details' ? 'border-primary-500 text-primary-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlinePencil className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">{lang === 'es' ? 'Detalles e Imágenes' : 'Details & Media'}</span>
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 sm:flex-none justify-center sm:justify-start px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'border-primary-500 text-primary-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="whitespace-nowrap">{t('orgSections')}</span>
        </button>
        <button
          onClick={() => setActiveTab('attendees')}
          className={`flex-1 sm:flex-none justify-center sm:justify-start px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'attendees' ? 'border-primary-500 text-primary-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineUsers className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">{lang === 'es' ? 'Asistentes y Ventas' : 'Attendees & Sales'}</span>
          {attendees.length > 0 && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] sm:text-xs shrink-0">{attendees.length} / {sales?.orders?.length || 0}</span>}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 sm:flex-none justify-center sm:justify-start px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'map' ? 'border-primary-500 text-primary-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineMap className="w-4 h-4 shrink-0" />
          <span className="whitespace-nowrap">{lang === 'es' ? 'Mapa Visual' : 'Venue Map'}</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('blocks');
            setSelectedBlockSection('');
            setSelectedBlockSeats([]);
          }}
          className={`flex-1 sm:flex-none justify-center sm:justify-start px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'blocks' ? 'border-primary-500 text-primary-600 font-bold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineBan className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline whitespace-nowrap">{lang === 'es' ? 'Bloqueos e Invitaciones' : 'Blocks & Invitations'}</span>
          <span className="sm:hidden whitespace-nowrap">{lang === 'es' ? 'Bloqueos' : 'Blocks'}</span>
        </button>
      </div>

      {/* Sections Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.length > 0 ? sections.map((sec) => (
            <div key={sec.id} className="bg-white rounded-xl border border-gray-200 p-5" style={{ borderTopWidth: 4, borderTopColor: sec.color }}>
              <h3 className="font-bold text-gray-900 mb-2">{sec.name}</h3>
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
          onSaved={handleMapSaved} 
          onChange={handleMapChange}
        />
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-10 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-4xl p-6 sm:p-8 space-y-6 animate-fade-in mt-4 sm:mt-8 mb-10">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
                  <HiOutlineBell className="w-6 h-6 text-orange-500" />
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
                    <span className="p-1 rounded-lg bg-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-wider">
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
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-black py-3 px-6 rounded-2xl transition-all shadow-sm disabled:opacity-60"
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
                    <span className="p-1 rounded-lg bg-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-wider">
                      {lang === 'es' ? 'Manual' : 'Manual'}
                    </span>
                    <h4 className="font-black text-sm text-gray-800 uppercase tracking-wider">
                      {lang === 'es' ? 'Enviar Notificación Inmediata' : 'Send Immediate Notification'}
                    </h4>
                  </div>

                  <div className="bg-orange-50/70 border border-orange-100/50 rounded-2xl p-4 text-sm text-orange-900 space-y-2">
                    <p className="font-extrabold flex items-center gap-2">
                      <span>📢</span>
                      <span>{event?.title}</span>
                    </p>
                    <p className="text-xs text-orange-700">
                      {lang === 'es'
                        ? `Se enviará un recordatorio manual de forma inmediata a los asistentes con entradas activas (${attendees.length} ticket${attendees.length !== 1 ? 's' : ''}).`
                        : `Will send a manual reminder immediately to all active ticket holders (${attendees.length} ticket${attendees.length !== 1 ? 's' : ''}).`}
                    </p>
                    <div className="bg-white/60 rounded-lg px-3 py-2 border border-orange-200/50">
                      <p className="text-xs font-bold text-orange-800">
                        ⏰ {reminderDays === 0
                          ? (lang === 'es' ? '¡Hoy es el evento!' : '🔥 Today is the event!')
                          : reminderDays === 1
                          ? (lang === 'es' ? '¡Mañana es el evento!' : '⏰ Tomorrow is the event!')
                          : (lang === 'es'
                            ? `Faltan ${reminderDays} días para el evento`
                            : `${reminderDays} days until the event`)}
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
                  className="w-full mt-6 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black py-3 px-6 rounded-2xl transition-all shadow-md shadow-orange-500/10 disabled:opacity-60"
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
                <p className="text-xs text-gray-500 mt-0.5">{attendees.length} {lang === 'es' ? 'entradas individuales vendidas' : 'individual tickets sold'}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition-all shadow-sm"
                  title={lang === 'es' ? 'Enviar recordatorio por email a los asistentes' : 'Send email reminder to attendees'}
                >
                  <HiOutlineBell className="w-4 h-4" />
                  {lang === 'es' ? 'Enviar Recordatorio' : 'Send Reminder'}
                </button>
                <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <HiOutlineDownload className="w-4 h-4" />
                  {t('orgExportCSV')}
                </button>
              </div>
            </div>
            
            {attendees.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Desktop */}
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{t('orgAttendeeName')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('orgAttendeeEmail')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('orgAttendeeSection')}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('orgAttendeeRow')}/{t('orgAttendeeSeat')}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('orgAttendeeCode')}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('orgAttendeeStatus')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {attendees.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-sm text-gray-900 font-medium">{a.user?.firstName} {a.user?.lastName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{a.user?.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{a.sectionName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{formatSeatLabel({ rowLabel: a.rowLabel, seatNumber: a.seatNumber }, undefined, lang)}</td>
                        <td className="px-4 py-3 text-xs font-mono text-primary-600">{a.ticketCode}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            a.status === 'active' ? 'bg-green-100 text-green-700' :
                            a.status === 'used' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
                          }`}>
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-100">
                  {attendees.map((a) => (
                    <div key={a.id} className="p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900 text-sm">{a.user?.firstName} {a.user?.lastName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>{a.status}</span>
                      </div>
                      <p className="text-xs text-gray-500">{a.user?.email}</p>
                      <p className="text-xs text-gray-500 mt-1">{a.sectionName} · {formatSeatLabel({ rowLabel: a.rowLabel, seatNumber: a.seatNumber }, undefined, lang)} · <span className="font-mono text-primary-600">{a.ticketCode}</span></p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                {lang === 'es' ? 'No hay asistentes registrados' : 'No attendees registered'}
              </div>
            )}
          </div>

          {/* Orders Section */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <HiOutlineShoppingCart className="w-5 h-5 text-purple-500" />
                  {lang === 'es' ? 'Órdenes y Clientes' : 'Orders & Clients'}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{sales?.orders?.length || 0} {lang === 'es' ? 'transacciones realizadas' : 'completed transactions'}</p>
              </div>
              <button onClick={exportSalesCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto">
                <HiOutlineDownload className="w-4 h-4" />
                {lang === 'es' ? 'Exportar Ventas' : 'Export Sales'}
              </button>
            </div>

            {sales?.orders && sales.orders.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Desktop */}
                <table className="w-full hidden md:table">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Cliente' : 'Client'}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Correo' : 'Email'}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Boletos' : 'Qty'}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Total' : 'Total'}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Fecha' : 'Date'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sales.orders.map((o: any) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-900 font-bold">{o.user?.firstName} {o.user?.lastName}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">{o.user?.email}</td>
                        <td className="px-4 py-4 text-sm text-gray-900 font-semibold text-center">{o.ticketCount}</td>
                        <td className="px-4 py-4 text-sm text-primary-600 font-bold text-right">${Number(o.total).toFixed(2)}</td>
                        <td className="px-4 py-4 text-xs text-gray-500 text-center">{format(parseSafeDate(o.createdAt), 'dd MMM yyyy')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Mobile */}
                <div className="md:hidden divide-y divide-gray-100">
                  {sales.orders.map((o: any) => (
                    <div key={o.id} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">{o.user?.firstName} {o.user?.lastName}</p>
                        <p className="text-xs text-gray-500">{o.ticketCount} {o.ticketCount === 1 ? 'boleto' : 'boletos'} · {format(parseSafeDate(o.createdAt), 'dd MMM')}</p>
                      </div>
                      <p className="text-sm font-extrabold text-primary-600">${Number(o.total).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-gray-500 text-sm">
                {lang === 'es' ? 'No hay ventas registradas' : 'No sales recorded'}
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
                  <option key={s.id} value={s.id}>{s.name} (${Number(s.price).toFixed(2)})</option>
                ))}
              </select>
            </div>
          </div>

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
                        if (isSelected) bgClass = 'bg-blue-600 border-blue-600 text-white font-bold scale-105 shadow-md shadow-blue-500/20';

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
                      src={imageFile ? URL.createObjectURL(imageFile) : getImageUrl(event.imageUrl)} 
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
                        src={bannerFile ? URL.createObjectURL(bannerFile) : getImageUrl(event?.bannerImageUrl)} 
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
                        <span className="text-xs font-extrabold text-blue-600 font-mono bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
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
                                ? 'bg-blue-600 text-white border-blue-600 font-extrabold' 
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
                className="w-2/3 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
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
    </div>
  );
}
