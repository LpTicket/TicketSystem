import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');
import { Order, OrderStatus, Ticket, TicketStatus, Seat, SeatStatus, Event, VenueSection } from '../database/entities';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import { MailService } from '../common/services/mail.service';

const IVA_RATE = 0.16;   // 16%
const IGTF_RATE = 0.03;  // 3%
const SERVICE_FEE_RATE = 0.10; // 10%

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

        const price = Number(seat.section.price);
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
    const serviceFee = Math.round(baseTotal * SERVICE_FEE_RATE * 100) / 100;
    const subtotalWithFees = baseTotal + serviceFee;
    const taxIVA = Math.round(subtotalWithFees * IVA_RATE * 100) / 100;
    const taxIGTF = Math.round(subtotalWithFees * IGTF_RATE * 100) / 100;
    const total = Math.round((subtotalWithFees + taxIVA + taxIGTF) * 100) / 100;

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

    if (serviceFee > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'Cargo por servicio (10%)' },
          unit_amount: Math.round(serviceFee * 100),
        },
        quantity: 1,
      });
    }

    if (taxIVA > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'IVA (16%)' },
          unit_amount: Math.round(taxIVA * 100),
        },
        quantity: 1,
      });
    }

    if (taxIGTF > 0) {
      lineItems.push({
        price_data: {
          currency,
          product_data: { name: 'IGTF (3%)' },
          unit_amount: Math.round(taxIGTF * 100),
        },
        quantity: 1,
      });
    }

    // Create order in DB
    const order = this.orderRepo.create({
      userId,
      eventId,
      subtotal: baseTotal,
      serviceFee,
      taxIVA,
      taxIGTF,
      total,
      status: OrderStatus.PENDING,
      ticketCount: seatsInfo.length,
    });
    const savedOrder = await this.orderRepo.save(order);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${this.configService.get('APP_URL')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.configService.get('APP_URL')}/checkout/cancel`,
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
        serviceFee,
        taxIVA,
        taxIGTF,
        total,
        ivaRate: IVA_RATE,
        igtfRate: IGTF_RATE,
        serviceFeeRate: SERVICE_FEE_RATE,
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
        const price = Number(seat.section.price);
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

    const serviceFee = Math.round(baseTotal * SERVICE_FEE_RATE * 100) / 100;
    const subtotalWithFees = baseTotal + serviceFee;
    const taxIVA = Math.round(subtotalWithFees * IVA_RATE * 100) / 100;
    const taxIGTF = Math.round(subtotalWithFees * IGTF_RATE * 100) / 100;
    const total = Math.round((subtotalWithFees + taxIVA + taxIGTF) * 100) / 100;

    return {
      baseTotal,
      serviceFee,
      subtotalWithFees,
      taxIVA,
      taxIGTF,
      total,
      ivaRate: IVA_RATE,
      igtfRate: IGTF_RATE,
      serviceFeeRate: SERVICE_FEE_RATE,
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
}
