import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from './src/components/AppHeader';
import { FloatingButtons } from './src/components/FloatingButtons';
import { MenuDrawer } from './src/components/MenuDrawer';
import { mockEvents } from './src/data/mockEvents';
import { mockUser } from './src/data/mockUser';
import { HomeScreen } from './src/screens/HomeScreen';
import { EventDetailScreen } from './src/screens/EventDetailScreen';
import { TicketsScreen } from './src/screens/TicketsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OrganizerPanelScreen } from './src/screens/OrganizerPanelScreen';
import { AdminPanelScreen } from './src/screens/AdminPanelScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { PurchaseScreen } from './src/screens/PurchaseScreen';
import { CheckoutInfoScreen } from './src/screens/CheckoutInfoScreen';
import { OrderSummaryScreen } from './src/screens/OrderSummaryScreen';
import { PaymentSuccessScreen } from './src/screens/PaymentSuccessScreen';
import { colors } from './src/theme/colors';
import { MobileEvent } from './src/types/event';

type Tab = 'events' | 'tickets' | 'profile' | 'organizer' | 'admin';

export default function App() {
  const [tab, setTab] = useState<Tab>('events');
  const [selectedEvent, setSelectedEvent] = useState<MobileEvent | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [checkoutInfoOpen, setCheckoutInfoOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginAfterPurchase, setLoginAfterPurchase] = useState(false);
  const [viewMode, setViewMode] = useState<'client' | 'organizer'>('client');
  const [paymentSuccessOpen, setPaymentSuccessOpen] = useState(false);

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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        {!scanOpen && <AppHeader onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => setScanOpen(true)} />}

        {!scanOpen && isLoggedIn && mockUser.canOrganize && !selectedEvent && (
          <View style={styles.modeSwitch}>
            <TouchableOpacity onPress={() => { setViewMode('client'); goToTab('events'); }} style={[styles.modeButton, viewMode === 'client' && styles.modeButtonActive]}>
              <Text style={[styles.modeText, viewMode === 'client' && styles.modeTextActive]}>Client</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setViewMode('organizer'); goToTab('organizer'); }} style={[styles.modeButton, viewMode === 'organizer' && styles.modeButtonActive]}>
              <Text style={[styles.modeText, viewMode === 'organizer' && styles.modeTextActive]}>Organizer</Text>
            </TouchableOpacity>
          </View>
        )}

        {scanOpen ? (
          <ScanScreen onBack={() => setScanOpen(false)} />
        ) : selectedEvent && paymentSuccessOpen ? (
          <PaymentSuccessScreen event={selectedEvent} onViewTickets={() => { clearFlow(); setTab('tickets'); }} onHome={() => { clearFlow(); setTab('events'); }} />
        ) : selectedEvent && orderSummaryOpen ? (
          <OrderSummaryScreen event={selectedEvent} onBack={() => { setOrderSummaryOpen(false); setCheckoutInfoOpen(true); }} onPay={() => { setOrderSummaryOpen(false); setPaymentSuccessOpen(true); }} />
        ) : selectedEvent && checkoutInfoOpen ? (
          <CheckoutInfoScreen event={selectedEvent} onBack={() => setCheckoutInfoOpen(false)} onContinue={() => { setCheckoutInfoOpen(false); setOrderSummaryOpen(true); }} />
        ) : selectedEvent && loginAfterPurchase ? (
          <LoginScreen onSignIn={() => { setIsLoggedIn(true); setLoginAfterPurchase(false); setPurchaseOpen(true); }} />
        ) : selectedEvent && purchaseOpen ? (
          <PurchaseScreen event={selectedEvent} onBack={() => setPurchaseOpen(false)} onContinue={() => { setPurchaseOpen(false); setCheckoutInfoOpen(true); }} />
        ) : selectedEvent ? (
          <EventDetailScreen event={selectedEvent} onBack={() => setSelectedEvent(null)} onBuy={() => { setPaymentSuccessOpen(false); setOrderSummaryOpen(false); setCheckoutInfoOpen(false); if (isLoggedIn) { setPurchaseOpen(true); } else { setLoginAfterPurchase(true); } }} />
        ) : tab === 'events' ? (
          <HomeScreen onOpenEvent={setSelectedEvent} />
        ) : tab === 'tickets' ? (
          isLoggedIn ? <TicketsScreen /> : <LoginScreen onSignIn={() => setIsLoggedIn(true)} />
        ) : tab === 'profile' ? (
          isLoggedIn ? <ProfileScreen /> : <LoginScreen onSignIn={() => setIsLoggedIn(true)} />
        ) : tab === 'organizer' ? (
          isLoggedIn ? <OrganizerPanelScreen /> : <LoginScreen onSignIn={() => setIsLoggedIn(true)} />
        ) : tab === 'admin' ? (
          isLoggedIn && mockUser.canAdmin ? <AdminPanelScreen /> : <LoginScreen onSignIn={() => setIsLoggedIn(true)} />
        ) : null}

        {!selectedEvent && !scanOpen && !purchaseOpen && (
          <View style={styles.bottomNav}>
            <TouchableOpacity onPress={() => goToTab('events')} style={[styles.navItem, tab === 'events' && styles.navActive]}>
              <Text style={[styles.navText, tab === 'events' && styles.navActiveText]}>Events</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goToTab('tickets')} style={[styles.navItem, tab === 'tickets' && styles.navActive]}>
              <Text style={[styles.navText, tab === 'tickets' && styles.navActiveText]}>Tickets</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goToTab('profile')} style={[styles.navItem, tab === 'profile' && styles.navActive]}>
              <Text style={[styles.navText, tab === 'profile' && styles.navActiveText]}>Profile</Text>
            </TouchableOpacity>
          </View>
        )}

        <MenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} onGoEvents={() => goToTab('events')} onGoTickets={() => goToTab('tickets')} onGoProfile={() => goToTab('profile')} onGoOrganizer={() => { setViewMode('organizer'); goToTab('organizer'); }} onGoAdmin={() => goToTab('admin')} onGoScan={() => { clearFlow(); setScanOpen(true); }} canOrganize={isLoggedIn && mockUser.canOrganize} canAdmin={isLoggedIn && mockUser.canAdmin} />
        {!scanOpen && <FloatingButtons />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  app: { flex: 1, backgroundColor: colors.bg, position: 'relative' },
  modeSwitch: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 5,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButton: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.navy,
  },
  modeText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  navItem: { flex: 1, paddingVertical: 11, borderRadius: 16, alignItems: 'center' },
  navActive: { backgroundColor: colors.navy },
  navText: { color: '#94A3B8', fontWeight: '800', fontSize: 13 },
  navActiveText: { color: colors.white },
});
