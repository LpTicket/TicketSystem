'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useLang } from '@/context/LanguageContext';

type Day = { date: string; views: number; visitors: number };
export default function DailyTrend({ daily }: { daily: Day[] }) {
  const { lang } = useLang();
  const reduced = useReducedMotion();
  const [line, setLine] = useState(false);
  const es = lang === 'es';
  const max = Math.max(1, ...daily.map(day => day.views));
  const points = daily.map((day, index) => ({ x: 24 + index * (552 / Math.max(1, daily.length - 1)), y: 170 - (day.views / max) * 140 }));
  const path = points.map((point, index) => {
    const next = points[index + 1] || point;
    const half = Math.min(14, 200 / Math.max(1, daily.length));
    return line ? `M${point.x},${point.y} L${point.x},${point.y} L${next.x},${next.y} L${next.x},${next.y} Z`
      : `M${point.x-half},170 L${point.x-half},${point.y} L${point.x+half},${point.y} L${point.x+half},170 Z`;
  }).join(' ');
  return <section className="premium-section-card p-5" aria-labelledby="daily-trend-title">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <h2 id="daily-trend-title" className="font-semibold">{es ? 'Visitas por día' : 'Daily views'}</h2>
      <div className="inline-flex gap-2" aria-label={es ? 'Vista de la gráfica' : 'Chart view'}>
        <button type="button" className={line ? 'btn-secondary' : 'btn-primary'} aria-pressed={!line} onClick={() => setLine(false)}>{es ? 'Barras' : 'Bars'}</button>
        <button type="button" className={line ? 'btn-primary' : 'btn-secondary'} aria-pressed={line} onClick={() => setLine(true)}>{es ? 'Línea' : 'Line'}</button>
      </div>
    </div>
    {daily.length ? <>
      <svg className="w-full h-auto max-h-64" viewBox="0 0 600 200" role="img" aria-label={es ? 'Visitas diarias. Los valores exactos están en la tabla inferior.' : 'Daily views. Exact values are in the table below.'}>
        <path d="M16 170 H584" stroke="#365874" />
        <motion.path initial={false} animate={{ d: path, fill: line ? '#ff7a0000' : '#ff7a00', strokeWidth: line ? 3 : 0 }} transition={{ duration: reduced ? 0 : .4, ease: [.22, 1, .36, 1] }} stroke="#ff7a00" />
        {points.map((point, index) => <circle key={daily[index].date} cx={point.x} cy={point.y} r={line ? 3 : 0} fill="#ffb56b"><title>{daily[index].date}: {daily[index].views}</title></circle>)}
        <text x="24" y="192" fill="#94a3b8" fontSize="12">{daily[0].date}</text>
        {daily.length > 1 && <text x="576" y="192" textAnchor="end" fill="#94a3b8" fontSize="12">{daily[daily.length-1].date}</text>}
      </svg>
      <details className="mt-3"><summary className="cursor-pointer py-3 text-sm">{es ? 'Ver cifras exactas' : 'View exact figures'}</summary><div className="max-h-64 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2">{es ? 'Fecha' : 'Date'}</th><th>{es ? 'Visitas' : 'Views'}</th><th>{es ? 'Visitantes' : 'Visitors'}</th></tr></thead><tbody>{daily.map(day => <tr key={day.date}><td className="py-2">{day.date}</td><td>{day.views}</td><td>{day.visitors}</td></tr>)}</tbody></table></div></details>
    </> : <p className="text-sm text-slate-400">{es ? 'Aún no hay visitas para este periodo.' : 'No views for this period yet.'}</p>}
  </section>;
}
