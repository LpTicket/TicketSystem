'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';

const VISITOR_KEY = 'lpticket_visitor_id';

function getVisitorId() {
  let visitorId = localStorage.getItem(VISITOR_KEY);
  if (!visitorId) {
    visitorId = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, visitorId);
  }
  return visitorId;
}

function getDeviceType() {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function getEventSlug(path: string) {
  const match = path.match(/^\/events\/([^/?#]+)/);
  return match?.[1] || null;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLang();

  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    if (typeof window === 'undefined') return;

    const timeout = window.setTimeout(() => {
      api.post('/analytics/page-view', {
        visitorId: getVisitorId(),
        path: `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`,
        eventSlug: getEventSlug(pathname),
        language: lang,
        referrer: document.referrer || null,
        deviceType: getDeviceType(),
      }).catch(() => {});
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [pathname, searchParams, lang]);

  return null;
}
