import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, Event, EventStatus, Order, Ticket, VenueSection } from '../database/entities';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(VenueSection) private readonly sectionRepo: Repository<VenueSection>,
  ) {}

  async getDashboardStats() {
    const totalUsers = await this.userRepo.count();
    const totalEvents = await this.eventRepo.count();
    const publishedEvents = await this.eventRepo.count({ where: { status: EventStatus.PUBLISHED } });
    const draftEvents = await this.eventRepo.count({ where: { status: EventStatus.DRAFT } });
    const totalOrders = await this.orderRepo.count();
    const paidOrders = await this.orderRepo.count({ where: { status: 'paid' as any } });

    const revenueResult = await this.orderRepo
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.total), 0)', 'totalRevenue')
      .where('order.status = :status', { status: 'paid' })
      .getRawOne();

    const totalTickets = await this.ticketRepo.count();
    const clients = await this.userRepo.count({ where: { role: UserRole.CLIENT } });
    const admins = await this.userRepo.count({ where: { role: UserRole.ADMIN } });

    return {
      totalUsers,
      clients,
      admins,
      totalEvents,
      publishedEvents,
      draftEvents,
      totalOrders,
      paidOrders,
      totalRevenue: Number(revenueResult?.totalRevenue || 0),
      totalTickets,
    };
  }

  async getUsers(page: number, limit: number, role?: string) {
    const where: any = {};
    if (role && ['client', 'admin'].includes(role)) {
      where.role = role;
    }

    const [users, total] = await this.userRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'role', 'isActive', 'createdAt'],
    });

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, role: UserRole) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.role = role;
    await this.userRepo.save(user);
    const { passwordHash, ...userData } = user;
    return userData;
  }

  async toggleUserActive(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.isActive = !user.isActive;
    await this.userRepo.save(user);
    const { passwordHash, ...userData } = user;
    return userData;
  }

  async updateUserProfile(userId: string, updateData: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string }) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    
    if (updateData.firstName !== undefined) user.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) user.lastName = updateData.lastName;
    if (updateData.email !== undefined) user.email = updateData.email;
    if (updateData.phone !== undefined) user.phone = updateData.phone;
    if (updateData.address !== undefined) user.address = updateData.address;
    
    await this.userRepo.save(user);
    const { passwordHash, ...userData } = user;
    return userData;
  }

  async deleteUser(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    
    if (user.role === UserRole.ADMIN && user.email === 'admin@lpticket.com') {
      throw new NotFoundException('No se puede eliminar al administrador principal');
    }

    // Manual cleanup of related data to avoid FK constraints
    // 1. Delete tickets where user is the buyer
    await this.ticketRepo.delete({ userId });

    // 2. Delete orders where user is the buyer
    await this.orderRepo.delete({ userId });

    // 3. Handle events where user is organizer
    const userEvents = await this.eventRepo.find({ where: { organizerId: userId } });
    for (const event of userEvents) {
      // Delete tickets for this event
      await this.ticketRepo.delete({ eventId: event.id });
      // Delete orders for this event
      await this.orderRepo.delete({ eventId: event.id });
      // Delete sections for this event
      await this.sectionRepo.delete({ eventId: event.id });
      // Finally delete the event
      await this.eventRepo.delete(event.id);
    }
    
    // Finally delete the user
    await this.userRepo.delete(userId);
    return { success: true };
  }

  async getAllEvents(page: number, limit: number, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [events, total] = await this.eventRepo.findAndCount({
      where,
      relations: ['organizer'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { events, total, page, totalPages: Math.ceil(total / limit) };
  }

  async approveEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    // Calculate min/max prices
    const sections = await this.sectionRepo.find({ where: { eventId } });
    const prices = sections.map((s) => Number(s.price));

    event.status = EventStatus.PUBLISHED;
    if (prices.length) {
      event.minPrice = Math.min(...prices);
      event.maxPrice = Math.max(...prices);
    }
    return this.eventRepo.save(event);
  }

  async rejectEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    event.status = EventStatus.CANCELLED;
    return this.eventRepo.save(event);
  }

  async toggleFeatured(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    event.isFeatured = !event.isFeatured;
    return this.eventRepo.save(event);
  }

  async deleteEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    
    // We will cascade delete or delete sections first
    await this.sectionRepo.delete({ eventId });
    await this.eventRepo.delete(eventId);
    return { success: true };
  }

  async getAllOrders(page: number, limit: number) {
    const [orders, total] = await this.orderRepo.findAndCount({
      relations: ['event'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { orders, total, page, totalPages: Math.ceil(total / limit) };
  }
}
