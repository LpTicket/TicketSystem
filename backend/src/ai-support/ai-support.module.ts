import { Module } from '@nestjs/common';
import { AiSupportService } from './ai-support.service';
import { AiSupportController } from './ai-support.controller';

@Module({
  providers: [AiSupportService],
  controllers: [AiSupportController],
  exports: [AiSupportService],
})
export class AiSupportModule {}
