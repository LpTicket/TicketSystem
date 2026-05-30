'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineMenu, HiOutlineX, HiOutlineUser, HiOutlineLogout, HiOutlineCog, HiOutlineTicket, HiOutlineShoppingCart, HiOutlineQrcode } from 'react-icons/hi';
import { formatSeatLabel } from '@/lib/seatLabel';

const FLOATING_PANEL_EVENT = 'lpticket-floating-panel-open';
const CART_PANEL = 'cart';

import ModeToggle from './ModeToggle';

import { useUIStore } from '@/stores/ui';

/**
 * Main application Header component.
 * Handles navigation, language switching, authentication status,
 * user profile dropdown, and the floating shopping cart logic.
 */
export default function Header() {
  const router = useRouter();
  const { user, isAuthenticated, logout, mode } = useAuthStore();
  const { lang, setLang, t } = useLang();
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [cartDropdown, setCartDropdown] = useState(false);
  const cartShellRef = useRef<HTMLDivElement>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);

  /**
   * Effect to handle clicks outside the profile dropdown to close it automatically.
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  /**
   * Loads cart items from localStorage.
   * Filters out items that have exceeded the 10-minute reservation threshold.
   */
  const notifyFloatingPanelOpen = (panel: string) => {
    window.dispatchEvent(new CustomEvent(FLOATING_PANEL_EVENT, { detail: panel }));
  };

  const loadCartItems = useCallback(() => {
    if (typeof window === 'undefined') return;
    const items: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Selected seats are stored with the prefix 'selectedSeats_' followed by the event ID
      if (key && key.startsWith('selectedSeats_')) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const eventId = key.replace('selectedSeats_', '');
              
              // Filter out items older than 10 minutes (reservation timeout)
              const validSeats = parsed.filter((seat: any) => {
                const addedAt = seat.addedAt || Date.now();
                const elapsed = Date.now() - addedAt;
                return elapsed < 10 * 60 * 1000;
              });

              if (validSeats.length > 0) {
                items.push({
                  eventId,
                  eventTitle: validSeats[0].eventTitle || 'Evento',
                  eventSlug: validSeats[0].eventSlug || '',
                  seats: validSeats
                });
              } else {
                // If no seats are valid, clean up the localStorage key
                localStorage.removeItem(key);
              }
            }
          }
        } catch (e) {
          console.error("Error parsing cart item:", e);
        }
      }
    }
    setCartItems(items);
  }, []);

  /**
   * Setup listeners for cart updates across the application and tab storage events.
   * Also sets up a 1-second interval to keep the countdown timers accurate.
   */
  useEffect(() => {
    const handleOtherFloatingPanel = (event: Event) => {
      const panel = (event as CustomEvent<string>).detail;
      if (panel !== CART_PANEL) setCartDropdown(false);
    };
    window.addEventListener(FLOATING_PANEL_EVENT, handleOtherFloatingPanel);
    return () => window.removeEventListener(FLOATING_PANEL_EVENT, handleOtherFloatingPanel);
  }, []);

  useEffect(() => {
    if (!cartDropdown) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (cartShellRef.current && !cartShellRef.current.contains(event.target as Node)) {
        setCartDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [cartDropdown]);

  useEffect(() => {
    loadCartItems();
    window.addEventListener('cart-updated', loadCartItems);
    window.addEventListener('storage', loadCartItems);

    // Dynamic countdown update interval to refresh time-remaining strings
    const interval = setInterval(() => {
      loadCartItems();
    }, 1000);

    return () => {
      window.removeEventListener('cart-updated', loadCartItems);
      window.removeEventListener('storage', loadCartItems);
      clearInterval(interval);
    };
  }, [loadCartItems]);

  /**
   * Calculates the remaining time for a seat reservation in MM:SS format.
   * @param seats List of seats in a cart item (usually sharing the same timestamp)
   * @returns Formatted time string
   */
  const getRemainingTimeStr = (seats: any[]) => {
    if (seats.length === 0) return '10:00';
    const addedAt = seats[0].addedAt || Date.now();
    const elapsed = Date.now() - addedAt;
    const remaining = Math.max(0, 10 * 60 * 1000 - elapsed);
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  /**
   * Removes all seats for a specific event from the cart.
   * @param eventId The ID of the event to clear
   */
  const handleRemoveEventCart = (eventId: string) => {
    localStorage.removeItem(`selectedSeats_${eventId}`);
    window.dispatchEvent(new Event('cart-updated'));
  };

  const pathname = usePathname();
  const navItems = [
    { href: '/events', label: t('events'), width: '', match: (path: string) => path.startsWith('/events') },
    { href: '/about', label: t('whoWeAre'), width: '', match: (path: string) => path.startsWith('/about') },
    { href: '/dashboard?tab=tickets', label: t('myTickets'), width: '', match: (path: string) => path.startsWith('/dashboard') },
    { href: '/contact', label: t('contact'), width: '', match: (path: string) => path.startsWith('/contact') },
    { href: '/support', label: t('support'), width: '', match: (path: string) => path.startsWith('/support') },
  ];

  return (
    <>
    <header className={`site-header-future sticky top-0 bg-white border-b border-gray-100 shadow-sm print:hidden ${mobileMenuOpen ? 'z-[200]' : 'z-50'}`}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-6">
        <div className="flex items-center h-16 md:h-[70px]">

          {/* Left: Brand Logo */}
          <div className="flex items-center shrink-0 mr-4 md:mr-8">
            <Link href="/" className="premium-logo group flex shrink-0" aria-label="LPTicket home">
              <img
                src="/logo.png"
                alt="LPTicket"
                className="relative z-10 h-9 md:h-14 w-auto object-contain transition-all duration-300 group-hover:scale-[1.035] group-active:scale-[0.98]"
              />
            </Link>
          </div>

          {/* Navigation Links: Fixed widths to prevent layout shifting */}
          <nav className="header-main-nav hidden lg:flex items-center gap-2">
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`header-nav-link ${active ? 'is-active' : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Large spacer */}
          <div className="flex-1" />

          {/* Right: Actions */}
          <div className="header-main-actions hidden lg:flex items-center gap-3 shrink-0 relative">
            
            {/* 1. Language Switcher (h-8 w-110) */}
            <div className="header-lang-switch flex border border-gray-200 rounded-lg overflow-hidden h-8 w-[110px] shrink-0">
              <button 
                onClick={() => setLang('es')}
                className={`flex-1 text-[10px] font-bold transition-colors ${lang === 'es' ? 'bg-[#0A375A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                ES
              </button>
              <button 
                onClick={() => setLang('en')}
                className={`flex-1 text-[10px] font-bold border-l border-gray-200 transition-colors ${lang === 'en' ? 'bg-[#0A375A] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                EN
              </button>
            </div>

            {/* 2. SCAN Button (if Auth) or Login Button (if Guest) */}
            {isAuthenticated ? (
              <Link
                href="/verify"
                className="header-scan-button h-8 w-[110px] text-white rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0"
              >
                <HiOutlineQrcode className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">SCAN</span>
              </Link>
            ) : (
              <Link 
                href="/login" 
                className="h-8 w-[110px] border border-blue-600 text-[#0A375A] hover:bg-[rgba(10,55,90,0.06)] text-[10px] font-black uppercase tracking-wider rounded-lg transition-all text-center flex items-center justify-center shrink-0"
              >
                {t('login')}
              </Link>
            )}

            {/* 3. Create Event Button (Only for Guests) */}
            {!isAuthenticated && (
              <Link 
                href="/login?redirect=/organizer/events/create"
                className="h-8 w-[110px] bg-[#0A375A] text-white hover:bg-[#0A375A] text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md transition-all text-center flex items-center justify-center shrink-0"
              >
                {lang === 'es' ? 'Crear Evento' : 'Create Event'}
              </Link>
            )}

            {/* 4. User Profile (Only if Auth) */}
            {isAuthenticated && user && (
              <div ref={profileRef} className="flex items-center">
                <button onClick={() => setProfileDropdown(!profileDropdown)} className={`premium-user-button ${profileDropdown ? 'active' : ''}`}>
                  <HiOutlineUser className="w-4 h-4 shrink-0" />
                  <span className="truncate max-w-[65px]">{user.firstName}</span>
                </button>

                {/* Profile Dropdown */}
                {profileDropdown && (
                  <div className="lp-user-menu absolute right-0 top-[45px] w-72 py-2 animate-fade-in z-50">
                    {/* User Info Header */}
                    <div className="lp-user-menu-header px-4 py-3 mb-1">
                      <p className="text-sm font-black text-gray-900 leading-tight">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-[11px] font-medium text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Mode Toggle */}
                    {user?.role !== 'admin' && (
                      <div className="px-4 py-3 bg-white/5 border-b border-white/10 mb-1 hover:bg-[rgba(249,115,22,0.10)] transition-colors">
                        <ModeToggle variant="dropdown" />
                      </div>
                    )}

                    <Link 
                      href="/dashboard?tab=profile" 
                      onClick={() => setProfileDropdown(false)} 
                      className="lp-menu-item mx-2 flex items-center gap-3 px-3 py-3 text-[13px] font-bold transition-colors"
                    >
                      <HiOutlineUser className="w-4 h-4 opacity-70" /> 
                      {t('myProfile')}
                    </Link>

                    {/* My Tickets */}
                    {(user.role === 'admin' || mode === 'buyer') && (
                      <Link 
                        href="/dashboard?tab=tickets" 
                        onClick={() => setProfileDropdown(false)} 
                        className="lp-menu-item mx-2 flex items-center gap-3 px-3 py-3 text-[13px] font-bold transition-colors"
                      >
                        <HiOutlineTicket className="w-4 h-4 opacity-70" /> 
                        {t('myTickets')}
                      </Link>
                    )}

                    {/* Organizer Panel Link */}
                    {(user.role === 'admin' || mode === 'organizer') && (
                      <Link 
                        href="/organizer" 
                        onClick={() => setProfileDropdown(false)} 
                        className="lp-menu-item mx-2 flex items-center gap-3 px-3 py-3 text-[13px] font-bold transition-colors"
                      >
                        <HiOutlineCog className="w-4 h-4 opacity-70" /> 
                        {t('organizerPanel') || 'Organizer Panel'}
                      </Link>
                    )}

                    {/* Admin Panel Link */}
                    {user.role === 'admin' && (
                      <Link 
                        href="/admin" 
                        onClick={() => setProfileDropdown(false)} 
                        className="lp-menu-danger mx-2 flex items-center gap-3 px-3 py-3 text-[13px] font-bold transition-colors border-t border-gray-50 mt-1"
                      >
                        <HiOutlineCog className="w-4 h-4 opacity-70" /> 
                        {t('adminPanel') || 'Admin Panel'}
                      </Link>
                    )}

                    {/* Logout Button */}
                    <button 
                      onClick={() => { logout(); setProfileDropdown(false); }} 
                      className="lp-menu-danger mx-2 flex items-center gap-3 w-[calc(100%-1rem)] px-3 py-3 text-[13px] font-bold border-t border-gray-50 mt-1 transition-colors text-left"
                    >
                      <HiOutlineLogout className="w-4 h-4 opacity-70" /> 
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile UI */}
          <div className="lg:hidden flex items-center gap-2 ml-auto shrink-0">
            {/* Language Switcher Mobile */}
            <div className="flex border border-white/20 rounded-md overflow-hidden h-8 w-[60px] shrink-0">
              <button
                onClick={() => setLang('es')}
                className={`flex-1 text-[10px] font-bold transition-colors ${lang === 'es' ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/70'}`}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={`flex-1 text-[10px] font-bold border-l border-white/20 transition-colors ${lang === 'en' ? 'bg-primary-500 text-white' : 'bg-white/10 text-white/70'}`}
              >
                EN
              </button>
            </div>

            {/* SCAN / Login */}
            {isAuthenticated ? (
              <Link
                href="/verify"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 px-2.5 bg-[#F97316] text-white rounded-md flex items-center gap-1 transition-all shadow-md active:scale-95 shrink-0"
              >
                <HiOutlineQrcode className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase">SCAN</span>
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 border border-white/30 text-white rounded-md transition-all flex items-center justify-center shrink-0"
              >
                <HiOutlineUser className="w-4 h-4" />
              </Link>
            )}

            {/* Hamburger */}
            <button className="h-8 w-8 flex items-center justify-center text-white rounded-md border border-white/20" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <HiOutlineX className="w-5 h-5" /> : <HiOutlineMenu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="hamburger-menu-panel lg:hidden animate-fade-in">
          <div className="hamburger-menu-inner space-y-3">
            
            {/* Nav Links */}
            <div className="hamburger-menu-card space-y-1 p-2">
              {navItems.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`hamburger-nav-link ${active ? 'is-active' : ''}`}
                  >
                    <span className="relative z-10">{item.label}</span>
                    <span className={`absolute left-4 bottom-2 h-[3px] rounded-full bg-gradient-to-r from-blue-500 to-orange-400 transition-all ${active ? 'w-9' : 'w-0'}`} />
                  </Link>
                );
              })}
            </div>

            {/* Mode Toggle inside Mobile Menu */}
            {isAuthenticated && user?.role !== 'admin' && (
              <div className="hamburger-menu-card mode-toggle-card px-4 py-4">
                <ModeToggle variant="dropdown" />
              </div>
            )}

            {/* Bottom Links (Profile, Tickets, Organizer, Logout) */}
            {isAuthenticated && (
              <div className="hamburger-menu-card p-2 space-y-1">
                <Link href="/dashboard?tab=profile" onClick={() => setMobileMenuOpen(false)} className="hamburger-account-link lp-menu-item">
                  <HiOutlineUser className="w-5 h-5 opacity-60" />
                  {t('myProfile')}
                </Link>

                {(user?.role === 'admin' || mode === 'buyer') && (
                  <Link href="/dashboard?tab=tickets" onClick={() => setMobileMenuOpen(false)} className="hamburger-account-link lp-menu-item">
                    <HiOutlineTicket className="w-5 h-5 opacity-60" />
                    {t('myTickets')}
                  </Link>
                )}
                
                {(user?.role === 'admin' || mode === 'organizer') && (
                  <Link href="/organizer" onClick={() => setMobileMenuOpen(false)} className="hamburger-account-link lp-menu-item">
                    <HiOutlineCog className="w-5 h-5 opacity-60" />
                    {t('organizerPanel') || 'Organizer Panel'}
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link href="/admin" onClick={() => setMobileMenuOpen(false)} className="hamburger-account-link hamburger-danger-link lp-menu-danger">
                    <HiOutlineCog className="w-5 h-5 opacity-60" />
                    {t('adminPanel') || 'Admin Panel'}
                  </Link>
                )}

                <button 
                  onClick={() => { logout(); setMobileMenuOpen(false); }} 
                  className="hamburger-account-link hamburger-danger-link lp-menu-danger"
                >
                  <HiOutlineLogout className="w-5 h-5 opacity-60" />
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
    
    {/* 
        Floating Shopping Cart Popup (Bottom Right)
        This component stays visible across standard pages but hides in management panels.
    */}
    {!pathname.includes('/admin') && !pathname.includes('/organizer') && !pathname.includes('/dashboard') && !pathname.includes('/login') && !pathname.includes('/register') && (
      <div ref={cartShellRef} className="fixed bottom-4 right-0 px-5 z-[100] flex flex-col items-end gap-3 print:hidden pointer-events-none">
        
        {/* Cart Dropdown Content */}
        {cartDropdown && (
          <div className="w-80 bg-white rounded-2xl shadow-elevated border border-gray-100 p-5 animate-fade-in-up mb-2 max-h-[420px] flex flex-col overflow-hidden pointer-events-auto">
            {/* Cart Header */}
            <div className="flex justify-between items-center mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center text-primary-500">
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

            {/* List of Reserved Tickets by Event */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 py-2 border-y border-gray-50 my-1">
              {cartItems.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs text-gray-500 italic">
                    {lang === 'es' ? 'No tienes entradas en el carrito listas para pagar.' : 'No tickets in your cart ready for checkout.'}
                  </p>
                </div>
              ) : (
                cartItems.map((item) => {
                  const timeLeft = getRemainingTimeStr(item.seats);
                  return (
                    <div key={item.eventId} className="bg-gray-50/50 rounded-2xl p-3 border border-gray-100 space-y-2.5">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h5 className="font-bold text-[13px] text-gray-900 truncate tracking-tight">{item.eventTitle}</h5>
                          <p className="text-[10px] font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">{item.seats.length} {item.seats.length === 1 ? (lang === 'es' ? 'Asiento' : 'Seat') : (lang === 'es' ? 'Asientos' : 'Seats')}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveEventCart(item.eventId)}
                          className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50/50 transition-colors shrink-0"
                          title={lang === 'es' ? 'Vaciar carrito' : 'Clear cart'}
                        >
                          <HiOutlineX className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Display individual Seat Badges */}
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto no-scrollbar">
                        {item.seats.map((seat: any) => (
                          <span key={seat.id} className="inline-flex items-center text-[9px] font-bold bg-white border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded-md">
                            {formatSeatLabel(seat, seat.sectionName, lang)}
                          </span>
                        ))}
                      </div>

                      {/* Reservation Timer & Direct Pay Button */}
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100/50">
                        <div className="flex items-center gap-1.5 text-[#F97316]">
                          <span className="w-1.5 h-1.5 bg-[#F97316] rounded-full animate-ping" />
                          <span className="text-[10px] font-bold font-mono tracking-wider">{timeLeft}</span>
                        </div>
                        <Link 
                          href={`/events/${item.eventSlug}/purchase`}
                          onClick={() => setCartDropdown(false)}
                          className="btn-primary !py-1.5 !px-3 !rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm shadow-primary-500/10 active:scale-[0.97]"
                        >
                          {lang === 'es' ? 'Pagar' : 'Pay'}
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Primary Action Button (Checkout) */}
            {cartItems.length > 0 ? (
              <button 
                onClick={() => {
                  setCartDropdown(false);
                  router.push(`/events/${cartItems[0].eventSlug}/purchase`);
                }}
                className="w-full py-3 bg-[#F97316] hover:bg-[#F97316] text-white font-black text-xs rounded-xl shadow-lg shadow-orange-500/10 transition-transform active:scale-[0.98] uppercase tracking-widest mt-2"
              >
                {lang === 'es' ? 'Continuar Compra' : 'Checkout'}
              </button>
            ) : (
              <button 
                className="w-full py-3 bg-gray-100 text-gray-400 font-bold text-xs rounded-xl cursor-not-allowed uppercase tracking-wider mt-2"
                disabled
              >
                {lang === 'es' ? 'Continuar Compra' : 'Checkout'}
              </button>
            )}
          </div>
        )}
        
        {/* Main Floating Cart Toggle Button */}
        <button 
          onClick={() => {
            if (!cartDropdown) notifyFloatingPanelOpen(CART_PANEL);
            setCartDropdown(!cartDropdown);
          }}
          className={`w-14 h-14 floating-action-pill rounded-full flex items-center justify-center transition-all duration-300 relative group active:scale-90 pointer-events-auto ${
            cartDropdown ? 'rotate-90' : ''
          }`}
        >
          {cartDropdown ? <HiOutlineX className="w-6 h-6" /> : <HiOutlineShoppingCart className="w-7 h-7" />}
          
          {/* Item Counter Badge */}
          {cartItems.reduce((acc, item) => acc + item.seats.length, 0) > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[24px] h-[24px] px-1.5 bg-[#F97316] text-white rounded-full text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-lg animate-bounce">
              {cartItems.reduce((acc, item) => acc + item.seats.length, 0)}
            </span>
          )}
        </button>
      </div>
    )}
    </>
  );
}
