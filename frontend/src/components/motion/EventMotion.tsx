'use client';

import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const EventNavigation = createContext<((href: string) => boolean) | null>(null);
export const eventMotionName = (slug: string) => `lp-event-${slug.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/** Only public event links opt in; ordinary links and unsupported browsers keep Next navigation. */
export function EventMotionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<(() => void) | null>(null);
  useLayoutEffect(() => { pending.current?.(); }, [pathname]);
  useLayoutEffect(() => () => { pending.current?.(); }, []);

  const navigate = (href: string) => {
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches || pending.current) return false;
    const target = new URL(href, window.location.href);
    if (target.origin !== window.location.origin || target.pathname === pathname) return false;
    const transition = document.startViewTransition(() => new Promise<void>((resolve) => {
      // A slow request must never leave an interactive page covered by a snapshot.
      const timer = window.setTimeout(() => { transition.skipTransition(); finish(); }, 700);
      const finish = () => { window.clearTimeout(timer); pending.current = null; resolve(); };
      pending.current = finish;
      router.push(`${target.pathname}${target.search}`);
    }));
    void transition.ready.catch(() => {});
    void transition.finished.catch(() => {});
    return true;
  };
  return <EventNavigation.Provider value={navigate}>{children}</EventNavigation.Provider>;
}

export function EventMotionLink(props: ComponentProps<typeof Link>) {
  const navigate = useContext(EventNavigation);
  return <Link {...props} onNavigate={(event) => {
    props.onNavigate?.(event);
    if (typeof props.href === 'string' && navigate?.(props.href)) event.preventDefault();
  }} />;
}
