import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event, Order, SpecialCode, User } from '../database/entities';
import { SpecialCodesController } from './special-codes.controller';
import { SpecialCodesService } from './special-codes.service';

@Module({
  imports: [TypeOrmModule.forFeature([SpecialCode, Order, User, Event])],
  controllers: [SpecialCodesController],
  providers: [SpecialCodesService],
  exports: [SpecialCodesService],
})
export class SpecialCodesModule {}
