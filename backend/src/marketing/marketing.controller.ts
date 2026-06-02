import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user.entity';
import { MarketingService } from './marketing.service';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('banner/home')
  async getActiveHomeBanner() {
    return this.marketingService.getActiveHomeBanner();
  }

  @Post('admin/banner/home')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async saveHomeBanner(@Body() body: { imageData: string; fileName?: string; mobileImageData?: string | null; mobileFileName?: string | null }) {
    return this.marketingService.saveHomeBanner(body);
  }

  @Delete('admin/banner/home')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async removeHomeBanner() {
    return this.marketingService.removeHomeBanner();
  }

  @Delete('admin/banner/home-mobile')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async removeHomeMobileBanner() {
    return this.marketingService.removeHomeMobileBanner();
  }

  @Get('admin/recipients')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getRecipientsList() {
    return this.marketingService.getRecipientsList();
  }

  @Post('admin/email-campaign')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendEmailCampaign(
    @Body() body: { subject?: string; title?: string; preheader?: string; imageData?: string | null; link?: string; recipients?: string[] },
  ) {
    return this.marketingService.sendEmailCampaign(body);
  }

  @Post('admin/sms-campaign')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendSmsCampaign(@Body() body: { message: string; recipients?: string[] }) {
    return this.marketingService.sendSmsCampaign(body?.message, body?.recipients);
  }

  @Post('admin/whatsapp-campaign')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendWhatsappCampaign(@Body() body: { message: string; recipients?: string[] }) {
    return this.marketingService.sendWhatsappCampaign(body?.message, body?.recipients);
  }
}
