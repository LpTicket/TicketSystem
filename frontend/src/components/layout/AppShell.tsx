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
import { EventMotionProvider } from '@/components/motion/EventMotion';
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

  // Keep global chat/social widgets clear of administration and the dense event editor.
  const hideFloatingWidgets = isCheckout || pathname.startsWith('/admin') || pathname.startsWith('/organizer') || pathname.startsWith('/staff') || pathname.startsWith('/dashboard') || pathname === '/login' || pathname === '/register' || pathname === '/contact' || pathname === '/support';

  // Presentation refinement stays outside checkout, receipts and operational editors.
  const refinePresentation = !standalone && !isCheckout && !pathname.startsWith('/checkout')
    && !pathname.startsWith('/staff') && !/^\/organizer\/(events\/[^/]+|door-sale)/.test(pathname)
    && !pathname.startsWith('/admin/events/edit/');

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
    <EventMotionProvider>
      {supportSession && (
        <div role="status" className="lp-support-banner relative z-40 flex flex-wrap items-center justify-center gap-3 bg-[#0A375A] px-4 py-3 text-center text-sm font-semibold text-white shadow-lg">
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
      {!standalone && !isCheckout && <><a href="#main-content" className="lp-skip-link">{lang === 'es' ? 'Ir al contenido' : 'Skip to content'}</a><Header /></>}
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      <main id="main-content" tabIndex={-1} className={`min-h-screen w-full max-w-full overflow-x-clip ${refinePresentation ? 'lp-refined' : ''}`}>{children}</main>
      {!standalone && !isCheckout && <Footer />}
      {!standalone && !hideFloatingWidgets && <Chatbot />}
      {!standalone && !hideFloatingWidgets && <SocialMatchWidget />}
      <ConfirmDialogHost />
    </EventMotionProvider>
  );
}
