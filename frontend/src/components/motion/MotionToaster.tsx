'use client';

import { Toaster, ToastBar } from 'react-hot-toast';
import { useReducedMotion } from 'framer-motion';

export default function MotionToaster() {
  const reduced = useReducedMotion();
  return <Toaster position="top-right" containerStyle={{ zIndex: 2147483647 }} toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff' } }}>
    {toast => <ToastBar toast={toast} style={{ animation: reduced ? 'none' : toast.visible ? 'lp-toast-spring .32s both' : 'lp-toast-out .16s both' }} />}
  </Toaster>;
}
