/**
 * AdminService
 * EN: Admin-only operations — dashboard stats, user CRUD + role/active toggles,
 *     event moderation (approve/reject/feature), fees, prices and creator
 *     commissions, plus orders and per-event financial breakdowns.
 * ES: Operaciones solo de admin — estadísticas del panel, CRUD de usuarios +
 *     cambios de rol/activo, moderación de eventos (aprobar/rechazar/destacar),
 *     tarifas, precios y comisiones de creador, además de órdenes y desglose
 *     financiero por evento.
 */
import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, Event, EventStatus, Order, OrderStatus, Ticket, VenueSection, Seat } from '../database/entities';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(VenueSection) private readonly sectionRepo: Repository<VenueSection>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  private routeBase64EventImage(slug: string, url: string | null, kind: 'image' | 'banner') {
    if (!url?.startsWith('data:')) return url;
    return `/api/events/${slug}/og-image?kind=${kind}`;
  }

  private routeBase64EventImages(event: Event) {
    return {
      ...event,
      imageUrl: this.routeBase64EventImage(event.slug, event.imageUrl, 'image'),
      bannerImageUrl: this.routeBase64EventImage(event.slug, event.bannerImageUrl, 'banner'),
      organizer: event.organizer ? this.toSafeOrganizer(event.organizer) as any : undefined,
    };
  }

  private toSafeOrganizer(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  async getDashboardStats() {
    // Run all aggregate counts in parallel — these are independent reads.
    const [
      totalUsers,
      totalEvents,
      publishedEvents,
      draftEvents,
      totalOrders,
      paidOrders,
      revenueResult,
      totalTickets,
      clients,
      admins,
    ] = await Promise.all([
      this.userRepo.count(),
      this.eventRepo.count(),
      this.eventRepo.count({ where: { status: EventStatus.PUBLISHED } }),
      this.eventRepo.count({ where: { status: EventStatus.DRAFT } }),
      this.orderRepo.count(),
      this.orderRepo.count({ where: { status: 'paid' as any } }),
      this.orderRepo
        .createQueryBuilder('order')
        .select('COALESCE(SUM(order.total), 0)', 'totalRevenue')
        .addSelect('COALESCE(SUM(order.subtotal), 0)', 'ticketSales')
        .where('order.status = :status', { status: 'paid' })
        .getRawOne(),
      this.ticketRepo.count(),
      this.userRepo.count({ where: { role: UserRole.CLIENT } }),
      this.userRepo.count({ where: { role: UserRole.ADMIN } }),
    ]);

    // Financial breakdown for the admin.
    const totalRevenue = Number(revenueResult?.totalRevenue || 0); // total charged to buyers
    const ticketSales = Number(revenueResult?.ticketSales || 0);   // goes to organizers
    const serviceFees = Math.max(0, +(totalRevenue - ticketSales).toFixed(2)); // LPTicket markup collected
    // Stripe standard pricing (US cards): 2.9% + $0.30 per successful charge.
    const STRIPE_PERCENT = 0.029;
    const STRIPE_FIXED = 0.30;
    const stripeFees = totalRevenue > 0
      ? +(totalRevenue * STRIPE_PERCENT + paidOrders * STRIPE_FIXED).toFixed(2)
      : 0;
    const lpticketProfit = +(serviceFees - stripeFees).toFixed(2); // LPTicket net after Stripe

    return {
      totalUsers,
      clients,
      admins,
      totalEvents,
      publishedEvents,
      draftEvents,
      totalOrders,
      paidOrders,
      totalRevenue,
      ticketSales,
      serviceFees,
      stripeFees,
      stripePercent: STRIPE_PERCENT,
      stripeFixed: STRIPE_FIXED,
      lpticketProfit,
      totalTickets,
    };
  }

  /**
   * Per-event financial breakdown (paid orders): total charged, ticket sales,
   * LPTicket fees, estimated Stripe fees and net profit — one row per event.
   */
  async getEventsFinancials() {
    const STRIPE_PERCENT = 0.029;
    const STRIPE_FIXED = 0.30;

    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o."eventId"', 'eventId')
      .addSelect('COALESCE(SUM(o.total), 0)', 'totalCharged')
      .addSelect('COALESCE(SUM(o.subtotal), 0)', 'ticketSales')
      .addSelect('COALESCE(SUM(o."ticketCount"), 0)', 'ticketsSold')
      .addSelect('COUNT(o.id)', 'orders')
      .where('o.status = :status', { status: 'paid' })
      .groupBy('o."eventId"')
      .getRawMany();

    const byId = new Map(rows.map((r) => [r.eventId, r]));

    const events = await this.eventRepo.find({
      select: ['id', 'title', 'slug', 'status', 'eventDate'],
      order: { createdAt: 'DESC' },
    });

    const result = events.map((ev) => {
      const r = byId.get(ev.id);
      const totalCharged = Number(r?.totalCharged || 0);
      const ticketSales = Number(r?.ticketSales || 0);
      const orders = Number(r?.orders || 0);
      const ticketsSold = Number(r?.ticketsSold || 0);
      const serviceFees = Math.max(0, +(totalCharged - ticketSales).toFixed(2));
      const stripeFees = totalCharged > 0
        ? +(totalCharged * STRIPE_PERCENT + orders * STRIPE_FIXED).toFixed(2)
        : 0;
      const lpticketProfit = +(serviceFees - stripeFees).toFixed(2);
      return {
        id: ev.id,
        title: ev.title,
        slug: ev.slug,
        status: ev.status,
        eventDate: ev.eventDate,
        totalCharged,
        ticketSales,
        serviceFees,
        stripeFees,
        lpticketProfit,
        ticketsSold,
        orders,
      };
    });

    return { events: result, stripePercent: STRIPE_PERCENT, stripeFixed: STRIPE_FIXED };
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
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'phone', 'role', 'isActive', 'avatarUrl', 'createdAt'],
    });

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  async createUser(dto: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password?: string;
    role?: UserRole;
    phone?: string;
    address?: string;
  }) {
    // 1. Validation
    const existingEmail = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingEmail) {
      throw new ConflictException('El correo electrónico ya se encuentra registrado');
    }

    const existingUsername = await this.userRepo.findOne({ where: { username: dto.username } });
    if (existingUsername) {
      throw new ConflictException('El nombre de usuario ya se encuentra en uso');
    }

    // 2. Default Password if not specified
    const plainPassword = dto.password || 'LPticket2026!';
    const passwordHash = await bcrypt.hash(plainPassword, 12);

    // 3. Create User entity
    const newUser = this.userRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      username: dto.username,
      email: dto.email,
      passwordHash,
      role: dto.role || UserRole.CLIENT,
      phone: dto.phone || '',
      address: dto.address || '',
      isActive: true,
    });

    // 4. Save
    const saved = await this.userRepo.save(newUser);
    const { passwordHash: _, ...userData } = saved;
    return userData;
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

  async updateUserProfile(userId: string, updateData: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string; password?: string }) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    
    if (updateData.firstName !== undefined) user.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) user.lastName = updateData.lastName;
    if (updateData.email !== undefined) user.email = updateData.email;
    if (updateData.phone !== undefined) user.phone = updateData.phone;
    if (updateData.address !== undefined) user.address = updateData.address;
    if (updateData.password !== undefined && updateData.password.trim() !== '') {
      user.passwordHash = await bcrypt.hash(updateData.password, 12);
    }
    
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

    const eventIds = events.map((event) => event.id);
    const rows = eventIds.length
      ? await this.orderRepo
          .createQueryBuilder('o')
          .select('o."eventId"', 'eventId')
          .addSelect('COALESCE(SUM(o."ticketCount"), 0)', 'soldTickets')
          .addSelect('COALESCE(SUM(o.subtotal), 0)', 'totalRevenue')
          .addSelect('COUNT(o.id)', 'totalOrders')
          .where('o."eventId" IN (:...eventIds)', { eventIds })
          .andWhere('o.status = :status', { status: OrderStatus.PAID })
          .groupBy('o."eventId"')
          .getRawMany()
      : [];

    const statsByEventId = new Map(rows.map((row) => [
      row.eventId,
      {
        soldTickets: Number(row.soldTickets || 0),
        totalRevenue: Number(row.totalRevenue || 0),
        totalOrders: Number(row.totalOrders || 0),
      },
    ]));

    return {
      events: events.map((event) => ({
        ...this.routeBase64EventImages(event),
        soldTickets: statsByEventId.get(event.id)?.soldTickets || 0,
        totalRevenue: statsByEventId.get(event.id)?.totalRevenue || 0,
        totalOrders: statsByEventId.get(event.id)?.totalOrders || 0,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async invalidateEventCache(event: Event) {
    await this.cache.del(`event:slug:${event.slug}`);
    await this.cache.del(`event:seatmap:${event.id}`);
    await this.cache.del('events:featured');
    const v = ((await this.cache.get<number>('events:list:v') || 0) + 1);
    await this.cache.set('events:list:v', v, 0);
  }

  async approveEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    event.status = EventStatus.PUBLISHED;
    const result = await this.eventRepo.save(event);
    await this.invalidateEventCache(event);
    return result;
  }

  async rejectEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    event.status = EventStatus.CANCELLED;
    const result = await this.eventRepo.save(event);
    await this.invalidateEventCache(event);
    return result;
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
      case 'creatorCommission':
        if (event.pendingCreatorCommission !== null && event.pendingCreatorCommission !== undefined) {
          event.creatorCommission = event.pendingCreatorCommission;
          event.pendingCreatorCommission = null;
        }
        break;
      default:
        throw new BadRequestException('Campo inválido para aprobar');
    }

    const saved = await this.eventRepo.save(event);
    await this.invalidateEventCache(event);
    return saved;
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
      case 'creatorCommission':
        event.pendingCreatorCommission = null;
        break;
      default:
        throw new BadRequestException('Campo inválido para rechazar');
    }

    const saved = await this.eventRepo.save(event);
    await this.invalidateEventCache(event);
    return saved;
  }

  async toggleFeatured(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    event.isFeatured = !event.isFeatured;
    const result = await this.eventRepo.save(event);
    await this.invalidateEventCache(event);
    return result;
  }

  async togglePublicVisibility(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    event.publicVisible = event.publicVisible === false;
    if (!event.publicVisible) event.isFeatured = false;
    const result = await this.eventRepo.save(event);
    await this.invalidateEventCache(event);
    return result;
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
      relations: ['event', 'user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { orders, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getEventFeeConfig(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const sections = await this.sectionRepo.find({
      where: { eventId },
      order: { name: 'ASC' },
    });

    return { event, sections };
  }

  async updateEventFees(eventId: string, dto: {
    serviceFeePercent?: number | null;
    serviceFeeFixedPerTicket?: number | null;
    processingFeePercent?: number | null;
    processingFeeFixedPerTicket?: number | null;
  }) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    if (dto.serviceFeePercent !== undefined) {
      event.serviceFeePercent = dto.serviceFeePercent !== null && dto.serviceFeePercent >= 1
        ? dto.serviceFeePercent / 100
        : dto.serviceFeePercent;
    }
    if (dto.serviceFeeFixedPerTicket !== undefined) event.serviceFeeFixedPerTicket = dto.serviceFeeFixedPerTicket;
    
    if (dto.processingFeePercent !== undefined) {
      event.processingFeePercent = dto.processingFeePercent !== null && dto.processingFeePercent >= 1
        ? dto.processingFeePercent / 100
        : dto.processingFeePercent;
    }
    if (dto.processingFeeFixedPerTicket !== undefined) event.processingFeeFixedPerTicket = dto.processingFeeFixedPerTicket;

    await this.eventRepo.save(event);
    return { success: true, event };
  }

  async updateSectionFees(sectionId: string, dto: {
    serviceFeePercent?: number | null;
    serviceFeeFixedPerTicket?: number | null;
    processingFeePercent?: number | null;
    processingFeeFixedPerTicket?: number | null;
  }) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Sección no encontrada');

    if (dto.serviceFeePercent !== undefined) {
      section.serviceFeePercent = dto.serviceFeePercent !== null && dto.serviceFeePercent >= 1
        ? dto.serviceFeePercent / 100
        : dto.serviceFeePercent;
    }
    if (dto.serviceFeeFixedPerTicket !== undefined) section.serviceFeeFixedPerTicket = dto.serviceFeeFixedPerTicket;

    if (dto.processingFeePercent !== undefined) {
      section.processingFeePercent = dto.processingFeePercent !== null && dto.processingFeePercent >= 1
        ? dto.processingFeePercent / 100
        : dto.processingFeePercent;
    }
    if (dto.processingFeeFixedPerTicket !== undefined) section.processingFeeFixedPerTicket = dto.processingFeeFixedPerTicket;

    await this.sectionRepo.save(section);
    return { success: true, section };
  }

  async setEventCreatorCommission(eventId: string, amount: number) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (amount < 0) throw new BadRequestException('El monto no puede ser negativo');
    event.creatorCommission = amount;
    event.pendingCreatorCommission = null;
    return this.eventRepo.save(event);
  }

  async getEventPrices(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Evento no encontrado');
    const sections = await this.sectionRepo.find({ where: { eventId }, order: { sortOrder: 'ASC' } });
    return { event, sections };
  }

  async approveSectionPrice(sectionId: string) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Sección no encontrada');
    if (section.pendingPrice === null || section.pendingPrice === undefined) {
      throw new BadRequestException('No hay precio pendiente para esta sección');
    }
    section.price = section.pendingPrice;
    section.pendingPrice = null;
    await this.sectionRepo.save(section);
    return { success: true, section };
  }

  async rejectSectionPrice(sectionId: string) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Sección no encontrada');
    section.pendingPrice = null;
    await this.sectionRepo.save(section);
    return { success: true, section };
  }

  async setSectionPrice(sectionId: string, price: number) {
    const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
    if (!section) throw new NotFoundException('Sección no encontrada');
    if (price < 0) throw new BadRequestException('El precio no puede ser negativo');
    section.price = price;
    section.pendingPrice = null;
    await this.sectionRepo.save(section);
    return { success: true, section };
  }
}
