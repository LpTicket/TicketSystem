'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
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
  HiOutlineCamera,
  HiOutlineX,
  HiOutlineBan,
  HiOutlineMail,
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

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const router = useRouter();
  const { getCategoryInfo } = useCategories();

  const [event, setEvent] = useState<Event | null>(null);
  const [sections, setSections] = useState<VenueSection[]>([]);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'overview' | 'attendees' | 'map' | 'blocks'>('details');
  const [selectedBlockSection, setSelectedBlockSection] = useState('');
  const [selectedBlockSeats, setSelectedBlockSeats] = useState<string[]>([]);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '' });
  const [blockingActionLoading, setBlockingActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit Event States
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    venueName: '',
    eventDate: '',
    category: '',
    hasSeatMap: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { loadEvent(); }, [id]);

  const loadEvent = async () => {
    try {
      // Load event details
      const { data: events } = await api.get('/events', { params: { limit: 100 } });
      const ev = (events.events || []).find((e: Event) => e.id === id);
      if (!ev || ev.organizerId !== user?.id) { router.push('/organizer/events'); return; }
      setEvent(ev);
      setEditForm({
        title: ev.title || '',
        description: ev.description || '',
        venueName: ev.venueName || '',
        eventDate: ev.eventDate ? ev.eventDate.substring(0, 16) : '',
        category: ev.category || '',
        hasSeatMap: ev.hasSeatMap || false,
      });

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

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingEdit(true);
    try {
      // 1. Save text fields
      await api.patch(`/events/${id}`, {
        title: editForm.title,
        description: editForm.description,
        venueName: editForm.venueName,
        eventDate: new Date(editForm.eventDate).toISOString(),
        category: editForm.category,
        hasSeatMap: editForm.hasSeatMap,
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

      setIsEditing(false);
      setImageFile(null);
      setBannerFile(null);
      toast.success(lang === 'es' ? '¡Cambios guardados con éxito! Debes esperar la aprobación del administrador.' : 'Changes saved successfully! Waiting for admin approval.');
      await loadEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al guardar los cambios');
    } finally {
      setSavingEdit(false);
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
              <span className="flex items-center gap-1"><HiOutlineCalendar className="w-4 h-4" /> {format(new Date(event.eventDate), "dd MMM yyyy — HH:mm", { locale: dateFnsLocale })}</span>
              <span className="flex items-center gap-1"><HiOutlineLocationMarker className="w-4 h-4" /> {event.venueName}</span>
              <span className="flex items-center gap-1">{catInfo?.icon || '🎫'} {catLabel}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setActiveTab('details')} className={`btn-secondary text-xs py-2 px-4 flex items-center gap-1.5 font-semibold text-gray-700 hover:bg-gray-50 border-gray-300 ${activeTab === 'details' ? 'bg-gray-100 ring-2 ring-primary-500 ring-offset-1' : ''}`}>
              <HiOutlinePencil className="w-4 h-4" /> {lang === 'es' ? 'Editar Detalle' : 'Edit Details'}
            </button>
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
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto pb-px no-scrollbar">
        <button
          onClick={() => setActiveTab('details')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${activeTab === 'details' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlinePencil className="w-4 h-4" />
          {lang === 'es' ? 'Detalles e Imágenes' : 'Details & Media'}
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap shrink-0 ${activeTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('orgSections')}
        </button>
        <button
          onClick={() => setActiveTab('attendees')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${activeTab === 'attendees' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineUsers className="w-4 h-4" />
          {t('orgAttendees')}
          {attendees.length > 0 && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs">{attendees.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${activeTab === 'map' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineMap className="w-4 h-4" />
          {lang === 'es' ? 'Mapa Visual' : 'Venue Map'}
        </button>
        <button
          onClick={() => {
            setActiveTab('blocks');
            setSelectedBlockSection('');
            setSelectedBlockSeats([]);
          }}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${activeTab === 'blocks' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineBan className="w-4 h-4" />
          {lang === 'es' ? 'Bloqueos e Invitaciones' : 'Blocks & Invitations'}
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
          onSaved={(newSections) => {
            setSections(newSections);
          }} 
          onChange={(updatedSections) => {
            // Keep the parent state in sync so switching tabs doesn't lose data
            setSections(updatedSections as VenueSection[]);
          }}
        />
      )}

      {/* Attendees Tab */}
      {activeTab === 'attendees' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {attendees.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
                <p className="text-sm font-medium text-gray-700">
                  {attendees.length} {lang === 'es' ? 'asistentes registrados' : 'registered attendees'}
                </p>
                <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                  <HiOutlineDownload className="w-4 h-4" />
                  {t('orgExportCSV')}
                </button>
              </div>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
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
                        <td className="px-4 py-3 text-sm text-gray-600 text-center">{a.rowLabel}{a.seatNumber}</td>
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
              </div>

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
                    <p className="text-xs text-gray-500 mt-1">{a.sectionName} · {a.rowLabel}{a.seatNumber} · <span className="font-mono text-primary-600">{a.ticketCode}</span></p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="px-6 py-16 text-center">
              <HiOutlineUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">{lang === 'es' ? 'Aún no hay asistentes para este evento' : 'No attendees yet for this event'}</p>
            </div>
          )}
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
                              {seat.rowLabel}{seat.seatNumber} — {isBlocked ? (lang === 'es' ? 'Bloqueado permanentemente' : 'Permanently Blocked') : isSold ? (lang === 'es' ? 'Vendido' : 'Sold') : (lang === 'es' ? 'Disponible' : 'Available')}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Categoría' : 'Category'}</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                >
                  <option value="music">{lang === 'es' ? 'Música' : 'Music'}</option>
                  <option value="sports">{lang === 'es' ? 'Deportes' : 'Sports'}</option>
                  <option value="theater">{lang === 'es' ? 'Teatro' : 'Theater'}</option>
                  <option value="party">{lang === 'es' ? 'Fiesta' : 'Party'}</option>
                  <option value="other">{lang === 'es' ? 'Otro' : 'Other'}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Fecha y Hora' : 'Date & Time'}</label>
                <input
                  type="datetime-local"
                  value={editForm.eventDate}
                  onChange={(e) => setEditForm({ ...editForm, eventDate: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-primary-500 text-sm focus:border-primary-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Venue Name */}
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

            {/* Toggle Seat Map */}
            <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl">
              <div>
                <h4 className="font-bold text-sm text-gray-800">{lang === 'es' ? 'Habilitar Mapa de Asientos Interactivo' : 'Enable Interactive Seating Chart'}</h4>
                <p className="text-xs text-gray-500 mt-1">{lang === 'es' ? 'Permite a los usuarios seleccionar asientos en un lienzo interactivo.' : 'Allows users to choose specific seats on an interactive canvas.'}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.hasSeatMap}
                  onChange={(e) => setEditForm({ ...editForm, hasSeatMap: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {editForm.hasSeatMap && (
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-800 space-y-2 animate-fade-in">
                <p className="font-bold flex items-center gap-1.5">
                  <span>🎨</span>
                  {lang === 'es' ? 'Cómo diseñar tu escenario:' : 'How to design your stage layout:'}
                </p>
                <p className="leading-relaxed">
                  {lang === 'es' 
                    ? 'El mapa de asientos (escenario, mesas y sillas) se diseña de manera interactiva en tiempo real utilizando la pestaña ' 
                    : 'The interactive seat map (stage, tables, and seats) is drawn in real-time using the '}
                  <strong className="underline cursor-pointer hover:text-blue-600" onClick={() => setActiveTab('map')}>
                    {lang === 'es' ? '"Mapa Visual"' : '"Venue Map"'}
                  </strong>
                  {lang === 'es' 
                    ? ' que encontrarás en la página principal del evento. Guarda estos cambios primero y luego ve a esa pestaña para comenzar a dibujar.' 
                    : ' tab on the main event page. Save these changes first, then click that tab to start drawing.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
              {/* Cover Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">{lang === 'es' ? 'Foto de Portada' : 'Cover Image'}</label>
                
                {/* Active Preview */}
                {(imageFile || event.imageUrl) && (
                  <div className="w-full aspect-[16/9] relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden mb-3 shadow-inner">
                    <img 
                      src={imageFile ? URL.createObjectURL(imageFile) : getImageUrl(event.imageUrl)} 
                      alt="Current Cover" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-[10px] font-black text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      {imageFile ? (lang === 'es' ? 'Nueva Selección' : 'New Selection') : (lang === 'es' ? 'Foto Actual' : 'Current Photo')}
                    </div>
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

                {/* Active Preview */}
                {(bannerFile || event.bannerImageUrl) && (
                  <div className="w-full aspect-[21/9] relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden mb-3 shadow-inner">
                    <img 
                      src={bannerFile ? URL.createObjectURL(bannerFile) : getImageUrl(event.bannerImageUrl)} 
                      alt="Current Banner" 
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-[10px] font-black text-white px-2.5 py-1 rounded-full uppercase tracking-wider shadow-lg">
                      {bannerFile ? (lang === 'es' ? 'Nueva Selección' : 'New Selection') : (lang === 'es' ? 'Banner Actual' : 'Current Banner')}
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
