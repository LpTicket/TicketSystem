'use client';

import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';

export default function NotFound() {
  const { lang } = useLang();
  const es = lang === 'es';
  return (
    <div className="page-dark-shell min-h-screen px-4 pt-28 pb-16">
      <section className="public-premium-card mx-auto max-w-2xl p-6 sm:p-10 text-center space-y-5">
        <p className="text-sm text-slate-400">404</p>
        <h1 className="public-premium-title text-2xl sm:text-3xl font-semibold">{es ? 'No encontramos esta página' : 'We could not find this page'}</h1>
        <p className="text-slate-300">{es ? 'El enlace puede haber cambiado. Puedes explorar los eventos o volver al inicio.' : 'The link may have changed. Explore events or return home.'}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/events" className="btn-primary">{es ? 'Explorar eventos' : 'Explore events'}</Link>
          <Link href="/" className="btn-secondary">{es ? 'Volver al inicio' : 'Return home'}</Link>
          <Link href="/support" className="btn-secondary">{es ? 'Necesito ayuda' : 'Get help'}</Link>
        </div>
      </section>
    </div>
  );
}
