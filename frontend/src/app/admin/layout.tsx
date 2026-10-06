'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineMenu, HiOutlineX, HiOutlineArrowLeft, HiOutlineShieldCheck, HiOutlineChevronRight } from 'react-icons/hi';
import { useUIStore } from '@/stores/ui';
import { adminNavigation, adminGroups, getAdminSection } from '@/components/admin/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { lang } = useLang();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const section = getAdminSection(pathname);
  const nested = pathname !== section.href;
  const detailLabel = pathname.startsWith('/admin/events/edit/')
    ? (lang === 'es' ? 'Editar evento' : 'Edit event')
    : (lang === 'es' ? 'Detalle financiero' : 'Financial detail');

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) router.replace('/');
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => { setSidebarOpen(false); }, [pathname, setSidebarOpen]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setSidebarOpen(false); }
      if (event.key !== 'Tab') return;
      const controls = drawer.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      desktop.removeEventListener('change', closeOnDesktop);
      menuButton.current?.focus();
    };
  }, [sidebarOpen, setSidebarOpen]);

  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return <div role="status" aria-label={lang === 'es' ? 'Cargando administración' : 'Loading administration'} className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  const navigation = (
    <nav aria-label={lang === 'es' ? 'Herramientas de administración' : 'Administration tools'} className="p-3 space-y-5">
      {adminGroups.map(group => (
        <div key={group.id}>
          <p className="admin-nav-group px-3 mb-2">{lang === 'es' ? group.es : group.en}</p>
          <ul className="space-y-1">
            {adminNavigation.filter(item => item.group === group.id).map(item => (
              <li key={item.href}><Link href={item.href} aria-current={section.href === item.href ? 'page' : undefined} onClick={() => setSidebarOpen(false)} className={`lp-sidebar-link flex items-center gap-3 px-3 py-2.5 text-sm ${section.href === item.href ? 'active' : ''}`}>
                <item.icon aria-hidden="true" className="w-4 h-4 shrink-0" />
                <span>{lang === 'es' ? item.es : item.en}</span>
              </Link></li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="admin-workspace lp-management-layout min-h-[calc(100vh-80px)] flex">
      <aside className="admin-desktop-sidebar lp-sidebar hidden lg:flex flex-col w-60 shrink-0">
        <div className="lp-sidebar-header p-5">
          <div className="flex items-center gap-2"><HiOutlineShieldCheck className="w-5 h-5 text-primary-400" /><h2 className="text-base font-semibold">{lang === 'es' ? 'Administración' : 'Administration'}</h2></div>
          <p className="text-xs mt-2 break-words">{user.firstName} {user.lastName}</p>
        </div>
        <div className="flex-1 overflow-y-auto">{navigation}</div>
        <Link href="/" className="flex items-center gap-2 p-5 text-sm text-slate-400 hover:text-white border-t border-white/10"><HiOutlineArrowLeft />{lang === 'es' ? 'Ir al sitio público' : 'Open public site'}</Link>
      </aside>

      <div className="flex-1 min-w-0">
        <div className="admin-context-bar flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <nav aria-label={lang === 'es' ? 'Ubicación en administración' : 'Administration breadcrumb'} className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-slate-400">
            <Link href="/admin" aria-current={pathname === '/admin' ? 'page' : undefined} className="hover:text-white">{lang === 'es' ? 'Administración' : 'Administration'}</Link>
            {pathname !== '/admin' && <><HiOutlineChevronRight aria-hidden="true" /><Link href={section.href} aria-current={!nested ? 'page' : undefined} className="hover:text-white">{lang === 'es' ? section.es : section.en}</Link></>}
            {nested && <><HiOutlineChevronRight aria-hidden="true" /><span aria-current="page" className="text-slate-200">{detailLabel}</span></>}
          </nav>
          <button ref={menuButton} type="button" aria-expanded={sidebarOpen} aria-controls="admin-navigation-drawer" onClick={() => setSidebarOpen(true)} className="lg:hidden inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-white"><HiOutlineMenu />{lang === 'es' ? 'Herramientas' : 'Tools'}</button>
        </div>
        <div id="admin-content" className="min-w-0">{children}</div>
      </div>

      {sidebarOpen && <div className="lp-tools-overlay lg:hidden fixed inset-0 z-[250]">
        <div aria-hidden="true" className="absolute inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
        <div ref={drawer} id="admin-navigation-drawer" role="dialog" aria-modal="true" aria-labelledby="admin-navigation-title" className="admin-navigation-drawer relative flex h-full w-[min(320px,calc(100vw-2rem))] flex-col bg-[#081f33] border-r border-white/10 shadow-xl">
          <div className="lp-tools-heading flex items-center justify-between gap-3 p-5 border-b border-white/10"><h2 id="admin-navigation-title" className="text-base font-semibold text-white">{lang === 'es' ? 'Administración' : 'Administration'}</h2><button type="button" onClick={() => setSidebarOpen(false)} aria-label={lang === 'es' ? 'Cerrar herramientas' : 'Close tools'} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white hover:bg-white/10"><HiOutlineX className="w-5 h-5" /></button></div>
          <div className="flex-1 overflow-y-auto overscroll-contain">{navigation}<Link href="/" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 p-5 text-sm text-slate-300"><HiOutlineArrowLeft />{lang === 'es' ? 'Ir al sitio público' : 'Open public site'}</Link></div>
        </div>
      </div>}
    </div>
  );
}
