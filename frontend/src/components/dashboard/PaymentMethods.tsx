'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import api from '@/lib/api';
import { HiOutlineTrash, HiCreditCard, HiOutlineShieldCheck } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/lib/dialog';

interface PaymentMethod {
  id: string;
  type: 'credit_card' | 'bank_account';
  last4: string;
  brand: string;
  isDefault: boolean;
}

export default function PaymentMethods() {
  const { lang } = useLang();
  const searchParams = useSearchParams();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    loadMethods();
  }, []);

  useEffect(() => {
    if (searchParams?.get('saved') === '1') {
      toast.success(lang === 'es' ? '¡Tarjeta guardada con éxito!' : 'Card saved successfully!');
    }
  }, [searchParams, lang]);

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

  const handleSaveCard = async () => {
    setRedirecting(true);
    try {
      const res = await api.post('/payments/setup-session');
      window.location.href = res.data.url;
    } catch {
      toast.error(lang === 'es' ? 'Error al iniciar el proceso. Intenta de nuevo.' : 'Failed to start. Please try again.');
      setRedirecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmMsg = lang === 'es'
      ? '¿Estás seguro de que deseas eliminar este método de pago?'
      : 'Are you sure you want to delete this payment method?';
    if (!await confirmDialog({
      title: lang === 'es' ? 'Eliminar método de pago' : 'Delete payment method',
      message: confirmMsg,
      tone: 'danger',
    })) return;
    try {
      await api.delete(`/payments/methods/${id}`);
      toast.success(lang === 'es' ? 'Método de pago eliminado.' : 'Payment method deleted.');
      loadMethods();
    } catch {
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
          <h3 className="font-black text-lg text-[#0A375A]">
            {lang === 'es' ? 'Métodos de Pago' : 'Payment Methods'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {lang === 'es'
              ? 'Tus tarjetas guardadas para compras rápidas.'
              : 'Your saved cards for quick purchases.'}
          </p>
        </div>
        <button
          onClick={handleSaveCard}
          disabled={redirecting}
          className="btn-primary text-xs py-2 px-3 flex items-center gap-1.5 font-semibold rounded-lg disabled:opacity-60"
        >
          {redirecting ? (
            <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <HiOutlineShieldCheck className="w-4 h-4" />
          )}
          {lang === 'es' ? 'Agregar Tarjeta' : 'Add Card'}
        </button>
      </div>

      <div className="flex items-start gap-3 p-3.5 rounded-lg bg-blue-50 border border-blue-100 mb-6 text-xs text-blue-700">
        <HiOutlineShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
        <span>
          {lang === 'es'
            ? 'Tus datos de tarjeta son procesados y almacenados de forma segura por Stripe. LPTicket nunca almacena números de tarjeta.'
            : 'Your card data is securely processed and stored by Stripe. LPTicket never stores card numbers.'}
        </span>
      </div>

      {methods.length > 0 ? (
        <div className="space-y-3">
          {methods.map(method => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 border border-[rgba(10,55,90,0.12)] rounded-lg hover:border-[rgba(249,115,22,0.34)] hover:shadow-[0_14px_36px_rgba(10,55,90,0.09)] transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full flex items-center justify-center bg-[rgba(10,55,90,0.06)] text-[#0A375A]">
                  <HiCreditCard className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-gray-900 capitalize">{method.brand}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {lang === 'es' ? 'Tarjeta finalizada en' : 'Card ending in'} **** {method.last4}
                  </div>
                </div>
                {method.isDefault && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-50 text-primary-600">
                    {lang === 'es' ? 'Principal' : 'Default'}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(method.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <HiOutlineTrash className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-500 border border-dashed border-[rgba(10,55,90,0.16)] rounded-lg bg-white">
          <span className="text-3xl block mb-2">💳</span>
          <p className="text-sm font-medium">
            {lang === 'es' ? 'No tienes tarjetas guardadas.' : 'No saved cards yet.'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {lang === 'es'
              ? 'Agrega una tarjeta o se guardará automáticamente al completar tu primera compra.'
              : 'Add a card or one will be saved automatically after your first purchase.'}
          </p>
        </div>
      )}
    </div>
  );
}
