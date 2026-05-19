import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');
import { Order, OrderStatus, Ticket, TicketStatus, Seat, SeatStatus, Event, VenueSection } from '../database/entities';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import { MailService } from '../common/services/mail.service';

/**
 * Service constants for fee calculation.
 */
const LPTICKET_FEE_RATE = 0.12; // 12% platform fee
const STRIPE_PERCENTAGE = 0.029; // 2.9% Stripe variable fee
const STRIPE_FIXED = 0.30; // $0.30 Stripe fixed fee per transaction

/**
 * OrdersService
 * Core logic for managing orders, payments via Stripe, ticket issuance, 
 * and ticket validation (scanning).
 */
@Injectable()
export class OrdersService {
  private stripe: any;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(VenueSection)
    private readonly sectionRepo: Repository<VenueSection>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const key = this.configService.get('STRIPE_SECRET_KEY');
    // Log key presence for debugging (masking sensitive data)
    console.log('Stripe Key Loaded:', key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'MISSING - Stripe payments will be disabled');
    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2024-12-18.acacia' as any,
      });
    }
  }

  /**
   * Helper to retrieve a seat's price, checking for specific price overrides
   * in the section's JSON configuration.
   * @param seat The seat entity to price
   */
  getSeatPrice(seat: Seat): number {
    const defaultPrice = Number(seat.section.price);
    try {
      if (!seat.section.seatsConfig) return defaultPrice;
      const config = JSON.parse(seat.section.seatsConfig);
      
      let seatKey = '';
      if (seat.rowLabel && seat.rowLabel !== 'GA') {
        seatKey = `${seat.rowLabel}-${seat.seatNumber}`;
      } else {
        seatKey = `seat-${seat.seatNumber}`;
      }

      const override = config[seatKey];
      if (override && override.price !== undefined && override.price !== null) {
        return Number(override.price);
      }
    } catch (e) {
      // Silently fall back to default price if JSON is invalid
    }
    return defaultPrice;
  }

  /**
   * Main entry point for creating a Stripe Checkout Session.
   * Handles:
   * 1. Seat/Standing availability validation
   * 2. Temporal seat locking (reservation)
   * 3. Fee & Total calculation (including Stripe backwards math)
   * 4. Order creation in PENDING state
   * 5. Stripe Session generation
   */
  async createCheckoutSession(
    userId: string,
    eventId: string,
    seatIds: string[],
    sectionId?: string,
    quantity?: number,
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const maxLimit = event.maxTicketsPerTransaction || 10;
    if (seatIds && seatIds.length > maxLimit) {
      throw new BadRequestException(`No puedes seleccionar más de ${maxLimit} asientos por transacción.`);
    }
    if (quantity && quantity > maxLimit) {
      throw new BadRequestException(`No puedes comprar más de ${maxLimit} entradas por transacción.`);
    }

    let baseTotal = 0;
    let lineItems: any[] = [];
    const seatsInfo: {
      seatId: string;
      sectionId: string;
      sectionName: string;
      sectionType: string;
      rowLabel: string;
      seatNumber: number;
      price: number;
      section?: any;
    }[] = [];

    if (seatIds && seatIds.length > 0) {
      // Logic for Numbered/Seated events
      for (const seatId of seatIds) {
        const seat = await this.seatRepo.findOne({
          where: { id: seatId },
          relations: ['section'],
        });
        if (!seat) throw new NotFoundException('Seat not found');
        if (seat.status === SeatStatus.SOLD) throw new BadRequestException('Seat already sold');

        // Enforcement of "Whole Table" purchase logic if applicable
        if (seat.section.sectionType === 'table' && seat.section.tablePurchaseMode === 'whole') {
          const tableSeats = await this.seatRepo.find({
            where: { sectionId: seat.sectionId },
          });
          const overrides = seat.section.seatsConfig ? JSON.parse(seat.section.seatsConfig) : {};
          const availableTableSeats = tableSeats.filter(s => {
            const key = `seat-${s.seatNumber}`;
            const isReserved = overrides[key]?.reserved || false;
            const isDisabled = overrides[key]?.disabled || false;
            if (isDisabled || isReserved) return false;
            if (s.status === SeatStatus.SOLD) return false;
            if (s.status === SeatStatus.LOCKED && s.lockedBy !== userId && s.lockExpiresAt && new Date() < s.lockExpiresAt) {
              return false;
            }
            return true;
          });
          const missingSeatIds = availableTableSeats.filter(s => !seatIds.includes(s.id));
          if (missingSeatIds.length > 0) {
            throw new BadRequestException(
              `The table "${seat.section.name}" must be purchased entirely. You must select all available seats.`
            );
          }
        }

        // Verify lock status
        if (
          seat.status === SeatStatus.LOCKED &&
          seat.lockedBy !== userId &&
          seat.lockExpiresAt &&
          new Date() < seat.lockExpiresAt
        ) {
          throw new BadRequestException('Seat reserved by another user');
        }

        // Extend seat lock for 31 minutes (30 min Stripe session + 1 min buffer)
        seat.status = SeatStatus.LOCKED;
        seat.lockedBy = userId;
        seat.lockExpiresAt = new Date(Date.now() + 31 * 60 * 1000); 
        await this.seatRepo.save(seat);

        const price = this.getSeatPrice(seat);
        baseTotal += price;
        seatsInfo.push({
          seatId: seat.id,
          sectionId: seat.sectionId,
          sectionName: seat.section.name,
          sectionType: seat.section.sectionType,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          price,
          section: seat.section,
        });
      }
    } else if (sectionId && quantity) {
      // Logic for Standing/General Admission events
      const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
      if (!section) throw new NotFoundException('Section not found');

      // Check capacity constraints
      if (section.capacity && section.capacity > 0) {
        const { In } = require('typeorm');
        const soldTicketsCount = await this.ticketRepo.count({
          where: {
            sectionId: section.id,
            status: In([TicketStatus.ACTIVE, TicketStatus.USED])
          }
        });
        
        if (soldTicketsCount + quantity > section.capacity) {
          throw new BadRequestException(`Capacity reached. Only ${section.capacity - soldTicketsCount} tickets available in this section.`);
        }
      }

      const price = Number(section.price);
      baseTotal = price * quantity;

      for (let i = 0; i < quantity; i++) {
        seatsInfo.push({
          seatId: '',
          sectionId: section.id,
          sectionName: section.name,
          sectionType: section.sectionType,
          rowLabel: 'GA',
          seatNumber: i + 1,
          price,
          section,
        });
      }
    }

    // --- Complex Fee Calculations ---
    let lpFee = 0;
    let processingFee = 0;
    let total = 0;

    if (baseTotal > 0) {
      let totalServiceFee = 0;
      let totalProcessingFee = 0;

      for (const item of seatsInfo) {
        const sec = item.section;
        const sFeePercent = sec?.serviceFeePercent !== null && sec?.serviceFeePercent !== undefined 
          ? Number(sec.serviceFeePercent) 
          : (event?.serviceFeePercent !== null && event?.serviceFeePercent !== undefined ? Number(event.serviceFeePercent) : 0.12);

        const sFeeFixed = sec?.serviceFeeFixedPerTicket !== null && sec?.serviceFeeFixedPerTicket !== undefined 
          ? Number(sec.serviceFeeFixedPerTicket) 
          : (event?.serviceFeeFixedPerTicket !== null && event?.serviceFeeFixedPerTicket !== undefined ? Number(event.serviceFeeFixedPerTicket) : 0);

        const pFeePercent = sec?.processingFeePercent !== null && sec?.processingFeePercent !== undefined 
          ? Number(sec.processingFeePercent) 
          : (event?.processingFeePercent !== null && event?.processingFeePercent !== undefined ? Number(event.processingFeePercent) : 0.029);

        const pFeeFixed = sec?.processingFeeFixedPerTicket !== null && sec?.processingFeeFixedPerTicket !== undefined 
          ? Number(sec.processingFeeFixedPerTicket) 
          : (event?.processingFeeFixedPerTicket !== null && event?.processingFeeFixedPerTicket !== undefined ? Number(event.processingFeeFixedPerTicket) : 0.30);

        totalServiceFee += item.price * sFeePercent + sFeeFixed;
        totalProcessingFee += item.price * pFeePercent + pFeeFixed;
      }

      lpFee = Math.round(totalServiceFee * 100) / 100;
      processingFee = Math.round(totalProcessingFee * 100) / 100;
      total = Math.round((baseTotal + lpFee + processingFee) * 100) / 100;
    }

    const cleanSeatsInfo = seatsInfo.map(({ section, ...rest }) => rest);

    const currency = (event.currency || 'USD').toLowerCase();

    // Prepare line items for Stripe UI
    lineItems = [
      {
        price_data: {
          currency,
          product_data: {
            name: event.title,
            description: seatsInfo.length > 0
              ? `${seatsInfo.length} ticket(s) — ${seatsInfo.map(s => `${s.sectionName} ${s.rowLabel}${s.seatNumber}`).join(', ')}`
              : `${quantity}x tickets`,
          },
          unit_amount: Math.round(baseTotal * 100),
        },
        quantity: 1,
      },
    ];

    if (lpFee > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'Cargo por servicio' },
          unit_amount: Math.round(lpFee * 100),
        },
        quantity: 1,
      });
    }

    if (processingFee > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'Tarifa de procesamiento' },
          unit_amount: Math.round(processingFee * 100),
        },
        quantity: 1,
      });
    }

    // Persist order in DB
    const order = this.orderRepo.create({
      userId,
      eventId,
      subtotal: baseTotal,
      lpFee,
      processingFee,
      total,
      status: OrderStatus.PENDING,
      ticketCount: cleanSeatsInfo.length,
      seatsData: JSON.stringify(cleanSeatsInfo),
    });
    const savedOrder = await this.orderRepo.save(order);

    // Determine correct redirect URL based on environment
    const rawAppUrl = this.configService.get('APP_URL');
    const appUrl = rawAppUrl && !rawAppUrl.includes('localhost') 
      ? (rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`)
      : 'https://ticketsystem-jzgf.onrender.com';

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), 
      success_url: `${appUrl.replace(/\/$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl.replace(/\/$/, '')}/checkout/cancel`,
      metadata: {
        orderId: savedOrder.id,
        userId,
        eventId,
      },
    });

    await this.orderRepo.update(savedOrder.id, { stripeSessionId: session.id });

    return {
      sessionId: session.id,
      url: session.url,
      invoice: {
        baseTotal,
        lpFee,
        processingFee,
        total,
        seatsInfo: cleanSeatsInfo,
      },
    };
  }

  /**
   * Generates an invoice preview for display in the frontend wizard.
   * Identical logic to session creation but without database side-effects.
   */
  async previewInvoice(
    eventId: string,
    seatIds: string[],
    sectionId?: string,
    quantity?: number,
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const maxLimit = event.maxTicketsPerTransaction || 10;
    if (seatIds && seatIds.length > maxLimit) {
      throw new BadRequestException(`No puedes seleccionar más de ${maxLimit} asientos por transacción.`);
    }
    if (quantity && quantity > maxLimit) {
      throw new BadRequestException(`No puedes comprar más de ${maxLimit} entradas por transacción.`);
    }

    let baseTotal = 0;
    const seatsInfo: any[] = [];

    if (seatIds && seatIds.length > 0) {
      for (const seatId of seatIds) {
        const seat = await this.seatRepo.findOne({
          where: { id: seatId },
          relations: ['section'],
        });
        if (!seat) throw new NotFoundException('Seat not found');

        // Check for table purchase constraints
        if (seat.section.sectionType === 'table' && seat.section.tablePurchaseMode === 'whole') {
          const tableSeats = await this.seatRepo.find({
            where: { sectionId: seat.sectionId },
          });
          const overrides = seat.section.seatsConfig ? JSON.parse(seat.section.seatsConfig) : {};
          const availableTableSeats = tableSeats.filter(s => {
            const key = `seat-${s.seatNumber}`;
            const isReserved = overrides[key]?.reserved || false;
            const isDisabled = overrides[key]?.disabled || false;
            if (isDisabled || isReserved) return false;
            if (s.status === SeatStatus.SOLD) return false;
            return true;
          });
          const missingSeatIds = availableTableSeats.filter(s => !seatIds.includes(s.id));
          if (missingSeatIds.length > 0) {
            throw new BadRequestException(
              `Table "${seat.section.name}" is sold as a whole. Select all available seats.`
            );
          }
        }

        const price = this.getSeatPrice(seat);
        baseTotal += price;
        seatsInfo.push({
          seatId: seat.id,
          sectionId: seat.sectionId,
          sectionName: seat.section.name,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          price,
          section: seat.section,
        });
      }
    } else if (sectionId && quantity) {
      const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
      if (!section) throw new NotFoundException('Section not found');
      const price = Number(section.price);
      baseTotal = price * quantity;
      for (let i = 0; i < quantity; i++) {
        seatsInfo.push({
          seatId: '',
          sectionId: section.id,
          sectionName: section.name,
          rowLabel: 'GA',
          seatNumber: i + 1,
          price,
          section,
        });
      }
    }

    let lpFee = 0;
    let processingFee = 0;
    let total = 0;

    if (baseTotal > 0) {
      let totalServiceFee = 0;
      let totalProcessingFee = 0;

      for (const item of seatsInfo) {
        const sec = item.section;
        const sFeePercent = sec?.serviceFeePercent !== null && sec?.serviceFeePercent !== undefined 
          ? Number(sec.serviceFeePercent) 
          : (event?.serviceFeePercent !== null && event?.serviceFeePercent !== undefined ? Number(event.serviceFeePercent) : 0.12);

        const sFeeFixed = sec?.serviceFeeFixedPerTicket !== null && sec?.serviceFeeFixedPerTicket !== undefined 
          ? Number(sec.serviceFeeFixedPerTicket) 
          : (event?.serviceFeeFixedPerTicket !== null && event?.serviceFeeFixedPerTicket !== undefined ? Number(event.serviceFeeFixedPerTicket) : 0);

        const pFeePercent = sec?.processingFeePercent !== null && sec?.processingFeePercent !== undefined 
          ? Number(sec.processingFeePercent) 
          : (event?.processingFeePercent !== null && event?.processingFeePercent !== undefined ? Number(event.processingFeePercent) : 0.029);

        const pFeeFixed = sec?.processingFeeFixedPerTicket !== null && sec?.processingFeeFixedPerTicket !== undefined 
          ? Number(sec.processingFeeFixedPerTicket) 
          : (event?.processingFeeFixedPerTicket !== null && event?.processingFeeFixedPerTicket !== undefined ? Number(event.processingFeeFixedPerTicket) : 0.30);

        totalServiceFee += item.price * sFeePercent + sFeeFixed;
        totalProcessingFee += item.price * pFeePercent + pFeeFixed;
      }

      lpFee = Math.round(totalServiceFee * 100) / 100;
      processingFee = Math.round(totalProcessingFee * 100) / 100;
      total = Math.round((baseTotal + lpFee + processingFee) * 100) / 100;
    }

    const cleanSeatsInfo = seatsInfo.map(({ section, ...rest }) => rest);

    return {
      baseTotal,
      lpFee,
      processingFee,
      total,
      seatsInfo: cleanSeatsInfo,
    };
  }

  /**
   * Stripe Webhook Handler
   * Listens for 'checkout.session.completed' to:
   * 1. Mark Order as PAID
   * 2. Issue digital Tickets (with QR codes)
   * 3. Permanently mark Seats as SOLD
   * 4. Trigger confirmation email
   */
  async handleStripeWebhook(event: any) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId;

      if (!orderId) return;

      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PENDING) return;

      // Finalize order status
      await this.orderRepo.update(orderId, {
        status: OrderStatus.PAID,
        stripePaymentIntent: session.payment_intent as string,
      });

      const seatsInfo = JSON.parse(order.seatsData || '[]');
      const createdTickets: any[] = [];
      
      // Issue individual tickets for each seat
      for (const seatInfo of seatsInfo) {
        const ticketCode = nanoid(12).toUpperCase();
        const appUrl = this.configService.get('APP_URL');
        // Generate QR code for entry validation
        const qrData = await QRCode.toDataURL(`${appUrl}/verify/${ticketCode}`);

        const ticket = this.ticketRepo.create({
          ticketCode,
          orderId,
          eventId: order.eventId,
          userId: order.userId,
          seatId: seatInfo.seatId || null,
          sectionId: seatInfo.sectionId,
          sectionName: seatInfo.sectionName,
          rowLabel: seatInfo.rowLabel,
          seatNumber: seatInfo.seatNumber,
          qrData,
          price: seatInfo.price,
          status: TicketStatus.ACTIVE,
        });
        const savedTicket = await this.ticketRepo.save(ticket);
        createdTickets.push(savedTicket);

        // Permanently occupy the seat in the venue
        if (seatInfo.seatId) {
          await this.seatRepo.update(seatInfo.seatId, {
            status: SeatStatus.SOLD,
            lockedBy: null as any,
            lockExpiresAt: null as any,
          });
        }
      }

      // Send Email with QR codes
      try {
        const fullOrder = await this.orderRepo.findOne({
          where: { id: orderId },
          relations: ['user', 'event'],
        });
        if (fullOrder && fullOrder.user) {
          const buyerEmail = session.customer_details?.email || fullOrder.user.email;
          const buyerName = session.customer_details?.name || fullOrder.user.firstName;
          await this.mailService.sendTicketEmail(
            buyerEmail,
            buyerName,
            fullOrder.event.title,
            createdTickets,
            {
              venueName: fullOrder.event.venueName,
              venueAddress: fullOrder.event.venueAddress,
            },
          );
        }
      } catch (err) {
        console.error('Error in post-payment email:', err);
      }
    }
  }

  /**
   * Retrieves all orders for a specific user.
   */
  async getUserOrders(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { userId },
      relations: ['event'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      data: orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves all tickets for a specific user, optionally filtered by Stripe Session ID.
   */
  async getUserTickets(userId: string, sessionId?: string, page: number = 1, limit: number = 12) {
    const where: any = { userId };
    if (sessionId) {
      const order = await this.orderRepo.findOne({ where: { stripeSessionId: sessionId } });
      if (order) {
        where.orderId = order.id;
      }
    }
    const skip = (page - 1) * limit;
    const [tickets, total] = await this.ticketRepo.findAndCount({
      where,
      relations: ['event'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      data: tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Finds a ticket by its unique public code (used for scanning).
   */
  async getTicketByCode(code: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { ticketCode: code },
      relations: ['event', 'user'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  /**
   * Validates a ticket (Scanning Logic).
   * Ensures the user has permission to scan and that the ticket hasn't been used.
   */
  async validateTicket(code: string, user: any) {
    const ticket = await this.getTicketByCode(code);
    
    // Authorization: Only admins or the event's organizer can scan
    if (user.role !== 'admin' && ticket.event.organizerId !== user.id) {
      throw new ForbiddenException('You do not have permission to validate tickets for this event');
    }

    if (ticket.status === TicketStatus.USED) {
      return { valid: false, message: 'This ticket has already been used', ticket };
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      return { valid: false, message: 'This ticket was cancelled', ticket };
    }
    
    // Mark as USED to prevent double-entry
    await this.ticketRepo.update(ticket.id, { status: TicketStatus.USED });
    return { valid: true, message: 'Valid Ticket — entry confirmed', ticket };
  }

  /**
   * Aggregate sales data for an event.
   */
  async getEventSales(eventId: string) {
    const orders = await this.orderRepo.find({
      where: { eventId, status: OrderStatus.PAID },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalTickets = orders.reduce((sum, o) => sum + o.ticketCount, 0);
    return { orders, totalRevenue, totalTickets, totalOrders: orders.length };
  }

  /**
   * Retrieves list of attendees for an event.
   */
  async getEventAttendees(eventId: string) {
    return this.ticketRepo.find({
      where: { eventId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Finds a detailed order by ID.
   */
  async getOrderById(orderId: string) {
    return this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['event', 'user'],
    });
  }

  /**
   * Organizer tool to manually block/unblock a seat (e.g., for physical sale or guest list).
   */
  async toggleBlockSeat(seatId: string, userId: string) {
    const seat = await this.seatRepo.findOne({ where: { id: seatId }, relations: ['section', 'section.event'] });
    if (!seat) throw new NotFoundException('Seat not found');
    
    // Authorization check
    if (seat.section.event.organizerId !== userId) {
      const user = await this.eventRepo.manager.findOne('User' as any, { where: { id: userId } }) as any;
      if (user?.role !== 'admin') {
        throw new ForbiddenException('No permission to block seats for this event');
      }
    }

    if (seat.status === SeatStatus.SOLD) {
      throw new BadRequestException('Seat is already sold and cannot be blocked');
    }

    if (seat.status === SeatStatus.LOCKED && !seat.lockExpiresAt) {
      // Release permanent lock
      seat.status = SeatStatus.AVAILABLE;
      seat.lockedBy = null as any;
      seat.lockExpiresAt = null as any;
    } else {
      // Apply permanent lock (null expiry)
      seat.status = SeatStatus.LOCKED;
      seat.lockedBy = userId;
      seat.lockExpiresAt = null as any;
    }

    await this.seatRepo.save(seat);
    return { status: seat.status, message: seat.status === SeatStatus.LOCKED ? 'Seat blocked permanently' : 'Seat unblocked' };
  }

  /**
   * Organizer tool to issue free tickets (Invitations).
   * Creates a dummy PAID order with $0 total and sends QR tickets to recipient.
   */
  async issueFreeTickets(eventId: string, seatIds: string[], email: string, name: string, organizerId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    
    // Permission validation
    if (event.organizerId !== organizerId) {
      const user = await this.eventRepo.manager.findOne('User' as any, { where: { id: organizerId } }) as any;
      if (user?.role !== 'admin') {
        throw new ForbiddenException('No permission to issue invitations for this event');
      }
    }

    // Identify or provision the recipient user
    let recipientUser = await this.eventRepo.manager.findOne('User' as any, { where: { email } }) as any;
    if (!recipientUser) {
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ') || 'Guest';
      const username = `inv_${nanoid(6)}`;
      recipientUser = this.eventRepo.manager.create('User' as any, {
        firstName,
        lastName,
        email,
        username,
        role: 'client',
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      await this.eventRepo.manager.save(recipientUser);
    }

    // Create a Free ($0) Order record
    const order = this.orderRepo.create({
      userId: recipientUser.id,
      eventId,
      subtotal: 0,
      lpFee: 0,
      processingFee: 0,
      total: 0,
      status: OrderStatus.PAID,
      ticketCount: seatIds.length,
    });
    const savedOrder = await this.orderRepo.save(order);
    const orderId = savedOrder.id;

    const createdTickets: any[] = [];
    const rawAppUrl = this.configService.get('APP_URL') || 'http://localhost:3000';
    const appUrl = (rawAppUrl.startsWith('http://') || rawAppUrl.startsWith('https://')) 
      ? rawAppUrl 
      : `https://${rawAppUrl}`;

    for (const seatId of seatIds) {
      const seat = await this.seatRepo.findOne({ where: { id: seatId }, relations: ['section'] });
      if (!seat) throw new NotFoundException('Seat not found');

      seat.status = SeatStatus.SOLD;
      seat.lockedBy = null as any;
      seat.lockExpiresAt = null as any;
      await this.seatRepo.save(seat);

      const ticketCode = nanoid(12).toUpperCase();
      const qrData = await QRCode.toDataURL(`${appUrl}/verify/${ticketCode}`);

      const ticket = this.ticketRepo.create({
        ticketCode,
        orderId,
        eventId,
        userId: recipientUser.id,
        seatId: seat.id,
        sectionId: seat.sectionId,
        sectionName: seat.section.name,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        qrData,
        price: 0,
        status: TicketStatus.ACTIVE,
      });
      const savedTicket = await this.ticketRepo.save(ticket);
      createdTickets.push(savedTicket);
    }

    // Send the invitations via email
    try {
      await this.mailService.sendTicketEmail(email, name, event.title, createdTickets, {
        venueName: event.venueName,
        venueAddress: event.venueAddress,
      });
    } catch (e) {
      console.error('Error sending free ticket email:', e);
    }

    return { success: true, count: createdTickets.length, tickets: createdTickets };
  }

  /**
   * Sends reminder emails to all active ticket holders for an event.
   * Only the event organizer or an admin can trigger this.
   */
  async sendEventReminder(
    eventId: string,
    organizerId: string,
    daysUntilEvent?: number,
    customMessage?: string,
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    let days = daysUntilEvent;
    if (days === undefined || days === null) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const eventDateOnly = new Date(event.eventDate);
      eventDateOnly.setHours(0, 0, 0, 0);

      const timeDiff = eventDateOnly.getTime() - today.getTime();
      days = Math.ceil(timeDiff / (1000 * 3600 * 24));
    }

    // Authorization check
    if (event.organizerId !== organizerId) {
      const user = await this.eventRepo.manager.findOne('User' as any, { where: { id: organizerId } }) as any;
      if (user?.role !== 'admin') {
        throw new ForbiddenException('No permission to send reminders for this event');
      }
    }

    // Get all active ticket holders with their user info
    const { In } = require('typeorm');
    const tickets = await this.ticketRepo.find({
      where: { eventId, status: In([TicketStatus.ACTIVE]) },
      relations: ['user'],
    });

    if (tickets.length === 0) {
      return { success: true, sent: 0, message: 'No active ticket holders found' };
    }

    // De-duplicate by email — send one email per unique attendee
    const seen = new Set<string>();
    const uniqueAttendees: any[] = [];
    for (const t of tickets) {
      if (t.user?.email && !seen.has(t.user.email)) {
        seen.add(t.user.email);
        uniqueAttendees.push(t.user);
      }
    }

    // Format event date for the email
    const eventDateStr = event.eventDate
      ? new Date(event.eventDate).toLocaleDateString('es', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    let sent = 0;
    let errors = 0;
    for (const attendee of uniqueAttendees) {
      try {
        await this.mailService.sendReminderEmail(
          attendee.email,
          attendee.firstName || 'Asistente',
          event.title,
          eventDateStr,
          event.venueName || '',
          event.venueAddress || '',
          days,
          customMessage,
        );
        sent++;
      } catch (e) {
        console.error(`Reminder email failed for ${attendee.email}:`, e);
        errors++;
      }
    }

    return {
      success: true,
      sent,
      errors,
      total: uniqueAttendees.length,
      message: `Recordatorios enviados: ${sent}/${uniqueAttendees.length}`,
    };
  }

  /**
   * Saves the auto-reminder settings for an event.
   */
  async saveReminderSettings(
    eventId: string,
    organizerId: string,
    settings: { autoReminderEnabled: boolean; autoReminderDays: number; autoReminderMessage?: string }
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Authorization check
    if (event.organizerId !== organizerId) {
      const user = await this.eventRepo.manager.findOne('User' as any, { where: { id: organizerId } }) as any;
      if (user?.role !== 'admin') {
        throw new ForbiddenException('No permission to update reminders for this event');
      }
    }

    event.autoReminderEnabled = settings.autoReminderEnabled;
    event.autoReminderDays = settings.autoReminderDays;
    event.autoReminderMessage = settings.autoReminderMessage || null;
    // Reset autoReminderSent if they are enabling it, so it can fire if the date is right
    if (settings.autoReminderEnabled) {
      event.autoReminderSent = false;
    }

    await this.eventRepo.save(event);

    return {
      success: true,
      message: 'Configuración de recordatorio guardada correctamente',
      event,
    };
  }

  /**
   * Cron Job to send automated email reminders for upcoming events.
   * Runs every 30 minutes to support both daily and hourly reminder triggers.
   */
  @Cron('0 */30 * * * *')
  async handleScheduledReminders() {
    console.log('[Cron] Checking scheduled email reminders...');
    const events = await this.eventRepo.find({
      where: {
        autoReminderEnabled: true,
        autoReminderSent: false,
      },
    });

    for (const event of events) {
      try {
        if (event.autoReminderDays < 0) {
          // Hours mode (negative values represent hours)
          const now = new Date();
          const eventTime = new Date(event.eventDate);
          const hoursDifference = (eventTime.getTime() - now.getTime()) / (1000 * 3600);
          const targetHoursBefore = Math.abs(event.autoReminderDays);

          if (hoursDifference >= 0 && hoursDifference <= targetHoursBefore) {
            console.log(`[Cron] Triggering automatic hourly reminder for event: ${event.title} (${hoursDifference.toFixed(2)} hours left)`);
            await this.sendEventReminder(
              event.id,
              event.organizerId,
              event.autoReminderDays, // passes negative number representing hours
              event.autoReminderMessage || undefined,
            );
            event.autoReminderSent = true;
            await this.eventRepo.save(event);
            console.log(`[Cron] Successfully sent hourly reminder and marked event ${event.title} as completed.`);
          }
        } else {
          // Days mode (positive values represent days)
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const eventDateOnly = new Date(event.eventDate);
          eventDateOnly.setHours(0, 0, 0, 0);

          const timeDiff = eventDateOnly.getTime() - today.getTime();
          const daysUntilEvent = Math.ceil(timeDiff / (1000 * 3600 * 24));

          if (daysUntilEvent >= 0 && daysUntilEvent <= event.autoReminderDays) {
            const currentHour = new Date().getHours();
            if (currentHour >= 8) { // Only trigger daily reminder at or after 8:00 AM
              console.log(`[Cron] Triggering automatic daily reminder for event: ${event.title} (${daysUntilEvent} days left)`);
              await this.sendEventReminder(
                event.id,
                event.organizerId,
                daysUntilEvent,
                event.autoReminderMessage || undefined,
              );
              event.autoReminderSent = true;
              await this.eventRepo.save(event);
              console.log(`[Cron] Successfully sent daily reminder and marked event ${event.title} as completed.`);
            }
          }
        }
      } catch (err) {
        console.error(`[Cron] Error processing reminder for event ${event.id}:`, err);
      }
    }
  }
}
