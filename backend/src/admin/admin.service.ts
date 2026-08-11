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
import { User, UserRole, Event, EventStatus, Order, OrderStatus, Ticket, VenueSection, Seat, SeatStatus, OrganizerPayout } from '../database/entities';
import { RecordOrganizerPayoutDto } from './dto/record-organizer-payout.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(VenueSection) private readonly sectionRepo: Repository<VenueSection>,
    @InjectRepository(Seat) private readonly seatRepo: Repository<Seat>,
    @InjectRepository(OrganizerPayout) private readonly organizerPayoutRepo: Repository<OrganizerPayout>,
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
    const cached = await this.cache.get<any>('admin:stats');
    if (cached) return cached;

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

    const result = {
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
    await this.cache.set('admin:stats', result, 60_000);
    return result;
  }

  /**
   * Per-event financial breakdown (paid orders): total charged, ticket sales,
   * LPTicket fees, estimated Stripe fees and net profit — one row per event.
   */
  async getEventsFinancials() {
    const cached = await this.cache.get<any>('admin:financials');
    if (cached) return cached;

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
      select: ['id', 'title', 'slug', 'status', 'eventDate', 'eventTimezone'],
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
        eventTimezone: ev.eventTimezone,
        totalCharged,
        ticketSales,
        serviceFees,
        stripeFees,
        lpticketProfit,
        ticketsSold,
        orders,
      };
    });

    const response = { events: result, stripePercent: STRIPE_PERCENT, stripeFixed: STRIPE_FIXED };
    await this.cache.set('admin:financials', response, 60_000);
    return response;
  }

  /**
   * Admin-only audit view for one event. The expected ticket quantity always
   * comes from paid orders; issued tickets are counted separately so legacy
   * duplicate issuance is visible instead of inflating financial totals.
   */
  async getEventFinancialDetail(eventId: string) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const [orders, eventTickets, lockedSeats, organizerPayouts] = await Promise.all([
      this.orderRepo.find({
        where: { eventId, status: OrderStatus.PAID },
        relations: ['user'],
        order: { paidAt: 'DESC', createdAt: 'DESC' },
      }),
      this.ticketRepo.find({
        where: { eventId },
        order: { createdAt: 'ASC' },
      }),
      this.seatRepo
        .createQueryBuilder('seat')
        .innerJoin('seat.section', 'section')
        .where('section.eventId = :eventId', { eventId })
        .andWhere('seat.status = :status', { status: SeatStatus.LOCKED })
        .getCount(),
      this.organizerPayoutRepo.find({
        where: { eventId },
        relations: ['recordedBy'],
        order: { paidAt: 'DESC' },
      }),
    ]);

    const paidOrderIds = new Set(orders.map((order) => order.id));
    const paidTickets = eventTickets.filter((ticket) => paidOrderIds.has(ticket.orderId));
    const activeIssuedTickets = paidTickets.filter((ticket) => ticket.status !== 'cancelled');
    const ticketsByOrder = new Map<string, Ticket[]>();
    activeIssuedTickets.forEach((ticket) => {
      const items = ticketsByOrder.get(ticket.orderId) || [];
      items.push(ticket);
      ticketsByOrder.set(ticket.orderId, items);
    });

    const expectedTickets = orders.reduce((sum, order) => sum + Number(order.ticketCount || 0), 0);
    const issuedTickets = activeIssuedTickets.length;
    const ticketRevenue = orders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
    const lpFees = orders.reduce((sum, order) => sum + Number(order.lpFee || 0), 0);
    const processingFees = orders.reduce((sum, order) => sum + Number(order.processingFee || 0), 0);
    const grossCharged = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const scannedTickets = activeIssuedTickets.filter((ticket) => ticket.status === 'used').length;
    const pendingTickets = activeIssuedTickets.filter((ticket) => ticket.status === 'active').length;
    const cancelledTickets = paidTickets.filter((ticket) => ticket.status === 'cancelled').length;
    const buyers = new Set(orders.map((order) => order.userId)).size;
    const organizerPaid = organizerPayouts.reduce((sum, payout) => sum + Number(payout.amount || 0), 0);
    const organizerPending = Math.max(0, +(ticketRevenue - organizerPaid).toFixed(2));

    const sectionMap = new Map<string, { name: string; issued: number; scanned: number; pending: number }>();
    activeIssuedTickets.forEach((ticket) => {
      const name = ticket.sectionName || 'General';
      const entry = sectionMap.get(name) || { name, issued: 0, scanned: 0, pending: 0 };
      entry.issued += 1;
      if (ticket.status === 'used') entry.scanned += 1;
      if (ticket.status === 'active') entry.pending += 1;
      sectionMap.set(name, entry);
    });

    return {
      event: {
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        eventTimezone: event.eventTimezone,
        venueName: event.venueName,
        currency: event.currency || 'USD',
        organizer: event.organizer ? this.toSafeOrganizer(event.organizer) : null,
      },
      summary: {
        paidOrders: orders.length,
        buyers,
        expectedTickets,
        issuedTickets,
        extraIssuedTickets: Math.max(issuedTickets - expectedTickets, 0),
        missingTickets: Math.max(expectedTickets - issuedTickets, 0),
        cancelledTickets,
        scannedTickets,
        pendingTickets,
        lockedSeats,
        ticketRevenue,
        lpFees,
        processingFees,
        grossCharged,
        organizerPaid: +organizerPaid.toFixed(2),
        organizerPending,
      },
      sections: Array.from(sectionMap.values()).sort((a, b) => b.issued - a.issued),
      organizerPayouts: organizerPayouts.map((payout) => ({
        id: payout.id,
        amount: Number(payout.amount),
        note: payout.note,
        paidAt: payout.paidAt,
        recordedBy: payout.recordedBy ? this.toSafeOrganizer(payout.recordedBy) : null,
      })),
      orders: orders.map((order) => {
        const issued = ticketsByOrder.get(order.id) || [];
        const prices = issued.reduce<Record<string, number>>((acc, ticket) => {
          const key = Number(ticket.price || 0).toFixed(2);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        return {
          id: order.id,
          paidAt: order.paidAt || order.createdAt,
          buyer: order.user ? this.toSafeOrganizer(order.user) : null,
          expectedTickets: Number(order.ticketCount || 0),
          issuedTickets: issued.length,
          extraIssuedTickets: Math.max(issued.length - Number(order.ticketCount || 0), 0),
          subtotal: Number(order.subtotal || 0),
          lpFee: Number(order.lpFee || 0),
          processingFee: Number(order.processingFee || 0),
          total: Number(order.total || 0),
          salesChannel: order.salesChannel || null,
          ticketPrices: prices,
        };
      }),
    };
  }

  /**
   * Audits an external payout after the administrator has already paid it.
   * It never creates a transfer, charges Stripe, or changes order/ticket data.
   */
  async recordOrganizerPayout(eventId: string, dto: RecordOrganizerPayoutDto, recordedByUserId: string) {
    const amount = Number(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0.');
    }

    return this.organizerPayoutRepo.manager.transaction(async (manager) => {
      const event = await manager.getRepository(Event).findOne({
        where: { id: eventId },
        relations: ['organizer'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!event) throw new NotFoundException('Evento no encontrado.');
      if (!event.organizerId) throw new BadRequestException('Este evento no tiene un organizador asignado.');

      const revenueRow = await manager.getRepository(Order)
        .createQueryBuilder('order')
        .select('COALESCE(SUM(order.subtotal), 0)', 'ticketRevenue')
        .where('order.eventId = :eventId', { eventId })
        .andWhere('order.status = :status', { status: OrderStatus.PAID })
        .getRawOne();
      const ticketRevenue = Number(revenueRow?.ticketRevenue || 0);

      const paidRow = await manager.getRepository(OrganizerPayout)
        .createQueryBuilder('payout')
        .select('COALESCE(SUM(payout.amount), 0)', 'totalPaid')
        .where('payout.eventId = :eventId', { eventId })
        .getRawOne();
      const pending = Math.max(0, +(ticketRevenue - Number(paidRow?.totalPaid || 0)).toFixed(2));

      if (amount > pending + 0.001) {
        throw new BadRequestException('El pago no puede ser mayor al saldo pendiente del organizador.');
      }

      return manager.getRepository(OrganizerPayout).save(
        manager.getRepository(OrganizerPayout).create({
          eventId,
          organizerUserId: event.organizerId,
          recordedByUserId,
          amount: +amount.toFixed(2),
          note: dto.note?.trim() || null,
        }),
      );
    });
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
