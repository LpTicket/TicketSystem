import { Body, Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SocialMatchInterest } from '../database/entities';
import { SocialMatchService } from './social-match.service';

type UpdateSocialMatchDto = {
  isActive?: boolean;
  interests?: SocialMatchInterest[];
  industry?: string | null;
  instagram?: string | null;
  privateMode?: boolean;
  invisibleMode?: boolean;
  shareInstagram?: boolean;
  shareLocation?: boolean;
};

@UseGuards(AuthGuard('jwt'))
@Controller('social-match')
export class SocialMatchController {
  constructor(private readonly socialMatchService: SocialMatchService) {}

  @Get('me')
  getMySocialMatch(@Request() req: any) {
    return this.socialMatchService.getMySocialMatch(req.user.id);
  }

  @Put('events/:eventId/preferences')
  updatePreference(@Request() req: any, @Param('eventId') eventId: string, @Body() dto: UpdateSocialMatchDto) {
    return this.socialMatchService.updatePreference(req.user.id, eventId, dto);
  }
}
