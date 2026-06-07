import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from './src/components/AppHeader';
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
import { LanguageProvider, useLanguage } from './src/i18n/LanguageContext';
import { colors } from './src/theme/colors';
import { MobileEvent } from './src/types/event';

type Tab = 'events' | 'tickets' | 'profile' | 'organizer' | 'admin';

function AppContent() {
  const { t } = useLanguage();
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
      <StatusBar style="light" />
      <View style={styles.app}>
        {!scanOpen && <AppHeader onOpenMenu={() => setMenuOpen(true)} onOpenScan={() => setScanOpen(true)} />}

        {!scanOpen && isLoggedIn && mockUser.canOrganize && !selectedEvent && (
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
              <Text style={[styles.navText, tab === 'events' && styles.navActiveText]}>{t('Eventos', 'Events')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goToTab('tickets')} style={[styles.navItem, tab === 'tickets' && styles.navActive]}>
              <Text style={[styles.navText, tab === 'tickets' && styles.navActiveText]}>{t('Tickets', 'Tickets')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goToTab('profile')} style={[styles.navItem, tab === 'profile' && styles.navActive]}>
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
          onGoSocialMatch={() => goToTab('profile')}
          onGoCart={() => goToTab('tickets')}
          canOrganize={isLoggedIn && mockUser.canOrganize}
          canAdmin={isLoggedIn && mockUser.canAdmin}
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
  app: { flex: 1, backgroundColor: '#030B14', position: 'relative' },
  modeSwitch: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: 'transparent',
    borderRadius: 18,
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
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '900',
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  bottomNav: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: '#030B14',
    borderRadius: 22,
    padding: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    shadowColor: '#111827',
    shadowOpacity: 0.10,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  navItem: { flex: 1, paddingVertical: 11, borderRadius: 16, alignItems: 'center' },
  navActive: { backgroundColor: colors.orange },
  navText: { color: '#9CA3AF', fontWeight: '800', fontSize: 13 },
  navActiveText: { color: colors.white },
});
