import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { AuthUser, getApiErrorMessage, getImageUrl } from '../../services/api';
import { deleteAccount as deleteAccountRequest, updateProfile as updateProfileRequest, uploadAvatar as uploadAvatarRequest } from '../../services/auth';
import { GradientButton } from '../GradientButton';

type AccountForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  confirmPassword: string;
};

type Props = {
  user: AuthUser;
  onUserUpdated?: (user: AuthUser) => void;
  onAccountDeleted?: () => void;
  tabs?: ReactNode;
  showSections?: boolean;
};

function accountFromUser(user: AuthUser): AccountForm {
  return {
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    username: user.username || '',
    email: user.email || '',
    phone: user.phone || '',
    address: user.address || '',
    password: '',
    confirmPassword: '',
  };
}

export function AccountMobile({ user, onUserUpdated, onAccountDeleted, tabs, showSections = true }: Props) {
  const { lang, t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [account, setAccount] = useState<AccountForm>(() => accountFromUser(user));

  useEffect(() => {
    if (!editing) setAccount(accountFromUser(user));
  }, [editing, user]);

  const initials = `${account.firstName[0] || ''}${account.lastName[0] || ''}`.toUpperCase();
  const avatarUrl = getImageUrl(user.avatarUrl);

  const update = (key: keyof AccountForm, value: string) => {
    setAccount((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (account.password && account.password !== account.confirmPassword) {
      Alert.alert(
        t('Contraseñas distintas', 'Passwords do not match'),
        t('Revisa que la nueva contraseña y repetir contraseña sean iguales.', 'Make sure the new password and confirm password match.'),
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfileRequest({
        firstName: account.firstName,
        lastName: account.lastName,
        username: account.username || undefined,
        email: account.email,
        phone: account.phone,
        address: account.address,
        ...(account.password ? { password: account.password } : {}),
      });
      onUserUpdated?.(updated);
      setAccount(accountFromUser(updated));
      setEditing(false);
      Alert.alert(t('Perfil actualizado', 'Profile updated'), t('Tus cambios se guardaron correctamente.', 'Your changes were saved successfully.'));
    } catch (err: any) {
      Alert.alert(
        t('No se pudo guardar', 'Could not save'),
        getApiErrorMessage(err, lang, t('Revisa los datos e inténtalo de nuevo.', 'Review your details and try again.')),
      );
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setAccount(accountFromUser(user));
    setEditing(false);
  };

  const changeAvatar = async () => {
    if (uploadingAvatar) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('Permiso necesario', 'Permission needed'),
        t('Concede acceso a tus fotos para cambiar tu foto de perfil.', 'Grant photo access to change your profile photo.'),
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.86,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert(t('Error', 'Error'), t('No se pudo preparar la foto seleccionada.', 'Could not prepare the selected photo.'));
      return;
    }

    setUploadingAvatar(true);
    try {
      const mimeType = asset.mimeType || 'image/jpeg';
      const updated = await uploadAvatarRequest(`data:${mimeType};base64,${asset.base64}`);
      onUserUpdated?.(updated);
    } catch (err: any) {
      Alert.alert(
        t('Error', 'Error'),
        err?.message || t('No se pudo cambiar la foto de perfil.', 'Could not change your profile photo.'),
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const confirmDeleteAccount = () => {
    if (deletingAccount) return;
    Alert.alert(
      t('Eliminar cuenta', 'Delete account'),
      t(
        'Esta acción desactivará tu cuenta y eliminará tus datos personales del perfil. Tus registros transaccionales pueden conservarse cuando la ley lo requiera.',
        'This will deactivate your account and remove your personal profile data. Transaction records may be retained when required by law.',
      ),
      [
        { text: t('Cancelar', 'Cancel'), style: 'cancel' },
        {
          text: t('Eliminar cuenta', 'Delete account'),
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              await deleteAccountRequest();
              Alert.alert(
                t('Cuenta eliminada', 'Account deleted'),
                t('Tu cuenta fue eliminada correctamente.', 'Your account was deleted successfully.'),
                [{ text: 'OK', onPress: onAccountDeleted }],
              );
            } catch (err: any) {
              Alert.alert(
                t('Error', 'Error'),
                err?.message || t('No se pudo eliminar la cuenta. Intenta de nuevo.', 'Could not delete the account. Please try again.'),
              );
            } finally {
              setDeletingAccount(false);
            }
          },
        },
      ],
    );
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
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.cameraButton, uploadingAvatar && styles.cameraButtonDisabled]}
            onPress={changeAvatar}
            disabled={uploadingAvatar}
            accessibilityLabel={t('Cambiar foto de perfil', 'Change profile photo')}
          >
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color={colors.orange} />
            ) : (
              <Feather name="edit-2" size={14} color={colors.orange} />
            )}
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
                <TouchableOpacity style={styles.cancelSmall} onPress={cancelEdit}>
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
                <Field label={t('Repetir contraseña', 'Confirm password')} value={account.confirmPassword} onChangeText={(value: string) => update('confirmPassword', value)} secureTextEntry placeholder="******" />

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

          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerEyebrow}>{t('PRIVACIDAD', 'PRIVACY')}</Text>
            <Text style={styles.dangerTitle}>{t('Eliminar cuenta', 'Delete account')}</Text>
            <Text style={styles.dangerCopy}>
              {t(
                'Puedes solicitar la eliminación permanente de tu cuenta desde aquí. Cerraremos tu sesión al confirmar.',
                'You can request permanent account deletion here. We will sign you out after confirmation.',
              )}
            </Text>
            <TouchableOpacity
              style={[styles.deleteButton, deletingAccount && { opacity: 0.6 }]}
              onPress={confirmDeleteAccount}
              disabled={deletingAccount}
              activeOpacity={0.86}
            >
              <Feather name="trash-2" size={16} color="#FCA5A5" />
              <Text style={styles.deleteText}>{deletingAccount ? t('ELIMINANDO...', 'DELETING...') : t('ELIMINAR CUENTA', 'DELETE ACCOUNT')}</Text>
            </TouchableOpacity>
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
  avatarText: { color: '#F8FAFC', fontSize: 30, fontWeight: '600' },
  cameraButton: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.72)',
    shadowColor: '#ff6800',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  cameraButtonDisabled: { opacity: 0.66 },
  name: { color: '#FFFFFF', fontSize: 26, fontWeight: '600', marginBottom: 5 },
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
  heroStatValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
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
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 7 },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '600' },
  editSmall: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    justifyContent: 'center',
  },
  editSmallText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 0, fontWeight: '600' },
  cancelSmall: {
    height: 42,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
  },
  cancelSmallText: { color: '#F8FAFC', fontSize: 12, letterSpacing: 0, fontWeight: '600' },
  infoRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 10,
  },
  infoLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 5 },
  infoValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', lineHeight: 22 },
  field: { gap: 7, marginBottom: 14 },
  inputLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '400' },
  input: {
    minHeight: 56,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 16,
    paddingVertical: 0,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '600',
    textAlignVertical: 'center',
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
  saveText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  dangerCard: {
    borderColor: 'rgba(248,113,113,0.32)',
  },
  dangerEyebrow: { color: '#FCA5A5', fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 7 },
  dangerTitle: { color: '#F8FAFC', fontSize: 21, fontWeight: '600', marginBottom: 8 },
  dangerCopy: { color: 'rgba(226,232,240,0.70)', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  deleteButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.42)',
    backgroundColor: 'rgba(127,29,29,0.24)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: { color: '#FCA5A5', fontSize: 13, letterSpacing: 0, fontWeight: '600' },
});
