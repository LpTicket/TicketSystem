import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketingBanner } from './marketing-banner.entity';
import { MarketingController } from './marketing.controller';
import { MarketingService } from './marketing.service';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketingBanner, User])],
  controllers: [MarketingController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
