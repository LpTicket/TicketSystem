'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineDocumentText,
  HiOutlineExternalLink,
  HiOutlineMail,
  HiOutlineRefresh,
} from 'react-icons/hi';

type ManualInvoice = {
  id: string;
  number: string;
  status: string;
  customerName: string | null;
  customerEmail: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  createdAt: string | null;
  dueDate: string | null;
};

type InvoiceForm = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  concept: string;
  description: string;
  amount: string;
  currency: string;
  addProcessingFee: boolean;
  dueDays: string;
  notes: string;
};

const initialForm: InvoiceForm = {
  customerName: '',
  customerEmail: '',
  companyName: '',
  concept: '',
  description: '',
  amount: '',
  currency: 'USD',
  addProcessingFee: true,
  dueDays: '7',
  notes: '',
};

export default function AdminInvoicesPage() {
  const { lang } = useLang();
  const [form, setForm] = useState<InvoiceForm>(initialForm);
  const [invoices, setInvoices] = useState<ManualInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseAmount = Number(form.amount || 0);
  const feeAmount = useMemo(() => {
    if (!form.addProcessingFee || !Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
    return Math.round(baseAmount * 0.035 * 100) / 100;
  }, [baseAmount, form.addProcessingFee]);
  const totalAmount = Number.isFinite(baseAmount) && baseAmount > 0
    ? Math.round((baseAmount + feeAmount) * 100) / 100
    : 0;

  useEffect(() => {
    loadInvoices();
  }, []);

  const labels = {
    title: lang === 'es' ? 'Facturas Stripe' : 'Stripe invoices',
    subtitle: lang === 'es'
      ? 'Crea facturas manuales desde LPTicket y mantenlas visibles en Stripe.'
      : 'Create manual invoices from LPTicket and keep them visible in Stripe.',
    customerName: lang === 'es' ? 'Nombre del cliente' : 'Customer name',
    customerEmail: lang === 'es' ? 'Correo del cliente' : 'Customer email',
    companyName: lang === 'es' ? 'Empresa opcional' : 'Optional company',
    concept: lang === 'es' ? 'Concepto' : 'Concept',
    description: lang === 'es' ? 'Descripción detallada' : 'Detailed description',
    amount: lang === 'es' ? 'Monto base' : 'Base amount',
    currency: lang === 'es' ? 'Moneda' : 'Currency',
    dueDays: lang === 'es' ? 'Días para pagar' : 'Days to pay',
    notes: lang === 'es' ? 'Notas / términos' : 'Notes / terms',
    fee: lang === 'es' ? 'Agregar Processing Fee 3.5%' : 'Add Processing Fee 3.5%',
    create: lang === 'es' ? 'Crear y enviar factura' : 'Create and send invoice',
    sending: lang === 'es' ? 'Enviando factura...' : 'Sending invoice...',
    history: lang === 'es' ? 'Facturas enviadas desde LPTicket' : 'Invoices sent from LPTicket',
    refresh: lang === 'es' ? 'Actualizar' : 'Refresh',
    preview: lang === 'es' ? 'Vista previa' : 'Preview',
    base: lang === 'es' ? 'Base' : 'Base',
    total: lang === 'es' ? 'Total a cobrar' : 'Total charged',
    open: lang === 'es' ? 'Abrir' : 'Open',
    pdf: 'PDF',
    empty: lang === 'es' ? 'Todavía no hay facturas creadas desde LPTicket.' : 'No invoices created from LPTicket yet.',
  };

  const money = (amount: number, currency = form.currency) => {
    return new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount || 0);
  };

  const date = (value: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  };

  const statusLabel = (status: string) => {
    const normalized = status || 'draft';
    if (lang !== 'es') return normalized;
    const map: Record<string, string> = {
      draft: 'borrador',
      open: 'enviada',
      paid: 'pagada',
      void: 'anulada',
      uncollectible: 'incobrable',
    };
    return map[normalized] || normalized;
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/manual-invoices', { params: { limit: 50 } });
      setInvoices(data.invoices || []);
    } catch (err: unknown) {
      console.error(err);
      setError(lang === 'es' ? 'No se pudo cargar el historial de facturas.' : 'Could not load invoice history.');
    } finally {
      setLoading(false);
    }
  };

  const updateField = <K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const { data } = await api.post('/admin/manual-invoices', {
        ...form,
        amount: Number(form.amount),
        dueDays: Number(form.dueDays),
      });
      setMessage(lang === 'es'
        ? `Factura ${data.invoice?.number || ''} creada y enviada por Stripe.`
        : `Invoice ${data.invoice?.number || ''} created and sent by Stripe.`);
      setForm(initialForm);
      await loadInvoices();
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string } } };
      setError(response.response?.data?.message || (lang === 'es' ? 'No se pudo crear la factura.' : 'Could not create invoice.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="premium-page-title font-black text-3xl">{labels.title}</h1>
          <p className="premium-muted text-sm mt-1 font-medium">{labels.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={loadInvoices}
          className="btn-outline flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
        >
          <HiOutlineRefresh className="w-4 h-4" />
          {labels.refresh}
        </button>
      </div>

      {message && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">{message}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] gap-5 items-start">
        <form onSubmit={handleSubmit} className="premium-section-card bg-white/95 p-5 lg:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="public-premium-icon w-11 h-11 flex items-center justify-center">
              <HiOutlineDocumentText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-gray-950">{labels.create}</h2>
              <p className="text-xs text-gray-500 font-medium">Stripe enviará el correo oficial con enlace seguro de pago.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.customerName}</span>
              <input className="input" value={form.customerName} onChange={(event) => updateField('customerName', event.target.value)} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.customerEmail}</span>
              <input className="input" type="email" value={form.customerEmail} onChange={(event) => updateField('customerEmail', event.target.value)} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.companyName}</span>
              <input className="input" value={form.companyName} onChange={(event) => updateField('companyName', event.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.concept}</span>
              <input className="input" value={form.concept} onChange={(event) => updateField('concept', event.target.value)} required placeholder="LP Ticket / Evento / Servicio" />
            </label>
          </div>

          <label className="space-y-1.5 block">
            <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.description}</span>
            <textarea className="input min-h-[110px] resize-y" value={form.description} onChange={(event) => updateField('description', event.target.value)} />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.amount}</span>
              <input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.currency}</span>
              <input className="input uppercase" value={form.currency} maxLength={3} onChange={(event) => updateField('currency', event.target.value.toUpperCase())} required />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.dueDays}</span>
              <input className="input" type="number" min="1" max="90" value={form.dueDays} onChange={(event) => updateField('dueDays', event.target.value)} required />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/70 px-4 py-3">
            <input
              type="checkbox"
              checked={form.addProcessingFee}
              onChange={(event) => updateField('addProcessingFee', event.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm font-black text-gray-900">{labels.fee}</span>
          </label>

          <label className="space-y-1.5 block">
            <span className="text-xs font-black uppercase tracking-wider text-gray-500">{labels.notes}</span>
            <textarea className="input min-h-[90px] resize-y" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>

          <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-sm">
            <HiOutlineMail className="w-5 h-5" />
            {submitting ? labels.sending : labels.create}
          </button>
        </form>

        <aside className="space-y-5">
          <section className="premium-section-card bg-[#061421] text-white p-5 shadow-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-orange-300">{labels.preview}</p>
            <h2 className="text-2xl font-black mt-2">{form.concept || 'LP Ticket Invoice'}</h2>
            <p className="text-sm text-slate-300 mt-1">{form.customerName || labels.customerName}</p>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white/7 border border-white/10 px-4 py-3">
                <span className="text-sm font-bold text-slate-300">{labels.base}</span>
                <span className="font-black">{money(baseAmount || 0)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/7 border border-white/10 px-4 py-3">
                <span className="text-sm font-bold text-slate-300">Processing Fee 3.5%</span>
                <span className="font-black text-orange-300">{money(feeAmount)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-orange-500 pt-4">
                <span className="text-sm font-black uppercase tracking-wider text-white">{labels.total}</span>
                <span className="text-2xl font-black text-orange-400">{money(totalAmount)}</span>
              </div>
            </div>
          </section>

          <section className="premium-section-card bg-white/95 p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="font-black text-gray-950">{labels.history}</h2>
              <span className="text-xs font-bold text-gray-400">{invoices.length}</span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, index) => <div key={index} className="h-20 skeleton rounded-xl" />)}
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-gray-500 font-medium">{labels.empty}</p>
            ) : (
              <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-gray-950 truncate">{invoice.customerName || invoice.customerEmail || invoice.number}</p>
                        <p className="text-xs text-gray-500 font-bold truncate">{invoice.customerEmail}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase text-gray-600 border border-gray-200">
                        {statusLabel(invoice.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xl font-black text-gray-950">{money(invoice.amountDue, invoice.currency)}</p>
                        <p className="text-xs text-gray-500 font-medium">{date(invoice.createdAt)}</p>
                      </div>
                      <div className="flex gap-2">
                        {invoice.hostedInvoiceUrl && (
                          <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2 text-xs flex items-center gap-1">
                            <HiOutlineExternalLink className="w-4 h-4" />
                            {labels.open}
                          </a>
                        )}
                        {invoice.invoicePdf && (
                          <a href={invoice.invoicePdf} target="_blank" rel="noreferrer" className="btn-outline px-3 py-2 text-xs">
                            {labels.pdf}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
