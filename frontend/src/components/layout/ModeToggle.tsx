'use client';

import { useAuthStore, UserMode } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineUser, HiOutlineBriefcase } from 'react-icons/hi';
import { useRouter, usePathname } from 'next/navigation';

interface ModeToggleProps {
  variant?: 'pill' | 'dropdown';
}

export default function ModeToggle({ variant = 'pill' }: ModeToggleProps) {
  const { mode, setMode, user, isAuthenticated } = useAuthStore();
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname();

  if (!isAuthenticated || !user || user.role === 'admin') return null;

  const shouldRedirect = pathname.startsWith('/dashboard') || pathname.startsWith('/organizer');

  const handleModeChange = (newMode: UserMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    if (shouldRedirect) {
      router.push(newMode === 'organizer' ? '/organizer' : '/dashboard');
    }
  };

  const toggleMode = () => {
    const newMode: UserMode = mode === 'buyer' ? 'organizer' : 'buyer';
    handleModeChange(newMode);
  };

  if (variant === 'dropdown') {
    return (
      <div 
        className="flex items-center justify-between gap-2 px-1 cursor-pointer group"
        onClick={(e) => {
          e.stopPropagation();
          toggleMode();
        }}
      >
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-700 transition-colors">
          {mode === 'buyer' ? t('buyerMode' as any) : t('organizerMode' as any)}
        </span>
        <div
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
            mode === 'organizer' ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              mode === 'organizer' ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-gray-100/80 p-1 rounded-full border border-gray-200">
      <button
        onClick={() => handleModeChange('buyer')}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          mode === 'buyer'
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <HiOutlineUser className="w-3.5 h-3.5" />
        <span className="inline">{t('buyerMode' as any)}</span>
      </button>
      <button
        onClick={() => handleModeChange('organizer')}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
          mode === 'organizer'
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <HiOutlineBriefcase className="w-3.5 h-3.5" />
        <span className="inline">{t('organizerMode' as any)}</span>
      </button>
    </div>
  );
}
