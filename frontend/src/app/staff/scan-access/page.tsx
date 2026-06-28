'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineQrcode,
  HiOutlineSearch,
  HiOutlineTicket,
  HiOutlineClock,
  HiOutlineCheckCircle,
} from 'react-icons/hi';

type ScannerGrant = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  event: {
    id: string;
    title: string;
    eventDate?: string | null;
    venueName?: string | null;
    imageUrl?: string | null;
    bannerImageUrl?: string | null;
  };
};

type EventSearchResult = ScannerGrant['event'];

export default function StaffScanAccessPage() {
  const { lang } = useLang();
  const [accessList, setAccessList] = useState<ScannerGrant[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EventSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const approved = useMemo(() => accessList.filter((item) => item.status === 'approved'), [accessList]);
  const pending = useMemo(() => accessList.filter((item) => item.status === 'pending'), [accessList]);
  const knownEventIds = useMemo(() => new Set(accessList.map((item) => item.event?.id).filter(Boolean)), [accessList]);

  const labels = {
    title: lang === 'es' ? 'Scan entradas empleado' : 'Staff ticket scan',
    subtitle: lang === 'es'
      ? 'Solicita acceso a un evento. Cuando te aprueben, podrás escanear entradas desde la web.'
      : 'Request access to an event. Once approved, you can scan tickets from the web.',
    approved: lang === 'es' ? 'Eventos aprobados' : 'Approved events',
    search: lang === 'es' ? 'Buscar evento' : 'Search event',
    searchPlaceholder: lang === 'es' ? 'Nombre del evento o lugar...' : 'Event name or venue...',
    request: lang === 'es' ? 'Solicitar acceso' : 'Request access',
    requested: lang === 'es' ? 'Solicitado' : 'Requested',
    openScan: lang === 'es' ? 'Abrir scan' : 'Open scan',
    emptyApproved: lang === 'es' ? 'Todavía no tienes eventos aprobados.' : 'You do not have approved events yet.',
    pending: lang === 'es' ? 'Solicitudes pendientes' : 'Pending requests',
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '';
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
  };

  const loadAccess = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/scanner-access/me');
      setAccessList(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudo cargar tu acceso.' : 'Could not load your access.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccess();
  }, []);

  const searchEvents = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const clean = query.trim();
    if (!clean) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const { data } = await api.get('/scanner-access/events/search', { params: { q: clean } });
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudo buscar eventos.' : 'Could not search events.'));
    } finally {
      setSearching(false);
    }
  };

  const requestAccess = async (eventId: string) => {
    setRequestingId(eventId);
    setError('');
    try {
      const { data } = await api.post('/scanner-access/requests', { eventId });
      setAccessList((current) => [data, ...current.filter((item) => item.id !== data.id)]);
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'No se pudo enviar la solicitud.' : 'Could not send request.'));
    } finally {
      setRequestingId(null);
    }
  };

  const EventCard = ({ event, status, action }: { event: EventSearchResult; status?: ScannerGrant['status']; action?: React.ReactNode }) => {
    const image = event.imageUrl || event.bannerImageUrl;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[rgba(246,198,95,0.14)] bg-[rgba(8,31,51,0.72)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5">
            {image ? <img src={getImageUrl(image)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-orange-300"><HiOutlineTicket className="h-7 w-7" /></div>}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-black text-white">{event.title}</p>
            <p className="truncate text-xs font-semibold text-slate-400">{[formatDate(event.eventDate), event.venueName].filter(Boolean).join(' · ')}</p>
            {status && (
              <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                status === 'approved' ? 'border-green-400/30 bg-green-500/10 text-green-300'
                  : status === 'pending' ? 'border-orange-400/30 bg-orange-500/10 text-orange-300'
                    : 'border-red-400/30 bg-red-500/10 text-red-300'
              }`}>
                {status === 'approved' ? (lang === 'es' ? 'Aprobado' : 'Approved')
                  : status === 'pending' ? (lang === 'es' ? 'Pendiente' : 'Pending')
                    : lang === 'es' ? 'Rechazado' : 'Rejected'}
              </span>
            )}
          </div>
        </div>
        {action}
      </div>
    );
  };

  return (
    <div className="page-dark-shell min-h-screen px-4 py-8 md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-[#0A375A] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white">
            <HiOutlineQrcode className="h-4 w-4 text-orange-300" />
            {lang === 'es' ? 'Acceso empleado' : 'Staff access'}
          </div>
          <h1 className="mt-4 text-3xl font-black text-white">{labels.title}</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-slate-400">{labels.subtitle}</p>
        </div>

        {error && <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">{error}</div>}

        <section className="rounded-xl border border-[rgba(246,198,95,0.14)] bg-[rgba(8,31,51,0.82)] p-5">
          <h2 className="mb-4 text-lg font-black text-white">{labels.approved}</h2>
          {loading ? (
            <div className="space-y-3">{[...Array(2)].map((_, index) => <div key={index} className="h-24 skeleton rounded-xl" />)}</div>
          ) : approved.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm font-bold text-slate-400">{labels.emptyApproved}</p>
          ) : (
            <div className="space-y-3">
              {approved.map((item) => (
                <EventCard
                  key={item.id}
                  event={item.event}
                  status="approved"
                  action={
                    <Link href={`/verify?eventId=${item.event.id}`} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 text-xs">
                      <HiOutlineCheckCircle className="h-4 w-4" />
                      {labels.openScan}
                    </Link>
                  }
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[rgba(246,198,95,0.14)] bg-[rgba(8,31,51,0.82)] p-5">
          <h2 className="mb-4 text-lg font-black text-white">{labels.search}</h2>
          <form onSubmit={searchEvents} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <HiOutlineSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={labels.searchPlaceholder}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-12 py-4 text-sm font-bold text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <button type="submit" className="btn-primary px-5 py-4 text-xs" disabled={searching}>
              {searching ? (lang === 'es' ? 'Buscando...' : 'Searching...') : labels.search}
            </button>
          </form>

          {results.length > 0 && (
            <div className="mt-4 space-y-3">
              {results.map((event) => {
                const known = knownEventIds.has(event.id);
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    status={accessList.find((item) => item.event?.id === event.id)?.status}
                    action={
                      <button
                        disabled={known || requestingId === event.id}
                        onClick={() => requestAccess(event.id)}
                        className="rounded-lg border border-orange-400/40 bg-orange-500/10 px-4 py-3 text-xs font-black uppercase text-orange-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {known ? labels.requested : requestingId === event.id ? <HiOutlineClock className="h-4 w-4" /> : labels.request}
                      </button>
                    }
                  />
                );
              })}
            </div>
          )}
        </section>

        {pending.length > 0 && (
          <section className="rounded-xl border border-[rgba(246,198,95,0.14)] bg-[rgba(8,31,51,0.82)] p-5">
            <h2 className="mb-4 text-lg font-black text-white">{labels.pending}</h2>
            <div className="space-y-3">
              {pending.map((item) => <EventCard key={item.id} event={item.event} status="pending" />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
