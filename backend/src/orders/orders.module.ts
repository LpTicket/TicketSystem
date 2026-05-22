import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, Ticket, Seat, Event, VenueSection, SpecialCode } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Ticket, Seat, Event, VenueSection, SpecialCode])],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
