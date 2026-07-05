import { Body, Controller, Delete, Get, Param, Post, Put, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { memoryStorage } from 'multer';
import { StorageService } from '../common/services/storage.service';
import { AuthGuard } from '@nestjs/passport';
import { SocialMatchConnectionStatus, SocialMatchInterest, UserRole } from '../database/entities';
import { SocialMatchService } from './social-match.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

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
  constructor(
    private readonly socialMatchService: SocialMatchService,
    private readonly storageService: StorageService,
  ) {}

  @Get('me')
  getMySocialMatch(@Request() req: any) {
    return this.socialMatchService.getMySocialMatch(req.user.id);
  }

  @Get('events/:eventId/suggestions')
  getSuggestions(@Request() req: any, @Param('eventId') eventId: string) {
    return this.socialMatchService.getSuggestions(req.user.id, eventId);
  }

  @Post('connections')
  requestConnection(@Request() req: any, @Body() dto: { eventId: string; receiverId: string }) {
    return this.socialMatchService.requestConnection(req.user.id, dto.eventId, dto.receiverId);
  }

  @Post('suggestions/dismiss')
  dismissSuggestion(@Request() req: any, @Body() dto: { eventId: string; receiverId: string }) {
    return this.socialMatchService.dismissSuggestion(req.user.id, dto.eventId, dto.receiverId);
  }

  @Put('connections/:connectionId')
  updateConnection(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Body() dto: { status: SocialMatchConnectionStatus.ACCEPTED | SocialMatchConnectionStatus.DECLINED | SocialMatchConnectionStatus.CANCELLED },
  ) {
    return this.socialMatchService.updateConnection(req.user.id, connectionId, dto.status);
  }

  @Delete('connections/:connectionId/chat')
  deleteConnectionChat(@Request() req: any, @Param('connectionId') connectionId: string) {
    return this.socialMatchService.hideChat(req.user.id, connectionId);
  }

  @Get('connections/:connectionId/messages')
  getMessages(@Request() req: any, @Param('connectionId') connectionId: string) {
    return this.socialMatchService.getMessages(req.user.id, connectionId);
  }

  @Post('connections/:connectionId/messages')
  sendMessage(
    @Request() req: any,
    @Param('connectionId') connectionId: string,
    @Body() dto: { message: string },
  ) {
    return this.socialMatchService.sendMessage(req.user.id, connectionId, dto.message);
  }

  @Put('events/:eventId/preferences')
  updatePreference(
    @Request() req: any,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateSocialMatchDto,
  ) {
    return this.socialMatchService.updatePreference(req.user.id, eventId, dto);
  }

  @Post('events/:eventId/photos')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage() as any,
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Solo se permiten imágenes'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadPhoto(@Request() req: any, @Param('eventId') eventId: string, @UploadedFile() file: any) {
    const base64Url = await this.storageService.uploadFile(file, 'sm-photos');
    return this.socialMatchService.uploadPhoto(req.user.id, eventId, base64Url);
  }

  @Post('events/:eventId/photos/base64')
  async uploadPhotoBase64(
    @Request() req: any,
    @Param('eventId') eventId: string,
    @Body() dto: { photoDataUrl?: string },
  ) {
    return this.socialMatchService.uploadPhoto(req.user.id, eventId, dto.photoDataUrl || '');
  }

  @Delete('events/:eventId/photos/:index')
  deletePhoto(@Request() req: any, @Param('eventId') eventId: string, @Param('index') index: string) {
    return this.socialMatchService.deletePhoto(req.user.id, eventId, parseInt(index, 10));
  }

  @Post('seed-test-data')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  seedTestData(@Request() req: any) {
    return this.socialMatchService.seedTestData(req.user.id);
  }
}
