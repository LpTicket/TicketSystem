'use client';

import { HiOutlineCreditCard, HiOutlineQrcode, HiOutlineShieldCheck, HiOutlineSupport } from 'react-icons/hi';
import { useLang } from '@/context/LanguageContext';

type TrustBadgesProps = {
  compact?: boolean;
};

export default function TrustBadges({ compact = false }: TrustBadgesProps) {
  const { lang } = useLang();

  const items = [
    {
      icon: HiOutlineCreditCard,
      title: lang === 'es' ? 'Pagos seguros' : 'Secure payments',
      text: lang === 'es' ? 'Procesados por Stripe' : 'Processed by Stripe',
    },
    {
      icon: HiOutlineShieldCheck,
      title: lang === 'es' ? 'Tickets verificados' : 'Verified tickets',
      text: lang === 'es' ? 'Entrada digital protegida' : 'Protected digital entry',
    },
    {
      icon: HiOutlineQrcode,
      title: lang === 'es' ? 'QR único' : 'Unique QR',
      text: lang === 'es' ? 'Validación rápida en puerta' : 'Fast door validation',
    },
    {
      icon: HiOutlineSupport,
      title: lang === 'es' ? 'Soporte disponible' : 'Support available',
      text: lang === 'es' ? 'Antes y después de comprar' : 'Before and after purchase',
    },
  ];

  return (
    <div className={compact ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.title}
            className="flex items-center gap-3 rounded-xl border border-[rgba(10,55,90,0.10)] bg-white/85 px-4 py-3 shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(249,115,22,0.12)] text-[#0A375A]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-[#0A375A]">{item.title}</span>
              <span className="block text-xs font-semibold text-slate-500">{item.text}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
