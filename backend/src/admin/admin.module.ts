import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User, Event, Order, Ticket, VenueSection } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, Event, Order, Ticket, VenueSection])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
