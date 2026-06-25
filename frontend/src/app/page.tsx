/**
 * Home page (web) — /
 * EN: Server component that fetches featured events and marketing banners and
 *     renders HomeContent. Banners are fetched with no-store so marketing
 *     changes appear instantly.
 * ES: Componente de servidor que obtiene los eventos destacados y los banners de
 *     marketing y renderiza HomeContent. Los banners se obtienen sin caché para
 *     que los cambios de marketing aparezcan al instante.
 */
import { Event } from '@/types';
import HomeContent from './HomeContent';

export const revalidate = 10;

type MarketingHomeBanner = {
  id: string;
  imageData?: string;
  imageUrl?: string;
  mobileImageData?: string | null;
  mobileImageUrl?: string | null;
  fileName?: string;
  mobileFileName?: string | null;
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
      fetch(`${baseUrl}/events?limit=16`, { next: { revalidate: 60 } }),
      fetch(`${baseUrl}/marketing/banners/home`, { cache: 'no-store' }),
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
