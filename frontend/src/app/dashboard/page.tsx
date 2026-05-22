'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { parseSafeDate, formatDateInTimezone, getTimezoneAbbr } from '@/lib/dateUtils';
import { Ticket, Order } from '@/types';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  HiOutlineTicket,
  HiOutlineShoppingCart,
  HiOutlineUser,
  HiOutlinePencil,
  HiOutlineCalendar,
  HiOutlineLocationMarker,
  HiOutlineCreditCard,
  HiOutlineCamera,
  HiOutlineX,
  HiOutlineDownload,
  HiOutlineSparkles,
  HiOutlineTag,
} from 'react-icons/hi';
import PaymentMethods from '@/components/dashboard/PaymentMethods';
import SocialMatchPanel from '@/components/social/SocialMatchPanel';
import MySpecialCodesPanel from '@/components/special-codes/MySpecialCodesPanel';
import { Suspense } from 'react';

function DashboardPageBody() {
  const { user, isAuthenticated, isLoading, updateProfile, mode, setMode } = useAuthStore();
  const { t, lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingSocialRequests, setPendingSocialRequests] = useState(0);
  const [activeTab, setActiveTab] = useState<'tickets' | 'orders' | 'profile' | 'payments' | 'social' | 'codes'>('tickets');
  const [editMode, setEditMode] = useState(false);
  const [ticketsPage, setTicketsPage] = useState(1);
  const [ticketsPagination, setTicketsPagination] = useState({ total: 0, pages: 1 });
  const [loadingMoreTickets, setLoadingMoreTickets] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPagination, setOrdersPagination] = useState({ total: 0, pages: 1 });
  const [loadingMoreOrders, setLoadingMoreOrders] = useState(false);
  const [profileForm, setProfileForm] = useState({ 
    firstName: '', 
    lastName: '', 
    phone: '', 
    email: '', 
    username: '', 
    idType: 'V', 
    idNumber: '', 
    address: '', 
    password: '' 
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated]);


  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      if (user) {
        setProfileForm({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone || '',
          email: user.email,
          username: user.username || '',
          idType: user.idType || 'V',
          idNumber: user.idNumber || '',
          address: user.address || '',
          password: ''
        });
      }
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'profile' || tabParam === 'orders' || tabParam === 'tickets' || tabParam === 'payments' || tabParam === 'social' || tabParam === 'codes') {
      setActiveTab(tabParam as 'tickets' | 'orders' | 'profile' | 'payments' | 'social' | 'codes');
    }
  }, [searchParams]);


  const loadData = async (ticketPage: number = 1, orderPage: number = 1) => {
    try {
      const [t, o] = await Promise.all([
        api.get('/orders/my-tickets', { params: { page: ticketPage, limit: 12 } }),
        api.get('/orders/my-orders', { params: { page: orderPage, limit: 20 } })
      ]);
      if (ticketPage === 1) {
        setTickets(t.data.data);
      } else {
        setTickets(prev => [...prev, ...t.data.data]);
      }
      setTicketsPagination(t.data.pagination);
      setTicketsPage(ticketPage);

      if (orderPage === 1) {
        setOrders(o.data.data);
      } else {
        setOrders(prev => [...prev, ...o.data.data]);
      }
      setOrdersPagination(o.data.pagination);
      setOrdersPage(orderPage);

      try {
        const social = await api.get('/social-match/me');
        const pending = (social.data.connections || []).filter((connection: any) => connection.status === 'pending' && connection.direction === 'incoming').length;
        setPendingSocialRequests(pending);
      } catch (error) {
        console.error(error);
      }
    } catch (err) { console.error(err); }
  };

  const loadMoreTickets = async () => {
    const nextPage = ticketsPage + 1;
    if (nextPage <= ticketsPagination.pages) {
      setLoadingMoreTickets(true);
      try {
        await loadData(nextPage, ordersPage);
      } finally {
        setLoadingMoreTickets(false);
      }
    }
  };

  const loadMoreOrders = async () => {
    const nextPage = ordersPage + 1;
    if (nextPage <= ordersPagination.pages) {
      setLoadingMoreOrders(true);
      try {
        await loadData(ticketsPage, nextPage);
      } finally {
        setLoadingMoreOrders(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    try {
      // Si la contraseña está vacía, la omitimos de la actualización
      const dataToUpdate: any = { ...profileForm };
      if (!dataToUpdate.password) {
        delete dataToUpdate.password;
      }
      await updateProfile(dataToUpdate);
      setEditMode(false);
      setProfileForm({ ...profileForm, password: '' });
      toast.success(lang === 'es' ? 'Perfil actualizado' : 'Profile updated');
    }
    catch { toast.error(lang === 'es' ? 'Error al actualizar perfil' : 'Error updating profile'); }
  };

  const handleAppleWallet = async (code: string) => {
    const loadingToast = toast.loading(lang === 'es' ? 'Abriendo Apple Wallet...' : 'Opening Apple Wallet...');
    try {
      const url = `${api.defaults.baseURL}/orders/ticket/${code}/apple-wallet`;
      
      // Direct navigation allows iOS Safari to natively parse and open the pass sheet!
      window.location.href = url;
      
      toast.success(lang === 'es' ? 'Abriendo pase de Apple Wallet...' : 'Opening Apple Wallet pass...', { id: loadingToast });
    } catch (err: any) {
      toast.error(lang === 'es' ? 'Error al abrir Apple Wallet' : 'Error opening Apple Wallet', { id: loadingToast });
    }
  };

  const handleGoogleWallet = async (code: string) => {
    const loadingToast = toast.loading(lang === 'es' ? 'Generando enlace para Google Wallet...' : 'Generating Google Wallet link...');
    try {
      const response = await api.get(`/orders/ticket/${code}/google-wallet`);
      if (response.data?.url) {
        window.open(response.data.url, '_blank');
        toast.success(lang === 'es' ? 'Redirigiendo a Google Wallet' : 'Redirecting to Google Wallet', { id: loadingToast });
      } else {
        throw new Error();
      }
    } catch (err: any) {
      toast.error(lang === 'es' ? 'El servidor no tiene configuradas las credenciales de Google Wallet todavía.' : 'Google Wallet credentials not configured on server yet.', { id: loadingToast });
    }
  };

  const dateFnsLocale = lang === 'es' ? es : enUS;

  if (isLoading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const tabs = [
    { id: 'tickets' as const, label: t('clientMyTickets'), icon: HiOutlineTicket, count: tickets.length },
    { id: 'orders' as const, label: t('clientHistory'), icon: HiOutlineShoppingCart, count: orders.length },
    { id: 'payments' as const, label: 'Pagos', icon: HiOutlineCreditCard },
    { id: 'social' as const, label: 'Social Match', icon: HiOutlineSparkles, count: pendingSocialRequests },
    { id: 'codes' as const, label: lang === 'es' ? 'Códigos' : 'Codes', icon: HiOutlineTag },
    { id: 'profile' as const, label: t('clientProfile'), icon: HiOutlineUser },
  ];

  const getTicketStatus = (status: string) => {
    switch (status) {
      case 'active': return { label: t('clientActive'), classes: 'bg-green-100 text-green-700' };
      case 'used': return { label: t('clientUsed'), classes: 'bg-gray-100 text-gray-500' };
      default: return { label: t('clientCancelled'), classes: 'bg-red-100 text-red-700' };
    }
  };

  const getOrderStatus = (status: string) => {
    switch (status) {
      case 'paid': return { label: t('clientPaid'), classes: 'bg-green-100 text-green-700' };
      case 'pending': return { label: t('clientPending'), classes: 'bg-yellow-100 text-yellow-700' };
      default: return { label: t('clientCancelled'), classes: 'bg-red-100 text-red-700' };
    }
  };

  return (
    <div className="dashboard-premium-shell max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-black text-2xl text-[#0A375A]">{t('clientHello')}, {user.firstName} 👋</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">{t('clientManage')}</p>
      </div>

      {/* Tabs */}
      <div className="dashboard-premium-tabs grid grid-cols-2 sm:flex sm:flex-row gap-1 mb-8">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); window.history.replaceState(null, '', `/dashboard?tab=${tab.id}`); }}
            className={`dashboard-premium-tab flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-[#0A375A] text-white shadow-sm' : 'text-slate-500 hover:bg-[rgba(10,55,90,0.06)] hover:text-[#0A375A]'}`}>
            <tab.icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{tab.label}</span>
            {tab.count !== undefined && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] sm:text-xs text-gray-500">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {activeTab === 'tickets' && (
        tickets.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map((ticket) => {
              const badge = getTicketStatus(ticket.status);
              return (
                <div key={ticket.id} className="dashboard-premium-ticket p-5 space-y-3 transition-all">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-[#0A375A] truncate">{ticket.event?.title || 'Evento'}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-semibold">
                        <HiOutlineCalendar className="w-3.5 h-3.5 shrink-0" />
                        {ticket.event?.eventDate && (
                          <>
                            {formatDateInTimezone(ticket.event.eventDate, ticket.event.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                            {ticket.event.eventTimezone && <span className="text-gray-400 ml-1">({getTimezoneAbbr(ticket.event.eventTimezone, ticket.event.eventDate)})</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ml-2 ${badge.classes}`}>{badge.label}</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p className="flex items-center gap-1.5"><HiOutlineLocationMarker className="w-4 h-4 text-gray-400" /> {ticket.event?.venueName}</p>
                    <p className="text-xs text-gray-500">
                      🪑 {formatSeatLabel(ticket, ticket.sectionName, lang)}
                    </p>
                    <p className="font-mono text-xs text-[#F97316] font-bold">{t('clientCode')}: {ticket.ticketCode}</p>
                    {ticket.createdAt && (
                      <p className="text-[10px] text-gray-400 font-medium pt-1">
                        🕒 {lang === 'es' ? 'Adquirido el' : 'Purchased on'}: {format(parseSafeDate(ticket.createdAt), "dd MMM yyyy — hh:mm a", { locale: dateFnsLocale })}
                      </p>
                    )}
                  </div>
                  {ticket.qrData && (
                    <div className="flex justify-center pt-1">
                      <img src={ticket.qrData} alt="QR" className="w-28 h-28 rounded-lg border border-gray-200" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 pt-2">
                    <Link href={`/verify/${ticket.ticketCode}`} className="btn-primary w-full text-xs py-2.5 justify-center shadow-lg shadow-primary-500/10">
                      {t('clientViewTicket')}
                    </Link>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => handleAppleWallet(ticket.ticketCode)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-black text-white rounded-lg text-[10px] font-bold hover:bg-gray-900 transition-all active:scale-95 shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.05 20.28c-.96.95-2.04 1.9-3.4 1.9-1.33 0-1.77-.82-3.32-.82-1.58 0-2.05.8-3.32.85-1.3.05-2.52-1.03-3.48-2.43-1.98-2.85-2.28-7.14-.8-9.15 1.05-1.4 2.5-2.3 4.1-2.3 1.25 0 2.22.8 3.03.8.78 0 2.05-.95 3.52-.8 1 .05 2.18.45 2.92 1.3-1.85 1.1-1.55 3.65.3 4.6-.9 1.35-2.05 2.7-3.05 3.75zm-3.08-15.65c.65-.8 1.1-1.9.98-3-.95.05-2.1.65-2.78 1.45-.62.7-1.12 1.85-.95 2.92 1.05.08 2.1-.58 2.75-1.37z"/>
                        </svg>
                        Apple Wallet
                      </button>
                      <button 
                        onClick={() => handleGoogleWallet(ticket.ticketCode)}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-white border border-gray-200 text-gray-700 rounded-lg text-[10px] font-bold hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 48 48">
                          <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                          <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                          <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A23.93 23.93 0 0 0 0 24c0 3.77.88 7.33 2.45 10.48l7.24-5.7.1-.6z"/>
                          <path fill="#EA4335" d="M24 9.5c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.54 29.93 0 24 0 15.4 0 7.96 4.93 4.34 12.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
                        </svg>
                        Google Wallet
                      </button>
                    </div>
                    <button 
                      onClick={() => window.open(`/verify/${ticket.ticketCode}`, '_blank')}
                      className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <HiOutlineDownload className="w-3.5 h-3.5" />
                      Descargar PDF / Imprimir
                    </button>
                  </div>
                </div>
              );
            })}
            </div>

            {ticketsPagination.pages > ticketsPage && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMoreTickets}
                  disabled={loadingMoreTickets}
                  className="px-6 py-2.5 bg-[#F97316] hover:bg-[#ea650c] text-white rounded-lg font-bold text-sm transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {loadingMoreTickets ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {lang === 'es' ? 'Cargando...' : 'Loading...'}</>
                  ) : (
                    <>{lang === 'es' ? 'Cargar más entradas' : 'Load more tickets'} ({ticketsPage}/{ticketsPagination.pages})</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="dashboard-premium-card text-center py-16">
            <HiOutlineTicket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-4">{t('clientNoTickets')}</p>
            <Link href="/events" className="btn-primary text-sm inline-flex">{t('clientExplore')}</Link>
          </div>
        )
      )}

      {/* Orders */}
      {activeTab === 'orders' && (
        orders.length > 0 ? (
          <div className="space-y-4">
            <div className="dashboard-premium-card overflow-hidden">
              <div className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const badge = getOrderStatus(order.status);
                  return (
                    <div key={order.id} className="px-5 py-4 flex items-center justify-between hover:bg-[rgba(10,55,90,0.04)] transition-colors">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 text-sm truncate">{order.event?.title || 'Evento'}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {format(parseSafeDate(order.createdAt), "dd MMM yyyy — hh:mm a", { locale: dateFnsLocale })} · {order.ticketCount} ticket(s)
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-4 space-y-2">
                        <div className="font-bold text-gray-900">${Number(order.total).toFixed(2)}</div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                        <Link
                          href={`/orders/${order.id}/receipt`}
                          className="block text-[11px] font-black text-[#0A375A] border border-[#0A375A]/20 rounded-lg px-3 py-1 hover:bg-[#0A375A]/5 transition-colors"
                        >
                          Ver recibo
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {ordersPagination.pages > ordersPage && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={loadMoreOrders}
                  disabled={loadingMoreOrders}
                  className="px-6 py-2.5 bg-[#F97316] hover:bg-[#ea650c] text-white rounded-lg font-bold text-sm transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {loadingMoreOrders ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {lang === 'es' ? 'Cargando...' : 'Loading...'}</>
                  ) : (
                    <>{lang === 'es' ? 'Cargar más pedidos' : 'Load more orders'} ({ordersPage}/{ordersPagination.pages})</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="dashboard-premium-card text-center py-16">
            <HiOutlineShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">{t('clientNoOrders')}</p>
          </div>
        )
      )}

      {/* Profile */}
      {activeTab === 'profile' && user && (
        <div className="max-w-2xl mx-auto">
          <div className="dashboard-premium-card p-8">
            <div className="flex flex-col items-center mb-10 text-center">
              <div className="relative group mb-4">
                <div className="w-24 h-24 rounded-full bg-primary-100 border-4 border-white shadow-lg flex items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={getImageUrl(`/uploads/${user.avatarUrl}`)} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-primary-600 uppercase">{user.firstName[0]}{user.lastName[0]}</span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-8 h-8 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                  <HiOutlineCamera className="w-4 h-4 text-primary-600" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const { uploadAvatar } = useAuthStore.getState();
                          await uploadAvatar(file);
                        } catch (err) {
                          toast.error(lang === 'es' ? 'Error al subir imagen' : 'Error uploading image');
                        }
                      }
                    }} 
                  />
                </label>
              </div>
              <h3 className="font-bold text-2xl text-gray-900 mb-1">{user.firstName} {user.lastName}</h3>
              <p className="text-gray-500 text-sm tracking-wide uppercase font-medium">{t(user.role as any) || user.role}</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-gray-50 pb-4">
                <h4 className="font-bold text-sm text-gray-400 uppercase tracking-widest">{t('clientPersonalInfo')}</h4>
                <button onClick={() => setEditMode(!editMode)} className="text-[#0A375A] hover:text-[#F97316] text-sm font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-all">
                  {editMode ? (
                    <span className="flex items-center gap-1"><HiOutlineX className="w-4 h-4" /> {t('orgCancel')}</span>
                  ) : (
                    <span className="flex items-center gap-1"><HiOutlinePencil className="w-4 h-4" /> {t('clientEdit')}</span>
                  )}
                </button>
              </div>

              {editMode ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-fade-in">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('firstName')}</label>
                    <input type="text" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} className="input dashboard-premium-input bg-gray-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('lastName')}</label>
                    <input type="text" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} className="input dashboard-premium-input bg-gray-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Nombre de Usuario' : 'Username'}</label>
                    <input type="text" value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} className="input dashboard-premium-input bg-gray-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('email')}</label>
                    <input type="email" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} className="input dashboard-premium-input bg-gray-50 focus:bg-white" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('phone')}</label>
                    <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className="input dashboard-premium-input bg-gray-50 focus:bg-white" />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Dirección' : 'Address'}</label>
                    <textarea value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })} className="w-full input dashboard-premium-input bg-gray-50 focus:bg-white min-h-[80px] py-3" />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Nueva Contraseña (Opcional)' : 'New Password (Optional)'}</label>
                    <input type="password" value={profileForm.password || ''} onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })} placeholder="******" className="input dashboard-premium-input bg-gray-50 focus:bg-white" />
                  </div>
                  <div className="sm:col-span-2 pt-4">
                    <button onClick={handleSaveProfile} className="btn-primary w-full py-3.5 rounded-lg font-bold shadow-lg shadow-primary-500/20">{t('clientSave')}</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-2">
                  <div className="group cursor-default">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('firstName')}</span>
                    </div>
                    <p className="text-gray-900 font-semibold flex items-center justify-between">
                      {user.firstName}
                      <HiOutlinePencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setEditMode(true)} />
                    </p>
                  </div>
                  <div className="group cursor-default">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('lastName')}</span>
                    </div>
                    <p className="text-gray-900 font-semibold flex items-center justify-between">
                      {user.lastName}
                      <HiOutlinePencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setEditMode(true)} />
                    </p>
                  </div>
                  <div className="group cursor-default">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{lang === 'es' ? 'Nombre de Usuario' : 'Username'}</span>
                    </div>
                    <p className="text-gray-900 font-semibold flex items-center justify-between">
                      @{user.username || '—'}
                      <HiOutlinePencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setEditMode(true)} />
                    </p>
                  </div>
                  <div className="group cursor-default">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('email')}</span>
                    </div>
                    <p className="text-gray-900 font-semibold flex items-center justify-between">
                      {user.email}
                      <HiOutlinePencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setEditMode(true)} />
                    </p>
                  </div>
                  <div className="group cursor-default">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('phone')}</span>
                    </div>
                    <p className="text-gray-900 font-semibold flex items-center justify-between">
                      {user.phone || '—'}
                      <HiOutlinePencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setEditMode(true)} />
                    </p>
                  </div>

                  <div className="group cursor-default sm:col-span-2">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{lang === 'es' ? 'Dirección' : 'Address'}</span>
                    </div>
                    <p className="text-gray-900 font-semibold flex items-center justify-between">
                      {user.address || '—'}
                      <HiOutlinePencil className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => setEditMode(true)} />
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'social' && (
        <div className="max-w-3xl mx-auto">
          <SocialMatchPanel lang={lang === 'es' ? 'es' : 'en'} />
        </div>
      )}

      {activeTab === 'codes' && (
        <div className="max-w-3xl mx-auto">
          <MySpecialCodesPanel lang={lang === 'es' ? 'es' : 'en'} />
        </div>
      )}

      {/* Payments */}
      {activeTab === 'payments' && (
        <PaymentMethods />
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardPageBody />
    </Suspense>
  );
}
