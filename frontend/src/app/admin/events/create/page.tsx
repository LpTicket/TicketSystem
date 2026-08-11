'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HiOutlineArrowLeft, HiOutlineSearch, HiOutlineUserAdd, HiOutlineUsers } from 'react-icons/hi';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import Link from 'next/link';

type EventOwner = {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  isActive?: boolean;
};

export default function AdminCreateEventPage() {
  const { lang } = useLang();
  const router = useRouter();
  const [users, setUsers] = useState<EventOwner[]>([]);
  const [selectedUser, setSelectedUser] = useState<EventOwner | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const { data } = await api.get('/admin/users', { params: { limit: 200, role: 'client' } });
        setUsers((data?.users || []).filter((user: EventOwner) => user.isActive !== false));
      } catch (err: any) {
        setError(err.response?.data?.message || (lang === 'es' ? 'No se pudieron cargar los usuarios.' : 'Unable to load users.'));
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [lang]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.firstName, user.lastName, user.username, user.email].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [search, users]);

  const getName = (user: EventOwner) => [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email;

  return (
    <div className="premium-shell p-4 lg:p-8 max-w-5xl mx-auto animate-fade-in">
      <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-primary-400 transition-colors mb-4">
        <HiOutlineArrowLeft className="w-4 h-4" />
        {lang === 'es' ? 'Volver a eventos' : 'Back to events'}
      </Link>

      <div className="rounded-2xl border border-[rgba(77,117,151,0.42)] bg-[rgba(8,31,51,0.82)] p-6 lg:p-8 shadow-xl shadow-black/10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ff7900] text-white shadow-[0_8px_20px_rgba(255,119,0,0.25)]"><HiOutlineUserAdd className="h-6 w-6" /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-400">{lang === 'es' ? 'Solo administración' : 'Administration only'}</p>
            <h1 className="mt-1 text-2xl font-black text-white">{lang === 'es' ? 'Crear evento para usuario' : 'Create event for user'}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">{lang === 'es' ? 'Selecciona quién será el organizador. El evento quedará registrado en su panel y tú conservarás el acceso completo como administrador.' : 'Choose the organizer. The event will appear in their panel, while you retain full administrator access.'}</p>
          </div>
        </div>

        {error ? <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-200">{error}</div> : (
          <>
            <div className="relative mt-7">
              <HiOutlineSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="input w-full py-3 pl-11 !bg-[#112e47] !border-[#365874] !text-white placeholder:!text-slate-500" placeholder={lang === 'es' ? 'Buscar por nombre, usuario o correo...' : 'Search by name, username, or email...'} />
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(77,117,151,0.42)] bg-[rgba(6,25,42,0.72)]">
              <div className="flex items-center justify-between border-b border-[rgba(77,117,151,0.30)] px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-200"><HiOutlineUsers className="h-4 w-4 text-primary-400" />{lang === 'es' ? 'Selecciona un usuario' : 'Select a user'}</span>
                <span className="text-xs text-slate-500">{lang === 'es' ? 'Hasta 8 visibles; desliza para ver más.' : 'Up to 8 visible; scroll to see more.'}</span>
              </div>
              <div className="max-h-[456px] overflow-y-auto p-2">
                {loading ? <div className="flex h-40 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /></div> : filteredUsers.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">{lang === 'es' ? 'No hay usuarios que coincidan.' : 'No matching users found.'}</p> : filteredUsers.map((user) => {
                  const selected = selectedUser?.id === user.id;
                  return <button key={user.id} type="button" onClick={() => setSelectedUser(user)} className={`mb-2 flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors last:mb-0 ${selected ? 'border-[#ff7900] bg-[rgba(255,119,0,0.12)]' : 'border-transparent hover:border-[rgba(77,117,151,0.48)] hover:bg-[rgba(17,46,71,0.7)]'}`}>
                    <span><span className="block font-bold text-white">{getName(user)}</span><span className="mt-0.5 block text-xs text-slate-400">{user.email}{user.username ? ` · @${user.username}` : ''}</span></span>
                    <span className={`ml-4 flex h-5 w-5 items-center justify-center rounded-full border ${selected ? 'border-[#ff7900] bg-[#ff7900]' : 'border-slate-600'}`}>{selected && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                  </button>;
                })}
              </div>
            </div>
          </>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/admin/events" className="btn-secondary justify-center px-6 py-3 text-sm">{lang === 'es' ? 'Cancelar' : 'Cancel'}</Link>
          <button type="button" disabled={!selectedUser || loading} onClick={() => selectedUser && router.push(`/organizer/events/create?organizerId=${encodeURIComponent(selectedUser.id)}`)} className="btn-primary justify-center px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50">{lang === 'es' ? 'Continuar a crear evento' : 'Continue to event creation'}</button>
        </div>
      </div>
    </div>
  );
}
