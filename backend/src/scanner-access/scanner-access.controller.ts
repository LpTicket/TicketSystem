import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ScannerAccessStatus } from '../database/entities';
import { ScannerAccessService } from './scanner-access.service';

@Controller('scanner-access')
@UseGuards(AuthGuard('jwt'))
export class ScannerAccessController {
  constructor(private readonly scannerAccessService: ScannerAccessService) {}

  @Get('me')
  getMine(@Request() req: any) {
    return this.scannerAccessService.getMine(req.user.id);
  }

  @Get('events/search')
  searchEvents(@Query('q') q: string) {
    return this.scannerAccessService.searchEvents(q);
  }

  @Post('requests')
  requestAccess(@Body('eventId') eventId: string, @Request() req: any) {
    return this.scannerAccessService.requestAccess(eventId, req.user.id);
  }

  @Get('organizer/requests')
  getOrganizerRequests(@Request() req: any, @Query('eventId') eventId?: string) {
    return this.scannerAccessService.getOrganizerRequests(req.user, eventId);
  }

  @Patch('requests/:id/approve')
  approve(@Param('id') id: string, @Request() req: any) {
    return this.scannerAccessService.decideRequest(id, ScannerAccessStatus.APPROVED, req.user);
  }

  @Patch('requests/:id/reject')
  reject(@Param('id') id: string, @Request() req: any) {
    return this.scannerAccessService.decideRequest(id, ScannerAccessStatus.REJECTED, req.user);
  }

  @Patch('requests/:id/revoke')
  revoke(@Param('id') id: string, @Request() req: any) {
    return this.scannerAccessService.decideRequest(id, ScannerAccessStatus.REVOKED, req.user);
  }

  @Post('events/:eventId/ticket/:code/validate')
  validateTicket(@Param('eventId') eventId: string, @Param('code') code: string, @Request() req: any) {
    return this.scannerAccessService.validateTicketForEmployee(eventId, code, req.user);
  }
}
