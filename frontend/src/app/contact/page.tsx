'use client';

import { useState } from 'react';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineMail, HiOutlinePhone, HiOutlineLocationMarker } from 'react-icons/hi';
import api from '@/lib/api';

export default function ContactPage() {
  const { t, lang } = useLang();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      setSuccessMsg(lang === 'es' ? '¡Mensaje enviado con éxito!' : 'Message sent successfully!');
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error(err);
      alert(lang === 'es' ? 'Error al enviar.' : 'Error sending.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-[#0b1a2e] mb-4">{t('contactPageTitle')}</h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">{t('contactSubtitle')}</p>
          <div className="w-24 h-1 bg-primary-500 mx-auto rounded-full mt-6"></div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex gap-6 items-start animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-12 h-12 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <HiOutlinePhone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('contactOnline')}</h3>
                <p className="text-gray-600 font-medium">{t('contactPhone')}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex gap-6 items-start animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-12 h-12 shrink-0 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
                <HiOutlineLocationMarker className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('contactAddress')}</h3>
                <p className="text-gray-600 font-medium mb-1">{t('contactAddressText1')}</p>
                <p className="text-gray-500 text-sm">{t('contactAddressText2')}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex gap-6 items-start animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="w-12 h-12 shrink-0 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                <HiOutlineMail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">{t('contactEmailTitle')}</h3>
                <p className="text-gray-600 font-medium">{t('contactEmail')}</p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10 flex flex-col h-full animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{lang === 'es' ? 'Envíanos un mensaje' : 'Send us a message'}</h2>
            
            {successMsg ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                  <HiOutlineMail className="w-8 h-8" />
                </div>
                <p className="text-gray-700 font-medium">{successMsg}</p>
                <button onClick={() => setSuccessMsg('')} className="text-primary-600 font-bold hover:underline">
                  {lang === 'es' ? 'Enviar otro mensaje' : 'Send another message'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="text"
                  required
                  placeholder={lang === 'es' ? 'Nombre completo' : 'Full name'}
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 bg-gray-50/50"
                />
                <input
                  type="email"
                  required
                  placeholder={lang === 'es' ? 'Correo electrónico' : 'Email address'}
                  value={form.email}
                  onChange={(e) => setForm({...form, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 bg-gray-50/50"
                />
                <input
                  type="text"
                  required
                  placeholder={lang === 'es' ? 'Asunto' : 'Subject'}
                  value={form.subject}
                  onChange={(e) => setForm({...form, subject: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 bg-gray-50/50"
                />
                <textarea
                  required
                  rows={4}
                  placeholder={lang === 'es' ? '¿En qué podemos ayudarte?' : 'How can we help you?'}
                  value={form.message}
                  onChange={(e) => setForm({...form, message: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 bg-gray-50/50 resize-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-4 rounded-xl font-bold transition-all shadow-lg shadow-primary-100 disabled:opacity-50"
                >
                  {loading ? (lang === 'es' ? 'Enviando...' : 'Sending...') : (lang === 'es' ? 'ENVIAR MENSAJE' : 'SEND MESSAGE')}
                </button>
              </form>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
