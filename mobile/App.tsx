import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
import { PurchaseScreen } from './src/screens/PurchaseScreen';
import { CheckoutInfoScreen } from './src/screens/CheckoutInfoScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { AiChatScreen } from './src/screens/AiChatScreen';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { colors } from './src/theme/colors';
import { MobileEvent } from './src/types/event';
import { AuthUser } from './src/services/api';
import { logout as logoutRequest, restoreSession } from './src/services/auth';
import { SplashVideo } from './src/components/SplashVideo';

type Tab = 'events' | 'tickets' | 'scan' | 'social' | 'profile' | 'organizer' | 'admin' | 'contact' | 'about' | 'support' | 'aichat';

function AppContent() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const navIndicatorX = useRef(new Animated.Value(0)).current;
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
  const [checkoutInfoOpen, setCheckoutInfoOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginAfterPurchase, setLoginAfterPurchase] = useState(false);
  const [viewMode, setViewMode] = useState<'client' | 'organizer' | 'admin'>('client');
  const [organizerSection, setOrganizerSection] = useState<OrgSection>('dashboard');
  const [adminSection, setAdminSection] = useState<AdminSection>('dashboard');

  const setMode = (mode: 'client' | 'organizer' | 'admin') => {
    setViewMode(mode);
    if (mode === 'organizer') { setOrganizerSection('dashboard'); goToTab('organizer'); }
    else if (mode === 'admin') { setAdminSection('dashboard'); goToTab('admin'); }
    else { goToTab('events'); }
  };

  const goOrganizerSection = (section: OrgSection) => {
    clearFlow();
    setViewMode('organizer');
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

  const handleLogout = () => {
    clearFlow();
    logoutRequest();
    setCurrentUser(null);
    setViewMode('client');
    setTab('events');
  };

  const clearFlow = () => {
    setSelectedEvent(null);
    setScanOpen(false);
    setPurchaseOpen(false);
    setCheckoutInfoOpen(false);
    setOrderSummaryOpen(false);
    setPaymentSuccessOpen(false);
    setLoginAfterPurchase(false);
  };

  const goToTab = (nextTab: Tab) => {
    clearFlow();
    setTab(nextTab);
  };

  const isLoggedIn = !!currentUser;
  const userRole = currentUser?.role;
  const canAdmin = userRole === 'admin';
  const canOrganize = isLoggedIn;
  const navPadding = 8;

  // Bottom tab bar swaps with the mode: client / organizer / admin tools.
  const navItems = viewMode === 'admin'
    ? [
        // 2 extras LEFT
        { key: 'acategories', label: t('Categ.', 'Categories'),    icon: 'pricetag',      active: tab === 'admin' && adminSection === 'categories', onPress: () => goAdminSection('categories') },
        { key: 'amarketing',  label: 'Marketing',                  icon: 'megaphone',     active: tab === 'admin' && adminSection === 'marketing',  onPress: () => goAdminSection('marketing') },
        // 4 PRINCIPALES
        { key: 'adash',       label: t('Dashboard', 'Dashboard'),  icon: 'grid',          active: tab === 'admin' && adminSection === 'dashboard',  onPress: () => goAdminSection('dashboard') },
        { key: 'aevents',     label: t('Eventos', 'Events'),       icon: 'calendar',      active: tab === 'admin' && adminSection === 'events',     onPress: () => goAdminSection('events') },
        { key: 'ausers',      label: t('Usuarios', 'Users'),       icon: 'people',        active: tab === 'admin' && adminSection === 'users',      onPress: () => goAdminSection('users') },
        { key: 'aprofile',    label: t('Perfil', 'Profile'),       icon: 'person-circle', active: tab === 'profile',                                 onPress: () => goToTab('profile') },
        // 3 extras RIGHT
        { key: 'aanalytics',  label: t('Analíticas', 'Analytics'), icon: 'stats-chart',   active: tab === 'admin' && adminSection === 'analytics',  onPress: () => goAdminSection('analytics') },
        { key: 'acodes',      label: t('Códigos', 'Codes'),        icon: 'key',           active: tab === 'admin' && adminSection === 'codes',      onPress: () => goAdminSection('codes') },
        { key: 'apayments',   label: t('Pagos', 'Payments'),       icon: 'card',          active: tab === 'admin' && adminSection === 'payments',   onPress: () => goAdminSection('payments') },
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
      toValue: navPadding + navItemWidth * activeBottomIndex + navItemWidth / 2 - 9,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.7,
    }).start();
  }, [activeBottomIndex, navIndicatorX, navItemWidth]);

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

  return (
    <View style={styles.root}>
      <ScreenBackground />
      <SafeAreaView style={[styles.safe, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
        <StatusBar style="light" />
        <View style={[styles.app, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
        <View pointerEvents="none" style={styles.appGridVertical} />
        <View pointerEvents="none" style={styles.appGridHorizontal} />

        {!scanOpen && <AppHeader onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => setScanOpen(true)} />}

        {scanOpen ? (
          <ScanScreen onBack={() => setScanOpen(false)} />
        ) : selectedEvent && paymentSuccessOpen ? (
          <PaymentSuccessScreen event={selectedEvent} user={currentUser} onViewTickets={() => { clearFlow(); setTab('tickets'); }} onHome={() => { clearFlow(); setTab('events'); }} />
        ) : selectedEvent && orderSummaryOpen ? (
          <OrderSummaryScreen event={selectedEvent} user={currentUser} onBack={() => { setOrderSummaryOpen(false); setCheckoutInfoOpen(true); }} onPay={() => { setOrderSummaryOpen(false); setPaymentSuccessOpen(true); }} />
        ) : selectedEvent && checkoutInfoOpen ? (
          <CheckoutInfoScreen event={selectedEvent} user={currentUser} onBack={() => setCheckoutInfoOpen(false)} onContinue={() => { setCheckoutInfoOpen(false); setOrderSummaryOpen(true); }} />
        ) : selectedEvent && loginAfterPurchase ? (
          <LoginScreen onSignIn={(user) => { setCurrentUser(user); setLoginAfterPurchase(false); setPurchaseOpen(true); }} />
        ) : selectedEvent && purchaseOpen ? (
          <PurchaseScreen event={selectedEvent} user={currentUser} onBack={() => setPurchaseOpen(false)} onPaid={() => { clearFlow(); setTab('tickets'); }} />
        ) : selectedEvent ? (
          <EventDetailScreen event={selectedEvent} onBack={() => setSelectedEvent(null)} onBuy={() => { setPaymentSuccessOpen(false); setOrderSummaryOpen(false); setCheckoutInfoOpen(false); if (isLoggedIn) { setPurchaseOpen(true); } else { setLoginAfterPurchase(true); } }} />
        ) : tab === 'events' ? (
          <HomeScreen onOpenEvent={setSelectedEvent} />
        ) : tab === 'tickets' ? (
          isLoggedIn ? <TicketsScreen /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'scan' ? (
          <ScanScreen onBack={() => goToTab('events')} />
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
        ) : tab === 'aichat' ? (
          <AiChatScreen />
        ) : null}

        {!scanOpen && !purchaseOpen && !checkoutInfoOpen && !orderSummaryOpen && !paymentSuccessOpen && !loginAfterPurchase && (
          <View style={styles.bottomNav}>
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
                  {navItems.map((item) => (
                    <TouchableOpacity key={item.key} onPress={item.onPress} style={[styles.navItemFixed, { width: ADMIN_ITEM_W }]}>
                      {item.active && <View style={styles.navFixedActiveLine} />}
                      <Ionicons
                        name={(item.active ? item.icon : `${item.icon}-outline`) as any}
                        size={17}
                        color={item.active ? colors.orange : 'rgba(226,232,240,0.45)'}
                      />
                      <Text style={[styles.navText, item.active && styles.navActiveText]} numberOfLines={1}>{item.label}</Text>
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
                {navItems.map((item) => (
                  <TouchableOpacity key={item.key} onPress={item.onPress} style={styles.navItem}>
                    <Ionicons
                      name={(item.active ? item.icon : `${item.icon}-outline`) as any}
                      size={item.key === 'events' ? 18 : 17}
                      color={item.active ? colors.orange : 'rgba(226,232,240,0.50)'}
                    />
                    <Text style={[styles.navText, item.active && styles.navActiveText]} numberOfLines={1}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        <MenuDrawer
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
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
    height: 78,
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(2,8,15,0.98)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(125,211,252,0.12)',
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 18,
  },
  navItem: {
    flex: 1,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  navScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 0,
  },
  navItemFixed: {
    // width is set inline as (screenWidth - arrows) / 5
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  navFixedActiveLine: {
    position: 'absolute',
    top: 0,
    width: 22,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  navArrow: {
    width: 28,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navArrowDisabled: {
    opacity: 0.4,
  },
  navSlidingLine: {
    position: 'absolute',
    top: 15,
    left: 0,
    width: 18,
    height: 2,
    borderRadius: 999,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOpacity: 0.65,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  navText: {
    color: 'rgba(226,232,240,0.48)',
    fontWeight: '600',
    fontSize: 10,
    lineHeight: 12,
  },
  navActiveText: { color: colors.orange },
});
