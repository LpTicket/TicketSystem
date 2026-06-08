import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser } from '../services/api';

type Props = {
  event: any;
  user?: AuthUser | null;
  onBack: () => void;
  onContinue: () => void;
};

export function CheckoutInfoScreen({ event, user, onBack, onContinue }: Props) {
  const { t } = useLanguage();
  const [buyer, setBuyer] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const updateBuyer = (key: keyof typeof buyer, value: string) => {
    setBuyer((current) => ({ ...current, [key]: value }));
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>{t('CHECKOUT', 'CHECKOUT')}</Text>
          <Text style={styles.title}>{t('Confirma tu información', 'Confirm your information')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>{t('Evento seleccionado', 'Selected event')}</Text>
          <Text style={styles.eventTitle}>{event?.title || 'Event'}</Text>

          <View style={styles.eventMetaRow}>
            <Text style={styles.eventMeta}>{event?.date || '06/25 at 07:00 PM'}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.eventMeta}>{event?.venue || 'Ambriza'}</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>{t('DATOS DE CUENTA', 'ACCOUNT DETAILS')}</Text>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>{t('Nombre', 'First name')}</Text>
            <TextInput
              value={buyer.firstName}
              onChangeText={(value) => updateBuyer('firstName', value)}
              placeholder={t('Tu nombre', 'Your first name')}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>{t('Apellido', 'Last name')}</Text>
            <TextInput
              value={buyer.lastName}
              onChangeText={(value) => updateBuyer('lastName', value)}
              placeholder={t('Tu apellido', 'Your last name')}
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>{t('Email', 'Email')}</Text>
            <TextInput
              value={buyer.email}
              onChangeText={(value) => updateBuyer('email', value)}
              placeholder="email@example.com"
              placeholderTextColor={colors.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>{t('Teléfono', 'Phone')}</Text>
            <TextInput
              value={buyer.phone}
              onChangeText={(value) => updateBuyer('phone', value)}
              placeholder={t('Número de teléfono', 'Phone number')}
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t('Checkout seguro', 'Secure checkout')}</Text>
          <Text style={styles.noticeText}>
            We filled this with your account information. Your tickets will be sent to this email after payment confirmation.
          </Text>
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
          <Text style={styles.continueText}>{t('CONTINUAR AL PAGO', 'CONTINUE TO PAYMENT')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e6ebf1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: colors.navy,
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 3,
  },
  title: {
    color: colors.navy,
    fontSize: 24,
    fontWeight: '700',
  },
  content: {
    padding: 18,
    paddingBottom: 34,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 16,
  },
  eventLabel: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  eventTitle: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 10,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  eventMeta: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '400',
  },
  dot: {
    color: colors.orange,
    fontSize: 18,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    gap: 14,
  },
  sectionLabel: {
    color: colors.navy,
    fontSize: 13,
    letterSpacing: 2.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  field: {
    gap: 7,
  },
  inputLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '400',
  },
  input: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: colors.navy,
    fontSize: 16,
    fontWeight: '600',
  },
  notice: {
    marginTop: 16,
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  noticeTitle: {
    color: colors.navy,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  noticeText: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  continueButton: {
    height: 58,
    borderRadius: 15,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '800',
  },
});
