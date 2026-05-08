import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { OrdersModule } from './orders/orders.module';
import { AdminModule } from './admin/admin.module';
import { CategoriesModule } from './categories/categories.module';
import { PaymentsModule } from './payments/payments.module';
import { CommonModule } from './common/common.module';
import { User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod } from './database/entities';

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
          entities: [User, Event, VenueSection, Seat, Order, Ticket, EventCategoryEntity, PaymentMethod],
          synchronize: true,
          logging: false,
          ssl: isProd ? { rejectUnauthorized: false } : false,
        };
      },
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EventsModule,
    OrdersModule,
    AdminModule,
    CategoriesModule,
    PaymentsModule,
    CommonModule,
  ],
})
export class AppModule {}
