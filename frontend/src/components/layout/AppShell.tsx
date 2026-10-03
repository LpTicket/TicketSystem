'use client';

import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Chatbot from '@/components/support/Chatbot';
import SocialMatchWidget from '@/components/social/SocialMatchWidget';
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost';
import { useLang } from '@/context/LanguageContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loadUser, supportSession, stopSupportSession } = useAuthStore();
  const { lang } = useLang();
  const [restoringAdmin, setRestoringAdmin] = useState(false);
  const pathname = usePathname() || '';

  // Ticket and order-receipt pages render clean, without the site chrome that
  // would overlap their dedicated receipt toolbars.
  const isTicketPage = pathname.startsWith('/verify/');
  const isOrderReceipt = /^\/orders\/[^/]+\/receipt$/.test(pathname);
  const standalone = isTicketPage || isOrderReceipt;

  // Checkout pages have their own wizard nav — hide the global header/footer
  // so they don't collide with the sticky wizard breadcrumb.
  const isCheckout = pathname.endsWith('/purchase');

  // The organizer event editor (esp. the venue-map tab) has its own dense toolbar
  // and floating controls; the global chat/social widgets overlap it and break the
  // layout on small screens (e.g. iPhone SE). Hide them there.
  const hideFloatingWidgets = /^\/organizer\/events\/[^/]+/.test(pathname);

  useEffect(() => {
    const androidEventPage = /Android/i.test(navigator.userAgent)
      && /^\/events\/[^/]+\/?$/.test(pathname);
    document.documentElement.classList.toggle('android-event-browser', androidEventPage);
    return () => document.documentElement.classList.remove('android-event-browser');
  }, [pathname]);

  useEffect(() => {
    if (!isTicketPage) loadUser();
  }, [isTicketPage, loadUser]);

  return (
    <>
      {supportSession && (
        <div role="status" className="relative z-40 flex flex-wrap items-center justify-center gap-3 bg-[#0A375A] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
          <span>
            {lang === 'es' ? 'Sesión de soporte:' : 'Support session:'} {supportSession.user.firstName} {supportSession.user.lastName}
            {' · '}{lang === 'es' ? 'Acciones registradas' : 'Actions logged'}
          </span>
          <button
            type="button"
            disabled={restoringAdmin}
            onClick={async () => {
              setRestoringAdmin(true);
              const restored = await stopSupportSession();
              window.location.href = restored ? '/admin/users' : '/login';
            }}
            className="rounded-lg bg-[#F97316] px-4 py-2 font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          >
            {restoringAdmin ? (lang === 'es' ? 'Volviendo...' : 'Returning...') : (lang === 'es' ? 'Volver al administrador' : 'Return to admin')}
          </button>
        </div>
      )}
      {!standalone && !isCheckout && <Header />}
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      <main className="min-h-screen w-full max-w-full overflow-x-clip">{children}</main>
      {!standalone && !isCheckout && <Footer />}
      {!standalone && !hideFloatingWidgets && <Chatbot />}
      {!standalone && !hideFloatingWidgets && <SocialMatchWidget />}
      <ConfirmDialogHost />
    </>
  );
}
