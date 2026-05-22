'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { Event, User } from '@/types';
import {
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineCurrencyDollar,
  HiOutlinePencil,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineTag,
  HiOutlineUser,
  HiOutlineX,
  HiOutlineXCircle,
} from 'react-icons/hi';

type SpecialCode = {
  id: string;
  code: string;
  ownerUserId: string;
  eventId: string | null;
  isActive: boolean;
  commissionFixed: number;
  createdAt: string;
  updatedAt: string;
  owner?: User;
  event?: Event | null;
};

type CodeSale = {
  id: string;
  eventId: string;
  specialCode: string | null;
  specialCodeId: string | null;
  specialCodeOwnerId: string | null;
  ticketCount: number;
  total: number;
  paidAt?: string | null;
  createdAt: string;
  event?: Event | null;
  user?: User | null;
};

type CommissionEntry = {
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  codes: { code: string; commissionFixed: number; eventTitle: string | null }[];
  totalTickets: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  payouts: { id: string; amount: number; note: string | null; paidAt: string }[];
};

const emptyForm = { code: '', ownerUserId: '', eventId: '', isActive: true, commissionFixed: 0 };

export default function AdminSpecialCodesPage() {
  const { lang } = useLang();
  const [codes, setCodes] = useState<SpecialCode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [codeSales, setCodeSales] = useState<CodeSale[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingCode, setEditingCode] = useState<SpecialCode | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [payoutModal, setPayoutModal] = useState<CommissionEntry | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutSaving, setPayoutSaving] = useState(false);
  const [buyersModal, setBuyersModal] = useState<any | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesRes, usersRes, eventsRes, commissionsRes, salesRes] = await Promise.all([
        api.get('/special-codes'),
        api.get('/admin/users', { params: { limit: 200 } }),
        api.get('/admin/events', { params: { limit: 200 } }),
        api.get('/special-codes/admin/commission-summary'),
        api.get('/special-codes/admin-sales'),
      ]);
      setCodes(codesRes.data || []);
      setUsers(usersRes.data?.users || []);
      setEvents(eventsRes.data?.events || []);
      setCommissions(commissionsRes.data || []);
      setCodeSales(salesRes.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'No se pudo cargar la información.' : 'Could not load information.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredCodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return codes;
    return codes.filter((item) => {
      const ownerName = `${item.owner?.firstName || ''} ${item.owner?.lastName || ''} ${item.owner?.email || ''}`.toLowerCase();
      return item.code.toLowerCase().includes(term) || ownerName.includes(term) || (item.event?.title || '').toLowerCase().includes(term);
    });
  }, [codes, search]);


  const salesByCode = useMemo(() => {
    const eventById = new Map((events as any[]).map((event) => [event.id, event]));
    const groups = new Map<string, {
      key: string;
      organizerName: string;
      eventTitle: string;
      code: string;
      ownerName: string;
      ownerEmail: string;
      tickets: number;
      commission: number;
      generated: number;
      orders: any[];
    }>();

    for (const order of codeSales as any[]) {
      const codeValue = String(order.specialCode || '').trim().toUpperCase();
      if (!codeValue) continue;

      const event = order.event || eventById.get(order.eventId) || {};
      const specialCode = (codes as any[]).find((item) => {
        const sameId = order.specialCodeId && item.id === order.specialCodeId;
        const sameCode = item.code === codeValue;
        const sameEvent = !item.eventId || item.eventId === order.eventId;
        return sameId || (sameCode && sameEvent);
      });

      const organizer = event.organizer || {};
      const organizerName = [organizer.firstName, organizer.lastName].filter(Boolean).join(' ')
        || event.organizerName
        || event.ownerName
        || event.organizerEmail
        || '-';

      const owner = specialCode?.owner || {};
      const ownerName = [owner.firstName, owner.lastName].filter(Boolean).join(' ')
        || specialCode?.ownerName
        || order.specialCodeOwnerId
        || '-';

      const ownerEmail = owner.email || specialCode?.ownerEmail || '';
      const eventTitle = event.title || specialCode?.event?.title || '-';
      const commission = Number(event.creatorCommission || specialCode?.commissionFixed || 0);
      const tickets = Number(order.ticketCount || 1);
      const key = `${order.eventId || 'no-event'}-${codeValue}-${specialCode?.ownerUserId || order.specialCodeOwnerId || 'no-owner'}`;

      const current = groups.get(key) || {
        key,
        organizerName,
        eventTitle,
        code: codeValue,
        ownerName,
        ownerEmail,
        tickets: 0,
        commission,
        generated: 0,
        orders: [] as any[],
      };

      current.tickets += tickets;
      current.generated += commission * tickets;
      current.commission = commission;
      current.orders.push({ ...order, commissionGenerated: commission * tickets, buyer: order.user });
      groups.set(key, current);
    }

    return Array.from(groups.values()).sort((a, b) => b.generated - a.generated);
  }, [codeSales, codes, events]);

  const activeCount = codes.filter((c) => c.isActive).length;
  const globalCount = codes.filter((c) => !c.eventId).length;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (!code || !form.ownerUserId) { toast.error(lang === 'es' ? 'El código y el dueño son obligatorios.' : 'Code and owner are required.'); return; }
    setSaving(true);
    try {
      await api.post('/special-codes', { code, ownerUserId: form.ownerUserId, eventId: form.eventId || null, isActive: form.isActive, commissionFixed: Number(form.commissionFixed) || 0 });
      toast.success(lang === 'es' ? 'Código especial creado.' : 'Special code created.');
      setForm(emptyForm);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error al crear.' : 'Error creating.'));
    } finally { setSaving(false); }
  };

  const handleToggleActive = async (item: SpecialCode) => {
    try {
      await api.patch(`/special-codes/${item.id}`, { isActive: !item.isActive });
      setCodes((c) => c.map((x) => x.id === item.id ? { ...x, isActive: !item.isActive } : x));
      toast.success(lang === 'es' ? 'Estado actualizado.' : 'Status updated.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error.' : 'Error.'));
    }
  };

  const startEdit = (item: SpecialCode) => {
    setEditingCode(item);
    setEditForm({ code: item.code, ownerUserId: item.ownerUserId, eventId: item.eventId || '', isActive: item.isActive, commissionFixed: Number(item.commissionFixed) || 0 });
  };

  const handleSaveEdit = async () => {
    if (!editingCode) return;
    const code = editForm.code.trim().toUpperCase();
    if (!code || !editForm.ownerUserId) { toast.error(lang === 'es' ? 'El código y el dueño son obligatorios.' : 'Code and owner are required.'); return; }
    setUpdating(true);
    try {
      await api.patch(`/special-codes/${editingCode.id}`, { code, ownerUserId: editForm.ownerUserId, eventId: editForm.eventId || null, isActive: editForm.isActive, commissionFixed: Number(editForm.commissionFixed) || 0 });
      setEditingCode(null);
      await loadData();
      toast.success(lang === 'es' ? 'Código actualizado.' : 'Code updated.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error.' : 'Error.'));
    } finally { setUpdating(false); }
  };

  const handleRecordPayout = async () => {
    if (!payoutModal) return;
    const amount = parseFloat(payoutAmount);
    if (!amount || amount <= 0) { toast.error(lang === 'es' ? 'Ingresa un monto válido.' : 'Enter a valid amount.'); return; }
    setPayoutSaving(true);
    try {
      await api.post('/special-codes/admin/payouts', { ownerUserId: payoutModal.ownerUserId, amount, note: payoutNote || undefined });
      toast.success(lang === 'es' ? 'Pago registrado.' : 'Payment recorded.');
      setPayoutModal(null); setPayoutAmount(''); setPayoutNote('');
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error al registrar.' : 'Error recording.'));
    } finally { setPayoutSaving(false); }
  };

  const normalizeCodeInput = (v: string) => v.toUpperCase().replace(/[^A-Z0-9_-]/g, '');


  const handleDeleteCode = async (id: string, code: string) => {
    const ok = window.confirm(lang === 'es'
      ? `¿Eliminar el código ${code}? Esta acción no se puede deshacer.`
      : `Delete code ${code}? This action cannot be undone.`
    );

    if (!ok) return;

    try {
      await api.delete(`/special-codes/${id}`);
      toast.success(lang === 'es' ? 'Código eliminado' : 'Code deleted');
      setCodes((current) => current.filter((item) => item.id !== id));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || (lang === 'es' ? 'No se pudo eliminar el código' : 'Could not delete code'));
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-500">LP Ticket</p>
          <h1 className="font-bold text-2xl text-gray-900 mt-2">{lang === 'es' ? 'Códigos especiales' : 'Special codes'}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{lang === 'es' ? 'Crea y administra códigos rastreables para influencers y socios. Las comisiones se configuran por evento.' : 'Create and manage trackable codes for influencers and partners. Commissions are configured per event.'}</p>
        </div>
        <button onClick={loadData} disabled={loading} className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold">
          <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {lang === 'es' ? 'Actualizar' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="public-premium-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">Total</p>
            <HiOutlineTag className="w-6 h-6 text-primary-500" />
          </div>
          <p className="text-3xl font-black text-[#0A375A] mt-3">{codes.length}</p>
        </div>
        <div className="public-premium-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{lang === 'es' ? 'Activos' : 'Active'}</p>
            <HiOutlineCheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-3xl font-black text-[#0A375A] mt-3">{activeCount}</p>
        </div>
        <div className="public-premium-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{lang === 'es' ? 'Globales' : 'Global'}</p>
            <HiOutlineCalendar className="w-6 h-6 text-primary-500" />
          </div>
          <p className="text-3xl font-black text-[#0A375A] mt-3">{globalCount}</p>
        </div>
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} className="public-premium-card p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="public-premium-icon w-11 h-11 flex items-center justify-center">
            <HiOutlinePlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">{lang === 'es' ? 'Crear código' : 'Create code'}</h2>
            <p className="text-sm text-gray-500">{lang === 'es' ? 'La comisión se configura en cada evento y se paga manualmente fuera del sistema.' : 'Commission is configured per event and paid manually outside the system.'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{lang === 'es' ? 'Código' : 'Code'}</span>
            <input value={form.code} onChange={(e) => setForm((c) => ({ ...c, code: normalizeCodeInput(e.target.value) }))} placeholder="MARIA" className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm font-bold" />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{lang === 'es' ? 'Dueño del código' : 'Code owner'}</span>
            <select value={form.ownerUserId} onChange={(e) => setForm((c) => ({ ...c, ownerUserId: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm">
              <option value="">{lang === 'es' ? 'Seleccionar usuario' : 'Select user'}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} - {u.email}</option>)}
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
              <label className="space-y-2 block">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                  {lang === 'es' ? 'Evento' : 'Event'}
                </span>
                <select
                  value={form.eventId}
                  onChange={(e) => setForm({ ...form, eventId: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm"
                >
                  <option value="">{lang === 'es' ? 'Todos los eventos' : 'All events'}</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </label>

<label className="inline-flex items-center gap-3 text-sm font-bold text-gray-700">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))} className="w-5 h-5 accent-primary-500" />
            {lang === 'es' ? 'Activo' : 'Active'}
          </label>
          <button type="submit" disabled={saving} className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-black disabled:opacity-60">
            <HiOutlinePlus className="w-5 h-5" />
            {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Crear código' : 'Create code')}
          </button>
        </div>
      </form>

      {/* Codes list */}
      <div className="public-premium-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gray-900">{lang === 'es' ? 'Códigos creados' : 'Created codes'}</h2>
            <p className="text-sm text-gray-500">{lang === 'es' ? 'Activa o pausa códigos sin eliminarlos.' : 'Activate or pause codes without deleting them.'}</p>
          </div>
          <div className="relative w-full lg:w-80">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={lang === 'es' ? 'Buscar...' : 'Search...'} className="w-full pl-11 pr-4 py-3 border border-gray-200 public-premium-input text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-10 text-center"><HiOutlineTag className="w-10 h-10 text-gray-300 mx-auto" /><p className="text-sm text-gray-500 mt-3">{lang === 'es' ? 'Todavía no hay códigos.' : 'No codes yet.'}</p></div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCodes.map((item) => (
              <div key={item.id} className="p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{lang === 'es' ? 'Código' : 'Code'}</p>
                    <p className="text-xl font-black text-[#0A375A] mt-1">{item.code}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{lang === 'es' ? 'Dueño' : 'Owner'}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 flex items-center gap-2"><HiOutlineUser className="w-4 h-4 text-gray-400" />{item.owner ? `${item.owner.firstName} ${item.owner.lastName}` : item.ownerUserId}</p>
                    {item.owner?.email && <p className="text-xs text-gray-500 mt-0.5">{item.owner.email}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{lang === 'es' ? 'Evento' : 'Event'}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{item.event?.title || (lang === 'es' ? 'Todos' : 'All')}</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={() => startEdit(item)} className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-black">
                    <HiOutlinePencil className="w-5 h-5" />{lang === 'es' ? 'Editar' : 'Edit'}
                  </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCode(item.id, item.code)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      >
                        {lang === 'es' ? 'Eliminar' : 'Delete'}
                      </button>
                  <button onClick={() => handleToggleActive(item)} className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-black transition-all ${item.isActive ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {item.isActive ? <HiOutlineCheckCircle className="w-5 h-5" /> : <HiOutlineXCircle className="w-5 h-5" />}
                    {item.isActive ? (lang === 'es' ? 'Activo' : 'Active') : (lang === 'es' ? 'Inactivo' : 'Inactive')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Event commission management panel */}
      <div className="public-premium-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{lang === 'es' ? 'Comisiones por evento' : 'Event commissions'}</h2>
              <p className="text-sm text-gray-500">
                {lang === 'es'
                  ? 'Administra la comisión que genera cada evento cuando se vende con códigos de creador.'
                  : 'Manage the commission generated by each event when creator codes are used.'}
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {(events as any[]).length === 0 ? (
            <div className="p-5 text-sm text-gray-500">
              {lang === 'es' ? 'No hay eventos disponibles.' : 'No events available.'}
            </div>
          ) : (
            (events as any[]).map((event) => {
              const organizerName = [
                event.organizer?.firstName,
                event.organizer?.lastName,
              ].filter(Boolean).join(' ') || event.organizerName || event.ownerName || '-';

              const currentCommission = Number(event.creatorCommission || 0);
              const inputId = `admin-creator-commission-${event.id}`;

              return (
                <div key={event.id} className="p-5 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.7fr_0.9fr_auto] gap-4 items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{lang === 'es' ? 'Evento' : 'Event'}</p>
                    <p className="font-black text-[#0A375A]">{event.title}</p>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{lang === 'es' ? 'Organizador' : 'Organizer'}</p>
                    <p className="font-bold text-gray-800">{organizerName}</p>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{lang === 'es' ? 'Actual' : 'Current'}</p>
                    <p className="font-black text-green-700">${currentCommission.toFixed(2)}</p>
                  </div>

                  <label className="space-y-1 block">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">
                      {lang === 'es' ? 'Nueva comisión ($)' : 'New commission ($)'}
                    </span>
                    <input
                      id={inputId}
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={currentCommission.toFixed(2)}
                      className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={async () => {
                      const input = document.getElementById(inputId) as HTMLInputElement | null;
                      const amount = Math.round(Number(input?.value || 0) * 100) / 100;

                      if (Number.isNaN(amount) || amount < 0) {
                        toast.error(lang === 'es' ? 'Monto inválido' : 'Invalid amount');
                        return;
                      }

                      try {
                        await api.patch(`/admin/events/${event.id}/creator-commission`, { amount });
                        event.creatorCommission = amount;
                        toast.success(lang === 'es' ? 'Comisión actualizada' : 'Commission updated');
                      } catch (error: any) {
                        toast.error(error?.response?.data?.message || (lang === 'es' ? 'No se pudo actualizar la comisión' : 'Could not update commission'));
                      }
                    }}
                    className="btn-primary whitespace-nowrap px-5 py-3 text-sm"
                  >
                    {lang === 'es' ? 'Guardar' : 'Save'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>


      {/* Sales by code report */}
      <div className="public-premium-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{lang === 'es' ? 'Ventas por código' : 'Sales by code'}</h2>
              <p className="text-sm text-gray-500">
                {lang === 'es'
                  ? 'Reporte real de entradas vendidas y comisiones generadas por cada código.'
                  : 'Real report of tickets sold and commissions generated by each code.'}
              </p>
            </div>
          </div>
        </div>

        {salesByCode.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">
            {lang === 'es' ? 'Todavía no hay ventas asociadas a códigos.' : 'There are no sales associated with codes yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-[0.16em] text-gray-400">
                <tr>
                  <th className="px-5 py-3 text-left">{lang === 'es' ? 'Organizador' : 'Organizer'}</th>
                  <th className="px-5 py-3 text-left">{lang === 'es' ? 'Evento' : 'Event'}</th>
                  <th className="px-5 py-3 text-left">{lang === 'es' ? 'Código' : 'Code'}</th>
                  <th className="px-5 py-3 text-left">{lang === 'es' ? 'Dueño' : 'Owner'}</th>
                  <th className="px-5 py-3 text-right">{lang === 'es' ? 'Entradas' : 'Tickets'}</th>
                  <th className="px-5 py-3 text-right">{lang === 'es' ? 'Comisión' : 'Commission'}</th>
                  <th className="px-5 py-3 text-right">{lang === 'es' ? 'Generado' : 'Generated'}</th>
                  <th className="px-5 py-3 text-right">{lang === 'es' ? 'Compradores' : 'Buyers'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesByCode.map((row) => (
                  <tr key={row.key} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-bold text-gray-800">{row.organizerName}</td>
                    <td className="px-5 py-4 font-semibold text-gray-700">{row.eventTitle}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-black text-orange-600">
                        {row.code}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-black text-gray-900">{row.ownerName}</p>
                      {row.ownerEmail && <p className="text-xs text-gray-400">{row.ownerEmail}</p>}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-gray-900">{row.tickets}</td>
                    <td className="px-5 py-4 text-right font-bold text-gray-700">${row.commission.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right font-black text-[#0A375A]">${row.generated.toFixed(2)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setBuyersModal(row)}
                        className="btn-secondary px-3 py-2 rounded-lg text-xs font-black"
                      >
                        {lang === 'es' ? 'Ver compradores' : 'View buyers'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Commission summary panel */}
      {commissions.length > 0 && (
        <div className="public-premium-card overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-3">
            <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
              <HiOutlineCurrencyDollar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{lang === 'es' ? 'Comisiones pendientes' : 'Commission payouts'}</h2>
              <p className="text-sm text-gray-500">{lang === 'es' ? 'Calculado por entradas vendidas. Los pagos son manuales.' : 'Calculated from tickets sold. Payments are manual.'}</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100">
            {commissions.map((entry) => (
              <div key={entry.ownerUserId} className="p-5 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="font-black text-gray-900">{entry.ownerName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{entry.ownerEmail}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {entry.codes.map((c) => (
                        <span key={c.code} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                          {c.code} · ${c.commissionFixed.toFixed(2)}{c.eventTitle ? ` · ${c.eventTitle}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6 text-right">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-400">{lang === 'es' ? 'Entradas' : 'Tickets'}</p>
                      <p className="text-lg font-black text-gray-900 mt-0.5">{entry.totalTickets}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-gray-400">{lang === 'es' ? 'Ganado' : 'Earned'}</p>
                      <p className="text-lg font-black text-[#0A375A] mt-0.5">${entry.totalEarned.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-gray-400">{lang === 'es' ? 'Pagado' : 'Paid'}</p>
                      <p className="text-lg font-black text-green-600 mt-0.5">${entry.totalPaid.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase text-gray-400">{lang === 'es' ? 'Saldo' : 'Balance'}</p>
                      <p className={`text-lg font-black mt-0.5 ${entry.balance > 0 ? 'text-[#F97316]' : 'text-gray-400'}`}>${entry.balance.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => { setPayoutModal(entry); setPayoutAmount(entry.balance > 0 ? entry.balance.toFixed(2) : ''); setPayoutNote(''); }}
                      className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-black self-center"
                    >
                      <HiOutlineCurrencyDollar className="w-4 h-4" />
                      {lang === 'es' ? 'Registrar pago' : 'Record payment'}
                    </button>
                  </div>
                </div>

                {entry.payouts.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-black uppercase tracking-wider text-gray-400 mb-2">{lang === 'es' ? 'Historial de pagos' : 'Payment history'}</p>
                    {entry.payouts.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{new Date(p.paidAt).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US')} {p.note ? `· ${p.note}` : ''}</span>
                        <span className="font-black text-green-700">${Number(p.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setEditingCode(null)} />
          <div className="relative w-full max-w-2xl public-premium-card p-5 md:p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">LP Ticket</p>
                <h2 className="text-xl font-black text-[#0A375A] mt-1">{lang === 'es' ? 'Editar' : 'Edit'} {editingCode.code}</h2>
              </div>
              <button onClick={() => setEditingCode(null)} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{lang === 'es' ? 'Evento' : 'Event'}</span>
                <select value={editForm.eventId} onChange={(e) => setEditForm((c) => ({ ...c, eventId: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm">
                  <option value="">{lang === 'es' ? 'Todos los eventos' : 'All events'}</option>
                  {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{lang === 'es' ? 'Dueño' : 'Owner'}</span>
                <select value={editForm.ownerUserId} onChange={(e) => setEditForm((c) => ({ ...c, ownerUserId: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm">
                  <option value="">{lang === 'es' ? 'Seleccionar usuario' : 'Select user'}</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} - {u.email}</option>)}
                </select>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-2">
              <label className="inline-flex items-center gap-3 text-sm font-bold text-gray-700">
                <input type="checkbox" checked={editForm.isActive} onChange={(e) => setEditForm((c) => ({ ...c, isActive: e.target.checked }))} className="w-5 h-5 accent-primary-500" />
                {lang === 'es' ? 'Activo' : 'Active'}
              </label>
              <div className="flex gap-2">
                <button onClick={() => setEditingCode(null)} className="btn-secondary inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-black">{lang === 'es' ? 'Cancelar' : 'Cancel'}</button>
                <button onClick={handleSaveEdit} disabled={updating} className="btn-primary inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-black disabled:opacity-60">
                  {updating ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Guardar cambios' : 'Save changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout modal */}

      {buyersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setBuyersModal(null)} />
          <div className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">LP Ticket</p>
                <h2 className="text-xl font-black text-[#0A375A] mt-1">
                  {lang === 'es' ? 'Compradores del código' : 'Code buyers'} {buyersModal.code}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">{buyersModal.eventTitle}</p>
              </div>
              <button onClick={() => setBuyersModal(null)} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full min-w-[850px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-[0.16em] text-gray-400 sticky top-0">
                  <tr>
                    <th className="px-5 py-3 text-left">{lang === 'es' ? 'Comprador' : 'Buyer'}</th>
                    <th className="px-5 py-3 text-left">Email</th>
                    <th className="px-5 py-3 text-left">{lang === 'es' ? 'Fecha' : 'Date'}</th>
                    <th className="px-5 py-3 text-right">{lang === 'es' ? 'Entradas' : 'Tickets'}</th>
                    <th className="px-5 py-3 text-right">{lang === 'es' ? 'Total pagado' : 'Total paid'}</th>
                    <th className="px-5 py-3 text-right">{lang === 'es' ? 'Comisión' : 'Commission'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {buyersModal.orders.map((order: any) => {
                    const buyerName = [order.buyer?.firstName, order.buyer?.lastName].filter(Boolean).join(' ') || '-';
                    const buyerEmail = order.buyer?.email || '-';
                    const dateValue = order.paidAt || order.createdAt;
                    const dateLabel = dateValue ? new Date(dateValue).toLocaleString(lang === 'es' ? 'es-US' : 'en-US') : '-';

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-5 py-4 font-black text-gray-900">{buyerName}</td>
                        <td className="px-5 py-4 text-gray-600">{buyerEmail}</td>
                        <td className="px-5 py-4 text-gray-600">{dateLabel}</td>
                        <td className="px-5 py-4 text-right font-black text-gray-900">{order.ticketCount || 1}</td>
                        <td className="px-5 py-4 text-right font-bold text-gray-700">${Number(order.total || 0).toFixed(2)}</td>
                        <td className="px-5 py-4 text-right font-black text-[#0A375A]">${Number(order.commissionGenerated || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button onClick={() => setBuyersModal(null)} className="btn-secondary px-5 py-2.5 rounded-lg text-sm font-black">
                {lang === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {payoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={() => setPayoutModal(null)} />
          <div className="relative w-full max-w-md public-premium-card p-5 md:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-500">LP Ticket</p>
                <h2 className="text-xl font-black text-[#0A375A] mt-1">{lang === 'es' ? 'Registrar pago' : 'Record payment'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{payoutModal.ownerName}</p>
              </div>
              <button onClick={() => setPayoutModal(null)} className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs font-black text-gray-400 uppercase">{lang === 'es' ? 'Ganado' : 'Earned'}</p>
                <p className="text-lg font-black text-[#0A375A]">${payoutModal.totalEarned.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase">{lang === 'es' ? 'Pagado' : 'Paid'}</p>
                <p className="text-lg font-black text-green-600">${payoutModal.totalPaid.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs font-black text-gray-400 uppercase">{lang === 'es' ? 'Saldo' : 'Balance'}</p>
                <p className={`text-lg font-black ${payoutModal.balance > 0 ? 'text-[#F97316]' : 'text-gray-400'}`}>${payoutModal.balance.toFixed(2)}</p>
              </div>
            </div>

            <label className="space-y-2 block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{lang === 'es' ? 'Monto a registrar ($)' : 'Amount to record ($)'}</span>
              <input type="number" min="0.01" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} placeholder="0.00" className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm font-bold" />
            </label>

            <label className="space-y-2 block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{lang === 'es' ? 'Nota (opcional)' : 'Note (optional)'}</span>
              <input value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} placeholder={lang === 'es' ? 'Transferencia bancaria, efectivo...' : 'Bank transfer, cash...'} className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm" />
            </label>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setPayoutModal(null)} className="btn-secondary flex-1 py-3 rounded-lg text-sm font-black">{lang === 'es' ? 'Cancelar' : 'Cancel'}</button>
              <button onClick={handleRecordPayout} disabled={payoutSaving} className="btn-primary flex-1 py-3 rounded-lg text-sm font-black disabled:opacity-60">
                {payoutSaving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Confirmar pago' : 'Confirm payment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
