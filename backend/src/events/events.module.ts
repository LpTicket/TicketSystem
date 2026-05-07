import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { Event, VenueSection, Seat } from '../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([Event, VenueSection, Seat])],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
