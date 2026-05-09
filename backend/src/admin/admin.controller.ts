import {
  Controller, Get, Patch, Delete, Param, Query, UseGuards, Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Dashboard stats
  @Get('stats')
  getStats() {
    return this.adminService.getDashboardStats();
  }

  // Users
  @Get('users')
  getUsers(@Query('page') page?: number, @Query('limit') limit?: number, @Query('role') role?: string) {
    return this.adminService.getUsers(page || 1, limit || 20, role);
  }

  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body('role') role: UserRole) {
    return this.adminService.updateUserRole(id, role);
  }

  @Patch('users/:id/toggle-active')
  toggleUserActive(@Param('id') id: string) {
    return this.adminService.toggleUserActive(id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // Events management
  @Get('events')
  getAllEvents(@Query('page') page?: number, @Query('limit') limit?: number, @Query('status') status?: string) {
    return this.adminService.getAllEvents(page || 1, limit || 20, status);
  }

  @Patch('events/:id/approve')
  approveEvent(@Param('id') id: string) {
    return this.adminService.approveEvent(id);
  }

  @Patch('events/:id/reject')
  rejectEvent(@Param('id') id: string) {
    return this.adminService.rejectEvent(id);
  }

  @Patch('events/:id/toggle-featured')
  toggleFeatured(@Param('id') id: string) {
    return this.adminService.toggleFeatured(id);
  }

  @Delete('events/:id')
  deleteEvent(@Param('id') id: string) {
    return this.adminService.deleteEvent(id);
  }

  // Orders
  @Get('orders')
  getAllOrders(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAllOrders(page || 1, limit || 20);
  }
}
