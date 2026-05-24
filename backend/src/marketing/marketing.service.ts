import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingBanner } from './marketing-banner.entity';

type SaveHomeBannerInput = {
  imageData: string;
  fileName?: string;
  linkUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingBanner)
    private readonly bannerRepo: Repository<MarketingBanner>,
  ) {}

  async getActiveHomeBanner() {
    const now = new Date();

    const banners = await this.bannerRepo.find({
      where: { placement: 'home', isActive: true },
      order: { updatedAt: 'DESC' },
    });

    return banners.find((banner) => {
      const startsOk = !banner.startsAt || banner.startsAt <= now;
      const endsOk = !banner.endsAt || banner.endsAt >= now;
      return startsOk && endsOk;
    }) || null;
  }

  async saveHomeBanner(data: SaveHomeBannerInput) {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    const banner = new MarketingBanner();
    banner.placement = 'home';
    banner.title = 'Banner Home';
    banner.imageData = data.imageData;
    banner.fileName = data.fileName || 'banner-home';
    banner.linkUrl = data.linkUrl || null;
    banner.startsAt = data.startsAt ? new Date(data.startsAt) : null;
    banner.endsAt = data.endsAt ? new Date(data.endsAt) : null;
    banner.isActive = data.isActive !== false;

    return this.bannerRepo.save(banner);
  }

  async removeHomeBanner() {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    return { ok: true };
  }
}
