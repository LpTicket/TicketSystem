'use client';

import { Suspense, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Chatbot from '@/components/support/Chatbot';
import SocialMatchWidget from '@/components/social/SocialMatchWidget';
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <>
      <Header />
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
      <main className="min-h-screen pt-16 lg:pt-20 overflow-x-hidden w-full">{children}</main>
      <Footer />
      <Chatbot />
      <SocialMatchWidget />
    </>
  );
}
