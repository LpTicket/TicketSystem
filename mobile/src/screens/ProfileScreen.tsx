import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { mockUser } from '../data/mockUser';

export function ProfileScreen() {
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState({
    firstName: mockUser.firstName,
    lastName: mockUser.lastName,
    email: mockUser.email,
    phone: mockUser.phone,
  });

  const initials = `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`;

  const updateProfile = (key: keyof typeof profile, value: string) => {
    setProfile((current) => ({ ...current, [key]: value }));
  };

  if (editing) {
    return (
      <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.editHeader}>
          <Text style={styles.eyebrow}>PROFILE</Text>
          <Text style={styles.editTitle}>Edit information</Text>
          <Text style={styles.editCopy}>Update the information used for checkout and ticket delivery.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>ACCOUNT INFORMATION</Text>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>First name</Text>
            <TextInput value={profile.firstName} onChangeText={(value) => updateProfile('firstName', value)} style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>Last name</Text>
            <TextInput value={profile.lastName} onChangeText={(value) => updateProfile('lastName', value)} style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput value={profile.email} onChangeText={(value) => updateProfile('email', value)} autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          </View>

          <View style={styles.field}>
            <Text style={styles.inputLabel}>Phone</Text>
            <TextInput value={profile.phone} onChangeText={(value) => updateProfile('phone', value)} keyboardType="phone-pad" style={styles.input} />
          </View>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={() => setEditing(false)}>
          <Text style={styles.saveText}>SAVE CHANGES</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => setEditing(false)}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <Text style={styles.name}>{profile.firstName} {profile.lastName}</Text>
        <Text style={styles.email}>{profile.email}</Text>

        <TouchableOpacity style={styles.editButton} onPress={() => setEditing(true)}>
          <Text style={styles.editText}>EDIT PROFILE</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>ACCOUNT INFORMATION</Text>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>First name</Text>
          <Text style={styles.rowValue}>{profile.firstName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Last name</Text>
          <Text style={styles.rowValue}>{profile.lastName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Phone</Text>
          <Text style={styles.rowValue}>{profile.phone}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Language</Text>
          <Text style={styles.rowValue}>English</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>ACTIVITY</Text>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>1</Text>
            <Text style={styles.statLabel}>Active ticket</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Pending orders</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>LOG OUT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fa' },
  content: { padding: 18, paddingBottom: 120 },
  hero: {
    backgroundColor: colors.navy,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: colors.navy, fontSize: 30, fontWeight: '900' },
  name: { color: '#ffffff', fontSize: 26, fontWeight: '800', marginBottom: 6 },
  email: { color: '#cbd5e1', fontSize: 15, fontWeight: '600', marginBottom: 18 },
  editButton: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { color: '#ffffff', fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
  editHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  editTitle: { color: colors.navy, fontSize: 30, fontWeight: '800', marginBottom: 8 },
  editCopy: { color: '#64748b', fontSize: 15, lineHeight: 22, fontWeight: '600' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    marginBottom: 14,
  },
  cardLabel: { color: '#64748b', fontSize: 12, letterSpacing: 2.5, fontWeight: '900', marginBottom: 12 },
  row: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 18,
  },
  rowLabel: { color: '#64748b', fontSize: 15, fontWeight: '700' },
  rowValue: { color: colors.navy, fontSize: 15, fontWeight: '800', textAlign: 'right', flex: 1 },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: { color: colors.orange, fontSize: 28, fontWeight: '900', marginBottom: 3 },
  statLabel: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: colors.navy, fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
  field: { gap: 7, marginBottom: 14 },
  inputLabel: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dbe3ec',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 16,
    color: colors.navy,
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
  saveText: { color: '#ffffff', fontSize: 14, letterSpacing: 2, fontWeight: '900' },
  cancelButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.navy, fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
});
