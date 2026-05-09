'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineSearch, HiOutlineMenu, HiOutlineX, HiOutlineUser, HiOutlineLogout, HiOutlineCog, HiOutlineTicket, HiOutlineShoppingCart, HiOutlineQrcode } from 'react-icons/hi';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import api from '@/lib/api';

import ModeToggle from './ModeToggle';

export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout, mode } = useAuthStore();
  const { lang, setLang, t } = useLang();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const { data } = await api.get(`/events?search=${searchQuery}&limit=5`);
          setSearchResults(data.events || []);
          setShowSearchResults(true);
        } catch (err) {
          console.error('Error fetching search results', err);
        }
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSearchResults(false);
      window.location.href = `/events?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-b border-gray-200/50">
      <div className="w-full px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo + Nav */}
          <div className="flex items-center lg:w-[450px] shrink-0">
            <Link href="/" className="flex shrink-0">
              <img 
                src="/logo.png" 
                alt="LPTicket" 
                className="h-14 sm:h-16 w-auto object-contain" 
              />
            </Link>
            <nav className="hidden lg:flex items-center gap-1.5 ml-6">
              <Link href="/about" className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors px-3 text-center shrink-0">{t('whoWeAre')}</Link>
              <Link href={isAuthenticated ? "/dashboard?tab=tickets" : "/login?redirect=/dashboard?tab=tickets"} className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors px-3 text-center shrink-0">{lang === 'es' ? 'Mis Tickets' : 'My Tickets'}</Link>
              <Link href="/contact" className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors px-3 text-center shrink-0">{t('contact')}</Link>
              <Link href="/support" className="text-blue-600 hover:text-blue-800 font-medium text-[15px] transition-colors px-3 text-center shrink-0">{lang === 'es' ? 'Soporte' : 'Support'}</Link>
            </nav>
          </div>

          {/* Center Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-6 relative">
            <form onSubmit={handleSearch} className="w-full relative">
              <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 font-bold z-10" />
              <input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                className="w-full pr-5 py-2.5 rounded-full border-[1.5px] border-primary-500 bg-white text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                style={{ paddingLeft: '3rem' }}
              />
            </form>

            {/* Real-time Search Results */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.15)] border border-gray-100 py-3 z-[100] animate-fade-in overflow-hidden">
                <div className="px-4 pb-2 mb-2 border-b border-gray-50 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('searchResults' as any) || 'Resultados'}</span>
                  <button onClick={() => setShowSearchResults(false)} className="text-gray-400 hover:text-gray-600"><HiOutlineX className="w-3 h-3" /></button>
                </div>
                {searchResults.map((event) => (
                  <div 
                    key={event.id} 
                    onClick={() => {
                      router.push(`/events/${event.slug || event.id}`);
                      setShowSearchResults(false);
                      setSearchQuery('');
                    }}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-primary-50 cursor-pointer transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                      {event.imageUrl ? (
                        <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xs">LP</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-gray-900 truncate group-hover:text-primary-600 transition-colors">{event.title}</p>
                      <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                        {event.venueName}
                      </p>
                    </div>
                    <div className="text-primary-500 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0">
                      <HiOutlineSearch className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Side */}
          <div className="hidden lg:flex items-center gap-3 w-[450px] justify-end shrink-0">
            {/* NEW: Scanner Portal (Only if logged in) */}
            {isAuthenticated && (
              <Link 
                href="/verify" 
                className="w-9 h-9 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all shadow-sm group relative"
                title={lang === 'es' ? 'Escanear Entradas' : 'Scan Tickets'}
              >
                <HiOutlineQrcode className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="absolute bottom-11 scale-0 group-hover:scale-100 transition-all bg-gray-900 text-white text-[10px] font-bold py-1 px-2.5 rounded shadow-lg whitespace-nowrap z-50">
                  {lang === 'es' ? 'Escáner de Entradas' : 'Ticket Scanner'}
                </span>
              </Link>
            )}

            {/* NEW: Shopping Cart */}
            <div className="relative group shrink-0">
              <Link 
                href="/dashboard?tab=orders" 
                className="w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-blue-600 flex items-center justify-center transition-all relative"
                title={lang === 'es' ? 'Carrito de Compra' : 'Shopping Cart'}
              >
                <HiOutlineShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 text-white rounded-full text-[9px] font-bold flex items-center justify-center animate-pulse">
                  0
                </span>
              </Link>
              {/* Dropdown on hover */}
              <div className="absolute right-0 top-11 w-64 bg-white rounded-2xl shadow-elevated border border-gray-100 p-4 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50">
                <h4 className="font-bold text-xs text-gray-900 mb-1">{lang === 'es' ? 'Carrito de Compra' : 'Shopping Cart'}</h4>
                <p className="text-[11px] text-gray-500">{lang === 'es' ? 'No tienes entradas en el carrito listas para pagar.' : 'No tickets in your cart ready for checkout.'}</p>
              </div>
            </div>

            {/* Language switcher */}
            <div className="flex items-center border border-gray-300 rounded overflow-hidden text-xs font-bold shrink-0">
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
                <button onClick={() => setProfileDropdown(!profileDropdown)} className="w-9 h-9 rounded-full border border-blue-600 flex items-center justify-center text-blue-600 hover:bg-blue-50 transition-colors">
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
          <div className="lg:hidden flex items-center gap-3 shrink-0">
            {/* Mobile language switcher */}
            <div className="flex items-center border border-gray-300 rounded overflow-hidden text-xs font-bold">
              <button onClick={() => setLang('es')} className={`w-8 text-center py-1 transition-colors ${lang === 'es' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>ES</button>
              <button onClick={() => setLang('en')} className={`w-8 text-center py-1 transition-colors ${lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}>EN</button>
            </div>
            <button className="p-2 text-blue-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <HiOutlineX className="w-7 h-7" /> : <HiOutlineMenu className="w-7 h-7" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg animate-fade-in absolute w-full left-0">
          <div className="px-4 py-4 space-y-3">
            <div className="relative mb-4">
              <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }} className="relative">
                <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-500 z-10" />
                <input 
                  type="text" 
                  placeholder={t('searchMobile')} 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  onFocus={() => searchQuery.length >= 2 && setShowSearchResults(true)}
                  className="w-full pr-4 py-2.5 rounded-full border border-primary-500 text-sm focus:outline-none" 
                  style={{ paddingLeft: '3rem' }}
                />
              </form>

              {/* Mobile Search Results */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 overflow-hidden max-h-[300px] overflow-y-auto">
                  {searchResults.map((event) => (
                    <div 
                      key={event.id} 
                      onClick={() => {
                        router.push(`/events/${event.slug || event.id}`);
                        setShowSearchResults(false);
                        setMobileMenuOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-primary-50 active:bg-primary-100 cursor-pointer transition-colors"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                        {event.imageUrl ? (
                          <img src={event.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-[10px]">LP</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{event.title}</p>
                        <p className="text-[10px] text-gray-500 truncate">{event.venueName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Link href="/events" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('events')}</Link>
            <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('whoWeAre')}</Link>
            <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-medium">{t('contact')}</Link>
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
  );
}
