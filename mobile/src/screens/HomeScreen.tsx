import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { mockEvents } from '../data/mockEvents';
import { getPublicEvents } from '../services/events';
import { colors } from '../theme/colors';
import { MobileEvent } from '../types/event';
import { AppFooter } from '../components/AppFooter';

const banner = require('../../assets/home-banner.webp');

type Props = {
  onOpenEvent: (event: MobileEvent) => void;
};

const trustItems = [
  { icon: '▣', title: 'Secure payments', subtitle: 'Processed by Stripe' },
  { icon: '♢', title: 'Verified tickets', subtitle: 'Protected digital entry' },
  { icon: '⌗', title: 'Unique QR', subtitle: 'Fast door validation' },
  { icon: '◎', title: 'Support available', subtitle: 'Before and after purchase' },
];

export function HomeScreen({ onOpenEvent }: Props) {
  const [events, setEvents] = useState<MobileEvent[]>(mockEvents);

  useEffect(() => {
    let mounted = true;

    getPublicEvents()
      .then((items) => {
        if (mounted && items.length > 0) setEvents(items);
      })
      .catch(() => {
        if (mounted) setEvents(mockEvents);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroWrap}>
        <Image source={banner} style={styles.heroImage} resizeMode="cover" />
        <TouchableOpacity style={[styles.heroArrow, styles.heroLeft]}><Text style={styles.heroArrowText}>‹</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.heroArrow, styles.heroRight]}><Text style={styles.heroArrowText}>›</Text></TouchableOpacity>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>SEARCH EVENT</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>⌕</Text>
            <TextInput placeholder="Concerts, theater, workshops..." placeholderTextColor="#8B95A3" style={styles.fieldInput} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>PLACE</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>⌖</Text>
            <TextInput placeholder="City or venue" placeholderTextColor="#8B95A3" style={styles.fieldInput} />
          </View>
        </View>
        <TouchableOpacity style={styles.searchButton}><Text style={styles.searchText}>SEARCH</Text></TouchableOpacity>

        <View style={styles.categoryRow}>
          {['‹', 'All', 'Concert', 'Private', '›'].map((item, index) => (
            <TouchableOpacity key={item} style={[styles.category, item === 'All' && styles.categoryActive, (index === 0 || index === 4) && styles.categoryArrow]}>
              <Text style={[styles.categoryText, item === 'All' && styles.categoryTextActive]}>{item}</Text>
              {item === 'All' && <View style={styles.categoryDot} />}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.sortButton}><Text style={styles.sortText}>SORT BY ▼</Text></TouchableOpacity>
      </View>

      <View style={styles.trustList}>
        {trustItems.map((item) => (
          <View key={item.title} style={styles.trustCard}>
            <View style={styles.trustIcon}><Text style={styles.trustIconText}>{item.icon}</Text></View>
            <View>
              <Text style={styles.trustTitle}>{item.title}</Text>
              <Text style={styles.trustSubtitle}>{item.subtitle}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.highlights}>
        <Text style={styles.eyebrow}>HIGHLIGHTS</Text>
        <Text style={styles.eventsTitle}>Events near you</Text>
        <Text style={styles.eventsCount}>{events.length} available events</Text>
      </View>

      {events.map((event) => (
        <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => onOpenEvent(event)}>
          <View style={styles.eventPoster}>
            <Image source={banner} style={styles.eventPosterImage} resizeMode="cover" />
            <View style={styles.posterShade} />
            <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>● {event.tag}</Text></View>
            <View style={styles.featuredBadge}><Text style={styles.featuredText}>FEATURED</Text></View>
            <View style={styles.plusBadge}><Text style={styles.plusText}>{event.age}</Text></View>
            <View style={styles.mockPosterText}>
              <Text style={styles.mockVenue}>AMBRIZA</Text>
              <Text style={styles.mockEvent}>NOCHE DE (DES)AMOR</Text>
              <Text style={styles.mockLine}>DRINK · SING · DANCE</Text>
            </View>
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{event.title}</Text>
            <Text style={styles.eventMeta}>▣ {event.date}</Text>
            <Text style={styles.eventMeta}>⌖ {event.venue}</Text>
            <Text style={styles.eventAddress}>{event.address}</Text>
            <View style={styles.divider} />
            <Text style={styles.price}>◇ From {event.price}</Text>
            <View style={styles.ctaRow}>
              <TouchableOpacity style={styles.shareButton}><Text style={styles.shareText}>⌯</Text></TouchableOpacity>
              <TouchableOpacity style={styles.buyButton} onPress={() => onOpenEvent(event)}><Text style={styles.buyText}>BUY TICKETS</Text></TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <AppFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 46 },
  heroWrap: { margin: 16, marginBottom: 0, height: 398, overflow: 'hidden', backgroundColor: colors.navy, borderWidth: 1, borderColor: '#D8DEE8' },
  heroImage: { width: '100%', height: '100%' },
  heroArrow: { position: 'absolute', top: '48%', width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(15,23,42,0.68)', alignItems: 'center', justifyContent: 'center' },
  heroLeft: { left: 14 },
  heroRight: { right: 14 },
  heroArrowText: { color: colors.white, fontSize: 36, lineHeight: 36, fontWeight: '300' },
  searchPanel: { marginHorizontal: 16, marginTop: -16, backgroundColor: colors.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderBottomLeftRadius: 18, borderBottomRightRadius: 18, padding: 16, gap: 12, shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: -4 } },
  field: { borderWidth: 1, borderColor: '#DDE5EE', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.white },
  fieldLabel: { color: '#7B8B9E', fontSize: 11, fontWeight: '800', letterSpacing: 2.4, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldIcon: { color: '#647A90', fontSize: 22, fontWeight: '700' },
  fieldInput: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '700', outlineStyle: 'none' as any },
  searchButton: { backgroundColor: colors.navy, height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchText: { color: colors.white, fontWeight: '800', letterSpacing: 4, fontSize: 13 },
  categoryRow: { paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E6ECF2', flexDirection: 'row', gap: 8 },
  category: { height: 40, minWidth: 94, borderRadius: 12, borderWidth: 1, borderColor: '#DDE5EE', backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryActive: { borderColor: '#FDBA74', backgroundColor: '#FFF7ED' },
  categoryArrow: { minWidth: 34, width: 34 },
  categoryText: { color: colors.navy, fontSize: 14, fontWeight: '800' },
  categoryTextActive: { color: colors.navy },
  categoryDot: { position: 'absolute', right: 12, top: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  sortButton: { height: 52, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  sortText: { color: colors.white, fontWeight: '800', letterSpacing: 3.4, fontSize: 12 },
  trustList: { paddingHorizontal: 16, marginTop: 28, gap: 14 },
  trustCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#DFE6EE', borderRadius: 16, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 16 },
  trustIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: '#FFF3EA', alignItems: 'center', justifyContent: 'center' },
  trustIconText: { color: colors.navy, fontWeight: '800', fontSize: 19 },
  trustTitle: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  trustSubtitle: { color: '#718096', fontSize: 14, fontWeight: '700', marginTop: 2 },
  highlights: { paddingHorizontal: 16, marginTop: 56 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 4.2, fontWeight: '800', marginBottom: 12 },
  eventsTitle: { color: colors.navy, fontSize: 32, lineHeight: 36, fontWeight: '800' },
  eventsCount: { color: colors.muted, fontSize: 16, fontWeight: '700', marginTop: 12 },
  eventCard: { marginHorizontal: 16, marginTop: 28, backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#DDE5EE' },
  eventPoster: { height: 500, position: 'relative', backgroundColor: '#111827' },
  eventPosterImage: { width: '100%', height: '100%' },
  posterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.22)' },
  privateBadge: { position: 'absolute', top: 16, left: 14, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  privateBadgeText: { color: colors.navy, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  featuredBadge: { position: 'absolute', top: 16, right: 14, backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  featuredText: { color: colors.white, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  plusBadge: { position: 'absolute', top: 76, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#8B1E24', fontSize: 20, fontWeight: '800' },
  mockPosterText: { position: 'absolute', left: 18, right: 18, bottom: 34, alignItems: 'center' },
  mockVenue: { color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: 2.2 },
  mockEvent: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  mockLine: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: 18, letterSpacing: 2 },
  eventInfo: { padding: 18 },
  eventName: { color: colors.navy, fontSize: 21, fontWeight: '800', marginBottom: 22 },
  eventMeta: { color: colors.navy, fontSize: 16, fontWeight: '700', marginTop: 8 },
  eventAddress: { color: '#9CA3AF', fontSize: 15, fontWeight: '700', marginTop: 3, paddingLeft: 22 },
  divider: { height: 1, backgroundColor: '#E5EAF0', marginVertical: 20 },
  price: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  ctaRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  shareButton: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.white, fontSize: 26, fontWeight: '800' },
  buyButton: { flex: 1, height: 56, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  buyText: { color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2.6 },
});
