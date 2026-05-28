import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const logo = require('../../assets/lpticket-logo.png');

export function AppFooter() {
  return (
    <View style={styles.footer}>
      <Image source={logo} style={styles.footerLogo} resizeMode="contain" />

      <View style={styles.socialRow}>
        <View style={styles.socialCircle}><Text style={styles.socialText}>☎</Text></View>
        <View style={styles.socialCircle}><Text style={styles.socialText}>◎</Text></View>
      </View>

      <View style={styles.footerLine} />

      <Text style={styles.footerHead}>LPTICKET</Text>
      <Text style={styles.footerLink}>About Us</Text>

      <Text style={styles.footerHead}>YOUR EVENT</Text>
      <Text style={styles.footerLink}>Events</Text>
      <Text style={styles.footerLink}>Refunds</Text>
      <Text style={styles.footerLink}>My Tickets</Text>

      <Text style={styles.footerHead}>LEGAL</Text>
      <Text style={styles.footerLink}>Legal Terms</Text>
      <Text style={styles.footerLink}>Privacy</Text>
      <Text style={styles.footerLink}>Support</Text>
      <Text style={styles.footerLink}>Organizer Agreement</Text>

      <Text style={styles.footerHead}>CONTACT</Text>
      <Text style={styles.footerSmall}>ADDRESS</Text>
      <Text style={styles.footerLink}>1325 Main St Suite 203, Katy, TX 77494</Text>
      <Text style={styles.footerSmall}>PHONE</Text>
      <Text style={styles.footerLink}>832.379.0809</Text>
      <Text style={styles.footerSmall}>EMAIL</Text>
      <Text style={styles.footerLink}>info@lpticket.com</Text>

      <View style={styles.footerLine} />
      <Text style={styles.disclaimer}>
        Important: LP Ticket is not responsible for the quality, organization, changes, cancellation, or satisfaction of published events. LP Ticket is a platform that provides online ticket sales and event access management services.
      </Text>
      <Text style={styles.copy}>COPYRIGHT © 2026 LP TICKET · ALL RIGHTS RESERVED</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.navy,
    paddingHorizontal: 26,
    paddingTop: 58,
    paddingBottom: 110,
    alignItems: 'flex-start',
  },
  footerLogo: { alignSelf: 'center', width: 170, height: 54, tintColor: colors.white },
  socialRow: { alignSelf: 'center', flexDirection: 'row', gap: 22, marginTop: 28 },
  socialCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  footerLine: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 42,
  },
  footerHead: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 24,
    marginTop: 10,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 20,
  },
  footerSmall: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
    marginTop: 10,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  copy: {
    color: 'rgba(255,255,255,0.22)',
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 4,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 42,
    alignSelf: 'center',
  },
});
