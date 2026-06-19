import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { OrdersModule } from './orders/orders.module';
import { AdminModule } from './admin/admin.module';
import { CategoriesModule } from './categories/categories.module';
import { PaymentsModule } from './payments/payments.module';
import { CommonModule } from './common/common.module';
import { VenueTemplatesModule } from './venue-templates/venue-templates.module';
import { AiSupportModule } from './ai-support/ai-support.module';
import { SocialMatchModule } from './social-match/social-match.module';
import { SpecialCodesModule } from './special-codes/special-codes.module';
import { User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod, VenueTemplate, SocialMatchPreference, SocialMatchConnection, SocialMatchMessage, SpecialCode, SpecialCodePayout } from './database/entities';
import { MarketingModule } from './marketing/marketing.module';
import { MarketingBanner } from './marketing/marketing-banner.entity';
import { PushToken } from './marketing/push-token.entity';
import { AnalyticsModule } from './analytics/analytics.module';
import { AnalyticsPageView } from './analytics/analytics-page-view.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL') || config.get<string>('DB_URL');
        const isProd = config.get<string>('NODE_ENV') === 'production';
        return {
          type: 'postgres',
          ...(url ? { url } : {
            host: config.get<string>('DB_HOST'),
            port: config.get<number>('DB_PORT'),
            username: config.get<string>('DB_USERNAME'),
            password: config.get<string>('DB_PASSWORD'),
            database: config.get<string>('DB_NAME'),
          }),
          entities: [MarketingBanner, PushToken, AnalyticsPageView, User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod, VenueTemplate, SocialMatchPreference, SocialMatchConnection, SocialMatchMessage, SpecialCode, SpecialCodePayout],
          synchronize: true,
          logging: false,
          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EventsModule,
    OrdersModule,
    AdminModule,
    CategoriesModule,
    PaymentsModule,
    CommonModule,
    VenueTemplatesModule,
    AiSupportModule,
    SocialMatchModule,
    SpecialCodesModule,
    MarketingModule,
    AnalyticsModule,
  ],
})
export class AppModule {}
