import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities/user.entity';
import { MarketingService } from './marketing.service';

@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Get('banner/home')
  async getActiveHomeBanner(@Query('includeData') includeData?: string) {
    return this.marketingService.getActiveHomeBanner(includeData === 'true');
  }

  @Get('banners/home')
  async getHomeBanners(@Query('includeData') includeData?: string) {
    return this.marketingService.getHomeBanners(includeData === 'true');
  }

  @Get('banner/home/image')
  async getHomeBannerImage(@Query('variant') variant: 'desktop' | 'mobile' | undefined, @Query('id') id: string | undefined, @Res() res: any) {
    const image = await this.marketingService.getHomeBannerImage(variant === 'mobile' ? 'mobile' : 'desktop', id);
    res.header('Content-Type', image.mimeType);
    res.header('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.header('Content-Length', image.buffer.length);
    return res.send(image.buffer);
  }

  @Post('push-token')
  @UseGuards(AuthGuard('jwt'))
  async registerPushToken(@Request() req: any, @Body() body: { token?: string; platform?: string }) {
    return this.marketingService.registerPushToken(req.user.id, body);
  }

  @Post('admin/banner/home')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async saveHomeBanner(@Body() body: { imageData: string; fileName?: string; mobileImageData?: string | null; mobileFileName?: string | null }) {
    return this.marketingService.saveHomeBanner(body);
  }

  @Get('admin/banners/home')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async getAdminHomeBanners(@Query('includeData') includeData?: string) {
    return this.marketingService.getHomeBanners(includeData === 'true');
  }

  @Post('admin/banners/home')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async saveHomeBannerItem(@Body() body: {
    id?: string;
    title?: string;
    imageData: string;
    fileName?: string;
    mobileImageData?: string | null;
    mobileFileName?: string | null;
    bannerType?: string;
    displayMode?: string;
    sortOrder?: number;
    linkUrl?: string | null;
    isActive?: boolean;
  }) {
    return this.marketingService.saveHomeBannerItem(body);
  }

  @Patch('admin/banners/home/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async updateHomeBannerItem(@Param('id') id: string, @Body() body: any) {
    return this.marketingService.updateHomeBannerItem(id, body);
  }

  @Delete('admin/banners/home/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async removeHomeBannerItem(@Param('id') id: string) {
    return this.marketingService.removeHomeBannerItem(id);
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
  async sendWhatsappCampaign(@Body() body: { message: string; recipients?: string[]; lang?: 'es' | 'en' }) {
    return this.marketingService.sendWhatsappCampaign(body?.message, body?.recipients, body?.lang);
  }

  @Post('admin/push-campaign')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  async sendPushCampaign(@Body() body: { title?: string; message?: string; audience?: 'all' | 'user'; userId?: string; link?: string }) {
    return this.marketingService.sendPushCampaign(body);
  }
}
