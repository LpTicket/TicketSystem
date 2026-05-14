import { Controller, Post, Body } from '@nestjs/common';
import { MailService } from '../services/mail.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly mailService: MailService) {}

  @Post()
  async handleContact(@Body() body: { name: string; email: string; subject: string; message: string }) {
    await this.mailService.sendContactEmail(body.name, body.email, body.subject, body.message);
    return { success: true };
  }
}
