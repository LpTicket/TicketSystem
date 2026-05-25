import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user.entity';
import { MarketingService } from './marketing.service';
import { MarketingEmailAudience } from './marketing-email-campaign.entity';

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

  @Get('admin/email-campaigns')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async listEmailCampaigns() {
    return this.marketingService.listEmailCampaigns();
  }

  @Post('admin/email-campaigns')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async createEmailCampaign(@Body() body: {
    name: string;
    subject: string;
    preheader?: string | null;
    imageData: string;
    imageFileName?: string | null;
    headline?: string | null;
    body?: string | null;
    buttonText?: string | null;
    buttonUrl?: string | null;
    audience?: MarketingEmailAudience;
    eventId?: string | null;
    scheduledAt?: string | null;
  }) {
    return this.marketingService.createEmailCampaign(body);
  }

  @Post('admin/email-campaigns/:id/test')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async markEmailCampaignTested(@Param('id') id: string) {
    return this.marketingService.markEmailCampaignTested(id);
  }

}
