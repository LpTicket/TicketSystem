'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/auth';
import { HiOutlineCheck, HiOutlineExternalLink, HiOutlineRefresh, HiOutlineSearch, HiOutlineUserAdd, HiOutlineUserGroup, HiOutlineX } from 'react-icons/hi';

type ScannerRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  requestedAt?: string | null;
  event?: { id: string; title: string; eventDate?: string | null; venueName?: string | null; organizerId?: string };
  user?: { id?: string; firstName?: string; lastName?: string; email?: string; avatarUrl?: string | null };
  decidedBy?: { id?: string; firstName?: string; lastName?: string; email?: string } | null;
};

type AdminUserOption = {
  id: string;
  firstName?: string;
  lastName?: string;
  email: string;
  isActive: boolean;
};

type AdminEventOption = NonNullable<ScannerRequest['event']> & {
  organizer?: { id?: string; firstName?: string; lastName?: string; email?: string };
};

export default function OrganizerScannerAccessPage() {
  const { lang } = useLang();
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<ScannerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userOptions, setUserOptions] = useState<AdminUserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserOption | null>(null);
  const [eventQuery, setEventQuery] = useState('');
  const [eventOptions, setEventOptions] = useState<AdminEventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<AdminEventOption | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchingEvents, setSearchingEvents] = useState(false);
  const [creatingRequest, setCreatingRequest] = useState(false);

  const labels = {
    title: user?.role === 'admin'
      ? (lang === 'es' ? 'Empleados de eventos' : 'Event staff')
      : (lang === 'es' ? 'Empleados para scan' : 'Scan staff'),
    subtitle: user?.role === 'admin'
      ? (lang === 'es'
        ? 'Administra las solicitudes de scan de cualquier evento: pendientes, aprobadas, rechazadas y revocadas.'
        : 'Manage scan requests for any event: pending, approved, rejected, and revoked.')
      : (lang === 'es'
        ? 'Aprueba, rechaza o revoca empleados que solicitan escanear entradas de tus eventos.'
        : 'Approve, reject, or revoke staff members requesting ticket scan access.'),
    refresh: lang === 'es' ? 'Actualizar' : 'Refresh',
    empty: lang === 'es' ? 'Todavía no hay solicitudes de empleados.' : 'There are no staff requests yet.',
    approve: lang === 'es' ? 'Aprobar' : 'Approve',
    reject: lang === 'es' ? 'Rechazar' : 'Reject',
    revoke: lang === 'es' ? 'Revocar' : 'Revoke',
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { event: ScannerRequest['event']; requests: ScannerRequest[] }>();
    requests.forEach((request) => {
      const key = request.event?.id || 'none';
      const current = map.get(key) || { event: request.event, requests: [] };
      current.requests.push(request);
      map.set(key, current);
    });
    return Array.from(map.values());
  }, [requests]);

  useEffect(() => {
    if (user?.role !== 'admin' || selectedUser) return;
    let active = true;
    setSearchingUsers(true);
    const timer = window.setTimeout(() => {
      api.get('/admin/users', { params: { page: 1, limit: 20, search: userQuery.trim() || undefined } })
        .then(({ data }) => {
          if (active) setUserOptions((Array.isArray(data?.users) ? data.users : []).filter((item: AdminUserOption) => item.isActive && item.id !== user.id));
        })
        .catch(() => { if (active) setUserOptions([]); })
        .finally(() => { if (active) setSearchingUsers(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [selectedUser, user?.id, user?.role, userQuery]);

  useEffect(() => {
    if (user?.role !== 'admin' || selectedEvent) return;
    let active = true;
    setSearchingEvents(true);
    const timer = window.setTimeout(() => {
      api.get('/scanner-access/admin/events/search', { params: { q: eventQuery.trim() || undefined } })
        .then(({ data }) => { if (active) setEventOptions(Array.isArray(data) ? data : []); })
        .catch(() => { if (active) setEventOptions([]); })
        .finally(() => { if (active) setSearchingEvents(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [eventQuery, selectedEvent, user?.role]);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/scanner-access/organizer/requests');
      setRequests(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudieron cargar las solicitudes.' : 'Could not load requests.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const decide = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    setBusyId(id);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.patch(`/scanner-access/requests/${id}/${action}`);
      setRequests((current) => current.map((item) => item.id === id ? data : item));
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudo actualizar el permiso.' : 'Could not update access.'));
    } finally {
      setBusyId(null);
    }
  };

  const createRequestForUser = async () => {
    if (!selectedUser || !selectedEvent) return;
    setCreatingRequest(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/scanner-access/admin/requests', {
        userId: selectedUser.id,
        eventId: selectedEvent.id,
      });
      setRequests((current) => [data, ...current.filter((item) => item.id !== data.id)]);
      setSuccess(data.status === 'approved'
        ? (lang === 'es' ? 'Ese usuario ya tenía acceso aprobado para este evento.' : 'That user already had approved access to this event.')
        : (lang === 'es' ? 'Solicitud pendiente creada. Ya puedes aprobarla en la lista.' : 'Pending request created. You can approve it in the list now.'));
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudo crear la solicitud para el empleado.' : 'Could not create the staff request.'));
    } finally {
      setCreatingRequest(false);
    }
  };

  const statusBadge = (status: ScannerRequest['status']) => {
    const label = status === 'approved' ? (lang === 'es' ? 'Aprobado' : 'Approved')
      : status === 'pending' ? (lang === 'es' ? 'Pendiente' : 'Pending')
        : status === 'rejected' ? (lang === 'es' ? 'Rechazado' : 'Rejected')
          : lang === 'es' ? 'Revocado' : 'Revoked';
    const tone = status === 'approved' ? 'bg-green-100 text-green-700 border-green-200'
      : status === 'pending' ? 'bg-orange-100 text-orange-700 border-orange-200'
        : 'bg-red-100 text-red-700 border-red-200';
    return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${tone}`}>{label}</span>;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '';
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  };

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="premium-page-title font-black text-3xl">{labels.title}</h1>
          <p className="premium-muted text-sm mt-1 font-medium">{labels.subtitle}</p>
        </div>
        <button type="button" onClick={loadRequests} className="btn-outline inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm">
          <HiOutlineRefresh className="w-4 h-4" />
          {labels.refresh}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{success}</div>}

      {user?.role === 'admin' && (
        <section className="premium-section-card bg-white/95 p-5">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A375A] text-white">
              <HiOutlineUserAdd className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-black text-gray-950">{lang === 'es' ? 'Solicitar acceso para un empleado' : 'Request access for a staff member'}</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">{lang === 'es' ? 'Selecciona una persona y un evento. La solicitud quedará pendiente hasta que la apruebes.' : 'Select a person and an event. The request remains pending until you approve it.'}</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-500">{lang === 'es' ? '1. Usuario empleado' : '1. Staff user'}</label>
              {selectedUser ? (
                <button type="button" onClick={() => { setSelectedUser(null); setUserQuery(''); }} className="flex w-full items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left">
                  <span><strong className="block text-sm text-gray-950">{[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}</strong><span className="text-xs font-medium text-gray-500">{selectedUser.email}</span></span>
                  <span className="text-xs font-black text-green-700">{lang === 'es' ? 'Cambiar' : 'Change'}</span>
                </button>
              ) : (
                <div className="relative">
                  <HiOutlineSearch className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                  <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} placeholder={lang === 'es' ? 'Buscar por nombre o correo...' : 'Search by name or email...'} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-950 outline-none focus:border-[#F97316]" />
                  <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
                    {searchingUsers ? <p className="px-3 py-2 text-xs font-bold text-gray-500">{lang === 'es' ? 'Buscando...' : 'Searching...'}</p> : userOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setSelectedUser(option)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white">
                        <span className="block text-sm font-black text-gray-900">{[option.firstName, option.lastName].filter(Boolean).join(' ') || option.email}</span>
                        <span className="block truncate text-xs font-medium text-gray-500">{option.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-wider text-gray-500">{lang === 'es' ? '2. Evento del organizador' : '2. Organizer event'}</label>
              {selectedEvent ? (
                <button type="button" onClick={() => { setSelectedEvent(null); setEventQuery(''); }} className="flex w-full items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left">
                  <span><strong className="block text-sm text-gray-950">{selectedEvent.title}</strong><span className="text-xs font-medium text-gray-500">{selectedEvent.organizer?.email || selectedEvent.venueName || ''}</span></span>
                  <span className="text-xs font-black text-orange-700">{lang === 'es' ? 'Cambiar' : 'Change'}</span>
                </button>
              ) : (
                <div className="relative">
                  <HiOutlineSearch className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                  <input value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} placeholder={lang === 'es' ? 'Buscar evento u organizador...' : 'Search event or organizer...'} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-950 outline-none focus:border-[#F97316]" />
                  <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 p-2">
                    {searchingEvents ? <p className="px-3 py-2 text-xs font-bold text-gray-500">{lang === 'es' ? 'Buscando...' : 'Searching...'}</p> : eventOptions.map((option) => (
                      <button key={option.id} type="button" onClick={() => setSelectedEvent(option)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white">
                        <span className="block text-sm font-black text-gray-900">{option.title}</span>
                        <span className="block truncate text-xs font-medium text-gray-500">{[[option.organizer?.firstName, option.organizer?.lastName].filter(Boolean).join(' '), option.organizer?.email].filter(Boolean).join(' · ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <button type="button" disabled={!selectedUser || !selectedEvent || creatingRequest} onClick={createRequestForUser} className="btn-primary mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-50">
            <HiOutlineUserAdd className="h-4 w-4" />
            {creatingRequest ? (lang === 'es' ? 'Creando solicitud...' : 'Creating request...') : (lang === 'es' ? 'Crear solicitud pendiente' : 'Create pending request')}
          </button>
        </section>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, index) => <div key={index} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="premium-section-card bg-white/95 p-10 text-center">
          <HiOutlineUserGroup className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-bold text-gray-500">{labels.empty}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((group) => (
            <section key={group.event?.id || 'none'} className="premium-section-card bg-white/95 p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-black text-gray-950">{group.event?.title || 'Evento'}</h2>
                  <p className="text-xs font-medium text-gray-500">{[formatDate(group.event?.eventDate), group.event?.venueName].filter(Boolean).join(' · ')}</p>
                </div>
                {group.event?.id && (
                  <Link href={`/organizer/events/${group.event.id}`} className="btn-outline inline-flex items-center justify-center gap-2 px-3 py-2 text-xs">
                    <HiOutlineExternalLink className="h-4 w-4" />
                    {lang === 'es' ? 'Abrir evento' : 'Open event'}
                  </Link>
                )}
              </div>
              <div className="space-y-3">
                {group.requests.map((request) => {
                  const employeeName = [request.user?.firstName, request.user?.lastName].filter(Boolean).join(' ') || request.user?.email || 'Empleado';
                  const initial = employeeName.slice(0, 2).toUpperCase();
                  return (
                    <div key={request.id} className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0A375A] text-sm font-black text-white">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-gray-950">{employeeName}</p>
                          <p className="truncate text-xs font-bold text-gray-500">{request.user?.email || '-'}</p>
                          <div className="mt-2">{statusBadge(request.status)}</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        {request.status === 'pending' && (
                          <>
                            <button disabled={busyId === request.id} onClick={() => decide(request.id, 'approve')} className="btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs">
                              <HiOutlineCheck className="h-4 w-4" /> {labels.approve}
                            </button>
                            <button disabled={busyId === request.id} onClick={() => decide(request.id, 'reject')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700">
                              {labels.reject}
                            </button>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <button disabled={busyId === request.id} onClick={() => decide(request.id, 'revoke')} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 inline-flex items-center gap-1">
                            <HiOutlineX className="h-4 w-4" /> {labels.revoke}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
