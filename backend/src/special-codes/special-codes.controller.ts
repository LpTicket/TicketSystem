import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';
import { SpecialCodesService } from './special-codes.service';

@Controller('special-codes')
export class SpecialCodesController {
  constructor(private readonly specialCodesService: SpecialCodesService) {}

  @Get('validate')
  async validate(@Query('code') code: string, @Query('eventId') eventId?: string) {
    const specialCode = await this.specialCodesService.validateForCheckout(code, eventId);
    if (!specialCode) return null;

    return {
      id: specialCode.id,
      code: specialCode.code,
      ownerUserId: specialCode.ownerUserId,
      eventId: specialCode.eventId,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMyCodes(@Request() req: any) {
    return this.specialCodesService.getMyCodes(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me/sales')
  getMySales(@Request() req: any) {
    return this.specialCodesService.getSalesForOwner(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  getAllCodes() {
    return this.specialCodesService.getAllCodes();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('sales')
  getAllSales() {
    return this.specialCodesService.getAllSales();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post()
  createCode(@Body() dto: { code: string; ownerUserId: string; eventId?: string | null; isActive?: boolean }) {
    return this.specialCodesService.createCode(dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  updateCode(
    @Param('id') id: string,
    @Body() dto: { code?: string; ownerUserId?: string; eventId?: string | null; isActive?: boolean },
  ) {
    return this.specialCodesService.updateCode(id, dto);
  }
}
