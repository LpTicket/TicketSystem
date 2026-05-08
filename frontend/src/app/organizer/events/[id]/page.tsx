'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
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
} from 'react-icons/hi';
import VenueMapBuilder from '@/components/events/VenueMapBuilder';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'attendees' | 'map'>('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEvent(); }, [id]);

  const loadEvent = async () => {
    try {
      // Load event details
      const { data: events } = await api.get('/events', { params: { limit: 100 } });
      const ev = (events.events || []).find((e: Event) => e.id === id);
      if (!ev || ev.organizerId !== user?.id) { router.push('/organizer/events'); return; }
      setEvent(ev);

      // Load sections
      try {
        const { data: secs } = await api.get(`/events/${id}/sections`);
        setSections(secs);
      } catch {}

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
      await loadEvent();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async () => {
    if (!confirm(lang === 'es' ? '¿Eliminar este evento permanentemente?' : 'Delete this event permanently?')) return;
    try {
      await api.delete(`/events/${id}`);
      router.push('/organizer/events');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error');
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('orgSections')}
        </button>
        <button
          onClick={() => setActiveTab('attendees')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'attendees' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineUsers className="w-4 h-4" />
          {t('orgAttendees')}
          {attendees.length > 0 && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs">{attendees.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${activeTab === 'map' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <HiOutlineMap className="w-4 h-4" />
          {lang === 'es' ? 'Mapa Visual' : 'Venue Map'}
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
    </div>
  );
}
