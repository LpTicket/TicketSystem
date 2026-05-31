'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { parseSafeDate } from '@/lib/dateUtils';
import { formatSeatLabel } from '@/lib/seatLabel';
import { toast } from 'react-hot-toast';
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
  HiOutlinePencil,
  HiOutlineUserAdd,
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

  // User Profile Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // User Profile Creation states
  const [isCreating, setIsCreating] = useState(false);
  const [createFirstName, setCreateFirstName] = useState('');
  const [createLastName, setCreateLastName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState('client');
  const [createPhone, setCreatePhone] = useState('');
  const [createAddress, setCreateAddress] = useState('');
  const [creatingLoading, setCreatingLoading] = useState(false);

  const handleSelectUser = async (u: User, startEditing: boolean = false) => {
    setSelectedUser(u);
    setIsEditing(startEditing);
    setEditFirstName(u.firstName || '');
    setEditLastName(u.lastName || '');
    setEditEmail(u.email || '');
    setEditPhone(u.phone || '');
    setEditAddress(u.address || '');
    setEditPassword('');

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

  const handleSaveUserEdit = async () => {
    if (!selectedUser) return;
    if (!editFirstName.trim() || !editLastName.trim() || !editEmail.trim()) {
      toast.error(lang === 'es' ? 'Nombre, Apellido y Correo son requeridos.' : 'First Name, Last Name and Email are required.');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: any = {
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        phone: editPhone,
        address: editAddress,
      };
      if (editPassword.trim()) {
        payload.password = editPassword;
      }
      
      const { data } = await api.patch(`/admin/users/${selectedUser.id}`, payload);
      
      toast.success(lang === 'es' ? 'Datos del cliente actualizados exitosamente.' : 'Client profile updated successfully.');
      setSelectedUser(prev => prev ? { ...prev, ...data } : null);
      setIsEditing(false);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error al actualizar' : 'Failed to update'));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateUser = async () => {
    if (!createFirstName.trim() || !createLastName.trim() || !createUsername.trim() || !createEmail.trim()) {
      toast.error(lang === 'es' ? 'Nombre, Apellido, Nombre de Usuario y Correo son requeridos.' : 'First Name, Last Name, Username and Email are required.');
      return;
    }

    setCreatingLoading(true);
    try {
      const payload = {
        firstName: createFirstName,
        lastName: createLastName,
        username: createUsername,
        email: createEmail,
        password: createPassword || undefined,
        role: createRole,
        phone: createPhone,
        address: createAddress,
      };

      await api.post('/admin/users', payload);
      toast.success(lang === 'es' ? 'Usuario creado exitosamente.' : 'User created successfully.');
      
      // Clean states
      setIsCreating(false);
      setCreateFirstName('');
      setCreateLastName('');
      setCreateUsername('');
      setCreateEmail('');
      setCreatePassword('');
      setCreateRole('client');
      setCreatePhone('');
      setCreateAddress('');

      await loadUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'Error al crear usuario' : 'Failed to create user'));
    } finally {
      setCreatingLoading(false);
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
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      await loadUsers();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
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
      default: return { label: lang === 'es' ? 'Cliente' : 'Client', classes: 'bg-[rgba(10,55,90,0.10)] text-[#0A375A]' };
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return u.firstName.toLowerCase().includes(term) || u.lastName.toLowerCase().includes(term) || u.email.toLowerCase().includes(term);
  });

  return (
    <>
      <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="premium-page-title font-black text-2xl">{t('adminUserManagement')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Administra los usuarios de la plataforma' : 'Manage platform users'}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        <div className="flex flex-col lg:flex-row gap-3 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {roleFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={`flex-1 sm:flex-none justify-center px-4 py-2.5 sm:py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap active:scale-95 ${
                  filter === f.key ? 'bg-gradient-to-b from-[#ff8a18] via-[#f46c00] to-[#c93f00] text-white font-bold border border-[rgba(255,151,45,0.62)] shadow-[0_10px_24px_rgba(255,104,0,0.24)]' : 'bg-[rgba(8,31,51,0.6)] border border-[rgba(246,198,95,0.18)] text-slate-300 hover:bg-[rgba(249,115,22,0.12)] hover:border-[rgba(249,115,22,0.4)] hover:text-white'
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
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 bg-white"
            />
          </div>
        </div>

        {/* Create User Button */}
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2.5 bg-[#0A375A] hover:bg-[#0A375A] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer self-start lg:self-auto shrink-0"
        >
          <HiOutlineUserAdd className="w-4 h-4" />
          {lang === 'es' ? 'Crear Usuario' : 'Create User'}
        </button>
      </div>

      {/* Users Table / Cards */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 skeleton rounded-lg" />)}</div>
      ) : filteredUsers.length > 0 ? (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto overflow-y-auto max-h-[65vh] custom-scrollbar">
      <div className="mb-4 inline-flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
          <span className="text-sm font-black">US</span>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-gray-400">Usuarios registrados</p>
          <p className="text-2xl font-black text-[#0A375A]">{users.length}</p>
        </div>
      </div>

              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#0d2236] border-b border-gray-200">
                    <th className="text-left px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Usuario' : 'User'}</th>
                    <th className="text-left px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                    <th className="text-center px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('adminRole')}</th>
                    <th className="text-center px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Estado' : 'Status'}</th>
                    <th className="text-left px-4 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider hidden xl:table-cell">{lang === 'es' ? 'Registro' : 'Registered'}</th>
                    <th className="text-right px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">{t('adminActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((u) => {
                    const roleBadge = getRoleBadge(u.role);
                    return (
                      <tr 
                        key={u.id} 
                        onClick={() => handleSelectUser(u)}
                        className="hover:bg-gray-50/75 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-sm font-bold text-primary-700 shrink-0 shadow-sm border border-primary-100 uppercase">
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{u.firstName} {u.lastName}</p>
                              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">@{u.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 hidden lg:table-cell font-medium">{u.email}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${roleBadge.classes}`}>{roleBadge.label}</span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {u.isActive ? t('adminActive') : t('adminInactive')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500 hidden xl:table-cell font-medium">
                          {format(parseSafeDate(u.createdAt), "dd MMM yyyy", { locale: dateFnsLocale })}
                        </td>
                        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <select
                              value={u.role}
                              onChange={(e) => handleChangeRole(u.id, e.target.value)}
                              className="text-[11px] font-bold border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 bg-white"
                            >
                              <option value="client">{lang === 'es' ? 'Cliente' : 'Client'}</option>
                              <option value="admin">Admin</option>
                            </select>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSelectUser(u, true); }}
                              className="p-2 rounded-lg text-[#0A375A] hover:text-[#0A375A] hover:bg-[rgba(10,55,90,0.06)] transition-colors"
                              title={lang === 'es' ? 'Editar usuario' : 'Edit user'}
                            >
                              <HiOutlinePencil className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(u.id)}
                              className={`p-2 rounded-lg transition-colors ${u.isActive ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-400 hover:text-green-600 hover:bg-green-50'}`}
                            >
                              {u.isActive ? <HiOutlineBan className="w-5 h-5" /> : <HiOutlineCheckCircle className="w-5 h-5" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id, u.firstName)}
                              className="p-2 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"
                            >
                              <HiOutlineTrash className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredUsers.map((u) => {
              const roleBadge = getRoleBadge(u.role);
              return (
                <div 
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  className="premium-section-card p-4 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-700 uppercase">
                        {u.firstName[0]}{u.lastName[0]}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm leading-tight">{u.firstName} {u.lastName}</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">@{u.username}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${roleBadge.classes}`}>
                      {roleBadge.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                      <HiOutlineMail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? t('adminActive') : t('adminInactive')}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium italic">
                        {format(parseSafeDate(u.createdAt), "dd/MM/yy", { locale: dateFnsLocale })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2" onClick={e => e.stopPropagation()}>
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeRole(u.id, e.target.value)}
                      className="flex-1 text-[11px] font-bold border border-gray-200 rounded-lg px-2 py-2 bg-gray-50"
                    >
                      <option value="client">{lang === 'es' ? 'Cliente' : 'Client'}</option>
                      <option value="admin">Admin</option>
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSelectUser(u, true); }}
                        className="p-2.5 rounded-xl border border-[rgba(10,55,90,0.14)] text-[#0A375A] bg-[rgba(10,55,90,0.06)]"
                        title={lang === 'es' ? 'Editar usuario' : 'Edit user'}
                      >
                        <HiOutlinePencil className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(u.id)}
                        className={`p-2.5 rounded-xl border ${u.isActive ? 'border-red-100 text-red-500 bg-red-50' : 'border-green-100 text-green-500 bg-green-50'}`}
                      >
                        {u.isActive ? <HiOutlineBan className="w-5 h-5" /> : <HiOutlineCheckCircle className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.firstName)}
                        className="p-2.5 rounded-xl border border-gray-100 text-gray-400 bg-gray-50"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-white rounded-xl border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{total} {lang === 'es' ? 'usuarios' : 'users'}</p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 transition-colors uppercase tracking-tight">{lang === 'es' ? 'Anterior' : 'Prev'}</button>
                <button onClick={() => setPage(page + 1)} disabled={users.length < 20} className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-50 transition-colors">{lang === 'es' ? 'Siguiente' : 'Next'}</button>
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
      </div>

      {/* Selected User Detail Centered Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-md transition-opacity"
            onClick={() => setSelectedUser(null)}
          />
          
          {/* Centered Modal Panel */}
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col z-10 max-h-[85vh] overflow-hidden animate-[scaleIn_0.2s_ease-out]">
            {/* Modal Header */}
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Profile Fields Card */}
              {isEditing ? (
                <div className="bg-white border-2 border-primary-100 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in">
                  <h3 className="font-bold text-[11px] text-primary-600 uppercase tracking-widest">{lang === 'es' ? 'Editar Perfil de Cliente' : 'Edit Client Profile'}</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{lang === 'es' ? 'Nombre' : 'First Name'}</label>
                      <input 
                        type="text" 
                        value={editFirstName} 
                        onChange={e => setEditFirstName(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{lang === 'es' ? 'Apellido' : 'Last Name'}</label>
                      <input 
                        type="text" 
                        value={editLastName} 
                        onChange={e => setEditLastName(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{lang === 'es' ? 'Correo Electrónico' : 'Email Address'}</label>
                      <input 
                        type="email" 
                        value={editEmail} 
                        onChange={e => setEditEmail(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{lang === 'es' ? 'Teléfono' : 'Phone'}</label>
                      <input 
                        type="text" 
                        value={editPhone} 
                        onChange={e => setEditPhone(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium text-gray-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{lang === 'es' ? 'Dirección' : 'Address'}</label>
                      <input 
                        type="text" 
                        value={editAddress} 
                        onChange={e => setEditAddress(e.target.value)} 
                        className="w-full bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium text-gray-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">{lang === 'es' ? 'Nueva Contraseña (Opcional)' : 'New Password (Optional)'}</label>
                      <input 
                        type="password" 
                        value={editPassword} 
                        onChange={e => setEditPassword(e.target.value)} 
                        placeholder={lang === 'es' ? 'Dejar en blanco para no cambiar' : 'Leave blank to keep current'}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-primary-500 focus:bg-white rounded-xl px-3 py-2 text-xs outline-none transition-all font-medium text-gray-800 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3.5">
                  <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Datos de Contacto' : 'Contact Information'}</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
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
                      <span>{lang === 'es' ? 'Registrado el' : 'Registered on'} {format(parseSafeDate(selectedUser.createdAt), "dd MMM yyyy", { locale: dateFnsLocale })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase History Section */}
              <div className="space-y-3">
                <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Historial de Boletos' : 'Tickets Purchase History'}</h3>
                
                <div className="min-h-[180px] max-h-[280px] overflow-y-auto pr-1 select-none mt-2">
                  {loadingTickets ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-20 skeleton rounded-2xl" />
                      ))}
                    </div>
                  ) : selectedUserTickets.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedUserTickets.map((t: any) => (
                        <div key={t.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-start justify-between gap-3 shadow-[0_4px_15px_rgba(0,0,0,0.015)] hover:border-gray-200 transition-all">
                          <div className="min-w-0 space-y-1">
                            <p className="font-bold text-xs text-gray-900 truncate">{t.eventName || (lang === 'es' ? 'Evento' : 'Event')}</p>
                            <p className="text-[10px] text-gray-500">
                              {t.sectionName} · {lang === 'es' ? 'Asiento' : 'Seat'}: <span className="font-bold text-gray-700">{formatSeatLabel({ rowLabel: t.rowLabel, seatNumber: t.seatNumber }, undefined, lang)}</span>
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
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-2xl text-gray-400 text-xs font-medium">
                      {lang === 'es' ? 'No se registran boletos comprados' : 'No ticket purchases found for this client'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={savingEdit}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {lang === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUserEdit}
                    disabled={savingEdit}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-primary-500 text-white hover:bg-primary-600 active:scale-95 transition-all shadow-md shadow-primary-500/15 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {savingEdit ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {lang === 'es' ? 'Guardando...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <span>💾</span>
                        {lang === 'es' ? 'Guardar Cambios' : 'Save Changes'}
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-primary-600 hover:text-primary-700 hover:bg-primary-50/50 flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <HiOutlinePencil className="w-4 h-4" />
                    {lang === 'es' ? 'Editar Datos' : 'Edit Profile'}
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-gray-800 transition-all shadow-sm cursor-pointer"
                  >
                    {lang === 'es' ? 'Cerrar' : 'Close'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Create User Centered Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-md transition-opacity animate-fade-in"
            onClick={() => setIsCreating(false)}
          />
          
          {/* Centered Modal Panel */}
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col z-10 max-h-[90vh] overflow-hidden animate-[scaleIn_0.2s_ease-out]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[rgba(10,55,90,0.10)] text-[#0A375A] flex items-center justify-center font-bold text-lg shrink-0">
                  ➕
                </div>
                <div>
                  <h2 className="font-bold text-base text-gray-900 leading-tight">
                    {lang === 'es' ? 'Crear Nuevo Usuario' : 'Create New User'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lang === 'es' ? 'Registra una cuenta de forma manual' : 'Manually register a user account'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsCreating(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Nombre *' : 'First Name *'}
                  </label>
                  <input 
                    type="text" 
                    value={createFirstName} 
                    onChange={e => setCreateFirstName(e.target.value)} 
                    placeholder={lang === 'es' ? 'Ej. Juan' : 'e.g. John'}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Apellido *' : 'Last Name *'}
                  </label>
                  <input 
                    type="text" 
                    value={createLastName} 
                    onChange={e => setCreateLastName(e.target.value)} 
                    placeholder={lang === 'es' ? 'Ej. Pérez' : 'e.g. Doe'}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Nombre de Usuario *' : 'Username *'}
                  </label>
                  <input 
                    type="text" 
                    value={createUsername} 
                    onChange={e => setCreateUsername(e.target.value)} 
                    placeholder={lang === 'es' ? 'Ej. juanperez' : 'e.g. johndoe'}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Correo Electrónico *' : 'Email Address *'}
                  </label>
                  <input 
                    type="email" 
                    value={createEmail} 
                    onChange={e => setCreateEmail(e.target.value)} 
                    placeholder="juan@lpticket.com"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Rol *' : 'Role *'}
                  </label>
                  <select 
                    value={createRole} 
                    onChange={e => setCreateRole(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-bold text-gray-800"
                  >
                    <option value="client">{lang === 'es' ? 'Cliente / Comprador' : 'Client / Buyer'}</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5 flex items-center justify-between">
                    <span>{lang === 'es' ? 'Contraseña (Opcional)' : 'Password (Optional)'}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        const randomPass = Math.random().toString(36).slice(-8) + 'LP!';
                        setCreatePassword(randomPass);
                        navigator.clipboard.writeText(randomPass);
                        toast.success(lang === 'es' ? 'Clave generada y copiada al portapapeles' : 'Password generated and copied to clipboard');
                      }}
                      className="text-[10px] text-[#0A375A] hover:text-[#0A375A] font-bold lowercase normal-case cursor-pointer"
                    >
                      ⚡ {lang === 'es' ? 'Generar clave' : 'Generate pass'}
                    </button>
                  </label>
                  <input 
                    type="text" 
                    value={createPassword} 
                    onChange={e => setCreatePassword(e.target.value)} 
                    placeholder={lang === 'es' ? 'Por defecto: LPticket2026!' : 'Default: LPticket2026!'}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Teléfono' : 'Phone'}
                  </label>
                  <input 
                    type="text" 
                    value={createPhone} 
                    onChange={e => setCreatePhone(e.target.value)} 
                    placeholder="+54 9 11 1234-5678"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase mb-1.5">
                    {lang === 'es' ? 'Dirección' : 'Address'}
                  </label>
                  <input 
                    type="text" 
                    value={createAddress} 
                    onChange={e => setCreateAddress(e.target.value)} 
                    placeholder="Av. Santa Fe 1234, CABA"
                    className="w-full bg-gray-50 border border-gray-200 focus:border-blue-500 focus:bg-white rounded-xl px-3.5 py-2.5 text-xs outline-none transition-all font-medium text-gray-800"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                disabled={creatingLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-50"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCreateUser}
                disabled={creatingLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0A375A] text-white hover:bg-[#0A375A] active:scale-95 transition-all shadow-md shadow-blue-500/15 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {creatingLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {lang === 'es' ? 'Creando...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    {lang === 'es' ? 'Crear Usuario' : 'Create User'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
