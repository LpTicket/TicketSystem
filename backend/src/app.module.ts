import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD } from '@nestjs/core';
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
import { ScannerAccessModule } from './scanner-access/scanner-access.module';
import { ScannerAccess } from './database/entities';

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
          entities: [MarketingBanner, PushToken, AnalyticsPageView, User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod, VenueTemplate, SocialMatchPreference, SocialMatchConnection, SocialMatchMessage, SpecialCode, SpecialCodePayout, ScannerAccess],
          synchronize: true,
          logging: false,
          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ScheduleModule.forRoot(),
    // In-memory cache for public read endpoints (events, categories, banners).
    // TTL 60s — fresh enough for the home page, avoids N Postgres hits per page load.
    CacheModule.register({ isGlobal: true, ttl: 60_000 }),
    // Global rate limiting: 120 requests / minute per IP by default.
    // Sensitive auth routes add their own stricter @Throttle() on top.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
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
    ScannerAccessModule,
  ],
  providers: [
    // Apply the throttler globally.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
