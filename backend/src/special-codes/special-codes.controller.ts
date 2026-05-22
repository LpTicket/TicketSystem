import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';
import { SpecialCodesService } from './special-codes.service';

type SaveSpecialCodeDto = {
  code: string;
  ownerUserId: string;
  eventId?: string | null;
  isActive?: boolean;
};

@Controller('special-codes')
export class SpecialCodesController {
  constructor(private readonly specialCodesService: SpecialCodesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('validate')
  validateCode(@Query('code') code: string, @Query('eventId') eventId: string) {
    return this.specialCodesService.validateForCheckout(code, eventId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-codes')
  getMyCodes(@Request() req: any) {
    return this.specialCodesService.getMyCodes(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-sales')
  getMySales(@Request() req: any) {
    return this.specialCodesService.getMySales(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin')
  createCode(@Body() dto: SaveSpecialCodeDto) {
    return this.specialCodesService.createCode(dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin')
  getAllCodes() {
    return this.specialCodesService.getAllCodes();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/sales')
  getAllSales() {
    return this.specialCodesService.getAllSales();
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch('admin/:id')
  updateCode(@Param('id') id: string, @Body() dto: Partial<SaveSpecialCodeDto>) {
    return this.specialCodesService.updateCode(id, dto);
  }
}
