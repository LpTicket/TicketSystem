import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Entrada LPTicket',
  description: 'Entrada digital de LPTicket.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default function VerifyCodeLayout({ children }: { children: ReactNode }) {
  return children;
}
