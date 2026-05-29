'use client';

import { toast } from 'react-hot-toast';

import { useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineQuestionMarkCircle,
  HiOutlineCreditCard,
  HiOutlineTicket,
  HiOutlineSupport,
  HiOutlineChevronDown,
  HiOutlineChevronUp,
  HiOutlineMail,
  HiOutlineUser,
} from 'react-icons/hi';
import api from '@/lib/api';
import TrustBadges from '@/components/layout/TrustBadges';

interface FAQItem {
  questionEs: string;
  questionEn: string;
  answerEs: string;
  answerEn: string;
  category: string;
}

const FAQS: FAQItem[] = [
  {
    category: 'payments',
    questionEs: '¿Qué métodos de pago se aceptan?',
    questionEn: 'What payment methods are accepted?',
    answerEs: 'Aceptamos todas las tarjetas de crédito y débito Visa, Mastercard y American Express a través de nuestra pasarela segura integrada con Stripe.',
    answerEn: 'We accept all major Visa, Mastercard, and American Express credit and debit cards through our secure integration with Stripe.',
  },
  {
    category: 'payments',
    questionEs: '¿Es seguro ingresar mi tarjeta en LPTicket?',
    questionEn: 'Is it safe to enter my card details on LPTicket?',
    answerEs: 'Absolutamente. LPTicket nunca almacena tus datos bancarios ni de tarjeta. Toda la información de pago se procesa directamente y de manera cifrada a través de Stripe (cumpliendo con la certificación PCI-DSS Nivel 1).',
    answerEn: 'Absolutely. LPTicket never stores your card or banking details. All payment information is processed directly and securely via Stripe (complying with Tier 1 PCI-DSS standards).',
  },
  {
    category: 'tickets',
    questionEs: '¿Cómo recibo mis boletos adquiridos?',
    questionEn: 'How do I receive my purchased tickets?',
    answerEs: 'Inmediatamente después de completar el pago, tus boletos se generarán y estarán disponibles en la sección "Mis Tickets" de tu panel de usuario. Además, se envía un correo de confirmación de manera automática con las entradas y sus códigos QR listos para escanear.',
    answerEn: 'Immediately after checkout, your tickets will be generated and made available in the "My Tickets" tab of your dashboard. In addition, an automatic confirmation email containing your entries and QR codes is sent instantly.',
  },
  {
    category: 'tickets',
    questionEs: '¿Cómo descargo las entradas en mi billetera móvil de Apple o Google?',
    questionEn: 'How do I add my tickets to Apple Wallet or Google Wallet?',
    answerEs: 'Al visualizar tu entrada en "Mis Tickets", verás botones directos para "Añadir a Apple Wallet" o "Añadir a Google Wallet". Haz clic en ellos para descargar y guardar tu pase directamente en tu celular.',
    answerEn: 'When viewing your tickets in "My Tickets", you will see dedicated buttons for "Add to Apple Wallet" and "Add to Google Wallet". Simply click on them to save your pass directly to your smartphone.',
  },
  {
    category: 'events',
    questionEs: '¿Puedo cambiar o reembolsar mis boletos?',
    questionEn: 'Can I exchange or refund my tickets?',
    answerEs: 'De acuerdo con nuestras políticas generales, todas las compras de entradas son definitivas. Sin embargo, en caso de cancelación del evento, se procesará un reembolso automático del 100% a la misma tarjeta de compra.',
    answerEn: 'According to our general platform policies, all ticket purchases are final. However, in the event of a cancellation, automatic 100% refunds are immediately processed back to the original payment card.',
  },
];

export default function SupportPage() {
  const { lang, t } = useLang();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'payments' | 'tickets' | 'events'>('all');
  const [openFAQIdx, setOpenFAQIdx] = useState<number | null>(null);
  
  // Contact Form States
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/contact', contactForm);
      setSuccessMsg(lang === 'es' ? '¡Tu mensaje ha sido enviado! Nos comunicaremos contigo muy pronto.' : 'Your message has been sent! We will contact you shortly.');
      setContactForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error(err);
      toast.error(lang === 'es' ? 'Error al enviar el mensaje.' : 'Error sending message.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredFAQs = FAQS.filter(faq => {
    const question = lang === 'es' ? faq.questionEs : faq.questionEn;
    const answer = lang === 'es' ? faq.answerEs : faq.answerEn;
    
    const matchesSearch = question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="page-dark-shell min-h-screen">
      {/* Hero Header */}
      <section className="py-16 text-center">
        <div className="public-premium-hero max-w-4xl mx-auto px-4 py-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-xs font-bold tracking-wider uppercase">
            <HiOutlineSupport className="w-4 h-4" />
            {lang === 'es' ? 'Centro de Ayuda' : 'Help & Support'}
          </span>
          <h1 className="public-premium-title text-3xl sm:text-5xl font-black tracking-tight leading-none">
            {lang === 'es' ? '¿Cómo podemos ayudarte?' : 'How can we help you?'}
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto text-sm sm:text-base">
            {lang === 'es' ? 'Encuentra respuestas rápidas sobre compras, accesos y mapas interactivos, o contáctanos directamente.' : 'Find quick answers regarding transactions, access scanner portals, or get in touch with support.'}
          </p>

          <div className="pt-5">
            <TrustBadges />
          </div>

          {/* Search bar */}
          <div className="max-w-md mx-auto pt-4 relative">
            <input
              type="text"
              placeholder={lang === 'es' ? 'Buscar respuestas...' : 'Search for questions...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="public-premium-input w-full px-5 py-3.5 text-sm"
            />
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: FAQs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Category Filter Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'all', label: lang === 'es' ? 'Todos' : 'All', icon: HiOutlineQuestionMarkCircle },
              { id: 'payments', label: lang === 'es' ? 'Pagos' : 'Payments', icon: HiOutlineCreditCard },
              { id: 'tickets', label: lang === 'es' ? 'Boletos' : 'My Tickets', icon: HiOutlineTicket },
              { id: 'events', label: lang === 'es' ? 'Eventos' : 'Events', icon: HiOutlineSupport },
            ].map(cat => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => { setSelectedCategory(cat.id as any); setOpenFAQIdx(null); }}
                  className={`p-4 rounded-lg border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                    isActive 
                      ? 'bg-white border-[#F97316] text-[#0A375A] shadow-[0_12px_30px_rgba(10,55,90,0.08)] font-bold' 
                      : 'bg-white border-[rgba(10,55,90,0.12)] hover:border-[rgba(249,115,22,0.30)] text-gray-500'
                  }`}
                >
                  <Icon className={`w-6 h-6 ${isActive ? 'text-[#F97316]' : 'text-gray-400'}`} />
                  <span className="text-xs">{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* FAQ Accordion List */}
          <div className="space-y-3">
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map((faq, idx) => {
                const isOpen = openFAQIdx === idx;
                return (
                  <div key={idx} className="public-premium-card overflow-hidden">
                    <button
                      onClick={() => setOpenFAQIdx(isOpen ? null : idx)}
                      className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50/50 transition-colors"
                    >
                      <span className="font-bold text-sm sm:text-base text-gray-900">
                        {lang === 'es' ? faq.questionEs : faq.questionEn}
                      </span>
                      {isOpen ? (
                        <HiOutlineChevronUp className="w-5 h-5 text-gray-400 shrink-0" />
                      ) : (
                        <HiOutlineChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-50 animate-fade-in">
                        {lang === 'es' ? faq.answerEs : faq.answerEn}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 text-gray-400 text-sm">
                {lang === 'es' ? 'No se encontraron preguntas frecuentes matching tu búsqueda.' : 'No matching FAQs found.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Contact Ticket Form */}
        <div className="public-premium-card p-6 sm:p-8 space-y-6 h-fit">
          <div>
            <h3 className="font-black text-lg text-[#0A375A]">{lang === 'es' ? '¿Tienes otra consulta?' : 'Have another question?'}</h3>
            <p className="text-xs text-gray-500 mt-1">{lang === 'es' ? 'Completa el formulario de abajo y nuestro equipo te responderá en menos de 24 horas.' : 'Fill out the form below and our team will get back to you within 24 hours.'}</p>
          </div>

          {successMsg ? (
            <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 text-sm text-center font-semibold space-y-3">
              <p>{successMsg}</p>
              <button onClick={() => setSuccessMsg('')} className="text-xs text-primary-600 hover:underline">
                {lang === 'es' ? 'Enviar otro mensaje' : 'Send another message'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{lang === 'es' ? 'Tu Nombre' : 'Your Name'}</label>
                <div className="relative">
                  <HiOutlineUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    placeholder="John Doe"
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg text-xs public-premium-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{lang === 'es' ? 'Tu Correo' : 'Your Email'}</label>
                <div className="relative">
                  <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-lg text-xs public-premium-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{lang === 'es' ? 'Asunto' : 'Subject'}</label>
                <input
                  type="text"
                  required
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  placeholder={lang === 'es' ? 'Ej: Error en pago' : 'e.g. Payment Issue'}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-xs public-premium-input"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{lang === 'es' ? 'Mensaje o Detalle' : 'Message or Detail'}</label>
                <textarea
                  required
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  placeholder={lang === 'es' ? 'Explícanos tu caso...' : 'Explain your issue...'}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-xs public-premium-input resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 rounded-lg font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20"
              >
                <HiOutlineSupport className="w-4 h-4" />
                {submitting ? (lang === 'es' ? 'Enviando...' : 'Sending...') : (lang === 'es' ? 'Enviar Mensaje' : 'Send Message')}
              </button>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
