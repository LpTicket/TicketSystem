import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AppHeader } from './src/components/AppHeader';
import { MenuDrawer } from './src/components/MenuDrawer';
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
type PrimaryTab = 'events' | 'tickets' | 'profile';
type NavIconName = 'calendar' | 'ticket' | 'profile';

type NavTabButtonProps = {
  active: boolean;
  icon: NavIconName;
  label: string;
  onPress: () => void;
};

function NavIcon({ name, active }: { name: NavIconName; active: boolean }) {
  if (name === 'calendar') {
    return (
      <View style={[styles.iconCalendar, active && styles.iconCalendarActive]}>
        <View style={styles.iconCalendarTop} />
        <View style={[styles.iconCalendarDot, styles.iconCalendarDotLeft, active && styles.iconDotActive]} />
        <View style={[styles.iconCalendarDot, styles.iconCalendarDotRight, active && styles.iconDotActive]} />
        <View style={[styles.iconCalendarLine, active && styles.iconLineActive]} />
      </View>
    );
  }

  if (name === 'ticket') {
    return (
      <View style={[styles.iconTicket, active && styles.iconTicketActive]}>
        <View style={[styles.iconTicketNotch, styles.iconTicketNotchLeft]} />
        <View style={[styles.iconTicketNotch, styles.iconTicketNotchRight]} />
        <View style={[styles.iconTicketLine, active && styles.iconLineActive]} />
      </View>
    );
  }

  return (
    <View style={[styles.iconProfile, active && styles.iconProfileActive]}>
      <View style={[styles.iconProfileHead, active && styles.iconDotActive]} />
      <View style={[styles.iconProfileBody, active && styles.iconLineActive]} />
    </View>
  );
}

function NavTabButton({ active, icon, label, onPress }: NavTabButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.navItem, active && styles.navActive]}
      activeOpacity={0.86}
    >
      <View style={[styles.navIconWrap, active && styles.navIconWrapActive]}>
        <NavIcon name={icon} active={active} />
      </View>
      <Text style={[styles.navText, active && styles.navActiveText]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.navIndicator, active && styles.navIndicatorActive]} />
    </TouchableOpacity>
  );
}

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

  const navTabs: Array<{ id: PrimaryTab; icon: NavIconName; label: string }> = [
    { id: 'events', icon: 'calendar', label: t('Eventos', 'Events') },
    { id: 'tickets', icon: 'ticket', label: t('Tickets', 'Tickets') },
    { id: 'profile', icon: 'profile', label: t('Perfil', 'Profile') },
  ];

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
            <View pointerEvents="none" style={styles.bottomNavGlow} />
            {navTabs.map((item) => (
              <NavTabButton
                key={item.id}
                active={tab === item.id}
                icon={item.icon}
                label={item.label}
                onPress={() => goToTab(item.id)}
              />
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
    height: 78,
    borderRadius: 30,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    backgroundColor: 'rgba(6, 19, 34, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    shadowColor: '#000000',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },
  bottomNavGlow: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: -36,
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 124, 51, 0.22)',
  },
  navItem: {
    flex: 1,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  navActive: {
    backgroundColor: 'rgba(255, 124, 51, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 124, 51, 0.42)',
  },
  navIconWrap: {
    width: 30,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  navIconWrapActive: {
    backgroundColor: colors.orange,
  },
  navText: {
    maxWidth: 82,
    color: '#8EA0B7',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
  },
  navActiveText: {
    color: colors.white,
  },
  navIndicator: {
    position: 'absolute',
    bottom: 5,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'transparent',
  },
  navIndicatorActive: {
    backgroundColor: colors.orange,
  },
  iconCalendar: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#8EA0B7',
    position: 'relative',
  },
  iconCalendarActive: {
    borderColor: colors.white,
  },
  iconCalendarTop: {
    position: 'absolute',
    left: -2,
    right: -2,
    top: 3,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  iconCalendarDot: {
    position: 'absolute',
    top: -4,
    width: 3,
    height: 6,
    borderRadius: 2,
    backgroundColor: '#8EA0B7',
  },
  iconCalendarDotLeft: { left: 3 },
  iconCalendarDotRight: { right: 3 },
  iconCalendarLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#8EA0B7',
  },
  iconTicket: {
    width: 20,
    height: 15,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#8EA0B7',
    position: 'relative',
    justifyContent: 'center',
  },
  iconTicketActive: {
    borderColor: colors.white,
  },
  iconTicketNotch: {
    position: 'absolute',
    top: 4,
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.orange,
  },
  iconTicketNotchLeft: { left: -4 },
  iconTicketNotchRight: { right: -4 },
  iconTicketLine: {
    alignSelf: 'center',
    width: 7,
    height: 2,
    borderRadius: 2,
    backgroundColor: '#8EA0B7',
  },
  iconProfile: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#8EA0B7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconProfileActive: {
    borderColor: colors.white,
  },
  iconProfileHead: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#8EA0B7',
  },
  iconProfileBody: {
    width: 10,
    height: 4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: '#8EA0B7',
  },
  iconDotActive: {
    backgroundColor: colors.white,
  },
  iconLineActive: {
    backgroundColor: colors.white,
  },
});
