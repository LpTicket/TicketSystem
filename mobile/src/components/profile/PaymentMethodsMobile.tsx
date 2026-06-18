import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet, apiPost, apiDelete } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { PaymentMethodSkeleton } from '../Skeleton';

type MethodType = 'credit_card' | 'bank_account';

type PaymentMethod = {
  id: string;
  type: MethodType;
  last4: string;
  brand: string;
  isDefault?: boolean;
};

function detectBrand(cardNumber: string): string {
  const n = cardNumber.replace(/\s/g, '');
  if (n.startsWith('4')) return 'Visa';
  if (/^5[1-5]/.test(n)) return 'Mastercard';
  if (/^3[47]/.test(n)) return 'American Express';
  return 'Credit Card';
}

function formatCardNumber(val: string) {
  const clean = val.replace(/\D/g, '').slice(0, 16);
  return clean.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(val: string) {
  const clean = val.replace(/\D/g, '').slice(0, 4);
  return clean.length > 2 ? `${clean.slice(0, 2)}/${clean.slice(2)}` : clean;
}

export function PaymentMethodsMobile() {
  const { t } = useLanguage();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [methodType, setMethodType] = useState<MethodType>('credit_card');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const load = async () => {
    try {
      const res = await apiGet<PaymentMethod[]>('/payments/methods');
      setMethods(Array.isArray(res) ? res : []);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setFirstName(''); setLastName(''); setCardNumber(''); setExpiry('');
    setCvc(''); setBankName(''); setRoutingNumber(''); setAccountNumber('');
    setMethodType('credit_card'); setError('');
  };

  const handleAdd = async () => {
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError(t('Ingresa tu nombre y apellido.', 'Enter your first and last name.'));
      return;
    }

    let brand = '';
    let last4 = '';

    if (methodType === 'credit_card') {
      const clean = cardNumber.replace(/\s/g, '');
      if (clean.length < 15) { setError(t('Número de tarjeta inválido.', 'Invalid card number.')); return; }
      if (expiry.length < 5) { setError(t('Fecha de vencimiento incompleta (MM/AA).', 'Incomplete expiry (MM/YY).')); return; }
      if (cvc.length < 3) { setError(t('CVC inválido.', 'Invalid CVC.')); return; }
      brand = detectBrand(clean);
      last4 = clean.slice(-4);
    } else {
      if (!bankName.trim()) { setError(t('Ingresa el nombre de tu banco.', 'Enter your bank name.')); return; }
      if (routingNumber.length !== 9) { setError(t('El routing number debe tener 9 dígitos.', 'Routing number must be 9 digits.')); return; }
      if (accountNumber.length < 4) { setError(t('Número de cuenta demasiado corto.', 'Account number too short.')); return; }
      brand = bankName;
      last4 = accountNumber.slice(-4);
    }

    setSaving(true);
    try {
      await apiPost('/payments/methods', {
        type: methodType, brand, last4,
        providerId: 'mock_' + Date.now(),
      });
      resetForm();
      setAdding(false);
      await load();
    } catch {
      setError(t('Error al guardar el método de pago.', 'Error saving payment method.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiDelete(`/payments/methods/${id}`);
      setMethods((prev) => prev.filter((m) => m.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeleting(null);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{t('MÉTODOS DE PAGO', 'PAYMENT METHODS')}</Text>
        {!adding && (
          <TouchableOpacity onPress={() => setAdding(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ {t('Agregar', 'Add')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {adding && (
        <View style={styles.formPanel}>
          <Text style={styles.formTitle}>{t('Nuevo Método de Pago', 'New Payment Method')}</Text>

          {/* Type selector */}
          <View style={styles.typeRow}>
            <TouchableOpacity
              onPress={() => setMethodType('credit_card')}
              style={[styles.typeBtn, methodType === 'credit_card' && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, methodType === 'credit_card' && styles.typeBtnTextActive]}>
                {t('Tarjeta', 'Card')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMethodType('bank_account')}
              style={[styles.typeBtn, methodType === 'bank_account' && styles.typeBtnActive]}
            >
              <Text style={[styles.typeBtnText, methodType === 'bank_account' && styles.typeBtnTextActive]}>
                {t('Cuenta Bancaria', 'Bank Account')}
              </Text>
            </TouchableOpacity>
          </View>

          <FormField label={t('Nombre del titular', 'First name')} value={firstName} onChangeText={setFirstName} placeholder="John" />
          <FormField label={t('Apellido del titular', 'Last name')} value={lastName} onChangeText={setLastName} placeholder="Doe" />

          {methodType === 'credit_card' ? (
            <>
              <FormField
                label={t('Número de tarjeta', 'Card number')}
                value={cardNumber}
                onChangeText={(v) => setCardNumber(formatCardNumber(v))}
                placeholder="4000 1234 5678 9010"
                keyboardType="numeric"
              />
              <View style={styles.row2}>
                <View style={styles.flex1}>
                  <FormField
                    label={t('Vencimiento (MM/AA)', 'Expiry (MM/YY)')}
                    value={expiry}
                    onChangeText={(v) => setExpiry(formatExpiry(v))}
                    placeholder="12/29"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.flex1}>
                  <FormField
                    label="CVC / CVV"
                    value={cvc}
                    onChangeText={(v) => setCvc(v.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    keyboardType="numeric"
                    secureTextEntry
                  />
                </View>
              </View>
            </>
          ) : (
            <>
              <View style={styles.countryField}>
                <Text style={styles.fieldLabel}>{t('País del Banco', 'Bank Country')}</Text>
                <View style={styles.countryPill}>
                  <Text style={styles.countryText}>🇺🇸 {t('EE.UU. (Solo cuentas americanas)', 'United States (US Accounts Only)')}</Text>
                </View>
              </View>
              <FormField
                label={t('Nombre del banco', 'Bank name')}
                value={bankName}
                onChangeText={setBankName}
                placeholder="Chase, Bank of America..."
              />
              <FormField
                label={t('Routing Number (9 dígitos)', 'Routing Number (9-digit)')}
                value={routingNumber}
                onChangeText={(v) => setRoutingNumber(v.replace(/\D/g, '').slice(0, 9))}
                placeholder="021000021"
                keyboardType="numeric"
              />
              <FormField
                label={t('Número de Cuenta', 'Account Number')}
                value={accountNumber}
                onChangeText={(v) => setAccountNumber(v.replace(/\D/g, '').slice(0, 17))}
                placeholder="123456789"
                keyboardType="numeric"
              />
            </>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.formActions}>
            <TouchableOpacity onPress={handleAdd} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
              <Text style={styles.saveBtnText}>
                {saving ? t('Guardando...', 'Saving...') : t('Guardar Método', 'Save Method')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setAdding(false); resetForm(); }} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>{t('Cancelar', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <>
          <PaymentMethodSkeleton />
          <PaymentMethodSkeleton />
          <PaymentMethodSkeleton />
        </>
      ) : methods.length === 0 ? (
        !adding && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💸</Text>
            <Text style={styles.emptyText}>{t('No tienes métodos de pago registrados.', 'No payment methods registered yet.')}</Text>
          </View>
        )
      ) : (
        methods.map((m, index) => (
          <View key={`${m.id || 'method'}-${index}`} style={styles.methodRow}>
            <View style={styles.methodIcon}>
              <Text style={styles.methodIconText}>{m.type === 'credit_card' ? '💳' : '🏦'}</Text>
            </View>
            <View style={styles.methodCopy}>
              <Text style={styles.methodBrand}>{m.brand}</Text>
              <Text style={styles.methodSub}>
                {m.type === 'credit_card'
                  ? t(`Tarjeta terminada en **** ${m.last4}`, `Card ending in **** ${m.last4}`)
                  : t(`Cuenta bancaria terminada en **** ${m.last4}`, `Bank account ending in **** ${m.last4}`)
                }
              </Text>
            </View>
            {m.isDefault && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t('Principal', 'Default')}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => handleDelete(m.id)}
              disabled={deleting === m.id}
              style={styles.deleteBtn}
            >
              {deleting === m.id
                ? <ActivityIndicator color="#FCA5A5" size="small" />
                : <Text style={styles.deleteIcon}>✕</Text>
              }
            </TouchableOpacity>
          </View>
        ))
      )}
    </View>
  );
}

function FormField({
  label, value, onChangeText, placeholder, keyboardType, secureTextEntry,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(226,232,240,0.3)"
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardLabel: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  addBtn: {
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)',
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6,
  },
  addBtnText: { color: '#F97316', fontSize: 12, fontWeight: '800' },

  formPanel: {
    backgroundColor: 'rgba(3,11,20,0.7)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.22)',
    padding: 14,
    marginBottom: 14,
  },
  formTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  typeBtn: {
    flex: 1, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.025)',
  },
  typeBtnActive: { backgroundColor: 'rgba(249,115,22,0.16)', borderColor: 'rgba(249,115,22,0.5)' },
  typeBtnText: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '700' },
  typeBtnTextActive: { color: '#F97316' },
  row2: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  field: { marginBottom: 10 },
  fieldLabel: { color: 'rgba(226,232,240,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 5, textTransform: 'uppercase' },
  fieldInput: {
    height: 46, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14, color: '#F8FAFC', fontSize: 14, fontWeight: '600',
  },
  countryField: { marginBottom: 10 },
  countryPill: {
    height: 46, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.02)',
    paddingHorizontal: 14, justifyContent: 'center',
  },
  countryText: { color: 'rgba(226,232,240,0.5)', fontSize: 12, fontWeight: '600' },
  errorText: { color: '#FCA5A5', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  saveBtn: {
    flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F97316',
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.025)',
  },
  cancelBtnText: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },

  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyState: { paddingVertical: 24, alignItems: 'center', gap: 8 },
  emptyEmoji: { fontSize: 28 },
  emptyText: { color: 'rgba(226,232,240,0.5)', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)',
  },
  methodIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
  },
  methodIconText: { fontSize: 20 },
  methodCopy: { flex: 1, minWidth: 0 },
  methodBrand: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  methodSub: { color: 'rgba(226,232,240,0.5)', fontSize: 11, fontWeight: '400', marginTop: 2 },
  defaultBadge: {
    backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 999,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
  },
  defaultBadgeText: { color: '#F97316', fontSize: 9, fontWeight: '800' },
  deleteBtn: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: 'rgba(255,90,69,0.08)', borderWidth: 1, borderColor: 'rgba(255,90,69,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteIcon: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
});
