import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { mockUser } from '../../data/mockUser';

type AccountForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  password: string;
};

export function AccountMobile() {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [account, setAccount] = useState<AccountForm>({
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    username: 'sundingalue',
    email: mockUser.email,
    phone: mockUser.phone,
    address: '1325 Main St Suite 203, Katy, TX 77494',
    password: '',
  });

  const initials = `${account.firstName[0] || ''}${account.lastName[0] || ''}`.toUpperCase();

  const update = (key: keyof AccountForm, value: string) => {
    setAccount((current) => ({ ...current, [key]: value }));
  };

  return (
    <View>
      <View style={styles.heroCard}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <TouchableOpacity style={styles.cameraButton}>
            <Text style={styles.cameraText}>{t('FOTO', 'CAM')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.name}>{account.firstName} {account.lastName}</Text>
        <Text style={styles.role}>{t('CUENTA DE CLIENTE', 'CLIENT ACCOUNT')}</Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{t('Activo', 'Active')}</Text>
            <Text style={styles.heroStatLabel}>{t('Estado', 'Status')}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>100%</Text>
            <Text style={styles.heroStatLabel}>{t('Perfil', 'Profile')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.eyebrow}>{t('CUENTA', 'ACCOUNT')}</Text>
            <Text style={styles.title}>{t('Información personal', 'Personal information')}</Text>
          </View>

          <TouchableOpacity style={editing ? styles.cancelSmall : styles.editSmall} onPress={() => setEditing(!editing)}>
            <Text style={editing ? styles.cancelSmallText : styles.editSmallText}>{editing ? 'CANCEL' : 'EDIT'}</Text>
          </TouchableOpacity>
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

            <TouchableOpacity style={styles.saveButton} onPress={() => setEditing(false)}>
              <Text style={styles.saveText}>{t('GUARDAR CAMBIOS', 'SAVE CHANGES')}</Text>
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
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  avatarWrap: { position: 'relative', marginBottom: 15 },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.018)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  avatarText: { color: '#F8FAFC', fontSize: 30, fontWeight: '900' },
  cameraButton: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.navy,
  },
  cameraText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 5 },
  role: { color: '#cbd5e1', fontSize: 12, letterSpacing: 2.4, fontWeight: '900', marginBottom: 18 },
  heroStats: { flexDirection: 'row', gap: 12, width: '100%' },
  heroStat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  heroStatValue: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  heroStatLabel: { color: '#cbd5e1', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 7 },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '900' },
  editSmall: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: colors.orange,
    justifyContent: 'center',
  },
  editSmallText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.6, fontWeight: '900' },
  cancelSmall: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#030B14',
    justifyContent: 'center',
  },
  cancelSmallText: { color: '#F8FAFC', fontSize: 12, letterSpacing: 1.6, fontWeight: '900' },
  infoRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  infoLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 1.5, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  infoValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', lineHeight: 22 },
  field: { gap: 7, marginBottom: 14 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '900' },
  input: {
    minHeight: 56,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    paddingHorizontal: 16,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
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
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 2, fontWeight: '900' },
  securityRow: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
    alignItems: 'center',
  },
  securityTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '900', marginBottom: 3 },
  securityCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '700', lineHeight: 19, maxWidth: 220 },
  statusPill: { backgroundColor: '#DCFCE7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { color: '#15803d', fontSize: 11, letterSpacing: 1.4, fontWeight: '900' },
  softPill: { backgroundColor: '#030B14', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  softPillText: { color: '#F8FAFC', fontSize: 11, letterSpacing: 1.4, fontWeight: '900' },
});
