'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { Event } from '@/types';
import {
  HiOutlineUsers,
  HiOutlineDownload,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
} from 'react-icons/hi';

interface Attendee {
  id: string;
  ticketCode: string;
  sectionName: string;
  rowLabel: string;
  seatNumber: number;
  status: string;
  event?: Event;
  user?: { firstName: string; lastName: string; email: string };
}

export default function AttendeesPage() {
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [validating, setValidating] = useState('');

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/events', { params: { limit: 100, includePast: 'true' } });
      const myEvents = (data.events || []).filter((e: Event) => e.organizerId === user?.id);
      setEvents(myEvents);
      if (myEvents.length > 0) {
        setSelectedEvent(myEvents[0].id);
        await loadAttendees(myEvents[0].id);
      }
    } catch {} finally { setLoading(false); }
  };

  const loadAttendees = async (eventId: string) => {
    try {
      const { data } = await api.get(`/orders/event/${eventId}/attendees`);
      setAttendees(data);
    } catch { setAttendees([]); }
  };

  const handleEventChange = async (eventId: string) => {
    setSelectedEvent(eventId);
    setLoading(true);
    await loadAttendees(eventId);
    setLoading(false);
  };

  const handleValidate = async (code: string) => {
    setValidating(code);
    try {
      await api.post(`/orders/ticket/${code}/validate`);
      await loadAttendees(selectedEvent);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error');
    } finally {
      setValidating('');
    }
  };

  const exportCSV = () => {
    const ev = events.find((e) => e.id === selectedEvent);
    const csv = [
      `${t('orgAttendeeName')},${t('orgAttendeeEmail')},${t('orgAttendeeSection')},${t('orgAttendeeRow')},${t('orgAttendeeSeat')},${t('orgAttendeeCode')},${t('orgAttendeeStatus')}`,
      ...filteredAttendees.map((a) =>
        `${a.user?.firstName} ${a.user?.lastName},${a.user?.email},${a.sectionName},${a.rowLabel},${a.seatNumber},${a.ticketCode},${a.status}`
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendees-${ev?.title || selectedEvent}.csv`;
    a.click();
  };

  const filteredAttendees = attendees.filter((a) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      a.user?.firstName.toLowerCase().includes(term) ||
      a.user?.lastName.toLowerCase().includes(term) ||
      a.user?.email.toLowerCase().includes(term) ||
      a.ticketCode.toLowerCase().includes(term)
    );
  });

  const activeCount = attendees.filter((a) => a.status === 'active').length;
  const usedCount = attendees.filter((a) => a.status === 'used').length;

  if (loading && events.length === 0) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <div className="h-8 skeleton rounded w-1/4" />
        <div className="h-12 skeleton rounded w-1/2" />
        <div className="h-64 skeleton rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-bold text-2xl text-gray-900">{t('orgAttendees')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Control de acceso y validación de tickets' : 'Access control and ticket validation'}</p>
      </div>

      {/* Event Selector */}
      {events.length > 0 ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedEvent}
              onChange={(e) => handleEventChange(e.target.value)}
              className="input sm:max-w-xs"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>{ev.title}</option>
              ))}
            </select>

            <div className="relative flex-1 max-w-xs">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={lang === 'es' ? 'Buscar por nombre, email o código...' : 'Search by name, email, or code...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{attendees.length}</p>
              <p className="text-xs text-gray-500">{lang === 'es' ? 'Total' : 'Total'}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{activeCount}</p>
              <p className="text-xs text-gray-500">{lang === 'es' ? 'Pendientes' : 'Pending'}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{usedCount}</p>
              <p className="text-xs text-gray-500">{lang === 'es' ? 'Ingresados' : 'Checked In'}</p>
            </div>
          </div>

          {/* Attendees List */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredAttendees.length > 0 ? (
              <>
                <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-700">
                    {filteredAttendees.length} {lang === 'es' ? 'resultados' : 'results'}
                  </p>
                  <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                    <HiOutlineDownload className="w-4 h-4" /> {t('orgExportCSV')}
                  </button>
                </div>

                <div className="divide-y divide-gray-100">
                  {filteredAttendees.map((a) => (
                    <div key={a.id} className="px-6 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-500 shrink-0">
                        {a.user?.firstName?.[0]}{a.user?.lastName?.[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.user?.firstName} {a.user?.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">{a.user?.email}</p>
                      </div>
                      <div className="hidden sm:block text-xs text-gray-500 text-right shrink-0">
                        <p>{a.sectionName}</p>
                        <p className="font-mono">{formatSeatLabel({ rowLabel: a.rowLabel, seatNumber: a.seatNumber }, undefined, lang)}</p>
                      </div>
                      <div className="hidden sm:block shrink-0">
                        <span className="font-mono text-xs text-primary-600">{a.ticketCode}</span>
                      </div>
                      <div className="shrink-0">
                        {a.status === 'active' ? (
                          <button
                            onClick={() => handleValidate(a.ticketCode)}
                            disabled={validating === a.ticketCode}
                            className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1"
                          >
                            <HiOutlineCheckCircle className="w-4 h-4" />
                            {validating === a.ticketCode ? '...' : (lang === 'es' ? 'Validar' : 'Check In')}
                          </button>
                        ) : a.status === 'used' ? (
                          <span className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-medium flex items-center gap-1">
                            <HiOutlineCheckCircle className="w-4 h-4" />
                            {lang === 'es' ? 'Ingresado' : 'Checked In'}
                          </span>
                        ) : (
                          <span className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium flex items-center gap-1">
                            <HiOutlineXCircle className="w-4 h-4" />
                            {lang === 'es' ? 'Cancelado' : 'Cancelled'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="px-6 py-16 text-center">
                <HiOutlineUsers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">{lang === 'es' ? 'No se encontraron asistentes' : 'No attendees found'}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <HiOutlineUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">{t('orgNoEvents')}</p>
        </div>
      )}
    </div>
  );
}
