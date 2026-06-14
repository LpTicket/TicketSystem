import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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
import { AdminPanelScreen } from './src/screens/AdminPanelScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { PurchaseScreen } from './src/screens/PurchaseScreen';
import { CheckoutInfoScreen } from './src/screens/CheckoutInfoScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { ContactScreen } from './src/screens/ContactScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { SupportScreen } from './src/screens/SupportScreen';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { colors } from './src/theme/colors';
import { MobileEvent } from './src/types/event';
import { AuthUser } from './src/services/api';
import { logout as logoutRequest, restoreSession } from './src/services/auth';

type Tab = 'events' | 'tickets' | 'scan' | 'social' | 'profile' | 'organizer' | 'admin' | 'contact' | 'about' | 'support';

function AppContent() {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const navIndicatorX = useRef(new Animated.Value(0)).current;
  const [tab, setTab] = useState<Tab>('events');
  const [selectedEvent, setSelectedEvent] = useState<MobileEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [checkoutInfoOpen, setCheckoutInfoOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loginAfterPurchase, setLoginAfterPurchase] = useState(false);
  const [viewMode, setViewMode] = useState<'client' | 'organizer'>('client');
  const [organizerSection, setOrganizerSection] = useState<OrgSection>('dashboard');

  const setMode = (mode: 'client' | 'organizer') => {
    setViewMode(mode);
    if (mode === 'organizer') { setOrganizerSection('dashboard'); goToTab('organizer'); }
    else { goToTab('events'); }
  };

  const goOrganizerSection = (section: OrgSection) => {
    clearFlow();
    setViewMode('organizer');
    setOrganizerSection(section);
    setTab('organizer');
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

  // Bottom tab bar swaps with the mode: client tools vs organizer tools.
  const navItems = viewMode === 'organizer'
    ? [
        { key: 'panel', label: t('Panel', 'Panel'), icon: 'grid', active: tab === 'organizer' && organizerSection === 'dashboard', onPress: () => goOrganizerSection('dashboard') },
        { key: 'oevents', label: t('Eventos', 'Events'), icon: 'calendar', active: tab === 'organizer' && organizerSection === 'events', onPress: () => goOrganizerSection('events') },
        { key: 'attendees', label: t('Asistentes', 'Attendees'), icon: 'people', active: tab === 'organizer' && organizerSection === 'attendees', onPress: () => goOrganizerSection('attendees') },
        { key: 'oscan', label: 'Scan', icon: 'scan', active: tab === 'scan', onPress: () => goToTab('scan') },
        { key: 'oprofile', label: t('Perfil', 'Profile'), icon: 'person-circle', active: tab === 'profile', onPress: () => goToTab('profile') },
      ]
    : [
        { key: 'events', label: t('Eventos', 'Events'), icon: 'home', active: tab === 'events', onPress: () => goToTab('events') },
        { key: 'tickets', label: t('Tickets', 'Tickets'), icon: 'ticket', active: tab === 'tickets', onPress: () => goToTab('tickets') },
        { key: 'scan', label: 'Scan', icon: 'scan', active: tab === 'scan', onPress: () => goToTab('scan') },
        { key: 'social', label: 'Social', icon: 'people', active: tab === 'social', onPress: () => goToTab('social') },
        { key: 'profile', label: t('Perfil', 'Profile'), icon: 'person-circle', active: tab === 'profile', onPress: () => goToTab('profile') },
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
          isLoggedIn ? <ProfileScreen key="profile" initialTab="account" user={currentUser!} onUserUpdated={setCurrentUser} onLogout={handleLogout} canOrganize={canOrganize} viewMode={viewMode} onSetMode={(mode) => setViewMode(mode)} /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'organizer' ? (
          isLoggedIn ? <OrganizerPanelScreen section={organizerSection} onSectionChange={setOrganizerSection} /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'admin' ? (
          canAdmin ? <AdminPanelScreen /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'contact' ? (
          <ContactScreen user={currentUser} onBack={() => goToTab('events')} />
        ) : tab === 'about' ? (
          <AboutScreen onBack={() => goToTab('events')} onContact={() => goToTab('contact')} />
        ) : tab === 'support' ? (
          <SupportScreen onContact={() => goToTab('contact')} onBack={() => goToTab('events')} />
        ) : null}

        {!scanOpen && !purchaseOpen && !checkoutInfoOpen && !orderSummaryOpen && !paymentSuccessOpen && !loginAfterPurchase && (
          <View style={styles.bottomNav}>
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
          onGoAiChat={() => goToTab('support')}
          onGoSocialMatch={() => goToTab('social')}
          onGoCart={() => goToTab('tickets')}
          onGoContact={() => goToTab('contact')}
          onGoAbout={() => goToTab('about')}
          onGoSupport={() => goToTab('support')}
          onLogout={handleLogout}
          canOrganize={canOrganize}
          canAdmin={canAdmin}
          viewMode={viewMode}
          onSetMode={setMode}
        />
        </View>
      </SafeAreaView>
    </View>
  );
}

export default function App() {
  return (
    <LanguageProvider>
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
