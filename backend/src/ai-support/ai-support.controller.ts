import { Controller, Post, Body } from '@nestjs/common';
import { AiSupportService } from './ai-support.service';

@Controller('ai-support')
export class AiSupportController {
  constructor(private readonly aiSupportService: AiSupportService) {}

  @Post('chat')
  async chat(@Body() body: { messages: any[] }) {
    return this.aiSupportService.generateResponse(body.messages);
  }
}
