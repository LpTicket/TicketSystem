'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Event } from '@/types';
import {
  HiOutlineCalendar,
  HiOutlineCheckCircle,
  HiOutlineClipboardCopy,
  HiOutlineRefresh,
  HiOutlineTag,
  HiOutlineXCircle,
} from 'react-icons/hi';
import toast from 'react-hot-toast';

type SpecialCode = {
  id: string;
  code: string;
  ownerUserId: string;
  eventId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  event?: Event | null;
};

type Props = {
  lang: 'es' | 'en';
};

export default function MySpecialCodesPanel({ lang }: Props) {
  const [codes, setCodes] = useState<SpecialCode[]>([]);
  const [loading, setLoading] = useState(true);

  const copy = {
    title: lang === 'es' ? 'Mis códigos especiales' : 'My special codes',
    subtitle: lang === 'es'
      ? 'Aquí aparecen los códigos que el equipo de LP Ticket te asignó.'
      : 'Codes assigned to you by the LP Ticket team appear here.',
    emptyTitle: lang === 'es' ? 'Aún no tienes códigos asignados' : 'No codes assigned yet',
    emptyText: lang === 'es'
      ? 'Cuando un administrador te asigne un código, lo verás en esta sección.'
      : 'When an admin assigns you a code, you will see it in this section.',
    allEvents: lang === 'es' ? 'Todos los eventos' : 'All events',
    active: lang === 'es' ? 'Activo' : 'Active',
    inactive: lang === 'es' ? 'Inactivo' : 'Inactive',
    copied: lang === 'es' ? 'Código copiado' : 'Code copied',
    error: lang === 'es' ? 'No se pudieron cargar tus códigos.' : 'Could not load your codes.',
  };

  const loadCodes = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/special-codes/me');
      setCodes(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || copy.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodes();
  }, []);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(copy.copied);
    } catch {
      toast.error(copy.error);
    }
  };

  return (
    <div className="dashboard-premium-card overflow-hidden">
      <div className="p-5 md:p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="public-premium-icon w-11 h-11 shrink-0 flex items-center justify-center">
            <HiOutlineTag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#0A375A]">{copy.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{copy.subtitle}</p>
          </div>
        </div>
        <button
          onClick={loadCodes}
          disabled={loading}
          className="btn-secondary inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold"
        >
          <HiOutlineRefresh className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          {lang === 'es' ? 'Actualizar' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      ) : codes.length === 0 ? (
        <div className="p-10 text-center">
          <HiOutlineTag className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-black text-gray-900 mt-4">{copy.emptyTitle}</h3>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">{copy.emptyText}</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {codes.map((item) => (
            <div key={item.id} className="p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-black tracking-wide text-[#0A375A]">{item.code}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                    item.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item.isActive ? <HiOutlineCheckCircle className="w-4 h-4" /> : <HiOutlineXCircle className="w-4 h-4" />}
                    {item.isActive ? copy.active : copy.inactive}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
                  <HiOutlineCalendar className="w-4 h-4 text-gray-400" />
                  {item.event?.title || copy.allEvents}
                </p>
              </div>

              <button
                onClick={() => handleCopy(item.code)}
                className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-black"
              >
                <HiOutlineClipboardCopy className="w-5 h-5" />
                {lang === 'es' ? 'Copiar' : 'Copy'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
