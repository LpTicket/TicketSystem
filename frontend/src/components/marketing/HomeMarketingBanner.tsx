'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

type MarketingBanner = {
  id: string;
  imageData: string;
  fileName?: string;
};

export default function HomeMarketingBanner() {
  const [banner, setBanner] = useState<MarketingBanner | null>(null);

  useEffect(() => {
    let mounted = true;

    api
      .get('/marketing/banner/home')
      .then(({ data }) => {
        if (mounted && data?.imageData) setBanner(data);
      })
      .catch(() => {
        if (mounted) setBanner(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!banner?.imageData) return null;

  return (
    <article className="group relative w-full overflow-hidden rounded-lg bg-black shadow-xl shadow-[rgba(10,55,90,0.12)]">
      <img
        src={banner.imageData}
        alt={banner.fileName || 'Banner publicitario LPTicket'}
        className="block w-full object-cover"
      />
    </article>
  );
}
