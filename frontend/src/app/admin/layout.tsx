'use client';

import {
  useEffect,
  useState } from 'react';
import { useRouter,
  usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineChartBar,
  HiOutlineCalendar,
  HiOutlineUsers,
  HiOutlineShoppingCart,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineArrowLeft,
  HiOutlineShieldCheck,
  HiOutlineTag,
  HiOutlineSpeakerphone,
  HiOutlineTrendingUp,
  HiOutlineDocumentText,
} from 'react-icons/hi';

import { useUIStore } from '@/stores/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const { t, lang } = useLang();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      router.push('/');
    }
  }, [isLoading, isAuthenticated, user]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: t('adminDashboard'), icon: HiOutlineChartBar },
    { href: '/admin/events', label: t('adminEvents'), icon: HiOutlineCalendar },
    { href: '/admin/users', label: t('adminUsers'), icon: HiOutlineUsers },
    { href: '/admin/categories', label: t('adminCategories'), icon: HiOutlineTag },
    { href: '/admin/special-codes', label: lang === 'es' ? 'Códigos especiales' : 'Special codes', icon: HiOutlineTag },
  { href: '/admin/marketing', label: 'Marketing', icon: HiOutlineSpeakerphone },
    { href: '/admin/analytics', label: lang === 'es' ? 'Analíticas' : 'Analytics', icon: HiOutlineTrendingUp },
    { href: '/admin/invoices', label: lang === 'es' ? 'Facturas' : 'Invoices', icon: HiOutlineDocumentText },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <div className="lp-management-layout min-h-[calc(100vh-80px)] flex">
      {/* Sidebar - Desktop */}
      <aside className="lp-sidebar hidden lg:flex flex-col w-64 shrink-0">
        <div className="lp-sidebar-header p-5">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-500 transition-colors mb-3">
            <HiOutlineArrowLeft className="w-4 h-4" />
            <span>{lang === 'es' ? 'Volver al sitio' : 'Back to site'}</span>
          </Link>
          <div className="flex items-center gap-2">
            <HiOutlineShieldCheck className="w-6 h-6 text-primary-500" />
            <h2 className="font-bold text-lg text-gray-900">{t('adminPanel')}</h2>
          </div>
          <p className="text-xs text-gray-500 mt-1">{user.firstName} {user.lastName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`lp-sidebar-link flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${isActive(item.href) ? 'active' : ''}`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile FAB */}
      <div className="lg:hidden fixed bottom-4 right-0 px-5 z-40">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="lp-mobile-sidebar-toggle w-12 h-12 flex items-center justify-center transition-colors"
        >
          {sidebarOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="lp-mobile-sidebar-panel relative w-72 flex flex-col animate-fade-in">
            <div className="lp-sidebar-header p-5">
              <div className="flex items-center gap-2">
                <HiOutlineShieldCheck className="w-6 h-6 text-primary-500" />
                <h2 className="font-bold text-lg text-gray-900">{t('adminPanel')}</h2>
              </div>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href) ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
