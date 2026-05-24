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
}
