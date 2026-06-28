import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminInvoicesService } from './admin-invoices.service';
import { User, Event, Order, Ticket, VenueSection } from '../database/entities';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Event, Order, Ticket, VenueSection]), OrdersModule],
  controllers: [AdminController],
  providers: [AdminService, AdminInvoicesService],
})
export class AdminModule {}
