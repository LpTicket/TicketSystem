import {Body, Controller, Get, Param, Patch, Post, Request, UseGuards, Delete} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';
import { SpecialCodesService } from './special-codes.service';

@Controller('special-codes')
export class SpecialCodesController {
  constructor(private readonly specialCodesService: SpecialCodesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('by-event/:eventId/payout-summary')
  getEventPayoutSummary(@Param('eventId') eventId: string, @Request() req: any) {
    return this.specialCodesService.getEventPayoutSummary(eventId, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('by-event/:eventId')
  getCodesByEvent(@Param('eventId') eventId: string, @Request() req: any) {
    return this.specialCodesService.getCodesByEvent(eventId, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('by-event/:eventId/:codeId/reward')
  updateCodeReward(
    @Param('eventId') eventId: string,
    @Param('codeId') codeId: string,
    @Body() dto: { commissionFixed: number },
    @Request() req: any,
  ) {
    return this.specialCodesService.updateCodeRewardByOrganizer(codeId, eventId, req.user.id, dto.commissionFixed);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMyCodes(@Request() req: any) {
    return this.specialCodesService.getMyCodes(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-sales')
  getMyCodeSales(@Request() req: any) {
    return this.specialCodesService.getMyCodeSales(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-payouts')
  getMyPayoutSummary(@Request() req: any) {
    return this.specialCodesService.getMyPayoutSummary(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin-sales')
  getAllCodeSales() {
    return this.specialCodesService.getAllCodeSales();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/commission-summary')
  getCommissionSummary() {
    return this.specialCodesService.getCommissionSummary();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/payouts')
  recordPayout(@Body() dto: { eventId: string; ownerUserId: string; amount: number; note?: string }) {
    return this.specialCodesService.recordPayout(dto.eventId, dto.ownerUserId, dto.amount, dto.note);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  getAllCodes() {
    return this.specialCodesService.getAllCodes();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  createCode(@Body() dto: { code: string; ownerUserId: string; eventId?: string | null; isActive?: boolean; commissionFixed?: number }) {
    return this.specialCodesService.createCode(dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateCode(
    @Param('id') id: string,
    @Body() dto: { code?: string; ownerUserId?: string; eventId?: string | null; isActive?: boolean; commissionFixed?: number },
  ) {
    return this.specialCodesService.updateCode(id, dto);
  }
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.specialCodesService.remove(id);
  }

}
