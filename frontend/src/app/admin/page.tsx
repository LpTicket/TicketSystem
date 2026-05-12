'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineUsers,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineShoppingCart,
  HiOutlineTicket,
  HiOutlineUserGroup,
} from 'react-icons/hi';

interface DashboardStats {
  totalUsers: number;
  clients: number;
  admins: number;
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  totalTickets: number;
}

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const { data } = await api.get('/admin/stats');
      setStats(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-8 skeleton rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const mainCards = [
    { label: t('adminTotalRevenue'), value: `$${stats.totalRevenue.toFixed(2)}`, icon: HiOutlineCurrencyDollar, bg: 'bg-green-50', iconColor: 'text-green-600', iconBg: 'bg-green-100' },
    { label: t('adminTotalUsers'), value: stats.totalUsers.toString(), icon: HiOutlineUsers, bg: 'bg-blue-50', iconColor: 'text-blue-600', iconBg: 'bg-blue-100' },
    { label: t('adminTotalEvents'), value: stats.totalEvents.toString(), icon: HiOutlineCalendar, bg: 'bg-orange-50', iconColor: 'text-orange-600', iconBg: 'bg-orange-100' },
    { label: t('adminTotalOrders'), value: stats.totalOrders.toString(), icon: HiOutlineShoppingCart, bg: 'bg-purple-50', iconColor: 'text-purple-600', iconBg: 'bg-purple-100' },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-bold text-2xl text-gray-900">{t('adminDashboard')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Vista general de la plataforma' : 'Platform overview'}</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiOutlineUserGroup className="w-5 h-5 text-gray-400" />
            {t('adminUserManagement')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100 shadow-sm">
              <p className="text-2xl font-black text-blue-700">{stats.clients}</p>
              <p className="text-xs text-blue-600 font-bold mt-1 uppercase tracking-wider">
                {lang === 'es' ? 'Clientes-Organizadores' : 'Clients-Organizers'}
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100 shadow-sm">
              <p className="text-2xl font-black text-red-700">{stats.admins}</p>
              <p className="text-xs text-red-600 font-bold mt-1 uppercase tracking-wider">
                {lang === 'es' ? 'Administradores' : 'Administrators'}
              </p>
            </div>
          </div>
        </div>

        {/* Events & Tickets */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiOutlineTicket className="w-5 h-5 text-gray-400" />
            {t('adminEventManagement')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{stats.publishedEvents}</p>
              <p className="text-xs text-green-600 font-medium">{t('adminPublished')}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-yellow-700">{stats.draftEvents}</p>
              <p className="text-xs text-yellow-600 font-medium">{t('adminDrafts')}</p>
            </div>
            <div className="bg-indigo-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{stats.totalTickets}</p>
              <p className="text-xs text-indigo-600 font-medium">{t('adminTicketsSold')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
