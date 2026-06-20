import { useEffect, useCallback, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from './src/components/AppHeader';
import { MenuDrawer } from './src/components/MenuDrawer';
import { ScreenBackground } from './src/components/ScreenBackground';
import { HomeScreen } from './src/screens/HomeScreen';
import { EventDetailScreen } from './src/screens/EventDetailScreen';
import { TicketsScreen } from './src/screens/TicketsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SocialScreen } from './src/screens/SocialScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrganizerPanelScreen, Section as OrgSection } from './src/screens/OrganizerPanelScreen';
import { AdminPanelScreen, Section as AdminSection } from './src/screens/AdminPanelScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { PurchaseScreen, CartItem } from './src/screens/PurchaseScreen';
import { CheckoutInfoScreen } from './src/screens/CheckoutInfoScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { LegalScreen } from './src/screens/LegalScreen';
import { LegalKey } from './src/data/legalContent';
import { AiChatScreen } from './src/screens/AiChatScreen';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { colors } from './src/theme/colors';
import { MobileEvent } from './src/types/event';
import { AuthUser } from './src/services/api';
import { logout as logoutRequest, restoreSession } from './src/services/auth';
import { getPublicEvents } from './src/services/events';
import { addPushNotificationResponseListener, registerDeviceForPushNotifications } from './src/services/pushNotifications';
import { SplashVideo } from './src/components/SplashVideo';

type Tab = 'events' | 'tickets' | 'scan' | 'social' | 'profile' | 'organizer' | 'admin' | 'contact' | 'about' | 'support' | 'legal' | 'aichat';
const NAV_LINE_WIDTH = 22;
const NAV_LINE_TOP = 10;
const ADMIN_NAV_LINE_TOP = NAV_LINE_TOP + 5;
const NAV_ICON_SIZE = 20;
const NAV_ICON_RAISE = 2;

function AppContent() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const navIndicatorX = useRef(new Animated.Value(0)).current;
  const adminNavIndicatorX = useRef(new Animated.Value(0)).current;
  const adminTabScrollRef = useRef<ScrollView>(null);
  const adminTabScrollX = useRef(0);
  const [adminAtStart, setAdminAtStart] = useState(true);
  const [adminAtEnd, setAdminAtEnd] = useState(false);
  // Each item is 1/4 of visible area → 4 items fit at once.
  // Order: [cat, marketing] | [dashboard, events, users, profile] | [analytics, codes, payments]
  // Arrows let user scroll left/right to reveal off-screen sections.
  const ARROW_W = 28;
  const ADMIN_ITEM_W = Math.floor((width - ARROW_W * 2) / 4);
  const ADMIN_PAGE = ADMIN_ITEM_W * 2; // scroll 2 items at a time
  const [tab, setTab] = useState<Tab>('events');
  const [selectedEvent, setSelectedEvent] = useState<MobileEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [preSelectedSeats, setPreSelectedSeats] = useState<any[]>([]);
  const [preSelectedGa, setPreSelectedGa] = useState<{ id: string; name: string; price: number } | undefined>(undefined);
  const [preSelectedGaQty, setPreSelectedGaQty] = useState(1);
  const [checkoutInfoOpen, setCheckoutInfoOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [cartSelectionCount, setCartSelectionCount] = useState(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [loginAfterPurchase, setLoginAfterPurchase] = useState(false);
  const [viewMode, setViewMode] = useState<'client' | 'organizer' | 'admin'>('client');
  const [organizerSection, setOrganizerSection] = useState<OrgSection>('dashboard');
  const [adminSection, setAdminSection] = useState<AdminSection>('dashboard');
  const [legalDoc, setLegalDoc] = useState<LegalKey>('terms');
  const goToLegal = (key: LegalKey) => { setLegalDoc(key); goToTab('legal'); };

  // Read cart from AsyncStorage — mirrors web localStorage(`selectedSeats_${eventId}`)
  const loadCartFromStorage = useCallback(async (eventId?: string) => {
    let eid = eventId || selectedEvent?.id;
    if (!eid) {
      // Fall back to last active cart event stored by EventDetailScreen
      try { eid = (await AsyncStorage.getItem('lp_active_cart_event')) || undefined; } catch {}
    }
    if (!eid) { setCartItems([]); setCartSubtotal(0); setCartTotal(0); setCartSelectionCount(0); return; }
    setCartLoading(true);
    try {
      const raw = await AsyncStorage.getItem(`selectedSeats_${eid}`);
      if (!raw) { setCartItems([]); setCartSubtotal(0); setCartTotal(0); setCartSelectionCount(0); return; }
      const parsed: any[] = JSON.parse(raw);
      const valid = parsed.filter((s) => !s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000));
      if (valid.length === 0) { AsyncStorage.removeItem(`selectedSeats_${eid}`); setCartItems([]); setCartSubtotal(0); setCartTotal(0); setCartSelectionCount(0); return; }
      const items: CartItem[] = valid.map((s: any) => ({
        seatId: s.id,
        sectionId: s.sectionId || '',
        sectionType: s.sectionType || '',
        label: s.sectionType === 'table'
          ? `Mesa ${s.sectionName || ''} · Silla ${s.seatNumber}`
          : `${s.sectionName || ''} ${s.rowLabel || ''}${s.seatNumber ? `-${s.seatNumber}` : ''}`.trim(),
        price: Number(s.price || 0),
      }));
      const sub = items.reduce((a, b) => a + b.price, 0);
      const svc = sub > 0 ? Math.round(sub * 0.08 * 100) / 100 : 0;
      const proc = sub > 0 ? Math.round((sub + svc) * 0.035 * 100) / 100 : 0;
      setCartItems(items);
      setCartSubtotal(sub);
      setCartTotal(sub + svc + proc);
      setCartSelectionCount(valid.length);
    } catch {
      setCartItems([]); setCartSubtotal(0); setCartTotal(0);
    } finally {
      setCartLoading(false);
    }
  }, [selectedEvent?.id]);

  const removeFromCart = useCallback(async (item: CartItem) => {
    try {
      const eid = selectedEvent?.id || (await AsyncStorage.getItem('lp_active_cart_event')) || '';
      if (!eid) return;
      const raw = await AsyncStorage.getItem(`selectedSeats_${eid}`);
      if (!raw) return;
      const parsed: any[] = JSON.parse(raw);
      // For table seats remove all seats of that section; for regular seats remove by id
      const remaining = item.sectionType === 'table'
        ? parsed.filter((s) => s.sectionId !== item.sectionId)
        : parsed.filter((s) => s.id !== item.seatId);
      if (remaining.length === 0) {
        await AsyncStorage.removeItem(`selectedSeats_${eid}`);
        await AsyncStorage.removeItem('lp_active_cart_event');
      } else {
        await AsyncStorage.setItem(`selectedSeats_${eid}`, JSON.stringify(remaining));
      }
      await loadCartFromStorage(eid);
    } catch {}
  }, [selectedEvent?.id, loadCartFromStorage]);

  const setMode = (mode: 'client' | 'organizer' | 'admin') => {
    setViewMode(mode);
    if (mode === 'organizer') { setOrganizerSection('dashboard'); goToTab('organizer'); }
    else if (mode === 'admin') { setAdminSection('dashboard'); goToTab('admin'); }
    else { goToTab('events'); }
  };

  const goOrganizerSection = (section: OrgSection) => {
    clearFlow();
    setViewMode('organizer');
    if (section === 'scan') {
      setTab('scan');
      return;
    }
    setOrganizerSection(section);
    setTab('organizer');
  };

  const goAdminSection = (section: AdminSection) => {
    clearFlow();
    setViewMode('admin');
    setAdminSection(section);
    setTab('admin');
  };
  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);

  // Restore a saved session on launch so the user stays logged in.
  useEffect(() => {
    restoreSession().then((user) => {
      if (user) setCurrentUser(user);
    });
  }, []);

  // Load cart on mount from last active event, and reload whenever selected event changes
  useEffect(() => {
    loadCartFromStorage(selectedEvent?.id);
  }, [selectedEvent?.id]);

  // Refresh cart when drawer opens (works even after leaving event detail screen)
  useEffect(() => {
    if (!cartDrawerOpen) return;
    loadCartFromStorage();
    const interval = setInterval(() => loadCartFromStorage(), 5000);
    return () => clearInterval(interval);
  }, [cartDrawerOpen]);

  useEffect(() => {
    if (!currentUser) return;
    registerDeviceForPushNotifications().catch(() => {});
  }, [currentUser]);

  const handleLogout = () => {
    clearFlow();
    logoutRequest();
    setCurrentUser(null);
    setViewMode('client');
    setTab('events');
  };

  const goToCheckoutFromCart = async () => {
    setCartDrawerOpen(false);
    try {
      const eid = selectedEvent?.id || (await AsyncStorage.getItem('lp_active_cart_event')) || '';
      if (!eid) return;
      const raw = await AsyncStorage.getItem(`selectedSeats_${eid}`);
      if (!raw) return;
      const parsed: any[] = JSON.parse(raw);
      const valid = parsed.filter((s) => !s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000));
      if (valid.length === 0) return;
      setPreSelectedSeats(valid);
      setPreSelectedGa(undefined);
      setPreSelectedGaQty(1);
      // Restore selectedEvent if we navigated away from it
      if (!selectedEvent || selectedEvent.id !== eid) {
        const eventTitle = valid[0]?.eventTitle || '';
        const eventSlug = valid[0]?.eventSlug || '';
        const venueName = valid[0]?.venueName || '';
        const eventDate = valid[0]?.eventDate || '';
        setSelectedEvent({ id: eid, title: eventTitle, slug: eventSlug, venue: venueName, date: eventDate } as any);
      }
      if (isLoggedIn) { setCheckoutInfoOpen(true); } else { setLoginAfterPurchase(true); }
    } catch {}
  };

  const clearFlow = () => {
    setSelectedEvent(null);
    setCartSelectionCount(0);
    setCartItems([]);
    setCartSubtotal(0);
    setCartTotal(0);
    setCartDrawerOpen(false);
    setScanOpen(false);
    setPurchaseOpen(false);
    setPreSelectedSeats([]);
    setPreSelectedGa(undefined);
    setPreSelectedGaQty(1);
    setCheckoutInfoOpen(false);
    setOrderSummaryOpen(false);
    setPaymentSuccessOpen(false);
    setLoginAfterPurchase(false);
  };

  const openPushLink = async (url: string) => {
    const value = url.trim();
    if (!value) return;

    if (value.startsWith('lpticket://')) {
      const path = value.replace(/^lpticket:\/\//, '').split(/[?#]/)[0];
      const parts = path.split('/').filter(Boolean);
      const eventKey = ['event', 'events', 'evento', 'eventos'].includes(parts[0]) ? parts[1] : '';

      if (eventKey) {
        try {
          const events = await getPublicEvents();
          const match = events.find((event) => event.id === eventKey || event.slug === eventKey);
          if (match) {
            clearFlow();
            setViewMode('client');
            setSelectedEvent(match);
            setTab('events');
            return;
          }
        } catch {}
      }

      if (parts[0] === 'tickets') {
        goToTab('tickets');
        return;
      }
      goHome();
      return;
    }

    Linking.openURL(value).catch(() => {});
  };

  const goToTab = (nextTab: Tab) => {
    clearFlow();
    setTab(nextTab);
  };

  const goHome = () => {
    clearFlow();
    setViewMode('client');
    setTab('events');
  };

  const isLoggedIn = !!currentUser;
  const userRole = currentUser?.role;
  const canAdmin = userRole === 'admin';
  const canOrganize = isLoggedIn;
  const navPadding = 8;
  const adminNavPadding = 4;

  // Bottom tab bar swaps with the mode: client / organizer / admin tools.
  const navItems = viewMode === 'admin'
    ? [
        // 2 extras LEFT
        { key: 'acategories', label: t('Categ.', 'Categories'),    icon: 'pricetag',      active: tab === 'admin' && adminSection === 'categories', onPress: () => goAdminSection('categories') },
        { key: 'amarketing',  label: 'Marketing',                  icon: 'megaphone',     active: tab === 'admin' && adminSection === 'marketing',  onPress: () => goAdminSection('marketing') },
        // 4 PRINCIPALES
        { key: 'adash',       label: t('Dashboard', 'Dashboard'),  icon: 'grid',          active: tab === 'admin' && adminSection === 'dashboard',  onPress: () => goAdminSection('dashboard') },
        { key: 'aevents',     label: t('Eventos', 'Events'),       icon: 'calendar',      active: tab === 'admin' && adminSection === 'events',     onPress: () => goAdminSection('events') },
        { key: 'ausersRight', label: t('Usuarios', 'Users'),       icon: 'people',        active: tab === 'admin' && adminSection === 'users',      onPress: () => goAdminSection('users') },
        { key: 'aprofile',    label: t('Perfil', 'Profile'),       icon: 'person-circle', active: tab === 'profile',                                 onPress: () => goToTab('profile') },
        // 3 extras RIGHT
        { key: 'aanalytics',  label: t('Analíticas', 'Analytics'), icon: 'stats-chart',   active: tab === 'admin' && adminSection === 'analytics',  onPress: () => goAdminSection('analytics') },
        { key: 'acodes',      label: t('Códigos', 'Codes'),        icon: 'key',           active: tab === 'admin' && adminSection === 'codes',      onPress: () => goAdminSection('codes') },
        { key: 'ausers',      label: t('Usuarios', 'Users'),       icon: 'people',        active: tab === 'admin' && adminSection === 'users',      onPress: () => goAdminSection('users') },
      ]
    : viewMode === 'organizer'
    ? [
        { key: 'panel', label: t('Panel', 'Dashboard'), icon: 'grid', active: tab === 'organizer' && organizerSection === 'dashboard', onPress: () => goOrganizerSection('dashboard') },
        { key: 'oevents', label: t('Eventos', 'Events'), icon: 'calendar', active: tab === 'organizer' && organizerSection === 'events', onPress: () => goOrganizerSection('events') },
        { key: 'ocreate', label: t('Crear', 'Create'), icon: 'add-circle', active: tab === 'organizer' && organizerSection === 'create', onPress: () => goOrganizerSection('create') },
        { key: 'oscan', label: 'Scan', icon: 'scan', active: tab === 'scan', onPress: () => goToTab('scan') },
        { key: 'oprofile', label: t('Perfil', 'Profile'), icon: 'person-circle', active: tab === 'profile', onPress: () => goToTab('profile') },
      ]
    : [
        { key: 'events',  label: t('Eventos', 'Events'),   icon: 'home',                   active: tab === 'events',  onPress: () => goToTab('events') },
        { key: 'tickets', label: t('Tickets', 'Tickets'),  icon: 'ticket',                 active: tab === 'tickets', onPress: () => goToTab('tickets') },
        { key: 'social',  label: 'Social',                 icon: 'people',                 active: tab === 'social',  onPress: () => goToTab('social') },
        { key: 'ai',      label: t('Asistente', 'AI Chat'),icon: 'chatbubble-ellipses',    active: tab === 'aichat',  onPress: () => goToTab('aichat') },
        { key: 'profile', label: t('Perfil', 'Profile'),   icon: 'person-circle',          active: tab === 'profile', onPress: () => goToTab('profile') },
      ];
  const activeBottomIndex = Math.max(0, navItems.findIndex((i) => i.active));
  const navItemWidth = (width - navPadding * 2) / navItems.length;

  useEffect(() => {
    Animated.spring(navIndicatorX, {
      toValue: navPadding + navItemWidth * activeBottomIndex + navItemWidth / 2 - NAV_LINE_WIDTH / 2,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [activeBottomIndex, navIndicatorX, navItemWidth]);

  useEffect(() => {
    if (viewMode !== 'admin') return;
    Animated.spring(adminNavIndicatorX, {
      toValue: adminNavPadding + ADMIN_ITEM_W * activeBottomIndex + ADMIN_ITEM_W / 2 - 11,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [ADMIN_ITEM_W, activeBottomIndex, adminNavIndicatorX, viewMode]);

  // Snap admin tab bar to the correct group when section changes
  // Order: categories(0) marketing(1) | dashboard(2) events(3) users(4) profile(5) | analytics(6) codes(7) payments(8)
  useEffect(() => {
    if (viewMode !== 'admin') return;
    const adminNavOrder = [
      'categories', 'marketing', 'dashboard', 'events', 'users', 'profile', 'analytics', 'codes', 'payments',
    ];
    const activeKey = tab === 'profile' ? 'profile' : adminSection;
    const idx = adminNavOrder.indexOf(activeKey);
    if (idx < 0) return;
    // Snap to group: left extras → 0, principals → 2*ITEM_W, right extras → 5*ITEM_W
    let targetX: number;
    if (idx <= 1) {
      targetX = 0;                       // show left extras
    } else if (idx <= 5) {
      targetX = 2 * ADMIN_ITEM_W;        // show the 4 principals group
    } else {
      targetX = 5 * ADMIN_ITEM_W;        // show right extras (analytics, codes, payments)
    }
    const timer = setTimeout(() => {
      adminTabScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [adminSection, tab, viewMode, ADMIN_ITEM_W]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    addPushNotificationResponseListener(openPushLink).then((cleanup) => { unsubscribe = cleanup; });
    return () => { unsubscribe?.(); };
  }, []);

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={[styles.safe, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
        <StatusBar style="light" />
        <View style={[styles.app, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
        <View pointerEvents="none" style={styles.appGridVertical} />
        <View pointerEvents="none" style={styles.appGridHorizontal} />

        <AppHeader onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => setScanOpen(true)} onGoHome={goHome} onOpenLogin={() => goToTab('profile')} showLoginButton={!isLoggedIn} onGoCart={() => { if (cartSelectionCount > 0) { setCartDrawerOpen(true); } else { goToTab('tickets'); } }} showCartButton={isLoggedIn || cartSelectionCount > 0} cartCount={cartSelectionCount} />

        {scanOpen ? (
          <ScanScreen onBack={() => setScanOpen(false)} user={currentUser} />
        ) : selectedEvent && paymentSuccessOpen ? (
          <PaymentSuccessScreen event={selectedEvent} user={currentUser} onViewTickets={() => { clearFlow(); setTab('tickets'); }} onHome={() => { clearFlow(); setTab('events'); }} />
        ) : selectedEvent && orderSummaryOpen ? (
          <OrderSummaryScreen event={selectedEvent} user={currentUser} onBack={() => { setOrderSummaryOpen(false); setCheckoutInfoOpen(true); }} onPay={() => { setOrderSummaryOpen(false); setPaymentSuccessOpen(true); }} />
        ) : selectedEvent && checkoutInfoOpen ? (
          <CheckoutInfoScreen event={selectedEvent} user={currentUser} onBack={() => setCheckoutInfoOpen(false)} onPaid={() => { clearFlow(); setTab('tickets'); }} seats={preSelectedSeats} gaSection={preSelectedGa} gaQty={preSelectedGaQty} />
        ) : selectedEvent && loginAfterPurchase ? (
          <LoginScreen onSignIn={(user) => { setCurrentUser(user); setLoginAfterPurchase(false); setCheckoutInfoOpen(true); }} />
        ) : selectedEvent ? (
          <EventDetailScreen event={selectedEvent} onBack={() => { setCartSelectionCount(0); setSelectedEvent(null); }} onSelectionCountChange={setCartSelectionCount} onBuy={(seats, ga, gaQty) => { setPreSelectedSeats(seats); setPreSelectedGa(ga); setPreSelectedGaQty(gaQty ?? 1); if (isLoggedIn) { setCheckoutInfoOpen(true); } else { setLoginAfterPurchase(true); } }} />
        ) : tab === 'events' ? (
          <HomeScreen onOpenEvent={setSelectedEvent} />
        ) : tab === 'tickets' ? (
          isLoggedIn ? <TicketsScreen /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'scan' ? (
          <ScanScreen onBack={() => goToTab('events')} user={currentUser} />
        ) : tab === 'social' ? (
          isLoggedIn ? <SocialScreen /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'profile' ? (
          isLoggedIn ? <ProfileScreen key="profile" initialTab="account" user={currentUser!} onUserUpdated={setCurrentUser} onLogout={handleLogout} canOrganize={canOrganize} canAdmin={canAdmin} viewMode={viewMode} onSetMode={(mode) => setViewMode(mode)} /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'organizer' ? (
          isLoggedIn ? <OrganizerPanelScreen section={organizerSection} onSectionChange={setOrganizerSection} /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'admin' ? (
          canAdmin ? <AdminPanelScreen section={adminSection} onSectionChange={setAdminSection} /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'contact' ? (
          <ContactScreen user={currentUser} onBack={() => goToTab('events')} />
        ) : tab === 'about' ? (
          <AboutScreen onBack={() => goToTab('events')} onContact={() => goToTab('contact')} />
        ) : tab === 'support' ? (
          <SupportScreen onContact={() => goToTab('contact')} onBack={() => goToTab('events')} />
        ) : tab === 'legal' ? (
          <LegalScreen docKey={legalDoc} onBack={() => goToTab('events')} />
        ) : tab === 'aichat' ? (
          <AiChatScreen />
        ) : null}

        <View style={styles.bottomNav}>
            <View pointerEvents="none" style={styles.bottomNavBg} />
            {viewMode === 'admin' ? (
              // Scrollable tab bar for admin with arrow buttons
              <>
                {/* Left arrow — disabled at leftmost position */}
                <TouchableOpacity
                  style={[styles.navArrow, adminAtStart && styles.navArrowDisabled]}
                  disabled={adminAtStart}
                  onPress={() => {
                    const next = Math.max(0, adminTabScrollX.current - ADMIN_PAGE);
                    adminTabScrollRef.current?.scrollTo({ x: next, animated: true });
                  }}
                >
                  <Ionicons name="chevron-back" size={16} color={adminAtStart ? 'rgba(249,115,22,0.20)' : 'rgba(249,115,22,0.70)'} />
                </TouchableOpacity>

                <ScrollView
                  ref={adminTabScrollRef}
                  horizontal
                  style={styles.navAdminScroll}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.navScrollContent}
                  snapToInterval={ADMIN_ITEM_W}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  disableIntervalMomentum
                  onScroll={(e) => {
                    const x = e.nativeEvent.contentOffset.x;
                    const maxX = 5 * ADMIN_ITEM_W; // 9 items - 4 visible = 5 item widths
                    adminTabScrollX.current = x;
                    setAdminAtStart(x <= 4);
                    setAdminAtEnd(x >= maxX - 2);
                  }}
                  scrollEventThrottle={16}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.navFixedSlidingLine, { transform: [{ translateX: adminNavIndicatorX }] }]}
                  />
                  {navItems.map((item, index) => (
                    <TouchableOpacity key={`${item.key}-${index}`} onPress={item.onPress} style={[styles.navItemFixed, { width: ADMIN_ITEM_W }]}>
                      <View style={[styles.navItemContent, styles.navItemContentAdmin]}>
                        <Ionicons
                          name={(item.active ? item.icon : `${item.icon}-outline`) as any}
                          size={NAV_ICON_SIZE}
                          color={item.active ? colors.orange : 'rgba(226,232,240,0.45)'}
                          style={styles.navIcon}
                        />
                        <Text style={[styles.navText, styles.navTextAdmin, item.active && styles.navActiveText]} numberOfLines={1}>{item.label}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Right arrow — disabled at rightmost position */}
                <TouchableOpacity
                  style={[styles.navArrow, adminAtEnd && styles.navArrowDisabled]}
                  disabled={adminAtEnd}
                  onPress={() => {
                    const next = adminTabScrollX.current + ADMIN_PAGE;
                    adminTabScrollRef.current?.scrollTo({ x: next, animated: true });
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={adminAtEnd ? 'rgba(249,115,22,0.20)' : 'rgba(249,115,22,0.70)'} />
                </TouchableOpacity>
              </>
            ) : (
              // Fixed tab bar for client / organizer
              <>
                <Animated.View style={[styles.navSlidingLine, { transform: [{ translateX: navIndicatorX }] }]} />
                {navItems.map((item, index) => (
                  <TouchableOpacity key={`${item.key}-${index}`} onPress={item.onPress} style={styles.navItem}>
                    <View style={styles.navItemContent}>
                      <Ionicons
                        name={(item.active ? item.icon : `${item.icon}-outline`) as any}
                        size={NAV_ICON_SIZE}
                        color={item.active ? colors.orange : 'rgba(226,232,240,0.50)'}
                        style={styles.navIcon}
                      />
                      <Text style={[styles.navText, item.active && styles.navActiveText]} numberOfLines={1}>{item.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
        </View>

        {/* Cart drawer */}
        <Modal visible={cartDrawerOpen} transparent animationType="slide" onRequestClose={() => setCartDrawerOpen(false)}>
          <TouchableOpacity style={cartSt.backdrop} activeOpacity={1} onPress={() => setCartDrawerOpen(false)} />
          <View style={cartSt.sheet}>
            <View style={cartSt.handle} />
            <View style={cartSt.sheetHeader}>
              <Text style={cartSt.sheetTitle}>{t('Tu carrito', 'Your cart')}</Text>
              <TouchableOpacity onPress={() => setCartDrawerOpen(false)} style={cartSt.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
              </TouchableOpacity>
            </View>
            {cartItems.length === 0 ? (
              <View style={cartSt.empty}>
                <Ionicons name="cart-outline" size={32} color="rgba(249,115,22,0.4)" />
                <Text style={cartSt.emptyText}>{t('No hay asientos seleccionados', 'No seats selected')}</Text>
              </View>
            ) : (
              <>
                <ScrollView style={cartSt.list} showsVerticalScrollIndicator={false}>
                  {(() => {
                    // Collapse table seats into one row per table section
                    const seen = new Set<string>();
                    const rows: { item: CartItem; totalPrice: number; chairs: number }[] = [];
                    cartItems.forEach((item) => {
                      if (item.sectionType === 'table' && item.sectionId) {
                        if (seen.has(item.sectionId)) {
                          const r = rows.find((r) => r.item.sectionId === item.sectionId);
                          if (r) { r.totalPrice += item.price; r.chairs++; }
                        } else {
                          seen.add(item.sectionId);
                          // Label: "Mesa 17 · 5 sillas"
                          const tableName = item.label.replace(/·.*/, '').trim();
                          rows.push({ item: { ...item, label: tableName }, totalPrice: item.price, chairs: 1 });
                        }
                      } else {
                        rows.push({ item, totalPrice: item.price, chairs: 1 });
                      }
                    });
                    return rows.map((row, i) => (
                      <View key={`${row.item.seatId}-${i}`} style={cartSt.row}>
                        <View style={cartSt.dot} />
                        <Text style={cartSt.rowLabel} numberOfLines={1}>
                          {row.item.sectionType === 'table' && row.chairs > 1
                            ? `${row.item.label} · ${row.chairs} ${t('sillas', 'chairs')}`
                            : row.item.label}
                        </Text>
                        <Text style={cartSt.rowPrice}>${row.totalPrice.toFixed(2)}</Text>
                        <TouchableOpacity onPress={() => removeFromCart(row.item)} style={cartSt.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close" size={14} color="rgba(248,113,113,0.85)" />
                        </TouchableOpacity>
                      </View>
                    ));
                  })()}
                </ScrollView>
                <View style={cartSt.divider} />
                <View style={cartSt.totalRow}>
                  <View>
                    <Text style={cartSt.subtotalText}>{t('Subtotal', 'Subtotal')} <Text style={cartSt.subtotalVal}>${cartSubtotal.toFixed(2)}</Text></Text>
                    <Text style={cartSt.feeText}>{t('Cargo de servicio incluido', 'Service fee included')}</Text>
                  </View>
                  <Text style={cartSt.totalVal}>${cartTotal.toFixed(2)}</Text>
                </View>
                <TouchableOpacity style={cartSt.checkoutBtn} onPress={goToCheckoutFromCart} activeOpacity={0.88}>
                  <View pointerEvents="none" style={cartSt.checkoutBtnShine} />
                  <Text style={cartSt.checkoutBtnText}>{t('COMPLETAR COMPRA →', 'COMPLETE PURCHASE →')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Modal>

        <MenuDrawer
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          onGoHome={goHome}
          onGoEvents={() => goToTab('events')}
          onGoTickets={() => goToTab('tickets')}
          onGoProfile={() => goToTab('profile')}
          onGoOrganizer={() => { setViewMode('organizer'); goToTab('organizer'); }}
          onGoAdmin={() => goToTab('admin')}
          onGoScan={() => { clearFlow(); setScanOpen(true); }}
          onGoAiChat={() => goToTab('aichat')}
          onGoSocialMatch={() => goToTab('social')}
          onGoCart={() => goToTab('tickets')}
          onGoContact={() => goToTab('contact')}
          onGoAbout={() => goToTab('about')}
          onGoSupport={() => goToTab('support')}
          onGoLegal={goToLegal}
          onLogout={handleLogout}
          isLoggedIn={isLoggedIn}
          canOrganize={canOrganize}
          canAdmin={canAdmin}
          viewMode={viewMode}
          onSetMode={setMode}
          adminSection={adminSection}
          onGoAdminSection={(s) => { goAdminSection(s); }}
          orgSection={organizerSection as any}
          onGoOrgSection={(s) => { goOrganizerSection(s as any); }}
        />
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <LanguageProvider>
      {!splashDone && <SplashVideo onFinish={() => setSplashDone(true)} />}
      <AppContent />
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#050b12',
    position: 'relative',
    overflow: 'hidden',
  },
  safe: { flex: 1, backgroundColor: 'transparent' },
  app: {
    flex: 1,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  appGridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '24%',
    width: 1,
    backgroundColor: 'rgba(125,211,252,0.035)',
  },
  appGridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '34%',
    height: 1,
    backgroundColor: 'rgba(125,211,252,0.030)',
  },
  appBlueGlow: {
    position: 'absolute',
    left: -80,
    right: -80,
    top: 80,
    height: 360,
    backgroundColor: 'rgba(14,116,144,0.10)',
    transform: [{ rotate: '-16deg' }],
  },
  modeSwitch: {
    position: 'absolute',
    top: 67,
    left: 16,
    right: 16,
    zIndex: 30,
    elevation: 30,
    backgroundColor: 'rgba(3,11,20,0.96)',
    borderRadius: 18,
    overflow: 'hidden',
    padding: 5,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  modeSlidingPill: {
    position: 'absolute',
    left: 5,
    top: 5,
    bottom: 5,
    borderRadius: 14,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  modeButtonActive: {
  },
  modeText: {
    color: 'rgba(226,232,240,0.62)',
    fontSize: 13,
    fontWeight: '700',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ translateY: 18 }],
    height: 78,
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'transparent',
  },
  bottomNavBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(2,8,15,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(125,211,252,0.12)',
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
    zIndex: 0,
  },
  navItem: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  navItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navItemContentAdmin: {},
  navIcon: {
    transform: [{ translateY: NAV_ICON_RAISE }],
  },
  navAdminScroll: {
    height: 78,
    flexGrow: 0,
    flexShrink: 1,
    zIndex: 2,
  },
  navScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 78,
    paddingHorizontal: 4,
    gap: 0,
    position: 'relative',
    zIndex: 2,
  },
  navItemFixed: {
    // width is set inline as (screenWidth - arrows) / 5
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 2,
  },
  navFixedSlidingLine: {
    position: 'absolute',
    top: ADMIN_NAV_LINE_TOP,
    left: 0,
    width: NAV_LINE_WIDTH,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 3,
  },
  navArrow: {
    width: 28,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    zIndex: 2,
  },
  navArrowDisabled: {
    opacity: 0.4,
  },
  navSlidingLine: {
    position: 'absolute',
    top: NAV_LINE_TOP,
    left: 0,
    width: NAV_LINE_WIDTH,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.65,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 3,
  },
  navText: {
    color: 'rgba(226,232,240,0.48)',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
  },
  navTextAdmin: {
    transform: [{ translateY: 0 }],
  },
  navActiveText: { color: colors.orange },
});

const cartSt = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: '#0d1f33', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', paddingBottom: 32, maxHeight: '75%' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '900' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  emptyText: { color: 'rgba(203,213,225,0.55)', fontSize: 14, fontWeight: '600' },
  list: { paddingHorizontal: 20, maxHeight: 260 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316', flexShrink: 0 },
  rowLabel: { color: 'rgba(226,232,240,0.85)', fontSize: 13, fontWeight: '600', flex: 1 },
  rowPrice: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  removeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, marginVertical: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  subtotalText: { color: 'rgba(226,232,240,0.65)', fontSize: 12, fontWeight: '600' },
  subtotalVal: { color: 'rgba(226,232,240,0.85)', fontWeight: '700' },
  feeText: { color: 'rgba(148,163,184,0.55)', fontSize: 11, marginTop: 2 },
  totalVal: { color: '#F97316', fontSize: 26, fontWeight: '900' },
  checkoutBtn: { marginHorizontal: 20, marginTop: 14, height: 52, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: '#F97316', shadowOpacity: 0.30, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  checkoutBtnShine: { position: 'absolute', top: 4, left: 16, right: 16, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.26)' },
  checkoutBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.4 },
});
