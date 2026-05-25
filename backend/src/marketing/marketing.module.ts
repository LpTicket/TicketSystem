import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingBanner } from './marketing-banner.entity';
import { MarketingEmailCampaign } from './marketing-email-campaign.entity';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { User, Order } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingBanner, MarketingEmailCampaign, User, Order])],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
