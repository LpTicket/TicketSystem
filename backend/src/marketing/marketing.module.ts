import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingBanner } from './marketing-banner.entity';
import { PushToken } from './push-token.entity';
import { EmailCampaign } from './email-campaign.entity';
import { EmailCampaignRecipient } from './email-campaign-recipient.entity';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { User } from '../database/entities/user.entity';
import { ZohoCampaignsService } from './zoho-campaigns.service';
import { MarketingIntegration } from './marketing-integration.entity';
import { Event } from '../database/entities/event.entity';
import { Order } from '../database/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingBanner, PushToken, EmailCampaign, EmailCampaignRecipient, MarketingIntegration, User, Event, Order])],
  controllers: [MarketingController],
  providers: [MarketingService, ZohoCampaignsService],
  exports: [MarketingService],
})
export class MarketingModule {}
