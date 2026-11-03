import { Body, Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './notification-settings.dto';

@Controller('admin/notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class NotificationSettingsController {
  constructor(private readonly settings: NotificationSettingsService) {}

  @Get()
  getSettings() { return this.settings.getSettings(); }

  @Patch()
  update(@Body() dto: UpdateNotificationSettingsDto, @Request() req: { user: { id: string } }) {
    return this.settings.update(dto, req.user.id);
  }
}
