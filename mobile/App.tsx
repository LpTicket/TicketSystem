import { useEffect, useRef, useState } from 'react';
import { Animated, SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from './src/components/AppHeader';
import { MenuDrawer } from './src/components/MenuDrawer';
import { mockEvents } from './src/data/mockEvents';
import { HomeScreen } from './src/screens/HomeScreen';
import { EventDetailScreen } from './src/screens/EventDetailScreen';
import { TicketsScreen } from './src/screens/TicketsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SocialScreen } from './src/screens/SocialScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrganizerPanelScreen } from './src/screens/OrganizerPanelScreen';
import { AdminPanelScreen } from './src/screens/AdminPanelScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { PurchaseScreen } from './src/screens/PurchaseScreen';
import { CheckoutInfoScreen } from './src/screens/CheckoutInfoScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { colors } from './src/theme/colors';
import { MobileEvent } from './src/types/event';
import { AuthUser } from './src/services/api';
import { logout as logoutRequest, restoreSession } from './src/services/auth';

type Tab = 'events' | 'tickets' | 'scan' | 'social' | 'profile' | 'organizer' | 'admin';

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

  const bottomTabs: Tab[] = ['events', 'tickets', 'scan', 'social', 'profile'];
  const activeBottomIndex = Math.max(0, bottomTabs.indexOf(tab));
  const isLoggedIn = !!currentUser;
  const userRole = currentUser?.role;
  const canAdmin = userRole === 'admin';
  const canOrganize = isLoggedIn;
  const navPadding = 8;
  const navItemWidth = (width - navPadding * 2) / bottomTabs.length;

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
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.app}>
        {!scanOpen && <AppHeader onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => setScanOpen(true)} onOpenCart={() => goToTab('tickets')} />}

        {!scanOpen && canOrganize && !selectedEvent && (
          <View style={styles.modeSwitch}>
            <TouchableOpacity onPress={() => { setViewMode('client'); goToTab('events'); }} style={[styles.modeButton, viewMode === 'client' && styles.modeButtonActive]}>
              <Text style={[styles.modeText, viewMode === 'client' && styles.modeTextActive]}>{t('Cliente', 'Client')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setViewMode('organizer'); goToTab('organizer'); }} style={[styles.modeButton, viewMode === 'organizer' && styles.modeButtonActive]}>
              <Text style={[styles.modeText, viewMode === 'organizer' && styles.modeTextActive]}>{t('Organizador', 'Organizer')}</Text>
            </TouchableOpacity>
          </View>
        )}

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
          <PurchaseScreen event={selectedEvent} onBack={() => setPurchaseOpen(false)} onContinue={() => { setPurchaseOpen(false); setCheckoutInfoOpen(true); }} />
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
          isLoggedIn ? <ProfileScreen key="profile" initialTab="account" user={currentUser!} onUserUpdated={setCurrentUser} onLogout={handleLogout} /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'organizer' ? (
          isLoggedIn ? <OrganizerPanelScreen /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : tab === 'admin' ? (
          canAdmin ? <AdminPanelScreen /> : <LoginScreen onSignIn={setCurrentUser} />
        ) : null}

        {!scanOpen && !purchaseOpen && !checkoutInfoOpen && !orderSummaryOpen && !paymentSuccessOpen && !loginAfterPurchase && (
          <View style={styles.bottomNav}>
            <Animated.View style={[styles.navSlidingLine, { transform: [{ translateX: navIndicatorX }] }]} />
            <TouchableOpacity onPress={() => goToTab('events')} style={styles.navItem}>
              <Ionicons name={tab === 'events' ? 'home' : 'home-outline'} size={18} color={tab === 'events' ? colors.orange : 'rgba(226,232,240,0.50)'} />
              <Text style={[styles.navText, tab === 'events' && styles.navActiveText]}>{t('Eventos', 'Events')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goToTab('tickets')} style={styles.navItem}>
              <Ionicons name={tab === 'tickets' ? 'ticket' : 'ticket-outline'} size={17} color={tab === 'tickets' ? colors.orange : 'rgba(226,232,240,0.50)'} />
              <Text style={[styles.navText, tab === 'tickets' && styles.navActiveText]}>{t('Tickets', 'Tickets')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goToTab('scan')} style={styles.navItem}>
              <Ionicons name={tab === 'scan' ? 'scan' : 'scan-outline'} size={17} color={tab === 'scan' ? colors.orange : 'rgba(226,232,240,0.50)'} />
              <Text style={[styles.navText, tab === 'scan' && styles.navActiveText]}>Scan</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goToTab('social')} style={styles.navItem}>
              <Ionicons name={tab === 'social' ? 'people' : 'people-outline'} size={17} color={tab === 'social' ? colors.orange : 'rgba(226,232,240,0.50)'} />
              <Text style={[styles.navText, tab === 'social' && styles.navActiveText]}>Social</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goToTab('profile')} style={styles.navItem}>
              <Ionicons name={tab === 'profile' ? 'person-circle' : 'person-circle-outline'} size={17} color={tab === 'profile' ? colors.orange : 'rgba(226,232,240,0.50)'} />
              <Text style={[styles.navText, tab === 'profile' && styles.navActiveText]}>{t('Perfil', 'Profile')}</Text>
            </TouchableOpacity>
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
          onGoAiChat={() => goToTab('profile')}
          onGoSocialMatch={() => goToTab('social')}
          onGoCart={() => goToTab('tickets')}
          onLogout={handleLogout}
          canOrganize={canOrganize}
          canAdmin={canAdmin}
        />
      </View>
    </SafeAreaView>
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
  safe: { flex: 1, backgroundColor: '#030B14' },
  app: {
    flex: 1,
    backgroundColor: '#030B14',
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
    top: 63,
    left: 0,
    right: 0,
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
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.orange,
  },
  modeText: {
    color: 'rgba(226,232,240,0.62)',
    fontSize: 13,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  bottomNav: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 54,
    paddingTop: 0,
    paddingBottom: 2,
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    position: 'relative',
    transform: [{ translateY: 12 }],
  },
  navSlidingLine: {
    position: 'absolute',
    top: 17,
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
    fontWeight: '800',
    fontSize: 10,
    lineHeight: 12,
  },
  navActiveText: { color: colors.orange },
});
