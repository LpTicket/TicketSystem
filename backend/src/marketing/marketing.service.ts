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
    const desktop = await this.bannerRepo.findOne({
      where: { placement: 'home', isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (!desktop) return null;

    const mobile = await this.bannerRepo.findOne({
      where: { placement: 'home-mobile', isActive: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      ...desktop,
      mobileImageData: mobile?.imageData || null,
      mobileFileName: mobile?.fileName || null,
    };
  }

  async saveHomeBanner(data: { imageData: string; fileName?: string; mobileImageData?: string | null; mobileFileName?: string | null }) {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    await this.bannerRepo.update(
      { placement: 'home-mobile', isActive: true },
      { isActive: false },
    );

    const banner = this.bannerRepo.create({
      placement: 'home',
      title: 'Banner Home',
      imageData: data.imageData,
      fileName: data.fileName || 'banner-home',
      isActive: true,
    });

    const savedDesktop = await this.bannerRepo.save(banner);

    if (data.mobileImageData) {
      const mobileBanner = this.bannerRepo.create({
        placement: 'home-mobile',
        title: 'Banner Home Mobile',
        imageData: data.mobileImageData,
        fileName: data.mobileFileName || 'banner-home-mobile',
        isActive: true,
      });

      await this.bannerRepo.save(mobileBanner);
    }

    return savedDesktop;
  }

  async removeHomeBanner() {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    return { ok: true };
  }

  async removeHomeMobileBanner() {
    await this.bannerRepo.update(
      { placement: 'home-mobile', isActive: true },
      { isActive: false },
    );

    return { ok: true };
  }
}
