import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingBanner } from './marketing-banner.entity';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingBanner])],
  controllers: [MarketingController],
  providers: [MarketingService],
})
export class MarketingModule {}
