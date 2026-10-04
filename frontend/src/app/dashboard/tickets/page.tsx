'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Redirect /dashboard/tickets to /dashboard with tickets tab
export default function DashboardTicketsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard?tab=tickets');
  }, [router]);
  return null;
}
