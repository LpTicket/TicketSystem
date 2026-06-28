'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineCheck, HiOutlineRefresh, HiOutlineUserGroup, HiOutlineX } from 'react-icons/hi';

type ScannerRequest = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  requestedAt?: string | null;
  event?: { id: string; title: string; eventDate?: string | null; venueName?: string | null };
  user?: { firstName?: string; lastName?: string; email?: string; avatarUrl?: string | null };
};

export default function OrganizerScannerAccessPage() {
  const { lang } = useLang();
  const [requests, setRequests] = useState<ScannerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const labels = {
    title: lang === 'es' ? 'Empleados para scan' : 'Scan staff',
    subtitle: lang === 'es'
      ? 'Aprueba, rechaza o revoca empleados que solicitan escanear entradas de tus eventos.'
      : 'Approve, reject, or revoke staff members requesting ticket scan access.',
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
    try {
      const { data } = await api.patch(`/scanner-access/requests/${id}/${action}`);
      setRequests((current) => current.map((item) => item.id === id ? data : item));
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudo actualizar el permiso.' : 'Could not update access.'));
    } finally {
      setBusyId(null);
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
              <div className="mb-4">
                <h2 className="font-black text-gray-950">{group.event?.title || 'Evento'}</h2>
                <p className="text-xs font-medium text-gray-500">{[formatDate(group.event?.eventDate), group.event?.venueName].filter(Boolean).join(' · ')}</p>
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
