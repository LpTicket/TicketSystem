import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsPageView } from './analytics-page-view.entity';
import { AnalyticsService } from './analytics.service';
import { Event, Order } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([AnalyticsPageView, Event, Order])],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
