'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { User } from '@/types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  HiOutlineSearch,
  HiOutlineUsers,
  HiOutlineBan,
  HiOutlineCheckCircle,
  HiOutlineShieldCheck,
  HiOutlineTrash,
  HiOutlineX,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineLocationMarker,
  HiOutlineCalendar,
  HiOutlineTicket,
} from 'react-icons/hi';

export default function AdminUsersPage() {
  const { t, lang } = useLang();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserTickets, setSelectedUserTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const handleSelectUser = async (u: User) => {
    setSelectedUser(u);
    setLoadingTickets(true);
    setSelectedUserTickets([]);
    try {
      const { data } = await api.get(`/orders/user/${u.id}/tickets`);
      setSelectedUserTickets(data);
    } catch (err) {
      console.error('Error loading tickets for user profile:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => { loadUsers(); }, [page, filter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filter) params.role = filter;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users);
      setTotal(data.total);
    } catch {} finally { setLoading(false); }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}/toggle-active`);
      await loadUsers();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      await loadUsers();
    } catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(lang === 'es' ? `¿Estás seguro de eliminar a ${userName}? Esta acción es irreversible.` : `Are you sure you want to delete ${userName}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      await loadUsers();
    } catch (err: any) { alert(err.response?.data?.message || 'Error al eliminar usuario'); }
  };

  const dateFnsLocale = lang === 'es' ? es : enUS;

  const roleFilters = [
    { key: '', label: lang === 'es' ? 'Todos' : 'All' },
    { key: 'client', label: lang === 'es' ? 'Clientes' : 'Clients' },
    { key: 'admin', label: t('adminAdmins') },
  ];

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return { label: 'Admin', classes: 'bg-red-100 text-red-700' };
      default: return { label: lang === 'es' ? 'Cliente' : 'Client', classes: 'bg-blue-100 text-blue-700' };
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return u.firstName.toLowerCase().includes(term) || u.lastName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-bold text-2xl text-gray-900">{t('adminUserManagement')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Administra los usuarios de la plataforma' : 'Manage platform users'}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {roleFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                filter === f.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={lang === 'es' ? 'Buscar usuarios...' : 'Search users...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}</div>
      ) : filteredUsers.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Usuario' : 'User'}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('adminRole')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Estado' : 'Status'}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Registro' : 'Registered'}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{t('adminActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => {
                  const roleBadge = getRoleBadge(u.role);
                  return (
                    <tr 
                      key={u.id} 
                      onClick={() => handleSelectUser(u)}
                      className="hover:bg-gray-50/75 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-gray-500 font-medium">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[180px]">{u.email}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${roleBadge.classes}`}>{roleBadge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {u.isActive ? t('adminActive') : t('adminInactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {format(new Date(u.createdAt), "dd MMM yyyy", { locale: dateFnsLocale })}
                      </td>
                      <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Role selector */}
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
                          >
                            <option value="client">{lang === 'es' ? 'Cliente' : 'Client'}</option>
                            <option value="admin">Admin</option>
                          </select>
                          {/* Toggle active */}
                          <button
                            onClick={() => handleToggleActive(u.id)}
                            className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-red-500 hover:bg-red-50' : 'text-green-500 hover:bg-green-50'}`}
                            title={u.isActive ? t('adminBlock') : t('adminUnblock')}
                          >
                            {u.isActive ? <HiOutlineBan className="w-4 h-4" /> : <HiOutlineCheckCircle className="w-4 h-4" />}
                          </button>
                          {/* Delete user */}
                          <button
                            onClick={() => handleDeleteUser(u.id, u.firstName)}
                            className="p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-50"
                            title={lang === 'es' ? 'Eliminar usuario' : 'Delete user'}
                          >
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">{total} {lang === 'es' ? 'usuarios' : 'users'}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-50">{lang === 'es' ? 'Anterior' : 'Previous'}</button>
                <button onClick={() => setPage(page + 1)} disabled={users.length < 20} className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-50">{lang === 'es' ? 'Siguiente' : 'Next'}</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <HiOutlineUsers className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">{t('adminNoUsers')}</p>
        </div>
      )}
      {/* Selected User Detail Drawer Slide-Over */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedUser(null)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-lg bg-white h-full shadow-2xl flex flex-col z-10 animate-[slideOver_0.3s_ease-out]">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-base shrink-0">
                  {selectedUser.firstName[0]}{selectedUser.lastName[0]}
                </div>
                <div>
                  <h2 className="font-bold text-base text-gray-900 leading-tight">{selectedUser.firstName} {selectedUser.lastName}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">@{selectedUser.username} · {selectedUser.role.toUpperCase()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Profile Fields Card */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3.5">
                <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Datos de Contacto' : 'Contact Information'}</h3>
                
                <div className="grid grid-cols-1 gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <HiOutlineMail className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="font-medium text-gray-900 truncate">{selectedUser.email}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <HiOutlinePhone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{selectedUser.phone || (lang === 'es' ? 'No ingresado' : 'Not configured')}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <HiOutlineLocationMarker className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="truncate">{selectedUser.address || (lang === 'es' ? 'No ingresado' : 'Not configured')}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-gray-600">
                    <HiOutlineCalendar className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{lang === 'es' ? 'Registrado el' : 'Registered on'} {format(new Date(selectedUser.createdAt), "dd MMM yyyy", { locale: dateFnsLocale })}</span>
                  </div>
                </div>
              </div>

              {/* Purchase History Section */}
              <div className="space-y-3">
                <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Historial de Boletos' : 'Tickets Purchase History'}</h3>

                {loadingTickets ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 skeleton rounded-xl" />
                    ))}
                  </div>
                ) : selectedUserTickets.length > 0 ? (
                  <div className="space-y-3">
                    {selectedUserTickets.map((t: any) => (
                      <div key={t.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-[0_4px_15px_rgba(0,0,0,0.015)] hover:border-gray-200 transition-all">
                        <div className="min-w-0 space-y-1">
                          <p className="font-bold text-xs text-gray-900 truncate">{t.eventName || (lang === 'es' ? 'Evento' : 'Event')}</p>
                          <p className="text-[10px] text-gray-500">
                            {t.sectionName} · {lang === 'es' ? 'Asiento' : 'Seat'}: <span className="font-bold text-gray-700">{t.rowLabel}{t.seatNumber}</span>
                          </p>
                          <p className="text-[10px] font-mono text-primary-600 font-semibold">{t.ticketCode}</p>
                        </div>
                        <div className="text-right shrink-0 space-y-1.5">
                          <p className="text-xs font-bold text-gray-900">${Number(t.price || 0).toFixed(2)}</p>
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            t.status === 'active' ? 'bg-green-100 text-green-700' :
                            t.status === 'used' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-100 rounded-2xl text-gray-400 text-xs">
                    {lang === 'es' ? 'No se registran boletos comprados' : 'No ticket purchases found for this client'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
