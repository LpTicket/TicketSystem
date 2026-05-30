'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import VisualCaptcha, { VisualCaptchaHandle } from '@/components/auth/VisualCaptcha';

export default function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const { register } = useAuthStore();
  const { t } = useLang();
  const captchaRef = useRef<VisualCaptchaHandle>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    password: '',
    confirmPassword: '',
  });

  const [captchaInput, setCaptchaInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError(t('passwordMismatch'));
      return;
    }

    const correctCaptcha = captchaRef.current?.getAnswer();
    if (captchaInput.toUpperCase() !== correctCaptcha) {
      setError(t('captchaError'));
      captchaRef.current?.refresh();
      setCaptchaInput('');
      return;
    }

    setLoading(true);
    try {
      // Backend still requires a username, so we'll use the part before @ in email
      const username = form.email.split('@')[0] + Math.floor(Math.random() * 1000);
      
      await register({
        email: form.email,
        username: username, // Generated to satisfy backend
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        address: form.address as any,
        role: 'client' as any,
      } as any);
      router.push(redirect || '/');
    } catch (err: any) {
      setError(err.response?.data?.message || t('registerError'));
      captchaRef.current?.refresh();
      setCaptchaInput('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-dark-shell flex items-start justify-center px-4 py-8 min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Link href="/">
            <img src="/lp-logo-glow.png" alt="LPTicket" className="h-20 w-auto object-contain" />
          </Link>
        </div>
        <div className="text-center mb-8">
          <h1 className="public-premium-title font-black text-2xl mt-4 tracking-tight">{t('registerTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('registerSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-premium-card p-8 space-y-5">
          {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center animate-shake">{error}</div>}

          {/* First + Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('firstName')}</label>
              <input type="text" value={form.firstName} onChange={update('firstName')} className="input public-premium-input" placeholder={t('firstNamePlaceholder' as any)} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('lastName')}</label>
              <input type="text" value={form.lastName} onChange={update('lastName')} className="input public-premium-input" placeholder={t('lastNamePlaceholder' as any)} required />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('phone')}</label>
            <input type="tel" value={form.phone} onChange={update('phone')} className="input public-premium-input" placeholder={t('phonePlaceholder' as any)} required />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('email')}</label>
            <input type="email" value={form.email} onChange={update('email')} className="input public-premium-input" placeholder={t('emailPlaceholder' as any)} required />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('address')}</label>
            <textarea 
              value={form.address} 
              onChange={(e: any) => update('address')(e)} 
              className="input public-premium-input min-h-[80px] py-2 resize-none" 
              placeholder={t('addressPlaceholder' as any)} 
              required 
            />
          </div>

          {/* Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('password')}</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={update('password')} className="input public-premium-input pr-10" placeholder="••••••••" minLength={6} required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('confirmPassword')}</label>
              <div className="relative">
                <input type={showConfirmPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={update('confirmPassword')} className="input public-premium-input pr-10" placeholder="••••••••" required />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirmPassword ? <HiOutlineEyeOff className="w-4 h-4" /> : <HiOutlineEye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Captcha Real */}
          <div className="pt-2 border-t border-gray-50">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
              {t('captcha')}
            </label>
            <div className="space-y-3">
              <VisualCaptcha ref={captchaRef} onVerify={() => {}} />
              <input
                type="text"
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                className="input public-premium-input text-center tracking-widest font-bold uppercase"
                placeholder={t('enterCode' as any)}
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-4 rounded-lg text-sm font-black shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform">
            {loading ? t('creating') : t('createAccount')}
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('haveAccount')}{' '}
            <Link href={`/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-primary-600 hover:text-primary-700 font-bold">{t('signIn')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
