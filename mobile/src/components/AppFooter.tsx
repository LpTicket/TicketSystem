import { Image, StyleSheet, Text, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';

const logo = require('../../assets/lpticket-logo.png');

export function AppFooter() {
  const { t } = useLanguage();

  return (
    <View style={styles.footer}>
      <View style={styles.footerTop}>
        <Image source={logo} style={styles.footerLogo} resizeMode="contain" />
        <View style={styles.socialRow}>
          <View style={styles.socialCircle}><Text style={styles.socialText}>◉</Text></View>
          <View style={styles.socialCircle}><Text style={styles.socialText}>◎</Text></View>
        </View>
      </View>

      <View style={styles.footerLine} />

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.footerHead}>Lpticket</Text>
          <Text style={styles.footerLink}>{t('Sobre nosotros', 'About Us')}</Text>
        </View>

        <View style={styles.column}>
          <Text style={styles.footerHead}>{t('TU EVENTO', 'YOUR EVENT')}</Text>
          <Text style={styles.footerLink}>{t('Eventos', 'Events')}</Text>
          <Text style={styles.footerLink}>{t('Reembolsos', 'Refunds')}</Text>
          <Text style={styles.footerLink}>{t('Mis Tickets', 'My Tickets')}</Text>
        </View>

        <View style={styles.column}>
          <Text style={styles.footerHead}>Legal</Text>
          <Text style={styles.footerLink}>{t('Términos legales', 'Legal Terms')}</Text>
          <Text style={styles.footerLink}>{t('Privacidad', 'Privacy')}</Text>
          <Text style={styles.footerLink}>{t('Soporte', 'Support')}</Text>
          <Text style={styles.footerLink}>{t('Acuerdo de Organizador', 'Organizer Agreement')}</Text>
        </View>

        <View style={styles.column}>
          <Text style={styles.footerHead}>{t('CONTACTO', 'CONTACT')}</Text>
          <Text style={styles.footerSmall}>{t('DIRECCIÓN', 'ADDRESS')}</Text>
          <Text style={styles.footerLink}>1325 Main St Suite 203, Katy, TX 77494</Text>
          <Text style={styles.footerSmall}>{t('TELÉFONO', 'PHONE')}</Text>
          <Text style={styles.footerLink}>832.379.0809</Text>
          <Text style={styles.footerSmall}>Email</Text>
          <Text style={styles.footerLink}>info@lpticket.com</Text>
        </View>
      </View>

      <View style={styles.footerLine} />

      <Text style={styles.disclaimer}>
        {t(
          'Importante: LP Ticket no se hace responsable por la calidad, organización, cambios, cancelaciones o satisfacción de los eventos publicados. LP Ticket es una plataforma que brinda servicios de venta de entradas en línea y gestión de acceso a eventos.',
          'Important: LP Ticket is not responsible for the quality, organization, changes, cancellation, or satisfaction of the published events. LP Ticket is a platform that provides online ticket sales and event access management services.'
        )}
      </Text>

      <Text style={styles.copy}>
        {t('COPYRIGHT © 2026 LP TICKET · TODOS LOS DERECHOS RESERVADOS', 'COPYRIGHT © 2026 LP TICKET · ALL RIGHTS RESERVED')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: '#030B14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 22,
    paddingTop: 42,
    paddingBottom: 112,
  },
  footerTop: {
    alignItems: 'center',
    gap: 24,
  },
  footerLogo: {
    width: 150,
    height: 46,
    tintColor: '#FFFFFF',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 16,
  },
  socialCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.018)',
  },
  socialText: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 17,
    fontWeight: '700',
  },
  footerLine: {
    height: 1,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 34,
  },
  columns: {
    gap: 28,
  },
  column: {
    gap: 10,
  },
  footerHead: {
    color: 'rgba(255,255,255,0.90)',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 6,
  },
  footerLink: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  footerSmall: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 9,
    fontWeight: '400',
    letterSpacing: 0,
    marginTop: 8,
  },
  disclaimer: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  copy: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 10,
    lineHeight: 18,
    letterSpacing: 0,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 34,
  },
});
