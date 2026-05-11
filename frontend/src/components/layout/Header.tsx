'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineSearch, HiOutlineMenu, HiOutlineX, HiOutlineUser, HiOutlineLogout, HiOutlineCog, HiOutlineTicket, HiOutlineShoppingCart, HiOutlineQrcode } from 'react-icons/hi';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import api from '@/lib/api';

import ModeToggle from './ModeToggle';

import { useUIStore } from '@/stores/ui';

export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout, mode } = useAuthStore();
  const { lang, setLang, t } = useLang();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [cartDropdown, setCartDropdown] = useState(false);



  const pathname = usePathname();

  return (
    <>
    <header className="sticky top-0 z-50 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-b border-gray-200/50">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 md:px-8">
        <div className="flex lg:grid lg:grid-cols-3 items-center justify-between h-20">
          
          {/* Left: Logo */}
          <div className="flex items-center justify-start shrink-0 min-w-0">
            <Link href="/" className="flex shrink-0">
              <img 
                src="/logo.png" 
                alt="LPTicket" 
                className="h-8 xs:h-10 sm:h-12 md:h-14 w-auto object-contain" 
              />
            </Link>
          </div>

          {/* Center: Nav Links */}
          <nav className="hidden lg:flex items-center justify-center gap-10">
            <Link href="/about" className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors whitespace-nowrap">{t('whoWeAre')}</Link>
            <Link href={isAuthenticated ? "/dashboard?tab=tickets" : "/login?redirect=/dashboard?tab=tickets"} className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors whitespace-nowrap">{t('myTickets')}</Link>
            <Link href="/contact" className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors whitespace-nowrap">{t('contact')}</Link>
            <Link href="/support" className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors whitespace-nowrap">{t('support')}</Link>
          </nav>

          <div className="hidden lg:flex items-center justify-end gap-6 shrink-0">
            {/* Scanner Portal (Available for all authenticated users) */}
            {isAuthenticated && (
              <Link 
                href="/verify" 
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-all shadow-md active:scale-95 group"
              >
                <HiOutlineQrcode className="w-4 h-4 text-primary-100 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {lang === 'es' ? 'Escanear' : 'Scan'}
                </span>
              </Link>
            )}

            {/* Language switcher */}
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden text-xs font-bold shrink-0">
              <button
                onClick={() => setLang('es')}
                className={`w-9 text-center py-1.5 transition-colors ${lang === 'es' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={`w-9 text-center py-1.5 transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                EN
              </button>
            </div>

            {isAuthenticated && user ? (
              <div className="relative">
                <button onClick={() => setProfileDropdown(!profileDropdown)} className="w-9 h-9 rounded-md border border-blue-600 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors">
                  <HiOutlineUser className="w-5 h-5" />
                </button>
                {profileDropdown && (
                  <div className="absolute right-0 top-12 w-52 bg-white rounded-lg shadow-elevated border border-gray-200 py-2 animate-fade-in z-50">
                    <div className="px-4 py-2 border-b border-gray-100 mb-1">
                      <p className="text-sm font-bold text-gray-900">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>

                    {/* NEW: Mode Toggle Item */}
                    {user.role !== 'admin' && (
                      <div className="px-4 py-2.5 bg-gray-50/50 border-b border-gray-100">
                        <ModeToggle variant="dropdown" />
                      </div>
                    )}
                    
                    <Link href="/dashboard?tab=profile" onClick={() => setProfileDropdown(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><HiOutlineUser className="w-4 h-4" /> {t('myProfile')}</Link>
                    
                    {/* Admins see everything, Clients see based on mode */}
                    {(user.role === 'admin' || mode === 'buyer') && (
                      <Link href="/dashboard?tab=tickets" onClick={() => setProfileDropdown(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><HiOutlineTicket className="w-4 h-4" /> {t('myTickets')}</Link>
                    )}
                    
                    {(user.role === 'admin' || mode === 'organizer') && (
                      <Link href="/organizer" onClick={() => setProfileDropdown(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"><HiOutlineCog className="w-4 h-4" /> {t('organizerPanel')}</Link>
                    )}

                    {user.role === 'admin' && (
                      <Link href="/admin" onClick={() => setProfileDropdown(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-bold border-t border-gray-50 mt-1 pt-1"><HiOutlineCog className="w-4 h-4" /> Admin Panel</Link>
                    )}
                    
                    <hr className="my-1 border-gray-100" />
                    <button onClick={() => { logout(); setProfileDropdown(false); }} className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"><HiOutlineLogout className="w-4 h-4" /> {t('logout')}</button>
                  </div>
                )}
              </div>

            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <Link href="/login" className="btn-secondary !py-2 !px-0 w-[110px] text-center !text-[11px] font-bold !border-blue-600 !text-blue-600 hover:!bg-blue-50">{t('login')}</Link>
                <Link href="/register" className="btn-primary !py-2 !px-0 w-[120px] text-center !text-[11px] font-bold !bg-blue-600 hover:!bg-blue-700">{t('register')}</Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Mobile Scanner */}
            {isAuthenticated && (
              <Link 
                href="/verify" 
                className="flex items-center gap-1 px-2 py-1 bg-primary-500 text-white rounded-md shadow-sm active:scale-95"
              >
                <HiOutlineQrcode className="w-3.5 h-3.5 text-primary-100" />
                <span className="hidden xs:inline text-[9px] font-bold uppercase tracking-tight">
                  {lang === 'es' ? 'Escanear' : 'Scan'}
                </span>
                <span className="xs:hidden text-[9px] font-bold uppercase tracking-tight">SCAN</span>
              </Link>
            )}

            {/* Mobile language switcher */}
            <div className="flex items-center border border-gray-300 rounded-md overflow-hidden text-[10px] font-bold shrink-0">
              <button onClick={() => setLang('es')} className={`w-6 text-center py-1 transition-colors ${lang === 'es' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>ES</button>
              <button onClick={() => setLang('en')} className={`w-6 text-center py-1 transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>EN</button>
            </div>
            <button className="p-0.5 text-blue-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <HiOutlineX className="w-7 h-7" /> : <HiOutlineMenu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg animate-fade-in absolute w-full left-0">
          <div className="px-4 py-4 space-y-3">

            <Link href="/events" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('events')}</Link>
            <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('whoWeAre')}</Link>
            <Link href="/dashboard?tab=tickets" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('myTickets')}</Link>
            <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('contact')}</Link>
            <Link href="/support" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('support')}</Link>
            <div className="py-2 border-b border-gray-100 flex justify-center">
              {isAuthenticated && user?.role !== 'admin' && (
                <ModeToggle variant="pill" />
              )}
            </div>
            {isAuthenticated ? (
              <>
                <Link href="/dashboard?tab=profile" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700">{t('myProfile')}</Link>
                
                {(user?.role === 'admin' || mode === 'buyer') && (
                  <Link href="/dashboard?tab=tickets" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700">{t('myTickets')}</Link>
                )}
                
                {(user?.role === 'admin' || mode === 'organizer') && (
                  <Link href="/organizer" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-gray-700">{t('organizerPanel')}</Link>
                )}

                {user?.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-red-600 font-bold">{t('adminPanel') || 'Admin Panel'}</Link>
                )}
                
                <button onClick={() => { logout(); setMobileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-red-600 font-medium">{t('logout')}</button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="btn-secondary w-full text-center py-2 !border-blue-600 !text-blue-600">{t('login')}</Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="btn-primary w-full text-center py-2 !bg-blue-600">{t('register')}</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
    
    {/* Floating Shopping Cart Popup (Bottom Right) - Fixed position stable sibling */}
    {!pathname.includes('/admin') && !pathname.includes('/organizer') && !pathname.includes('/dashboard') && !pathname.includes('/login') && !pathname.includes('/register') && (
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
        {cartDropdown && (
          <div className="w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-5 animate-fade-in-up mb-2">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                  <HiOutlineShoppingCart className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-sm text-gray-900">{lang === 'es' ? 'Mi Carrito' : 'My Cart'}</h4>
              </div>
              <button 
                onClick={() => setCartDropdown(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <HiOutlineX className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="py-4 text-center border-y border-gray-50 my-2">
              <p className="text-xs text-gray-500 italic">
                {lang === 'es' ? 'No tienes entradas en el carrito listas para pagar.' : 'No tickets in your cart ready for checkout.'}
              </p>
            </div>
            <button 
              className="w-full py-2.5 bg-gray-100 text-gray-400 font-bold text-xs rounded-xl cursor-not-allowed uppercase tracking-wider"
              disabled
            >
              {lang === 'es' ? 'Continuar Compra' : 'Checkout'}
            </button>
          </div>
        )}
        
        <button 
          onClick={() => setCartDropdown(!cartDropdown)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 relative group active:scale-90 ${
            cartDropdown ? 'bg-gray-900 text-white rotate-90' : 'bg-primary-500 text-white hover:bg-primary-600'
          }`}
        >
          {cartDropdown ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineShoppingCart className="w-7 h-7" />}
          {!cartDropdown && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-blue-600 text-white rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
              0
            </span>
          )}
        </button>
      </div>
    )}
    </>
  );
}
