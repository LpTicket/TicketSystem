'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { FaGoogle, FaFacebook } from 'react-icons/fa';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const { login } = useAuthStore();
  const { t, lang } = useLang();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push(redirect || '/');
    } catch (err: any) {
      setError(err.response?.data?.message || t('loginError'));
    } finally { setLoading(false); }
  };

  const handleSocialLogin = (provider: 'google' | 'facebook') => {
    let apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ticketsystembackend-102j.onrender.com/api';
    
    // Ensure it ends with /api
    if (!apiUrl.endsWith('/api')) {
      apiUrl = apiUrl.endsWith('/') ? `${apiUrl}api` : `${apiUrl}/api`;
    }

    if (provider === 'google') {
      window.location.href = `${apiUrl}/auth/google`;
    } else if (provider === 'facebook') {
      window.location.href = `${apiUrl}/auth/facebook`;
    }
  };

  return (
    <div className="flex items-start justify-center px-4 py-10 bg-gray-50 min-h-[calc(100vh-80px)]">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Link href="/">
            <img src="/logo.png" alt="LPTicket" className="h-12 w-auto object-contain" />
          </Link>
        </div>
        <div className="text-center mb-6">
          <h1 className="font-bold text-2xl text-gray-900 mt-3">{t('loginTitle')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-gray-100 p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm text-center font-medium">{error}</div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">{t('email')}</label>
            <div className="relative">
              <HiOutlineMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 z-10" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input !pl-11" placeholder={t('emailPlaceholder' as any)} required />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">{t('password')}</label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:underline font-medium">{t('forgotPassword')}</Link>
            </div>
            <div className="relative">
              <HiOutlineLockClosed className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400 z-10" />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input !pl-11 !pr-11" placeholder="••••••••" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none z-10">
                {showPassword ? <HiOutlineEyeOff className="w-4.5 h-4.5" /> : <HiOutlineEye className="w-4.5 h-4.5" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-primary-500/10">
            {loading ? t('loginLoading') : t('loginBtn')}
          </button>

          {/* Social Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-100"></div>
            <span className="flex-shrink mx-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('orContinueWith' as any)}</span>
            <div className="flex-grow border-t border-gray-100"></div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSocialLogin('google')}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors focus:outline-none text-xs font-semibold text-gray-700"
            >
              <FaGoogle className="w-4 h-4 text-red-500" />
              Google
            </button>
            <button
              type="button"
              onClick={() => handleSocialLogin('facebook')}
              disabled={loading}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-[#1877F2] text-white rounded-xl hover:bg-[#166FE5] transition-colors focus:outline-none text-xs font-semibold"
            >
              <FaFacebook className="w-4 h-4" />
              Facebook
            </button>
          </div>

          <p className="text-center text-xs text-gray-500 pt-1">
            {t('noAccount')}{' '}
            <Link href={`/register${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`} className="text-primary-600 hover:text-primary-700 font-bold">{t('registerFree')}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
