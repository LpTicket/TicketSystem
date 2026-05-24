import { Event } from '@/types';
import HomeContent from './HomeContent';

export const revalidate = 60; // ISR: revalidar cada 60 segundos

type MarketingHomeBanner = {
  id: string;
  imageData: string;
  mobileImageData?: string | null;
  fileName?: string;
  mobileFileName?: string | null;
  bannerPosition?: string;
  isMarketingBanner: true;
};

async function loadHomeData() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  try {
    const [eventsRes, bannerRes] = await Promise.all([
      fetch(`${baseUrl}/events?limit=16`, { next: { revalidate: 60 } }),
      fetch(`${baseUrl}/marketing/banner/home`, { next: { revalidate: 60 } }),
    ]);

    const events: Event[] = eventsRes.ok ? (await eventsRes.json()).events || [] : [];
    const bannerData = bannerRes.ok ? await bannerRes.json() : null;

    const banner: MarketingHomeBanner | null = bannerData?.imageData
      ? {
          id: bannerData.id || 'marketing-home-banner',
          imageData: bannerData.imageData,
          mobileImageData: bannerData.mobileImageData || null,
          fileName: bannerData.fileName || 'Banner publicitario LPTicket',
          mobileFileName: bannerData.mobileFileName || null,
          bannerPosition: 'center',
          isMarketingBanner: true,
        }
      : null;

    return { events, banner };
  } catch (err) {
    console.error('Error loading home data:', err);
    return { events: [], banner: null };
  }
}

export default async function HomePage() {
  const { events, banner } = await loadHomeData();

  return <HomeContent initialEvents={events} initialBanner={banner} />;
}
