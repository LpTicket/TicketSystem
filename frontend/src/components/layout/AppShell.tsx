'use client';

import { Suspense, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Chatbot from '@/components/support/Chatbot';
import SocialMatchWidget from '@/components/social/SocialMatchWidget';
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loadUser } = useAuthStore();
  const pathname = usePathname() || '';

  // Standalone pages (e.g. the shared digital ticket) render clean, without the
  // site header/footer/floating widgets that would overlap the ticket.
  const standalone = pathname.startsWith('/verify/');

  // The organizer event editor (esp. the venue-map tab) has its own dense toolbar
  // and floating controls; the global chat/social widgets overlap it and break the
  // layout on small screens (e.g. iPhone SE). Hide them there.
  const hideFloatingWidgets = /^\/organizer\/events\/[^/]+/.test(pathname);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <>
      {!standalone && <Header />}
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      <main className="min-h-screen w-full max-w-full overflow-x-clip">{children}</main>
      {!standalone && <Footer />}
      {!standalone && !hideFloatingWidgets && <Chatbot />}
      {!standalone && !hideFloatingWidgets && <SocialMatchWidget />}
    </>
  );
}
