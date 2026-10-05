'use client';

import { useLang } from '@/context/LanguageContext';
import { HiOutlineCalendar, HiOutlineTicket, HiOutlineDocumentText } from 'react-icons/hi';

export default function AppShowcase() {
  const { lang } = useLang();
  const es = lang === 'es';
  const panels = [
    { title: es ? 'Eventos' : 'Events', icon: HiOutlineCalendar },
    { title: es ? 'Mis entradas' : 'My tickets', icon: HiOutlineTicket },
    { title: es ? 'Mis recibos' : 'My receipts', icon: HiOutlineDocumentText },
  ];
  return <section className="lp-app-showcase public-premium-card p-6 sm:p-8" aria-labelledby="app-showcase-title">
    <div className="max-w-xl">
      <h2 id="app-showcase-title" className="text-2xl font-semibold text-white">{es ? 'Lleva tus experiencias contigo' : 'Take your experiences with you'}</h2>
      <p className="mt-3 text-sm text-slate-300">{es ? 'Descubre eventos y consulta tus entradas y recibos desde la aplicación de LPTicket.' : 'Discover events and access your tickets and receipts in the LPTicket app.'}</p>
      <a className="btn-primary inline-flex mt-5" href="https://apps.apple.com/us/app/lpticket/id6777589448?l=es-MX" target="_blank" rel="noopener noreferrer">{es ? 'Ver en App Store' : 'View on the App Store'}</a>
    </div>
    <div className="lp-app-fan" aria-hidden="true">
      {panels.map((panel, index) => <div key={panel.title} className={`lp-app-phone lp-app-phone-${index}`}>
        <img src="/logo.png" alt="" width="100" height="28" className="h-7 w-full object-contain" />
        <panel.icon className="w-9 h-9 mt-7 text-orange-400" />
        <p className="mt-3 font-semibold text-sm text-white">{panel.title}</p>
        <div className="lp-app-preview-block" /><div className="lp-app-preview-line" /><div className="lp-app-preview-line w-2/3" />
      </div>)}
    </div>
    <p className="text-xs text-slate-400 mt-2">{es ? 'Ilustración de las funciones de la app.' : 'Illustration of app features.'}</p>
  </section>;
}
