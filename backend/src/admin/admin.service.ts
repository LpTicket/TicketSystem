import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, Event, EventStatus, Order, Ticket, VenueSection, Seat } from '../database/entities';

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

    event.status = EventStatus.PUBLISHED;
    return this.eventRepo.save(event);
  }

  async rejectEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    event.status = EventStatus.CANCELLED;
    return this.eventRepo.save(event);
  }

  async approveField(eventId: string, field: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    switch (field) {
      case 'title':
        if (event.pendingTitle) {
          event.title = event.pendingTitle;
          event.pendingTitle = null;
        }
        break;
      case 'description':
        if (event.pendingDescription) {
          event.description = event.pendingDescription;
          event.pendingDescription = null;
        }
        break;
      case 'imageUrl':
        if (event.pendingImageUrl) {
          event.imageUrl = event.pendingImageUrl;
          event.pendingImageUrl = null;
        }
        break;
      case 'bannerImageUrl':
        if (event.pendingBannerImageUrl) {
          event.bannerImageUrl = event.pendingBannerImageUrl;
          event.pendingBannerImageUrl = null;
        }
        break;
      case 'venueName':
        if (event.pendingVenueName) {
          event.venueName = event.pendingVenueName;
          event.pendingVenueName = null;
        }
        break;
      case 'eventDate':
        if (event.pendingEventDate) {
          event.eventDate = event.pendingEventDate;
          event.pendingEventDate = null;
        }
        break;
      case 'category':
        if (event.pendingCategory) {
          event.category = event.pendingCategory;
          event.pendingCategory = null;
        }
        break;
      default:
        throw new BadRequestException('Campo inválido para aprobar');
    }

    return this.eventRepo.save(event);
  }

  async rejectField(eventId: string, field: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    switch (field) {
      case 'title':
        event.pendingTitle = null;
        break;
      case 'description':
        event.pendingDescription = null;
        break;
      case 'imageUrl':
        event.pendingImageUrl = null;
        break;
      case 'bannerImageUrl':
        event.pendingBannerImageUrl = null;
        break;
      case 'venueName':
        event.pendingVenueName = null;
        break;
      case 'eventDate':
        event.pendingEventDate = null;
        break;
      case 'category':
        event.pendingCategory = null;
        break;
      default:
        throw new BadRequestException('Campo inválido para rechazar');
    }

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
    
    // Cascade delete related entities to avoid foreign key constraint violations
    await this.eventRepo.manager.transaction(async (manager) => {
      // 1. Delete tickets
      await manager.delete(Ticket, { eventId });
      
      // 2. Delete orders
      await manager.delete(Order, { eventId });
      
      // 3. Delete seats
      const sections = await manager.find(VenueSection, { where: { eventId } });
      if (sections.length > 0) {
        const sectionIds = sections.map(s => s.id);
        await manager.createQueryBuilder().delete().from(Seat).where("sectionId IN (:...sectionIds)", { sectionIds }).execute();
        
        // 4. Delete sections
        await manager.delete(VenueSection, { eventId });
      }
      
      // 5. Delete event
      await manager.delete(Event, { id: eventId });
    });
    
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
