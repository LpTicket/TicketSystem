import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, Ticket, Seat, Event, VenueSection, SpecialCode, ScannerAccess, PaymentMethod } from '../database/entities';
import { MarketingModule } from '../marketing/marketing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Ticket, Seat, Event, VenueSection, SpecialCode, ScannerAccess, PaymentMethod]),
    MarketingModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
