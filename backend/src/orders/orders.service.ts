import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');
import { Order, OrderStatus, Ticket, TicketStatus, Seat, SeatStatus, Event, VenueSection } from '../database/entities';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import { MailService } from '../common/services/mail.service';

const LPTICKET_FEE_RATE = 0.12; // 12%
const STRIPE_PERCENTAGE = 0.029; // 2.9%
const STRIPE_FIXED = 0.30; // $0.30

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
    console.log('Stripe Key Loaded:', key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'MISSING');
    this.stripe = new Stripe(key || '', {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

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
      // JSON parse fallback
    }
    return defaultPrice;
  }

  async createCheckoutSession(
    userId: string,
    eventId: string,
    seatIds: string[],
    sectionId?: string,
    quantity?: number,
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    let baseTotal = 0;
    let lineItems: any[] = [];
    const seatsInfo: {
      seatId: string;
      sectionId: string;
      sectionName: string;
      rowLabel: string;
      seatNumber: number;
      price: number;
    }[] = [];

    if (seatIds && seatIds.length > 0) {
      // Seated event — get price from each seat's section
      for (const seatId of seatIds) {
        const seat = await this.seatRepo.findOne({
          where: { id: seatId },
          relations: ['section'],
        });
        if (!seat) throw new NotFoundException('Asiento no encontrado');
        if (seat.status === SeatStatus.SOLD) throw new BadRequestException('Asiento ya vendido');

        const price = this.getSeatPrice(seat);
        baseTotal += price;
        seatsInfo.push({
          seatId: seat.id,
          sectionId: seat.sectionId,
          sectionName: seat.section.name,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          price,
        });
      }
    } else if (sectionId && quantity) {
      // Standing/general admission
      const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
      if (!section) throw new NotFoundException('Sección no encontrada');

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
        });
      }
    }

    // Calculate fees & taxes
    let lpFee = 0;
    let processingFee = 0;
    let total = 0;

    if (baseTotal > 0) {
      lpFee = Math.round(baseTotal * LPTICKET_FEE_RATE * 100) / 100;
      const subtotalWithLp = baseTotal + lpFee;
      // Stripe processing fee calculates backwards so the organizer gets exactly baseTotal + lpFee
      // Total = (Subtotal + 0.30) / (1 - 0.029)
      const exactTotal = (subtotalWithLp + STRIPE_FIXED) / (1 - STRIPE_PERCENTAGE);
      total = Math.round(exactTotal * 100) / 100;
      processingFee = Math.round((total - subtotalWithLp) * 100) / 100;
    }

    const currency = (event.currency || 'USD').toLowerCase();

    // Build Stripe line items
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
          product_data: { name: 'LPTicket Fee (12%)' },
          unit_amount: Math.round(lpFee * 100),
        },
        quantity: 1,
      });
    }

    if (processingFee > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'Processing Fee (Stripe)' },
          unit_amount: Math.round(processingFee * 100),
        },
        quantity: 1,
      });
    }

    // Create order in DB
    const order = this.orderRepo.create({
      userId,
      eventId,
      subtotal: baseTotal,
      lpFee,
      processingFee,
      total,
      status: OrderStatus.PENDING,
      ticketCount: seatsInfo.length,
    });
    const savedOrder = await this.orderRepo.save(order);

    const rawAppUrl = this.configService.get('APP_URL');
    // Force production URL if we are on Render, otherwise fallback
    const appUrl = rawAppUrl && !rawAppUrl.includes('localhost') 
      ? (rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`)
      : 'https://ticketsystem-jzgf.onrender.com'; // Your Render Frontend URL

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${appUrl.replace(/\/$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl.replace(/\/$/, '')}/checkout/cancel`,
      metadata: {
        orderId: savedOrder.id,
        userId,
        eventId,
        seatsInfo: JSON.stringify(seatsInfo),
      },
    });

    await this.orderRepo.update(savedOrder.id, { stripeSessionId: session.id });

    return {
      sessionId: session.id,
      url: session.url,
      // Also return full invoice breakdown for frontend display
      invoice: {
        baseTotal,
        lpFee,
        processingFee,
        total,
        seatsInfo,
      },
    };
  }

  // Compute invoice preview WITHOUT creating an order (for wizard step 4)
  async previewInvoice(
    eventId: string,
    seatIds: string[],
    sectionId?: string,
    quantity?: number,
  ) {
    let baseTotal = 0;
    const seatsInfo: any[] = [];

    if (seatIds && seatIds.length > 0) {
      for (const seatId of seatIds) {
        const seat = await this.seatRepo.findOne({
          where: { id: seatId },
          relations: ['section'],
        });
        if (!seat) throw new NotFoundException('Asiento no encontrado');
        const price = this.getSeatPrice(seat);
        baseTotal += price;
        seatsInfo.push({
          seatId: seat.id,
          sectionId: seat.sectionId,
          sectionName: seat.section.name,
          rowLabel: seat.rowLabel,
          seatNumber: seat.seatNumber,
          price,
        });
      }
    } else if (sectionId && quantity) {
      const section = await this.sectionRepo.findOne({ where: { id: sectionId } });
      if (!section) throw new NotFoundException('Sección no encontrada');
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
        });
      }
    }

    let lpFee = 0;
    let processingFee = 0;
    let total = 0;

    if (baseTotal > 0) {
      lpFee = Math.round(baseTotal * LPTICKET_FEE_RATE * 100) / 100;
      const subtotalWithLp = baseTotal + lpFee;
      const exactTotal = (subtotalWithLp + STRIPE_FIXED) / (1 - STRIPE_PERCENTAGE);
      total = Math.round(exactTotal * 100) / 100;
      processingFee = Math.round((total - subtotalWithLp) * 100) / 100;
    }

    return {
      baseTotal,
      lpFee,
      processingFee,
      total,
      seatsInfo,
    };
  }

  async handleStripeWebhook(event: any) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const orderId = session.metadata?.orderId;

      if (!orderId) return;

      const order = await this.orderRepo.findOne({ where: { id: orderId } });
      if (!order || order.status !== OrderStatus.PENDING) return;

      await this.orderRepo.update(orderId, {
        status: OrderStatus.PAID,
        stripePaymentIntent: session.payment_intent as string,
      });

      const seatsInfo = JSON.parse(session.metadata?.seatsInfo || '[]');

      const createdTickets: any[] = [];
      for (const seatInfo of seatsInfo) {
        const ticketCode = nanoid(12).toUpperCase();
        const appUrl = this.configService.get('APP_URL');
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

        if (seatInfo.seatId) {
          await this.seatRepo.update(seatInfo.seatId, {
            status: SeatStatus.SOLD,
            lockedBy: null as any,
            lockExpiresAt: null as any,
          });
        }
      }

      // Send Email
      try {
        const fullOrder = await this.orderRepo.findOne({
          where: { id: orderId },
          relations: ['user', 'event'],
        });
        if (fullOrder && fullOrder.user) {
          await this.mailService.sendTicketEmail(
            fullOrder.user.email,
            fullOrder.user.firstName,
            fullOrder.event.title,
            createdTickets,
          );
        }
      } catch (err) {
        console.error('Error in post-payment email:', err);
      }
    }
  }

  async getUserOrders(userId: string) {
    return this.orderRepo.find({
      where: { userId },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserTickets(userId: string) {
    return this.ticketRepo.find({
      where: { userId },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTicketByCode(code: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { ticketCode: code },
      relations: ['event', 'user'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  async validateTicket(code: string) {
    const ticket = await this.getTicketByCode(code);
    if (ticket.status === TicketStatus.USED) {
      return { valid: false, message: 'Este ticket ya fue utilizado', ticket };
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      return { valid: false, message: 'Este ticket fue cancelado', ticket };
    }
    await this.ticketRepo.update(ticket.id, { status: TicketStatus.USED });
    return { valid: true, message: 'Ticket válido — entrada confirmada', ticket };
  }

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

  async getEventAttendees(eventId: string) {
    return this.ticketRepo.find({
      where: { eventId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getOrderById(orderId: string) {
    return this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['event', 'user'],
    });
  }

  async toggleBlockSeat(seatId: string, userId: string) {
    const seat = await this.seatRepo.findOne({ where: { id: seatId }, relations: ['section', 'section.event'] });
    if (!seat) throw new NotFoundException('Asiento no encontrado');
    
    // Check if user is organizer or admin
    if (seat.section.event.organizerId !== userId) {
      const user = await this.eventRepo.manager.findOne('User' as any, { where: { id: userId } }) as any;
      if (user?.role !== 'admin') {
        throw new ForbiddenException('No tienes permiso para bloquear asientos de este evento');
      }
    }

    if (seat.status === SeatStatus.SOLD) {
      throw new BadRequestException('El asiento ya fue vendido y no puede bloquearse');
    }

    if (seat.status === SeatStatus.LOCKED && !seat.lockExpiresAt) {
      // It is permanently locked, let's unlock it!
      seat.status = SeatStatus.AVAILABLE;
      seat.lockedBy = null as any;
      seat.lockExpiresAt = null as any;
    } else {
      // Lock it permanently (lockExpiresAt: null)
      seat.status = SeatStatus.LOCKED;
      seat.lockedBy = userId;
      seat.lockExpiresAt = null as any;
    }

    await this.seatRepo.save(seat);
    return { status: seat.status, message: seat.status === SeatStatus.LOCKED ? 'Asiento bloqueado permanentemente' : 'Asiento desbloqueado' };
  }

  async issueFreeTickets(eventId: string, seatIds: string[], email: string, name: string, organizerId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    
    // Check permission
    if (event.organizerId !== organizerId) {
      const user = await this.eventRepo.manager.findOne('User' as any, { where: { id: organizerId } }) as any;
      if (user?.role !== 'admin') {
        throw new ForbiddenException('No tienes permiso para emitir invitaciones para este evento');
      }
    }

    // Find or create user by email
    let recipientUser = await this.eventRepo.manager.findOne('User' as any, { where: { email } }) as any;
    if (!recipientUser) {
      // Create a dummy user
      const [firstName, ...lastNameParts] = name.split(' ');
      const lastName = lastNameParts.join(' ') || 'Invitado';
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

    // 1. Create a dummy Order of status PAID with total = 0
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
      if (!seat) throw new NotFoundException('Asiento no encontrado');

      // Change status to SOLD
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
        price: 0, // Free ticket
        status: TicketStatus.ACTIVE,
      });
      const savedTicket = await this.ticketRepo.save(ticket);
      createdTickets.push(savedTicket);
    }

    // Send Email notification using template service
    try {
      await this.mailService.sendTicketEmail(email, name, event.title, createdTickets);
    } catch (e) {
      console.error('Error sending free ticket email:', e);
    }

    return { success: true, count: createdTickets.length, tickets: createdTickets };
  }
}
