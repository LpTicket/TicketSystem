'use client';

import { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Chatbot from '@/components/support/Chatbot';
import SocialMatchWidget from '@/components/social/SocialMatchWidget';
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';
import ConfirmDialogHost from '@/components/ui/ConfirmDialogHost';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loadUser } = useAuthStore();
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
    if (!isTicketPage) loadUser();
  }, [isTicketPage, loadUser]);

  return (
    <>
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
