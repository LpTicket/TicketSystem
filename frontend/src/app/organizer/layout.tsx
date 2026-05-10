'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineChartBar,
  HiOutlineCalendar,
  HiOutlinePlusCircle,
  HiOutlineUsers,
  HiOutlineCog,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineArrowLeft,
} from 'react-icons/hi';

import { useUIStore } from '@/stores/ui';

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, mode, setMode } = useAuthStore();
  const { t } = useLang();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || (user?.role !== 'client' && user?.role !== 'admin'))) {
      router.push('/');
    }
    // Ensure mode is organizer when in this layout
    if (!isLoading && isAuthenticated && mode !== 'organizer') {
      setMode('organizer');
    }
  }, [isLoading, isAuthenticated, user, mode, setMode]);


  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navItems = [
    { href: '/organizer', label: t('orgDashboard'), icon: HiOutlineChartBar },
    { href: '/organizer/events', label: t('orgMyEvents'), icon: HiOutlineCalendar },
    { href: '/organizer/events/create', label: t('orgCreateEvent'), icon: HiOutlinePlusCircle },
    { href: '/organizer/attendees', label: t('orgAttendees'), icon: HiOutlineUsers },
  ];

  const isActive = (href: string) => {
    if (href === '/organizer') return pathname === '/organizer';
    if (href === '/organizer/events') return pathname === '/organizer/events';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] flex bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 shrink-0">
        <div className="p-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-primary-500 transition-colors mb-3">
            <HiOutlineArrowLeft className="w-4 h-4" />
            <span>{t('orgBackToDashboard')}</span>
          </Link>
          <h2 className="font-bold text-lg text-gray-900">{t('orgPanel')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{user.firstName} {user.lastName}</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.href)
                  ? 'bg-primary-50 text-primary-600 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive(item.href) ? 'text-primary-500' : 'text-gray-400'}`} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-sm font-bold text-white">
              {user.firstName[0]}{user.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user.firstName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="w-12 h-12 rounded-full bg-primary-500 text-white shadow-lg flex items-center justify-center hover:bg-primary-600 transition-colors"
        >
          {sidebarOpen ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineMenu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-72 bg-white shadow-xl flex flex-col animate-fade-in">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">{t('orgPanel')}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{user.firstName} {user.lastName}</p>
            </div>
            <nav className="flex-1 p-3 space-y-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${isActive(item.href) ? 'text-primary-500' : 'text-gray-400'}`} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
