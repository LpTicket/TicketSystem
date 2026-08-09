/**
 * Home page (web) — /
 * EN: Server component that fetches featured events and marketing banners and
 *     renders HomeContent. Events and banners use the same short cache so Home
 *     does not wait for Railway on every visit.
 * ES: Componente de servidor que obtiene los eventos destacados y los banners de
 *     marketing y renderiza HomeContent. Eventos y banners usan la misma caché
 *     breve para no esperar a Railway en cada visita.
 */
import { Event } from '@/types';
import HomeContent from './HomeContent';

type MarketingHomeBanner = {
  id: string;
  imageData?: string;
  imageUrl?: string;
  mobileImageData?: string | null;
  mobileImageUrl?: string | null;
  fileName?: string;
  mobileFileName?: string | null;
  linkUrl?: string | null;
  bannerType?: string | null;
  displayMode?: string | null;
  sortOrder?: number | null;
  bannerPosition?: string;
  isMarketingBanner: true;
};

async function loadHomeData() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  try {
    const [eventsRes, bannerRes] = await Promise.all([
      fetch(`${baseUrl}/events?limit=16`, { next: { revalidate: 30 } }),
      fetch(`${baseUrl}/marketing/banners/home`, { next: { revalidate: 30 } }),
    ]);

    const events: Event[] = eventsRes.ok ? (await eventsRes.json()).events || [] : [];
    const bannerData = bannerRes.ok ? await bannerRes.json() : [];
    const banners: MarketingHomeBanner[] = (Array.isArray(bannerData) ? bannerData : [])
      .map((item: any, index: number) => {
        const bannerImage = item?.imageUrl || item?.imageData;
        if (!bannerImage || item?.isActive === false) return null;
        return {
          id: item.id || `marketing-home-banner-${index}`,
          imageData: bannerImage,
          imageUrl: item.imageUrl || null,
          mobileImageData: item.mobileImageData || null,
          mobileImageUrl: item.mobileImageUrl || null,
          fileName: item.fileName || 'Banner publicitario LPTicket',
          mobileFileName: item.mobileFileName || null,
          linkUrl: item.linkUrl || null,
          bannerType: item.bannerType || 'banner',
          displayMode: item.displayMode || 'once',
          sortOrder: item.sortOrder || index,
          bannerPosition: 'center',
          isMarketingBanner: true,
        };
      })
      .filter(Boolean) as MarketingHomeBanner[];

    return { events, banners };
  } catch (err) {
    console.error('Error loading home data:', err);
    return { events: [], banners: [] };
  }
}

export default async function HomePage() {
  const { events, banners } = await loadHomeData();

  return <HomeContent initialEvents={events} initialBanners={banners} />;
}
