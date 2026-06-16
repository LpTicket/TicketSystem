'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { HiChevronDown, HiChevronUp, HiOutlineChartBar, HiOutlineCursorClick, HiOutlineEye, HiOutlineUsers } from 'react-icons/hi';

type AnalyticsSummary = {
  days: number;
  totalViews: number;
  uniqueVisitors: number;
  topEvents: { eventSlug: string; eventTitle?: string | null; views: number; visitors: number }[];
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
  const [recentOpen, setRecentOpen] = useState(false);

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
    views: lang === 'es' ? 'visitas' : 'views',
    visitorsLabel: lang === 'es' ? 'visitantes' : 'visitors',
  };

  const formatEventSlug = (slug: string) => {
    const parts = slug
      .split(/[/-]+/)
      .filter(Boolean)
      .filter((word, index, words) => {
        const isLast = index === words.length - 1;
        return !(isLast && /^[a-z0-9]{8,}$/i.test(word));
      });

    return parts
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
          <h1 className="premium-page-title font-black text-3xl">{labels.title}</h1>
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, index) => <div key={index} className="h-28 skeleton rounded-xl" />)}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="premium-section-card p-5 space-y-3">
                <div className="h-5 skeleton rounded w-1/3 mb-2" />
                {[...Array(5)].map((_, j) => <div key={j} className="h-12 skeleton rounded-xl" />)}
              </div>
            ))}
          </div>
        </>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <div key={card.label} className="premium-stat-card p-5 bg-white/90 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-500">{card.label}</span>
                  <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
                    <card.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-950 tracking-tight">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
            <section className="premium-section-card p-5 bg-white/95 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-black text-gray-950">{labels.topEvents}</h2>
                <span className="text-xs font-bold text-gray-400">{summary.topEvents.length}</span>
              </div>
              <div className="max-h-[340px] overflow-y-auto pr-2 space-y-2">
                {summary.topEvents.length === 0 && <p className="text-sm text-gray-500">{labels.noData}</p>}
                {summary.topEvents.map((event, index) => (
                  <div key={event.eventSlug} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3">
                    <div className="public-premium-icon w-8 h-8 flex items-center justify-center text-xs font-black">{index + 1}</div>
                    <Link href={`/events/${event.eventSlug}`} className="min-w-0 flex-1 truncate text-sm font-bold text-[#0A375A] hover:text-primary-600">
                      {event.eventTitle || formatEventSlug(event.eventSlug)}
                    </Link>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-gray-600 border border-gray-100">
                      {event.views} {labels.views} · {event.visitors} {labels.visitorsLabel}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="premium-section-card p-5 bg-white/95 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-black text-gray-950">{labels.topPages}</h2>
                <span className="text-xs font-bold text-gray-400">{summary.topPages.length}</span>
              </div>
              <div className="max-h-[340px] overflow-y-auto pr-2 space-y-2">
                {summary.topPages.length === 0 && <p className="text-sm text-gray-500">{labels.noData}</p>}
                {summary.topPages.map((page, index) => (
                  <div key={page.path} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-3">
                    <div className="public-premium-icon w-8 h-8 flex items-center justify-center text-xs font-black">{index + 1}</div>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-700">{page.path}</span>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-gray-600 border border-gray-100">
                      {page.views} {labels.views} · {page.visitors} {labels.visitorsLabel}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="premium-section-card overflow-hidden bg-white/95 shadow-sm">
            <button type="button" onClick={() => setRecentOpen((open) => !open)} className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
              <div>
                <h2 className="font-black text-gray-950">{labels.recent}</h2>
                <p className="text-xs font-semibold text-gray-400 mt-1">{summary.recentViews.length} {labels.views}</p>
              </div>
              <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
                {recentOpen ? <HiChevronUp className="w-5 h-5" /> : <HiChevronDown className="w-5 h-5" />}
              </div>
            </button>
            {recentOpen && (
              <div className="border-t border-white/10 px-6 sm:px-8 pt-3 pb-6">
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#0b2236] z-10">
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
                        <tr key={view.id} className="hover:bg-gray-50/70">
                          <td className="py-3 pr-4 text-gray-800 font-semibold max-w-[280px] truncate">{view.path}</td>
                          <td className="py-3 pr-4 text-gray-500 max-w-[220px] truncate">{view.eventSlug || '-'}</td>
                          <td className="py-3 pr-4 text-gray-500">{view.deviceType || '-'}</td>
                          <td className="py-3 pr-4 text-gray-500">{view.referrerHost || '-'}</td>
                          <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{new Date(view.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
