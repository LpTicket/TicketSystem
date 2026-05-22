import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order, Ticket, Seat, Event, VenueSection, SpecialCode } from '../database/entities';
import { SpecialCodesModule } from '../special-codes/special-codes.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Ticket, Seat, Event, VenueSection, SpecialCode]), SpecialCodesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
