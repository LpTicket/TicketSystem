import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nest-lab/fastify-multer';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto, EventQueryDto } from './dto/event.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // Public endpoints
  @Get()
  findAll(@Query() query: EventQueryDto) {
    return this.eventsService.findAll(query);
  }

  @Get('featured')
  findFeatured() {
    return this.eventsService.findFeatured();
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  @Get(':eventId/seatmap')
  getSeatMap(@Param('eventId') eventId: string) {
    return this.eventsService.getSeatMap(eventId);
  }

  // Organizer endpoints
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateEventDto, @Request() req: any) {
    return this.eventsService.create(dto, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEventDto, @Request() req: any) {
    return this.eventsService.update(id, dto, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post(':id/publish')
  publish(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.publish(id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: any) {
    return this.eventsService.delete(id, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }) as any,
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req: any,
  ) {
    return this.eventsService.uploadImage(id, file.filename, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post(':id/image/banner')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req: any, file: any, cb: any) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, uniqueSuffix + extname(file.originalname));
        },
      }) as any,
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new Error('Solo se permiten imágenes'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  uploadBannerImage(
    @Param('id') id: string,
    @UploadedFile() file: any,
    @Request() req: any,
  ) {
    return this.eventsService.uploadBannerImage(id, file.filename, req.user.id);
  }

  // Sections & Seats
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post(':eventId/sections')
  createSection(
    @Param('eventId') eventId: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.eventsService.createSection(eventId, data, req.user.id);
  }

  @Get(':eventId/sections')
  getSections(@Param('eventId') eventId: string) {
    return this.eventsService.getSections(eventId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post(':eventId/sections/bulk')
  syncSections(
    @Param('eventId') eventId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    let sections = [];
    let defaultViewX = null;
    let defaultViewY = null;
    let defaultViewZoom = null;

    if (Array.isArray(body)) {
      sections = body;
    } else if (body && typeof body === 'object') {
      sections = body.sections || [];
      defaultViewX = body.defaultViewX;
      defaultViewY = body.defaultViewY;
      defaultViewZoom = body.defaultViewZoom;
    }

    return this.eventsService.syncSections(eventId, sections, req.user.id, {
      defaultViewX,
      defaultViewY,
      defaultViewZoom,
    });
  }

  @Get('sections/:sectionId/seats')
  getSeats(@Param('sectionId') sectionId: string) {
    return this.eventsService.getSeats(sectionId);
  }

  // Seat locking
  @UseGuards(AuthGuard('jwt'))
  @Post('seats/lock')
  lockSeats(@Body() body: { seatIds: string[] }, @Request() req: any) {
    return this.eventsService.lockSeats(body.seatIds, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('seats/unlock')
  unlockSeats(@Request() req: any) {
    return this.eventsService.unlockUserSeats(req.user.id);
  }
}
