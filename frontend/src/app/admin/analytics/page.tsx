'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineChartBar, HiOutlineCursorClick, HiOutlineEye, HiOutlineUsers } from 'react-icons/hi';

type AnalyticsSummary = {
  days: number;
  totalViews: number;
  uniqueVisitors: number;
  topEvents: { eventSlug: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
  daily: { date: string; views: number; visitors: number }[];
  recentViews: {
    id: string;
    path: string;
    eventSlug?: string | null;
    deviceType?: string | null;
    referrerHost?: string | null;
    createdAt: string;
  }[];
};

export default function AdminAnalyticsPage() {
  const { lang } = useLang();
  const [days, setDays] = useState(7);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [days]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/analytics/summary', { params: { days } });
      setSummary(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const labels = {
    title: lang === 'es' ? 'Analíticas' : 'Analytics',
    subtitle: lang === 'es' ? 'Visitas de la página y eventos más vistos' : 'Site visits and most viewed events',
    totalViews: lang === 'es' ? 'Visitas totales' : 'Total views',
    visitors: lang === 'es' ? 'Visitantes únicos' : 'Unique visitors',
    eventViews: lang === 'es' ? 'Eventos vistos' : 'Viewed events',
    pages: lang === 'es' ? 'Páginas vistas' : 'Viewed pages',
    topEvents: lang === 'es' ? 'Eventos más vistos' : 'Top events',
    topPages: lang === 'es' ? 'Páginas más vistas' : 'Top pages',
    recent: lang === 'es' ? 'Actividad reciente' : 'Recent activity',
    noData: lang === 'es' ? 'Aún no hay datos para este periodo.' : 'No data for this period yet.',
  };

  const statCards = [
    { label: labels.totalViews, value: summary?.totalViews || 0, icon: HiOutlineEye },
    { label: labels.visitors, value: summary?.uniqueVisitors || 0, icon: HiOutlineUsers },
    { label: labels.eventViews, value: summary?.topEvents.length || 0, icon: HiOutlineCursorClick },
    { label: labels.pages, value: summary?.topPages.length || 0, icon: HiOutlineChartBar },
  ];

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="premium-page-title font-black text-2xl">{labels.title}</h1>
          <p className="premium-muted text-sm mt-1 font-medium">{labels.subtitle}</p>
        </div>
        <select value={days} onChange={(event) => setDays(Number(event.target.value))} className="input max-w-[180px] text-sm">
          <option value={1}>{lang === 'es' ? 'Últimas 24 horas' : 'Last 24 hours'}</option>
          <option value={7}>{lang === 'es' ? 'Últimos 7 días' : 'Last 7 days'}</option>
          <option value={30}>{lang === 'es' ? 'Últimos 30 días' : 'Last 30 days'}</option>
          <option value={90}>{lang === 'es' ? 'Últimos 90 días' : 'Last 90 days'}</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, index) => <div key={index} className="h-28 skeleton rounded-xl" />)}
        </div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div key={card.label} className="premium-stat-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">{card.label}</span>
                  <div className="w-10 h-10 rounded-lg bg-[rgba(10,55,90,0.08)] flex items-center justify-center">
                    <card.icon className="w-5 h-5 text-[#0A375A]" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <section className="premium-section-card p-5">
              <h2 className="font-bold text-gray-900 mb-4">{labels.topEvents}</h2>
              <div className="space-y-3">
                {summary.topEvents.length === 0 && <p className="text-sm text-gray-500">{labels.noData}</p>}
                {summary.topEvents.map((event) => (
                  <div key={event.eventSlug} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0">
                    <Link href={`/events/${event.eventSlug}`} className="min-w-0 truncate text-sm font-semibold text-[#0A375A] hover:text-primary-600">
                      {event.eventSlug}
                    </Link>
                    <span className="shrink-0 text-xs font-bold text-gray-500">{event.views} views · {event.visitors} visitors</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="premium-section-card p-5">
              <h2 className="font-bold text-gray-900 mb-4">{labels.topPages}</h2>
              <div className="space-y-3">
                {summary.topPages.length === 0 && <p className="text-sm text-gray-500">{labels.noData}</p>}
                {summary.topPages.map((page) => (
                  <div key={page.path} className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 last:border-0">
                    <span className="min-w-0 truncate text-sm font-semibold text-gray-700">{page.path}</span>
                    <span className="shrink-0 text-xs font-bold text-gray-500">{page.views} views · {page.visitors} visitors</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="premium-section-card p-5">
            <h2 className="font-bold text-gray-900 mb-4">{labels.recent}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
                    <th className="py-3 pr-4">Path</th>
                    <th className="py-3 pr-4">Event</th>
                    <th className="py-3 pr-4">Device</th>
                    <th className="py-3 pr-4">Referrer</th>
                    <th className="py-3 pr-4">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.recentViews.map((view) => (
                    <tr key={view.id}>
                      <td className="py-3 pr-4 text-gray-700">{view.path}</td>
                      <td className="py-3 pr-4 text-gray-500">{view.eventSlug || '-'}</td>
                      <td className="py-3 pr-4 text-gray-500">{view.deviceType || '-'}</td>
                      <td className="py-3 pr-4 text-gray-500">{view.referrerHost || '-'}</td>
                      <td className="py-3 pr-4 text-gray-500">{new Date(view.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
