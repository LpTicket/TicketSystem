import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, Ticket, TicketRevocation, Seat, Event, VenueSection, SpecialCode, ScannerAccess, PaymentMethod, OrganizerPayout } from '../database/entities';
import { MarketingModule } from '../marketing/marketing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Ticket, TicketRevocation, Seat, Event, VenueSection, SpecialCode, ScannerAccess, PaymentMethod, OrganizerPayout]),
    MarketingModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
