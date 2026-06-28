import { useEffect, useCallback, useRef, useState } from 'react';
import { LogBox } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Linking, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

// react-native-web fires this warning whenever the canvas responder wins over
// the parent ScrollView — it's a known RNW quirk, harmless on native.
LogBox.ignoreLogs(["ScrollView doesn't take rejection well"]);
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from './src/components/AppHeader';
import { MenuDrawer } from './src/components/MenuDrawer';
import { GradientButton } from './src/components/GradientButton';
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
import { EmployeeScanAccessScreen } from './src/screens/EmployeeScanAccessScreen';
import { DoorSaleScreen } from './src/screens/DoorSaleScreen';
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
import { unlockSeats } from './src/services/orders';
import { addPushNotificationResponseListener, registerDeviceForPushNotifications } from './src/services/pushNotifications';
import { SplashVideo } from './src/components/SplashVideo';

type Tab = 'events' | 'tickets' | 'scan' | 'employeeScan' | 'employeeDoorSale' | 'doorSale' | 'social' | 'profile' | 'organizer' | 'admin' | 'contact' | 'about' | 'support' | 'legal' | 'aichat';
type AuthReturnState = {
  tab: Tab;
  selectedEvent?: MobileEvent | null;
  viewMode: 'client' | 'organizer' | 'admin';
  organizerSection: OrgSection;
  adminSection: AdminSection;
  checkoutInfoOpen?: boolean;
};
const NAV_LINE_WIDTH = 22;
const NAV_LINE_TOP = 10;
const NAV_ICON_SIZE = 20;
const NAV_ICON_RAISE = 2;

function AppContent() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const navIndicatorX = useRef(new Animated.Value(0)).current;
  const adminNavIndicatorX = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<Tab>('events');
  const [selectedEvent, setSelectedEvent] = useState<MobileEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [employeeScanBackToMenu, setEmployeeScanBackToMenu] = useState(false);
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
  const [cartSyncToken, setCartSyncToken] = useState(0);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [loginAfterPurchase, setLoginAfterPurchase] = useState(false);
  const [authReturn, setAuthReturn] = useState<AuthReturnState | null>(null);
  const [viewMode, setViewMode] = useState<'client' | 'organizer' | 'admin'>('client');
  const [organizerSection, setOrganizerSection] = useState<OrgSection>('dashboard');
  const [adminSection, setAdminSection] = useState<AdminSection>('dashboard');
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);
  const [scrollToTopSignal, setScrollToTopSignal] = useState(0);
  const [legalDoc, setLegalDoc] = useState<LegalKey>('terms');
  const goToLegal = (key: LegalKey) => { setLegalDoc(key); goToTab('legal'); };
  const notifyDoorSaleCompleted = useCallback(() => {
    setSalesRefreshKey((key) => key + 1);
  }, []);

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
      setCartSyncToken((token) => token + 1);
      if (remaining.length === 0) {
        setPreSelectedSeats([]);
        setPreSelectedGa(undefined);
        setPreSelectedGaQty(1);
        setCheckoutInfoOpen(false);
        setOrderSummaryOpen(false);
        setCartDrawerOpen(false);
        try { await unlockSeats(); } catch {}
      }
    } catch {}
  }, [selectedEvent?.id, loadCartFromStorage]);

  const clearTicketSelection = useCallback(async (eventId?: string) => {
    try {
      const eid = eventId || selectedEvent?.id || (await AsyncStorage.getItem('lp_active_cart_event')) || '';
      if (eid) await AsyncStorage.removeItem(`selectedSeats_${eid}`);
      await AsyncStorage.removeItem('lp_active_cart_event');
      try { await unlockSeats(); } catch {}
    } catch {}
    setCartItems([]);
    setCartSubtotal(0);
    setCartTotal(0);
    setCartSelectionCount(0);
    setPreSelectedSeats([]);
    setPreSelectedGa(undefined);
    setPreSelectedGaQty(1);
    setCheckoutInfoOpen(false);
    setOrderSummaryOpen(false);
    setCartDrawerOpen(false);
    setCartSyncToken((token) => token + 1);
  }, [selectedEvent?.id]);

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
    setAuthReturn(null);
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

  const protectedTabs = new Set<Tab>(['tickets', 'employeeScan', 'employeeDoorSale', 'doorSale', 'social', 'profile', 'organizer', 'admin']);

  const rememberCurrentPlaceForLogin = (override?: Partial<AuthReturnState>) => {
    setAuthReturn({
      tab,
      selectedEvent,
      viewMode,
      organizerSection,
      adminSection,
      checkoutInfoOpen,
      ...override,
    });
  };

  const handleSignIn = (user: AuthUser) => {
    setCurrentUser(user);
    if (!authReturn) return;
    setViewMode(authReturn.viewMode);
    setOrganizerSection(authReturn.organizerSection);
    setAdminSection(authReturn.adminSection);
    setSelectedEvent(authReturn.selectedEvent || null);
    setCheckoutInfoOpen(!!authReturn.checkoutInfoOpen);
    setTab(authReturn.tab);
    setAuthReturn(null);
  };

  const requestLoginFromCurrentPlace = (override?: Partial<AuthReturnState>) => {
    rememberCurrentPlaceForLogin(override);
  };

  const goToTab = (nextTab: Tab) => {
    if (nextTab !== 'employeeScan') setEmployeeScanBackToMenu(false);
    if (!isLoggedIn && protectedTabs.has(nextTab)) {
      const returnState: AuthReturnState = {
        tab: nextTab,
        selectedEvent: null,
        viewMode,
        organizerSection,
        adminSection,
        checkoutInfoOpen: false,
      };
      clearFlow();
      setAuthReturn(returnState);
      setTab(nextTab);
      return;
    }
    clearFlow();
    setTab(nextTab);
  };

  const goToEmployeeScanFromMenu = () => {
    setEmployeeScanBackToMenu(true);
    goToTab('employeeScan');
  };

  const handleEmployeeScanBack = () => {
    if (employeeScanBackToMenu) {
      setMenuOpen(true);
      return;
    }
    goToTab('events');
  };

  const goHome = () => {
    clearFlow();
    setViewMode('client');
    setTab('events');
  };

  const handleBottomNavPress = (action: () => void, isActive?: boolean) => {
    if (menuOpen) setMenuOpen(false);
    if (isActive && !selectedEvent && !scanOpen && !authReturn) {
      setScrollToTopSignal((signal) => signal + 1);
      return;
    }
    action();
  };

  const isLoggedIn = !!currentUser;
  const userRole = currentUser?.role;
  const canAdmin = userRole === 'admin';
  const canOrganize = isLoggedIn;
  const navPadding = 8;

  // Bottom tab bar swaps with the mode: client / organizer / admin tools.
  const navItems = viewMode === 'admin'
    ? [
        { key: 'adash',       label: t('Dashboard', 'Dashboard'),  icon: 'grid',          active: tab === 'admin' && adminSection === 'dashboard',  onPress: () => goAdminSection('dashboard') },
        { key: 'amarketing',  label: 'Marketing',                  icon: 'megaphone',     active: tab === 'admin' && adminSection === 'marketing',  onPress: () => goAdminSection('marketing') },
        { key: 'aevents',     label: t('Eventos', 'Events'),       icon: 'calendar',      active: tab === 'admin' && adminSection === 'events',     onPress: () => goAdminSection('events') },
        { key: 'ausers',      label: t('Usuarios', 'Users'),       icon: 'people',        active: tab === 'admin' && adminSection === 'users',      onPress: () => goAdminSection('users') },
        { key: 'aprofile',    label: t('Perfil', 'Profile'),       icon: 'person-circle', active: tab === 'profile',                                 onPress: () => goToTab('profile') },
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
      toValue: navPadding + navItemWidth * activeBottomIndex + navItemWidth / 2 - NAV_LINE_WIDTH / 2,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [activeBottomIndex, adminNavIndicatorX, navItemWidth, viewMode]);

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

        <AppHeader onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => setScanOpen(true)} onGoHome={goHome} onOpenLogin={() => goToTab('profile')} showLoginButton={!isLoggedIn} onGoCart={() => setCartDrawerOpen(true)} showCartButton={isLoggedIn} cartCount={cartSelectionCount} />

        {scanOpen ? (
          <ScanScreen onBack={() => setScanOpen(false)} user={currentUser} />
        ) : authReturn ? (
          <LoginScreen onSignIn={handleSignIn} />
        ) : selectedEvent && paymentSuccessOpen ? (
          <PaymentSuccessScreen event={selectedEvent} user={currentUser} onViewTickets={() => { clearFlow(); setTab('tickets'); }} onHome={() => { clearFlow(); setTab('events'); }} />
        ) : selectedEvent && orderSummaryOpen ? (
          <OrderSummaryScreen event={selectedEvent} user={currentUser} onBack={() => { setOrderSummaryOpen(false); setCheckoutInfoOpen(true); }} onPay={() => { setOrderSummaryOpen(false); setPaymentSuccessOpen(true); }} />
        ) : selectedEvent && checkoutInfoOpen ? (
          <CheckoutInfoScreen event={selectedEvent} user={currentUser} onBack={() => clearTicketSelection(selectedEvent.id)} onPaid={() => { clearFlow(); setTab('tickets'); }} seats={preSelectedSeats} gaSection={preSelectedGa} gaQty={preSelectedGaQty} />
        ) : selectedEvent && loginAfterPurchase ? (
          <LoginScreen onSignIn={(user) => { setCurrentUser(user); setLoginAfterPurchase(false); setCheckoutInfoOpen(true); }} />
        ) : selectedEvent ? (
          <EventDetailScreen event={selectedEvent} cartSyncToken={cartSyncToken} onBack={async () => { await clearTicketSelection(selectedEvent.id); setSelectedEvent(null); }} onSelectionCountChange={setCartSelectionCount} isLoggedIn={isLoggedIn} onRequestLogin={() => requestLoginFromCurrentPlace({ tab: 'events', selectedEvent, viewMode: 'client', checkoutInfoOpen: false })} onBuy={(seats, ga, gaQty) => { setPreSelectedSeats(seats); setPreSelectedGa(ga); setPreSelectedGaQty(gaQty ?? 1); if (isLoggedIn) { setCheckoutInfoOpen(true); } else { setLoginAfterPurchase(true); } }} />
        ) : tab === 'events' ? (
          <HomeScreen onOpenEvent={setSelectedEvent} scrollToTopSignal={scrollToTopSignal} />
        ) : tab === 'tickets' ? (
          isLoggedIn ? <TicketsScreen scrollToTopSignal={scrollToTopSignal} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'scan' ? (
          <ScanScreen onBack={() => goToTab('events')} user={currentUser} scrollToTopSignal={scrollToTopSignal} />
        ) : tab === 'employeeScan' ? (
          isLoggedIn ? <EmployeeScanAccessScreen user={currentUser} onBack={handleEmployeeScanBack} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'employeeDoorSale' ? (
          isLoggedIn ? <DoorSaleScreen user={currentUser} eventSource="employee" onBack={() => goToTab('events')} onSaleCompleted={notifyDoorSaleCompleted} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'doorSale' ? (
          isLoggedIn ? <DoorSaleScreen user={currentUser} onBack={() => goToTab('events')} onSaleCompleted={notifyDoorSaleCompleted} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'social' ? (
          isLoggedIn ? <SocialScreen scrollToTopSignal={scrollToTopSignal} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'profile' ? (
          isLoggedIn ? <ProfileScreen key="profile" initialTab="account" user={currentUser!} onUserUpdated={setCurrentUser} onLogout={handleLogout} canOrganize={canOrganize} canAdmin={canAdmin} viewMode={viewMode} onSetMode={(mode) => setViewMode(mode)} scrollToTopSignal={scrollToTopSignal} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'organizer' ? (
          isLoggedIn ? <OrganizerPanelScreen section={organizerSection} onSectionChange={setOrganizerSection} refreshKey={salesRefreshKey} scrollToTopSignal={scrollToTopSignal} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'admin' ? (
          canAdmin ? <AdminPanelScreen section={adminSection} onSectionChange={setAdminSection} scrollToTopSignal={scrollToTopSignal} /> : <LoginScreen onSignIn={handleSignIn} />
        ) : tab === 'contact' ? (
          <ContactScreen user={currentUser} onBack={() => goToTab('events')} />
        ) : tab === 'about' ? (
          <AboutScreen onBack={() => goToTab('events')} onContact={() => goToTab('contact')} />
        ) : tab === 'support' ? (
          <SupportScreen onContact={() => goToTab('contact')} onBack={() => goToTab('events')} />
        ) : tab === 'legal' ? (
          <LegalScreen docKey={legalDoc} onBack={() => goToTab('events')} />
        ) : tab === 'aichat' ? (
          <AiChatScreen scrollToTopSignal={scrollToTopSignal} />
        ) : null}

        <View style={styles.bottomNav}>
            <View pointerEvents="none" style={styles.bottomNavBg} />
            {viewMode === 'admin' ? (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[styles.navFixedSlidingLine, { transform: [{ translateX: adminNavIndicatorX }] }]}
                />
                {navItems.map((item, index) => (
                  <TouchableOpacity key={`${item.key}-${index}`} onPress={() => handleBottomNavPress(item.onPress, item.active)} style={styles.navItem}>
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
              </>
            ) : (
              // Fixed tab bar for client / organizer
              <>
                <Animated.View style={[styles.navSlidingLine, { transform: [{ translateX: navIndicatorX }] }]} />
                {navItems.map((item, index) => (
                  <TouchableOpacity key={`${item.key}-${index}`} onPress={() => handleBottomNavPress(item.onPress, item.active)} style={styles.navItem}>
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
            <View pointerEvents="none" style={cartSt.sheetGlass} />
            <View style={cartSt.handle} />
            <View style={cartSt.sheetHeader}>
              <Text style={cartSt.sheetTitle}>{t('Tu carrito', 'Your cart')}</Text>
              <TouchableOpacity onPress={() => setCartDrawerOpen(false)} style={cartSt.closeBtn}>
                <Ionicons name="close" size={20} color="rgba(226,232,240,0.7)" />
              </TouchableOpacity>
            </View>
            {cartItems.length === 0 ? (
              <View style={cartSt.empty}>
                <View pointerEvents="none" style={cartSt.emptyBevelTop} />
                <View pointerEvents="none" style={cartSt.emptyBevelBottom} />
                <View style={cartSt.emptyIconRing}>
                  <View style={cartSt.emptyIconCore}>
                    <Ionicons name="cart-outline" size={34} color="#F97316" />
                  </View>
                </View>
                <Text style={cartSt.emptyTitle}>{t('Tu compra empieza en el mapa', 'Your purchase starts on the map')}</Text>
                <Text style={cartSt.emptyText}>{t('Selecciona una mesa o asiento dentro de un evento y aparecerá aquí para completar el checkout.', 'Select a table or seat inside an event and it will appear here to complete checkout.')}</Text>
                <TouchableOpacity
                  style={cartSt.emptyAction}
                  activeOpacity={0.84}
                  onPress={() => {
                    setCartDrawerOpen(false);
                    goToTab('events');
                  }}
                >
                  <Text style={cartSt.emptyActionText}>{t('VER EVENTOS', 'VIEW EVENTS')}</Text>
                </TouchableOpacity>
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
                <GradientButton
                  height={52}
                  style={cartSt.checkoutBtn}
                  textStyle={cartSt.checkoutBtnText}
                  onPress={goToCheckoutFromCart}
                  label={t('COMPLETAR COMPRA →', 'COMPLETE PURCHASE →')}
                />
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
          onGoEmployeeScan={goToEmployeeScanFromMenu}
          onGoEmployeeDoorSale={() => goToTab('employeeDoorSale')}
          onGoDoorSale={() => goToTab('doorSale')}
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
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    elevation: 60,
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
  navFixedSlidingLine: {
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
  backdrop: { flex: 1, backgroundColor: 'transparent' },
  sheet: { backgroundColor: 'rgba(2,8,15,0.94)', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: 'rgba(249,115,22,0.14)', paddingBottom: 32, maxHeight: '75%', overflow: 'hidden' },
  sheetGlass: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.025)' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sheetTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '600' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  empty: { marginHorizontal: 20, marginTop: 8, marginBottom: 10, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 28, gap: 12, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(249,115,22,0.16)', backgroundColor: 'rgba(1,6,12,0.72)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  emptyBevelTop: { position: 'absolute', left: 12, right: 12, top: 1, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)' },
  emptyBevelBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, backgroundColor: 'rgba(0,0,0,0.16)' },
  emptyIconRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.065)', alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  emptyIconCore: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(249,115,22,0.16)', backgroundColor: 'rgba(3,11,20,0.88)', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 19, lineHeight: 24, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  emptyText: { color: 'rgba(203,213,225,0.68)', fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
  emptyAction: { marginTop: 4, height: 42, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.44)', backgroundColor: 'rgba(249,115,22,0.13)', alignItems: 'center', justifyContent: 'center' },
  emptyActionText: { color: '#F97316', fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  list: { paddingHorizontal: 20, maxHeight: 260 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f97316', flexShrink: 0 },
  rowLabel: { color: 'rgba(226,232,240,0.85)', fontSize: 13, fontWeight: '600', flex: 1 },
  rowPrice: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  removeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(248,113,113,0.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginHorizontal: 20, marginVertical: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  subtotalText: { color: 'rgba(226,232,240,0.65)', fontSize: 12, fontWeight: '600' },
  subtotalVal: { color: 'rgba(226,232,240,0.85)', fontWeight: '600' },
  feeText: { color: 'rgba(148,163,184,0.55)', fontSize: 11, marginTop: 2 },
  totalVal: { color: '#F97316', fontSize: 26, fontWeight: '600' },
  checkoutBtn: { marginHorizontal: 20, marginTop: 14, borderRadius: 12 },
  checkoutBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.4 },
});
