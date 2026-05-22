'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { Event, User } from '@/types';
import {
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineTag,
  HiOutlineUser,
  HiOutlineXCircle,
} from 'react-icons/hi';

type SpecialCode = {
  id: string;
  code: string;
  ownerUserId: string;
  eventId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner?: User;
  event?: Event | null;
};

const emptyForm = {
  code: '',
  ownerUserId: '',
  eventId: '',
  isActive: true,
};

export default function AdminSpecialCodesPage() {
  const { lang } = useLang();
  const [codes, setCodes] = useState<SpecialCode[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const copy = {
    title: lang === 'es' ? 'Códigos especiales' : 'Special codes',
    subtitle: lang === 'es'
      ? 'Crea y administra códigos rastreables para influencers, socios y equipos.'
      : 'Create and manage trackable codes for influencers, partners and teams.',
    create: lang === 'es' ? 'Crear código' : 'Create code',
    code: lang === 'es' ? 'Código' : 'Code',
    owner: lang === 'es' ? 'Dueño del código' : 'Code owner',
    event: lang === 'es' ? 'Evento' : 'Event',
    allEvents: lang === 'es' ? 'Todos los eventos' : 'All events',
    active: lang === 'es' ? 'Activo' : 'Active',
    inactive: lang === 'es' ? 'Inactivo' : 'Inactive',
    noCodes: lang === 'es' ? 'Todavía no hay códigos especiales.' : 'No special codes yet.',
    search: lang === 'es' ? 'Buscar código, usuario o evento...' : 'Search code, user or event...',
    created: lang === 'es' ? 'Creado' : 'Created',
    required: lang === 'es' ? 'El código y el dueño son obligatorios.' : 'Code and owner are required.',
    saved: lang === 'es' ? 'Código especial creado.' : 'Special code created.',
    updated: lang === 'es' ? 'Estado actualizado.' : 'Status updated.',
    error: lang === 'es' ? 'No se pudo cargar la información.' : 'Could not load information.',
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [codesRes, usersRes, eventsRes] = await Promise.all([
        api.get('/special-codes'),
        api.get('/admin/users', { params: { limit: 200 } }),
        api.get('/admin/events', { params: { limit: 200 } }),
      ]);

      setCodes(codesRes.data || []);
      setUsers(usersRes.data?.users || []);
      setEvents(eventsRes.data?.events || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || copy.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredCodes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return codes;

    return codes.filter((item) => {
      const ownerName = `${item.owner?.firstName || ''} ${item.owner?.lastName || ''} ${item.owner?.email || ''}`.toLowerCase();
      const eventTitle = (item.event?.title || '').toLowerCase();
      return item.code.toLowerCase().includes(term) || ownerName.includes(term) || eventTitle.includes(term);
    });
  }, [codes, search]);

  const activeCount = codes.filter((item) => item.isActive).length;
  const globalCount = codes.filter((item) => !item.eventId).length;

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();

    if (!code || !form.ownerUserId) {
      toast.error(copy.required);
      return;
    }

    setSaving(true);
    try {
      await api.post('/special-codes', {
        code,
        ownerUserId: form.ownerUserId,
        eventId: form.eventId || null,
        isActive: form.isActive,
      });

      toast.success(copy.saved);
      setForm(emptyForm);
      await loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || copy.error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: SpecialCode) => {
    try {
      await api.patch(`/special-codes/${item.id}`, { isActive: !item.isActive });
      setCodes((current) =>
        current.map((code) => code.id === item.id ? { ...code, isActive: !item.isActive } : code),
      );
      toast.success(copy.updated);
    } catch (err: any) {
      toast.error(err.response?.data?.message || copy.error);
    }
  };

  const normalizeCodeInput = (value: string) => {
    return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-500">LP Ticket</p>
          <h1 className="font-bold text-2xl text-gray-900 mt-2">{copy.title}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{copy.subtitle}</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold"
        >
          <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {lang === 'es' ? 'Actualizar' : 'Refresh'}
        </button>
      </div>

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
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{copy.active}</p>
            <HiOutlineCheckCircle className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-3xl font-black text-[#0A375A] mt-3">{activeCount}</p>
        </div>
        <div className="public-premium-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">{copy.allEvents}</p>
            <HiOutlineCalendar className="w-6 h-6 text-primary-500" />
          </div>
          <p className="text-3xl font-black text-[#0A375A] mt-3">{globalCount}</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="public-premium-card p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="public-premium-icon w-11 h-11 flex items-center justify-center">
            <HiOutlinePlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">{copy.create}</h2>
            <p className="text-sm text-gray-500">
              {lang === 'es' ? 'No aplica descuentos. Solo prepara el rastreo para ventas futuras.' : 'No discounts are applied. This only prepares tracking for future sales.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{copy.code}</span>
            <input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: normalizeCodeInput(event.target.value) }))}
              placeholder="MARIA"
              className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm font-bold"
            />
          </label>

          <label className="space-y-2 lg:col-span-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{copy.owner}</span>
            <select
              value={form.ownerUserId}
              onChange={(event) => setForm((current) => ({ ...current, ownerUserId: event.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm"
            >
              <option value="">{lang === 'es' ? 'Seleccionar usuario' : 'Select user'}</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} - {user.email}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{copy.event}</span>
            <select
              value={form.eventId}
              onChange={(event) => setForm((current) => ({ ...current, eventId: event.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 public-premium-input text-sm"
            >
              <option value="">{copy.allEvents}</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.title}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <label className="inline-flex items-center gap-3 text-sm font-bold text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              className="w-5 h-5 accent-primary-500"
            />
            {copy.active}
          </label>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-black disabled:opacity-60"
          >
            <HiOutlinePlus className="w-5 h-5" />
            {saving ? (lang === 'es' ? 'Guardando...' : 'Saving...') : copy.create}
          </button>
        </div>
      </form>

      <div className="public-premium-card overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-gray-900">{lang === 'es' ? 'Códigos creados' : 'Created codes'}</h2>
            <p className="text-sm text-gray-500">{lang === 'es' ? 'Activa o pausa códigos sin eliminarlos.' : 'Activate or pause codes without deleting them.'}</p>
          </div>
          <div className="relative w-full lg:w-80">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.search}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 public-premium-input text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="p-10 text-center">
            <HiOutlineTag className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500 mt-3">{copy.noCodes}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredCodes.map((item) => (
              <div key={item.id} className="p-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{copy.code}</p>
                    <p className="text-xl font-black text-[#0A375A] mt-1">{item.code}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{copy.owner}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 flex items-center gap-2">
                      <HiOutlineUser className="w-4 h-4 text-gray-400" />
                      {item.owner ? `${item.owner.firstName} ${item.owner.lastName}` : item.ownerUserId}
                    </p>
                    {item.owner?.email && <p className="text-xs text-gray-500 mt-1">{item.owner.email}</p>}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{copy.event}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{item.event?.title || copy.allEvents}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">{copy.created}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {new Date(item.createdAt).toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleActive(item)}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-black transition-all ${
                    item.isActive
                      ? 'bg-green-50 text-green-700 hover:bg-green-100'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.isActive ? <HiOutlineCheckCircle className="w-5 h-5" /> : <HiOutlineXCircle className="w-5 h-5" />}
                  {item.isActive ? copy.active : copy.inactive}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
