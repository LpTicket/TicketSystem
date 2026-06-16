import { useState } from 'react';
import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { AuthUser, getImageUrl } from '../../services/api';
import { updateProfile as updateProfileRequest } from '../../services/auth';
import { GradientButton } from '../GradientButton';

type AccountForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  password: string;
};

type Props = {
  user: AuthUser;
  onUserUpdated?: (user: AuthUser) => void;
  tabs?: ReactNode;
  showSections?: boolean;
};

export function AccountMobile({ user, onUserUpdated, tabs, showSections = true }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [account, setAccount] = useState<AccountForm>({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    address: '',
    password: '',
  });

  const initials = `${account.firstName[0] || ''}${account.lastName[0] || ''}`.toUpperCase();
  const avatarUrl = getImageUrl(user.avatarUrl);

  const update = (key: keyof AccountForm, value: string) => {
    setAccount((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateProfileRequest({
        firstName: account.firstName,
        lastName: account.lastName,
        username: account.username || undefined,
        email: account.email,
        phone: account.phone,
        ...(account.address ? { address: account.address } : {}),
        ...(account.password ? { password: account.password } : {}),
      });
      onUserUpdated?.(updated);
      setAccount((c) => ({ ...c, password: '' }));
      setEditing(false);
    } catch {
      /* keep editing on error */
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.cameraButton}>
            <Text style={styles.cameraText}>{t('FOTO', 'CAM')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{account.firstName} {account.lastName}</Text>
        <Text style={styles.role}>{t('CUENTA DE CLIENTE', 'CLIENT ACCOUNT')}</Text>

        <View style={styles.heroStats}>
          <View style={[styles.heroStat, styles.heroStatTop]}>
            <Text style={styles.heroStatValue} numberOfLines={1}>{t('Activo', 'Active')}</Text>
            <Text style={styles.heroStatLabel} numberOfLines={1}>{t('Estado', 'Status')}</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatTop]}>
            <Text style={styles.heroStatValue} numberOfLines={1}>100%</Text>
            <Text style={styles.heroStatLabel} numberOfLines={1}>{t('Perfil', 'Profile')}</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatTop]}>
            <Text style={styles.heroStatValue} numberOfLines={1}>2</Text>
            <Text style={styles.heroStatLabel} numberOfLines={1}>{t('Recibos', 'Receipts')}</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatBottom]}>
            <Text style={styles.heroStatValue} numberOfLines={1}>1</Text>
            <Text style={styles.heroStatLabel} numberOfLines={1}>{t('Ticket activo', 'Active ticket')}</Text>
          </View>
          <View style={[styles.heroStat, styles.heroStatBottom]}>
            <Text style={styles.heroStatValue} numberOfLines={1}>92%</Text>
            <Text style={styles.heroStatLabel} numberOfLines={1}>{t('Puntaje social', 'Social score')}</Text>
          </View>
        </View>
      </View>

      {tabs}

      {showSections && (
        <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.eyebrow}>{t('CUENTA', 'ACCOUNT')}</Text>
                <Text style={styles.title}>{t('Información personal', 'Personal information')}</Text>
              </View>

              {editing ? (
                <TouchableOpacity style={styles.cancelSmall} onPress={() => setEditing(false)}>
                  <Text style={styles.cancelSmallText}>CANCEL</Text>
                </TouchableOpacity>
              ) : (
                <GradientButton label="EDIT" onPress={() => setEditing(true)} height={42} style={styles.editSmall} textStyle={styles.editSmallText} />
              )}
            </View>

            {editing ? (
              <View>
                <Field label={t('Nombre', 'First name')} value={account.firstName} onChangeText={(value: string) => update('firstName', value)} />
                <Field label={t('Apellido', 'Last name')} value={account.lastName} onChangeText={(value: string) => update('lastName', value)} />
                <Field label={t('Usuario', 'Username')} value={account.username} onChangeText={(value: string) => update('username', value)} autoCapitalize="none" />
                <Field label={t('Email', 'Email')} value={account.email} onChangeText={(value: string) => update('email', value)} autoCapitalize="none" keyboardType="email-address" />
                <Field label={t('Teléfono', 'Phone')} value={account.phone} onChangeText={(value: string) => update('phone', value)} keyboardType="phone-pad" />
                <Field label={t('Dirección', 'Address')} value={account.address} onChangeText={(value: string) => update('address', value)} multiline />
                <Field label={t('Nueva contraseña opcional', 'New password optional')} value={account.password} onChangeText={(value: string) => update('password', value)} secureTextEntry placeholder="******" />

                <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
                  <Text style={styles.saveText}>{saving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR CAMBIOS', 'SAVE CHANGES')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <InfoRow label={t('Nombre', 'First name')} value={account.firstName} />
                <InfoRow label={t('Apellido', 'Last name')} value={account.lastName} />
                <InfoRow label={t('Usuario', 'Username')} value={`@${account.username}`} />
                <InfoRow label={t('Email', 'Email')} value={account.email} />
                <InfoRow label={t('Teléfono', 'Phone')} value={account.phone} />
                <InfoRow label={t('Dirección', 'Address')} value={account.address} />
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>{t('SEGURIDAD', 'SECURITY')}</Text>
            <Text style={styles.title}>{t('Acceso de cuenta', 'Account access')}</Text>

            <View style={styles.securityRow}>
              <View>
                <Text style={styles.securityTitle}>{t('Email verificado', 'Email verified')}</Text>
                <Text style={styles.securityCopy}>{t('Usado para tickets, recibos y recuperación de cuenta.', 'Used for tickets, receipts and account recovery.')}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{t('ACTIVO', 'ACTIVE')}</Text>
              </View>
            </View>

            <View style={styles.securityRow}>
              <View>
                <Text style={styles.securityTitle}>{t('Contraseña', 'Password')}</Text>
                <Text style={styles.securityCopy}>{t('Actualízala desde el modo de edición cuando sea necesario.', 'Update it from edit mode when needed.')}</Text>
              </View>
              <View style={styles.softPill}>
                <Text style={styles.softPillText}>{t('LISTO', 'READY')}</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

function Field(props: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, props.multiline && styles.textArea]}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  avatarWrap: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#F8FAFC', fontSize: 30, fontWeight: '700' },
  cameraButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.72)',
  },
  cameraText: { color: colors.orange, fontSize: 10, fontWeight: '700' },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', marginBottom: 5 },
  role: { color: '#cbd5e1', fontSize: 12, letterSpacing: 0, fontWeight: '400', marginBottom: 14 },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', justifyContent: 'center' },
  heroStat: {
    minHeight: 48,
    backgroundColor: '#030B14',
    borderRadius: 11,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatTop: { width: '31%' },
  heroStatBottom: { width: '47.5%' },
  heroStatValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  heroStatLabel: { color: '#cbd5e1', fontSize: 9, fontWeight: '400', textAlign: 'center', marginTop: 2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 7 },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '700' },
  editSmall: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    justifyContent: 'center',
  },
  editSmallText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 0, fontWeight: '700' },
  cancelSmall: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  cancelSmallText: { color: '#F8FAFC', fontSize: 12, letterSpacing: 0, fontWeight: '700' },
  infoRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  infoLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 5 },
  infoValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', lineHeight: 22 },
  field: { gap: 7, marginBottom: 14 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  input: {
    minHeight: 56,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  textArea: { minHeight: 92, paddingTop: 14, textAlignVertical: 'top' },
  saveButton: {
    height: 58,
    borderRadius: 17,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  securityRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    padding: 14,
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'center',
  },
  securityTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  securityCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400', lineHeight: 19, maxWidth: 220 },
  statusPill: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { color: '#F8FAFC', fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  softPill: { backgroundColor: '#030B14', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, paddingVertical: 8 },
  softPillText: { color: '#F8FAFC', fontSize: 11, letterSpacing: 0, fontWeight: '700' },
});
