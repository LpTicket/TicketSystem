import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  onSignIn: () => void;
};

export function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState('sundin@example.com');
  const [password, setPassword] = useState('123456');

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ACCOUNT</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.copy}>Access your tickets, profile and checkout information.</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@example.com"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={onSignIn}>
          <Text style={styles.buttonText}>SIGN IN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>CREATE ACCOUNT</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 18,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 22,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
    marginBottom: 8,
  },
  title: {
    color: colors.navy,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  copy: {
    color: '#64748b',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 22,
  },
  field: {
    gap: 7,
    marginBottom: 14,
  },
  label: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
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
  button: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryText: {
    color: colors.navy,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
});
