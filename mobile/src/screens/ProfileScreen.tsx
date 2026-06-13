import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser } from '../services/api';
import { updateProfile as updateProfileRequest } from '../services/auth';
import { AccountMobile } from '../components/profile/AccountMobile';

type ProfileTab = 'account' | 'payments';

type Props = {
  initialTab?: ProfileTab;
  user: AuthUser;
  onUserUpdated?: (user: AuthUser) => void;
  onLogout?: () => void;
};

const paymentMethods = [
  { id: '1', brand: 'Visa', last4: '4242', label: 'Primary card' },
  { id: '2', brand: 'Apple Pay', last4: 'Ready', label: 'Fast checkout' },
];

export function ProfileScreen({ initialTab = 'account', user, onUserUpdated, onLogout }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [tabShellWidth, setTabShellWidth] = useState(0);
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    phone: user.phone || '',
  });

  const tabButtonWidth = tabShellWidth > 0 ? (tabShellWidth - 18) / 2 : 0;

  useEffect(() => {
    Animated.spring(tabIndicatorX, {
      toValue: activeTab === 'account' ? 0 : tabButtonWidth + 6,
      useNativeDriver: true,
      damping: 17,
      stiffness: 190,
      mass: 0.72,
    }).start();
  }, [activeTab, tabButtonWidth, tabIndicatorX]);

  const updateProfile = (key: keyof typeof profile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await updateProfileRequest({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
      });
      onUserUpdated?.(updated);
      setEditing(false);
    } catch {
      /* keep editing on error */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.editHeader}>
          <Text style={styles.eyebrow}>{t('PERFIL', 'PROFILE')}</Text>
          <Text style={styles.editTitle}>{t('Editar información', 'Edit information')}</Text>
          <Text style={styles.editCopy}>{t('Actualiza los datos usados para checkout, recibos y entrega de tickets.', 'Update the account details used for checkout, receipts and ticket delivery.')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('INFORMACIÓN DE CUENTA', 'ACCOUNT INFORMATION')}</Text>

          <ProfileField label={t('Nombre', 'First name')} value={profile.firstName} onChangeText={(value) => updateProfile('firstName', value)} />
          <ProfileField label={t('Apellido', 'Last name')} value={profile.lastName} onChangeText={(value) => updateProfile('lastName', value)} />
          <ProfileField label={t('Email', 'Email')} value={profile.email} onChangeText={(value) => updateProfile('email', value)} keyboardType="email-address" autoCapitalize="none" />
          <ProfileField label={t('Teléfono', 'Phone')} value={profile.phone} onChangeText={(value) => updateProfile('phone', value)} keyboardType="phone-pad" />
        </View>

        <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={saveProfile} disabled={saving}>
          <Text style={styles.saveText}>{saving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR CAMBIOS', 'SAVE CHANGES')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
          <Text style={styles.cancelText}>{t('CANCELAR', 'CANCEL')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const tabs = (
      <View style={styles.tabShell} onLayout={(event) => setTabShellWidth(event.nativeEvent.layout.width)}>
        {tabButtonWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabSlidingPill,
              {
                width: tabButtonWidth,
                transform: [{ translateX: tabIndicatorX }],
              },
            ]}
          />
        )}
        <ProfileTabButton label={t('Cuenta', 'Account')} active={activeTab === 'account'} onPress={() => setActiveTab('account')} />
        <ProfileTabButton label={t('Pagos', 'Payments')} active={activeTab === 'payments'} onPress={() => setActiveTab('payments')} />
      </View>
  );

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

      {activeTab === 'account' && <AccountMobile user={user} onUserUpdated={onUserUpdated} tabs={tabs} />}

      {activeTab === 'payments' && (
        <>
          <AccountMobile user={user} onUserUpdated={onUserUpdated} tabs={tabs} showSections={false} />

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('MÉTODOS DE PAGO', 'PAYMENT METHODS')}</Text>
            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.paymentCard}>
                <View style={styles.paymentIcon}>
                  <Text style={styles.paymentIconText}>{method.brand.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.paymentCopy}>
                  <Text style={styles.paymentTitle}>{method.brand}</Text>
                  <Text style={styles.paymentSub}>{method.label} - {method.last4}</Text>
                </View>
                <Text style={styles.paymentAction}>{t('EDITAR', 'EDIT')}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('FACTURACIÓN', 'BILLING')}</Text>
            <ActionRow badge="RC" title={t('Archivo de recibos', 'Receipts archive')} subtitle={t('Ver pagos, impuestos y confirmaciones', 'View payments, taxes and confirmations')} action={t('ABRIR', 'OPEN')} />
            <ActionRow badge="ST" title={t('Checkout de Stripe', 'Stripe checkout')} subtitle={t('Pagos seguros y confirmación instantánea', 'Secure payments and instant confirmation')} action={t('LISTO', 'READY')} />
          </View>
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>{t('CERRAR SESIÓN', 'LOG OUT')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ProfileField({
  label,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} style={styles.input} />
    </View>
  );
}

function ProfileTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.tabButton}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function ActionRow({ badge, title, subtitle, action }: { badge: string; title: string; subtitle: string; action: string }) {
  return (
    <TouchableOpacity style={styles.actionRow}>
      <View style={styles.actionBadge}>
        <Text style={styles.actionBadgeText}>{badge}</Text>
      </View>
      <View style={styles.actionCopy}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.actionText}>{action}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 46, paddingBottom: 132 },
  hero: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    marginBottom: 14,
    shadowColor: '#111827',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  tabShell: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 6,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  tabSlidingPill: { position: 'absolute', left: 6, top: 6, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', shadowColor: '#FFFFFF', shadowOpacity: 0.14, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  tabButton: { flex: 1, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  tabButtonActive: { backgroundColor: '#030B14' },
  tabText: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  editHeader: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 14,
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  editTitle: { color: '#F8FAFC', fontSize: 30, fontWeight: '700', marginBottom: 8 },
  editCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 15, lineHeight: 22, fontWeight: '400' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  cardLabel: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  cardTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  cardCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '400' },
  statusPill: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  statusPillText: { color: '#15803d', fontSize: 10, letterSpacing: 0, fontWeight: '700' },
  row: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  rowLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 15, fontWeight: '400' },
  rowValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', textAlign: 'right', flex: 1 },
  actionRow: {
    minHeight: 74,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  actionBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  actionSubtitle: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  actionText: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  socialHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 16 },
  socialBadge: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#FED7AA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBadgeText: { color: colors.orange, fontSize: 16, fontWeight: '700' },
  socialCopy: { flex: 1 },
  switchRow: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchRowActive: { backgroundColor: 'rgba(255,255,255,0.025)', borderColor: colors.navy },
  switchText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 0, fontWeight: '700' },
  switchTextActive: { color: '#FFFFFF' },
  switchKnob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#cbd5e1' },
  switchKnobActive: { backgroundColor: colors.orange },
  matchCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchAvatar: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  matchCopy: { flex: 1 },
  matchName: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', marginBottom: 3 },
  matchDetail: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  matchScore: { backgroundColor: '#fff7ed', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  matchScoreText: { color: colors.orange, fontSize: 13, fontWeight: '700' },
  receiptRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  receiptEvent: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  receiptMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400' },
  receiptRight: { alignItems: 'flex-end' },
  receiptTotal: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  receiptStatus: { color: '#15803d', fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  paymentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  paymentCopy: { flex: 1 },
  paymentTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  paymentSub: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400' },
  paymentAction: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '700' },
  field: { gap: 7, marginBottom: 14 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  cancelButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '700' },
});
