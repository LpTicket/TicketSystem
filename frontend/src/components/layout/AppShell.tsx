'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Chatbot from '@/components/support/Chatbot';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { loadUser } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <>
      <Header />
      <main className="min-h-screen bg-white">{children}</main>
      <Footer />
      <Chatbot />
    </>
  );
}
