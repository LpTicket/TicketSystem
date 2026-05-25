import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MarketingBanner } from './marketing-banner.entity';
import { MarketingEmailAudience, MarketingEmailCampaign, MarketingEmailCampaignStatus } from './marketing-email-campaign.entity';
import { User, Order, OrderStatus } from '../database/entities';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingBanner)
    private readonly bannerRepo: Repository<MarketingBanner>,
    @InjectRepository(MarketingEmailCampaign)
    private readonly campaignRepo: Repository<MarketingEmailCampaign>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly configService: ConfigService,
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

    await this.bannerRepo.update(
      { placement: 'home-mobile', isActive: true },
      { isActive: false },
    );

    return { ok: true };
  }

  async listEmailCampaigns() {
    return this.campaignRepo.find({
      order: { createdAt: 'DESC' },
      take: 20,
    });
  }

  private async estimateAudience(audience: MarketingEmailAudience, eventId?: string | null) {
    if (audience === MarketingEmailAudience.ALL_USERS) {
      return this.userRepo.count({ where: { isActive: true } });
    }

    const query = this.orderRepo
      .createQueryBuilder('order')
      .select('COUNT(DISTINCT order."userId")', 'count')
      .where('order.status = :status', { status: OrderStatus.PAID });

    if (audience === MarketingEmailAudience.EVENT_BUYERS && eventId) {
      query.andWhere('order."eventId" = :eventId', { eventId });
    }

    const result = await query.getRawOne();
    return Number(result?.count || 0);
  }

  async createEmailCampaign(data: {
    name: string;
    subject: string;
    preheader?: string | null;
    imageData: string;
    imageFileName?: string | null;
    headline?: string | null;
    body?: string | null;
    buttonText?: string | null;
    buttonUrl?: string | null;
    audience?: MarketingEmailAudience;
    eventId?: string | null;
    scheduledAt?: string | null;
  }) {
    if (!data.name?.trim()) throw new BadRequestException('Campaign name is required');
    if (!data.subject?.trim()) throw new BadRequestException('Email subject is required');
    if (!data.imageData?.startsWith('data:image/')) throw new BadRequestException('A valid email image is required');

    const audience = data.audience || MarketingEmailAudience.ALL_USERS;
    const estimatedRecipients = await this.estimateAudience(audience, data.eventId);
    const campaign = this.campaignRepo.create({
      name: data.name.trim(),
      subject: data.subject.trim(),
      preheader: data.preheader?.trim() || null,
      imageData: data.imageData,
      imageFileName: data.imageFileName?.trim() || null,
      headline: data.headline?.trim() || null,
      body: data.body?.trim() || null,
      buttonText: data.buttonText?.trim() || null,
      buttonUrl: data.buttonUrl?.trim() || null,
      audience,
      eventId: data.eventId || null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      estimatedRecipients,
      status: data.scheduledAt ? MarketingEmailCampaignStatus.SCHEDULED : MarketingEmailCampaignStatus.DRAFT,
    });

    return this.campaignRepo.save(campaign);
  }

  async markEmailCampaignTested(campaignId: string) {
    const campaign = await this.campaignRepo.findOne({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Campaign not found');

    campaign.status = MarketingEmailCampaignStatus.TESTED;
    campaign.lastTestSentAt = new Date();
    return this.campaignRepo.save(campaign);
  }

}
