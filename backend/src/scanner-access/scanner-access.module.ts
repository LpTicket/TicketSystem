import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event, ScannerAccess, User } from '../database/entities';
import { OrdersModule } from '../orders/orders.module';
import { ScannerAccessController } from './scanner-access.controller';
import { ScannerAccessService } from './scanner-access.service';

@Module({
  imports: [TypeOrmModule.forFeature([ScannerAccess, Event, User]), OrdersModule],
  controllers: [ScannerAccessController],
  providers: [ScannerAccessService],
  exports: [ScannerAccessService],
})
export class ScannerAccessModule {}
