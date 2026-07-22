/**
 * ProfileScreen (mobile)
 * EN: The user's account area — edit profile, manage settings, switch
 *     buyer/organizer/admin views, and log out.
 * ES: El área de cuenta del usuario — editar perfil, gestionar ajustes, cambiar
 *     entre vistas comprador/organizador/admin y cerrar sesión.
 */
import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SymbolView } from 'expo-symbols';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { AppMode } from '../components/ModeSelector';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser } from '../services/api';
import { updateProfile as updateProfileRequest } from '../services/auth';
import { AccountMobile } from '../components/profile/AccountMobile';
import { MySpecialCodesMobile } from '../components/profile/MySpecialCodesMobile';
import { OrdersMobile } from '../components/profile/OrdersMobile';
import { PaymentMethodsMobile } from '../components/profile/PaymentMethodsMobile';
import { presentTapToPayEducation } from '../services/tapToPayEducation';

type ProfileTab = 'account' | 'payments' | 'codes';

type Props = {
  initialTab?: ProfileTab;
  user: AuthUser;
  onUserUpdated?: (user: AuthUser) => void;
  onLogout?: () => void;
  canOrganize?: boolean;
  canAdmin?: boolean;
  viewMode?: AppMode;
  onSetMode?: (mode: AppMode) => void;
  onOpenTapToPay?: () => void;
  scrollToTopSignal?: number;
};

export function ProfileScreen({ initialTab = 'account', user, onUserUpdated, onLogout, canOrganize, canAdmin, viewMode = 'client', onSetMode, onOpenTapToPay, scrollToTopSignal = 0 }: Props) {
  const { t } = useLanguage();
  const scrollRef = useRef<ScrollView>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [tabShellWidth, setTabShellWidth] = useState(0);
  const [tapEducationError, setTapEducationError] = useState('');
  const tabIndicatorX = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || '',
    phone: user.phone || '',
  });

  const tabButtonWidth = tabShellWidth > 0 ? (tabShellWidth - 24) / 3 : 0;

  useEffect(() => {
    let targetX = 0;
    if (activeTab === 'payments') targetX = tabButtonWidth + 6;
    if (activeTab === 'codes') targetX = (tabButtonWidth + 6) * 2;

    Animated.spring(tabIndicatorX, {
      toValue: targetX,
      useNativeDriver: true,
      damping: 17,
      stiffness: 190,
      mass: 0.72,
    }).start();
  }, [activeTab, tabButtonWidth, tabIndicatorX]);

  useEffect(() => {
    if (!scrollToTopSignal) return;
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopSignal]);

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
      <ScrollView ref={scrollRef} style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
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
        <ProfileTabButton label={t('Códigos', 'Codes')} active={activeTab === 'codes'} onPress={() => setActiveTab('codes')} />
      </View>
  );

  return (
    <ScrollView ref={scrollRef} style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      {activeTab === 'account' && <AccountMobile user={user} onUserUpdated={onUserUpdated} onAccountDeleted={onLogout} tabs={tabs} />}

      {activeTab === 'payments' && (
        <>
          <AccountMobile user={user} onUserUpdated={onUserUpdated} onAccountDeleted={onLogout} tabs={tabs} showSections={false} />

          {canAdmin ? (
            <TapToPaySettingsCard
              onOpenDoorSale={onOpenTapToPay}
              onOpenEducation={async () => {
                setTapEducationError('');
                try {
                  await presentTapToPayEducation();
                } catch (error: any) {
                  setTapEducationError(error?.message || t('No se pudo abrir la educación oficial.', 'Could not open the official education.'));
                }
              }}
              error={tapEducationError}
              t={t}
            />
          ) : null}
          <PaymentMethodsMobile />
          <OrdersMobile />
        </>
      )}

      {activeTab === 'codes' && (
        <>
          <AccountMobile user={user} onUserUpdated={onUserUpdated} onAccountDeleted={onLogout} tabs={tabs} showSections={false} />
          <MySpecialCodesMobile />
        </>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>{t('CERRAR SESIÓN', 'LOG OUT')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function TapToPaySettingsCard({
  onOpenDoorSale,
  onOpenEducation,
  error,
  t,
}: {
  onOpenDoorSale?: () => void;
  onOpenEducation: () => void;
  error: string;
  t: (es: string, en: string) => string;
}) {
  return (
    <View style={styles.tapToPayCard}>
      <View style={styles.tapToPayHeader}>
        <View style={styles.tapToPayIcon}>
          <SymbolView name="wave.3.right.circle.fill" size={26} tintColor="#FB923C" />
        </View>
        <View style={styles.tapToPayCopy}>
          <Text style={styles.cardLabel}>Tap to Pay on iPhone</Text>
          <Text style={styles.tapToPayTitle}>{t('Configuración de cobro presencial', 'In-person payment setup')}</Text>
          <Text style={styles.tapToPayText}>{t('Configura esta función antes de aceptar pagos. Solo el administrador principal de LPTicket puede aceptar los términos oficiales.', 'Set up this feature before accepting payments. Only the primary LPTicket administrator can accept the official terms.')}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.tapEducationButton} onPress={onOpenEducation}>
        <Ionicons name="play-circle-outline" size={18} color="#FDBA74" />
        <Text style={styles.tapEducationButtonText}>{t('VER EDUCACIÓN OFICIAL', 'VIEW OFFICIAL EDUCATION')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tapSetupButton} onPress={onOpenDoorSale}>
        <Text style={styles.tapSetupButtonText}>{t('IR A CONFIGURAR', 'GO TO SETUP')}</Text>
        <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
      </TouchableOpacity>
      {error ? <Text style={styles.tapToPayError}>{error}</Text> : null}
    </View>
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
  content: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 132 },
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
  tabText: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  editHeader: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: 14,
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  editTitle: { color: '#F8FAFC', fontSize: 30, fontWeight: '600', marginBottom: 8 },
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
  cardLabel: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  cardTitle: { color: '#F8FAFC', fontSize: 24, fontWeight: '600', marginBottom: 6 },
  cardCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '400' },
  statusPill: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  statusPillText: { color: '#15803d', fontSize: 10, letterSpacing: 0, fontWeight: '600' },
  row: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  rowLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 15, fontWeight: '400' },
  rowValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', textAlign: 'right', flex: 1 },
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
  actionBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  actionCopy: { flex: 1 },
  actionTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  actionSubtitle: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  actionText: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '600' },
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
  socialBadgeText: { color: colors.orange, fontSize: 16, fontWeight: '600' },
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
  switchText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 0, fontWeight: '600' },
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
  matchAvatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  matchCopy: { flex: 1 },
  matchName: { color: '#F8FAFC', fontSize: 17, fontWeight: '600', marginBottom: 3 },
  matchDetail: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  matchScore: { backgroundColor: '#fff7ed', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 8 },
  matchScoreText: { color: colors.orange, fontSize: 13, fontWeight: '600' },
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
  receiptEvent: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  receiptMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400' },
  receiptRight: { alignItems: 'flex-end' },
  receiptTotal: { color: '#F8FAFC', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  receiptStatus: { color: '#15803d', fontSize: 11, letterSpacing: 0, fontWeight: '600' },
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
  paymentIconText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  paymentCopy: { flex: 1 },
  paymentTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  paymentSub: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400' },
  paymentAction: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '600' },
  tapToPayCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.065)', padding: 16, marginBottom: 12, gap: 12 },
  tapToPayHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tapToPayIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  tapToPayCopy: { flex: 1 },
  tapToPayTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  tapToPayText: { color: 'rgba(226,232,240,0.66)', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  tapEducationButton: { height: 44, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tapEducationButtonText: { color: '#FDBA74', fontSize: 11, fontWeight: '600' },
  tapSetupButton: { height: 44, borderRadius: 13, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tapSetupButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  tapToPayError: { color: '#FCA5A5', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '600' },
  field: { gap: 7, marginBottom: 14 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    textAlignVertical: 'center',
  },
  codeInputWrap: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  codeInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 15,
  },
  codeApplyBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeApplyText: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  saveButton: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  cancelButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '600' },
});
