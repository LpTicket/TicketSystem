import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';

const banner = require('../../assets/home-banner.webp');

type Props = {
  event: MobileEvent;
  onBack: () => void;
  onBuy: () => void;
};

export function EventDetailScreen({ event, onBack, onBuy }: Props) {
  const { t } = useLanguage();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Events</Text>
      </TouchableOpacity>

      <View style={styles.poster}>
        <Image source={banner} style={styles.posterImage} resizeMode="cover" />
        <View style={styles.shade} />
        <View style={styles.badge}><Text style={styles.badgeText}>{event.tag}</Text></View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.meta}>▣ {event.date}</Text>
        <Text style={styles.meta}>⌖ {event.venue}</Text>
        <Text style={styles.address}>{event.address}</Text>
        <View style={styles.divider} />
        <Text style={styles.price}>From {event.price}</Text>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareButton}><Text style={styles.shareText}>⌯</Text></TouchableOpacity>
          <TouchableOpacity style={styles.buyButton} onPress={onBuy}><Text style={styles.buyText}>{t('COMPRAR TICKETS', 'BUY TICKETS')}</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoBlock}>
        <Text style={styles.infoTitle}>{t('Sobre este evento', 'About this event')}</Text>
        <Text style={styles.infoText}>
          Enjoy a premium LPTicket event experience with secure checkout, instant digital tickets and QR access.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 46 },
  backButton: { alignSelf: 'flex-start', marginBottom: 14, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  backText: { color: colors.navy, fontWeight: '800', fontSize: 14 },
  poster: { height: 420, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.navy },
  posterImage: { width: '100%', height: '100%' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.22)' },
  badge: { position: 'absolute', top: 16, left: 16, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: colors.navy, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  panel: { marginTop: -18, backgroundColor: colors.white, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.navy, fontSize: 25, fontWeight: '800', lineHeight: 30 },
  meta: { color: colors.navy, fontSize: 16, fontWeight: '700', marginTop: 16 },
  address: { color: '#9CA3AF', fontSize: 15, fontWeight: '400', marginTop: 4, paddingLeft: 22 },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
  price: { color: colors.navy, fontSize: 21, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 14, marginTop: 22 },
  shareButton: { width: 56, height: 56, borderRadius: 12, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.white, fontSize: 26, fontWeight: '800' },
  buyButton: { flex: 1, height: 56, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  buyText: { color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2.6 },
  infoBlock: { marginTop: 16, backgroundColor: colors.white, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: colors.border },
  infoTitle: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  infoText: { color: colors.muted, fontSize: 15, fontWeight: '400', lineHeight: 23, marginTop: 8 },
});
