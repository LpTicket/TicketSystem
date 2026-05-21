import { useState, useEffect } from 'react';
import { useLang } from '@/context/LanguageContext';
import api from '@/lib/api';
import { HiOutlineTrash, HiOutlinePlus, HiCreditCard } from 'react-icons/hi';
import toast from 'react-hot-toast';

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'bank_account';
  last4: string;
  brand: string;
  isDefault: boolean;
}

export default function PaymentMethods() {
  const { t, lang } = useLang();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  // Form Fields
  const [methodType, setMethodType] = useState<'credit_card' | 'bank_account'>('credit_card');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [bankName, setBankName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  useEffect(() => {
    loadMethods();
  }, []);

  const loadMethods = async () => {
    try {
      const res = await api.get('/payments/methods');
      setMethods(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Live Auto-Formatters
  const handleCardNumberChange = (val: string) => {
    // Keep only numbers
    const clean = val.replace(/\D/g, '');
    // Limit to 16 digits
    const limited = clean.slice(0, 16);
    // Format with spaces
    const formatted = limited.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
  };

  const handleExpiryChange = (val: string) => {
    // Keep only numbers
    const clean = val.replace(/\D/g, '');
    // Limit to 4 digits (MMYY)
    const limited = clean.slice(0, 4);
    // Format with /
    let formatted = limited;
    if (limited.length > 2) {
      formatted = `${limited.slice(0, 2)}/${limited.slice(2)}`;
    }
    setExpiry(formatted);
  };

  const handleRoutingNumberChange = (val: string) => {
    // Keep only numbers, limit to 9 digits
    const clean = val.replace(/\D/g, '').slice(0, 9);
    setRoutingNumber(clean);
  };

  const handleAccountNumberChange = (val: string) => {
    // Keep only numbers, limit to 17 digits
    const clean = val.replace(/\D/g, '').slice(0, 17);
    setAccountNumber(clean);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firstName.trim() || !lastName.trim()) {
      toast.error(lang === 'es' ? 'Por favor, ingresa tu nombre y apellido.' : 'Please enter your first and last name.');
      return;
    }

    let payloadBrand = '';
    let payloadLast4 = '';

    if (methodType === 'credit_card') {
      const cleanCard = cardNumber.replace(/\s/g, '');
      if (cleanCard.length < 15) {
        toast.error(lang === 'es' ? 'Número de tarjeta inválido.' : 'Invalid card number.');
        return;
      }
      if (expiry.length < 5) {
        toast.error(lang === 'es' ? 'Fecha de expiración incompleta (MM/YY).' : 'Incomplete expiration date (MM/YY).');
        return;
      }
      if (cvc.length < 3) {
        toast.error(lang === 'es' ? 'Código CVC inválido.' : 'Invalid CVC code.');
        return;
      }

      // Auto-detect brand
      if (cleanCard.startsWith('4')) {
        payloadBrand = 'Visa';
      } else if (/^5[1-5]/.test(cleanCard)) {
        payloadBrand = 'Mastercard';
      } else if (/^3[47]/.test(cleanCard)) {
        payloadBrand = 'American Express';
      } else {
        payloadBrand = 'Tarjeta de Crédito';
      }
      payloadLast4 = cleanCard.slice(-4);

    } else {
      // Bank Account validation
      if (!bankName.trim()) {
        toast.error(lang === 'es' ? 'Por favor, ingresa el nombre de tu banco.' : 'Please enter your bank name.');
        return;
      }
      if (routingNumber.length !== 9) {
        toast.error(lang === 'es' ? 'El número de ruta americano (Routing) debe tener exactamente 9 dígitos.' : 'The US routing number must be exactly 9 digits.');
        return;
      }
      if (accountNumber.length < 4) {
        toast.error(lang === 'es' ? 'El número de cuenta bancaria es demasiado corto.' : 'Bank account number is too short.');
        return;
      }

      payloadBrand = bankName;
      payloadLast4 = accountNumber.slice(-4);
    }

    try {
      await api.post('/payments/methods', {
        type: methodType,
        brand: payloadBrand,
        last4: payloadLast4,
        providerId: 'mock_' + Date.now(),
      });

      toast.success(lang === 'es' ? '¡Método de pago agregado con éxito!' : 'Payment method successfully added!');
      setAdding(false);
      
      // Reset form
      setFirstName('');
      setLastName('');
      setCardNumber('');
      setExpiry('');
      setCvc('');
      setBankName('');
      setRoutingNumber('');
      setAccountNumber('');
      
      loadMethods();
    } catch (err) {
      toast.error(lang === 'es' ? 'Error al guardar el método de pago.' : 'Error adding payment method.');
    }
  };

  const handleDelete = async (id: string) => {
    const confirmMsg = lang === 'es' ? '¿Estás seguro de que deseas eliminar este método de pago?' : 'Are you sure you want to delete this payment method?';
    if (!confirm(confirmMsg)) return;
    try {
      await api.delete(`/payments/methods/${id}`);
      toast.success(lang === 'es' ? 'Método de pago eliminado.' : 'Payment method deleted.');
      loadMethods();
    } catch (err) {
      toast.error(lang === 'es' ? 'Error al eliminar el método de pago.' : 'Error deleting payment method.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-premium-card p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-black text-lg text-[#0A375A]">{lang === 'es' ? 'Métodos de Pago' : 'Payment Methods'}</h3>
          <p className="text-xs text-gray-500 mt-1">{lang === 'es' ? 'Administra tus tarjetas de crédito y cuentas bancarias asociadas.' : 'Manage your credit cards and bank accounts.'}</p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary text-xs py-2 px-3 flex items-center gap-1 font-semibold rounded-lg">
            <HiOutlinePlus className="w-4 h-4" /> {lang === 'es' ? 'Agregar Método' : 'Add Method'}
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="rounded-lg border border-[rgba(10,55,90,0.12)] bg-white p-6 mb-6 space-y-4 animate-fade-in shadow-sm">
          <div className="border-b border-gray-150 pb-3 mb-2 flex justify-between items-center">
            <h4 className="font-bold text-sm text-gray-800">{lang === 'es' ? 'Nuevo Método de Pago' : 'New Payment Method'}</h4>
            <span className="text-[10px] uppercase font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded">Secure / SSL</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Tipo' : 'Type'}</label>
              <select 
                value={methodType} 
                onChange={e => setMethodType(e.target.value as any)} 
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316] bg-white"
              >
                <option value="credit_card">{lang === 'es' ? '💳 Tarjeta de Crédito' : '💳 Credit Card'}</option>
                <option value="bank_account">{lang === 'es' ? '🏦 Cuenta Bancaria' : '🏦 Bank Account'}</option>
              </select>
            </div>

            {/* Standard Account Owner First Name */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Nombre Titular' : 'First Name'}</label>
              <input 
                required 
                type="text" 
                value={firstName} 
                onChange={e => setFirstName(e.target.value)} 
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                placeholder={lang === 'es' ? 'Nombre' : 'John'} 
              />
            </div>

            {/* Standard Account Owner Last Name */}
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Apellido Titular' : 'Last Name'}</label>
              <input 
                required 
                type="text" 
                value={lastName} 
                onChange={e => setLastName(e.target.value)} 
                className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                placeholder={lang === 'es' ? 'Apellido' : 'Doe'} 
              />
            </div>

            {/* Credit Card Specific Fields */}
            {methodType === 'credit_card' ? (
              <>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Número de Tarjeta' : 'Card Number'}</label>
                  <div className="relative">
                    <input 
                      required 
                      type="text" 
                      value={cardNumber} 
                      onChange={e => handleCardNumberChange(e.target.value)} 
                      className="w-full pl-10 pr-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                      placeholder="4000 1234 5678 9010" 
                    />
                    <HiCreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Vencimiento (MM/YY)' : 'Expiry (MM/YY)'}</label>
                  <input 
                    required 
                    type="text" 
                    value={expiry} 
                    onChange={e => handleExpiryChange(e.target.value)} 
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                    placeholder="12/29" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">CVC / CVV</label>
                  <input 
                    required 
                    type="password" 
                    maxLength={4}
                    value={cvc} 
                    onChange={e => setCvc(e.target.value.replace(/\D/g, ''))} 
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                    placeholder="123" 
                  />
                </div>
              </>
            ) : (
              <>
                {/* Bank Account Specific Fields (USA ONLY) */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'País del Banco' : 'Bank Country'}</label>
                  <input 
                    readOnly 
                    type="text" 
                    value={lang === 'es' ? '🇺🇸 Estados Unidos (Solo cuentas Americanas)' : '🇺🇸 United States (US Accounts Only)'} 
                    className="w-full px-3.5 py-2 border border-gray-200 bg-gray-100 rounded-lg text-sm text-gray-600 font-medium focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Nombre del Banco' : 'Bank Name'}</label>
                  <input 
                    required 
                    type="text" 
                    value={bankName} 
                    onChange={e => setBankName(e.target.value)} 
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                    placeholder="Chase, Bank of America, Wells Fargo..." 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">
                    {lang === 'es' ? 'Número de Ruta (Routing - 9 dígitos)' : 'Routing Number (9-digits)'}
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={routingNumber} 
                    onChange={e => handleRoutingNumberChange(e.target.value)} 
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                    placeholder="021000021" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">{lang === 'es' ? 'Número de Cuenta' : 'Account Number'}</label>
                  <input 
                    required 
                    type="text" 
                    value={accountNumber} 
                    onChange={e => handleAccountNumberChange(e.target.value)} 
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F97316]"
                    placeholder="123456789" 
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" className="flex-1 btn-primary py-2.5 text-sm font-semibold rounded-lg">
              {lang === 'es' ? 'Guardar Método de Pago' : 'Save Payment Method'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="flex-1 py-2.5 text-sm font-bold text-[#0A375A] border border-[rgba(10,55,90,0.14)] bg-white rounded-lg hover:bg-[rgba(10,55,90,0.05)] transition-all">
              {lang === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        </form>
      )}

      {methods.length > 0 ? (
        <div className="space-y-3">
          {methods.map(method => (
            <div key={method.id} className="flex items-center justify-between p-4 border border-[rgba(10,55,90,0.12)] rounded-lg hover:border-[rgba(249,115,22,0.34)] hover:shadow-[0_14px_36px_rgba(10,55,90,0.09)] transition-all">
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center ${method.type === 'credit_card' ? 'bg-[rgba(10,55,90,0.06)] text-[#0A375A]' : 'bg-emerald-50 text-emerald-600'}`}>
                  {method.type === 'credit_card' ? (
                    <HiCreditCard className="w-5 h-5" />
                  ) : (
                    <span>🏦</span>
                  )}
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900">{method.brand}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {method.type === 'credit_card' 
                      ? `${lang === 'es' ? 'Tarjeta finalizada en' : 'Card ending in'} **** ${method.last4}` 
                      : `${lang === 'es' ? 'Cuenta bancaria (EE.UU.) finalizada en' : 'Bank account (US) ending in'} **** ${method.last4}`
                    }
                  </div>
                </div>
                {method.isDefault && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-50 text-primary-600">
                    {lang === 'es' ? 'Principal' : 'Default'}
                  </span>
                )}
              </div>
              <button onClick={() => handleDelete(method.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                <HiOutlineTrash className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        !adding && (
          <div className="text-center py-10 text-gray-500 border border-dashed border-[rgba(10,55,90,0.16)] rounded-lg bg-white">
            <span className="text-3xl block mb-2">💸</span>
            <p className="text-sm font-medium">{lang === 'es' ? 'No tienes métodos de pago registrados.' : 'No payment methods registered yet.'}</p>
          </div>
        )
      )}
    </div>
  );
}
