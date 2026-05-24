import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingBanner } from './marketing-banner.entity';

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingBanner)
    private readonly bannerRepo: Repository<MarketingBanner>,
  ) {}

  async getActiveHomeBanner() {
    return this.bannerRepo.findOne({
      where: { placement: 'home', isActive: true },
      order: { updatedAt: 'DESC' },
    });
  }

  async saveHomeBanner(data: { imageData: string; fileName?: string; mobileImageData?: string | null; mobileFileName?: string | null }) {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    const banner = this.bannerRepo.create({
      placement: 'home',
      title: 'Banner Home',
      imageData: data.imageData,
      mobileImageData: data.mobileImageData || null,
      fileName: data.fileName || 'banner-home',
      mobileFileName: data.mobileFileName || null,
      isActive: true,
    });

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
