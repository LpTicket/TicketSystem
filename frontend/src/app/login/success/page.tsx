'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';

function SuccessHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');

    if (token) {
      // Store tokens and redirect
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          accessToken: token,
          refreshToken: refreshToken,
          isAuthenticated: true,
        },
        version: 0
      }));
      
      // Force reload to update store state
      window.location.href = '/dashboard';
    } else {
      router.push('/login');
    }
  }, [searchParams, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-600 font-medium animate-pulse">Finalizando inicio de sesión...</p>
    </div>
  );
}

export default function LoginSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessHandler />
    </Suspense>
  );
}
