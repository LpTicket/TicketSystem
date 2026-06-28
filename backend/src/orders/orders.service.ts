import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');
import { Order, OrderStatus, Ticket, TicketStatus, Seat, SeatStatus, Event, EventStatus, VenueSection, SpecialCode, ScannerAccess, ScannerAccessStatus, UserRole } from '../database/entities';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import { MailService } from '../common/services/mail.service';
import { isValidEmailFormat, suggestEmailFix } from '../common/utils/email-typo';

/**
 * Service constants for fee calculation.
 */
const LPTICKET_FEE_RATE = 0.12; // 12% platform fee
const STRIPE_PERCENTAGE = 0.029; // 2.9% Stripe variable fee
const STRIPE_FIXED = 0.30; // $0.30 Stripe fixed fee per transaction

/**
 * OrdersService
 * EN: Core logic for managing orders, payments via Stripe, ticket issuance,
 *     ticket validation (scanning), sales/attendee reporting, door sales,
 *     reminders, free invitations and seat blocking. Ownership-checked.
 * ES: Lógica central para gestionar órdenes, pagos vía Stripe, emisión de
 *     tickets, validación de tickets (escaneo), reportes de ventas/asistentes,
 *     ventas en puerta, recordatorios, invitaciones gratis y bloqueo de
 *     asientos. Con verificación de propiedad.
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
    @InjectRepository(SpecialCode)
    private readonly specialCodeRepo: Repository<SpecialCode>,
    @InjectRepository(ScannerAccess)
    private readonly scannerAccessRepo: Repository<ScannerAccess>,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {
    const mode = this.configService.get('STRIPE_MODE') || 'test';
    const key = mode === 'production'
      ? this.configService.get('STRIPE_SECRET_KEY_PROD')
      : (this.configService.get('STRIPE_SECRET_KEY_TEST') || this.configService.get('STRIPE_SECRET_KEY'));
    console.log(`Stripe mode: ${mode} | Key: ${key ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` : 'MISSING'}`);
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

  private async ensureCanSellAtDoor(user: any, eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role === UserRole.ADMIN || event.organizerId === user.id) {
      return event;
    }
    const access = await this.scannerAccessRepo.findOne({
      where: { eventId, userId: user.id, status: ScannerAccessStatus.APPROVED },
    });
    if (!access) {
      throw new ForbiddenException('You do not have permission to sell tickets for this event');
    }
    return event;
  }

  private calculateDoorSaleFees(event: Event, amount: number, quantity: number, section?: VenueSection | null) {
    const safeQuantity = Math.max(1, Math.min(Number(quantity) || 1, event.maxTicketsPerTransaction || 10));
    const unitPrice = Math.max(0, Math.round(Number(amount || 0) * 100) / 100);
    if (unitPrice <= 0) throw new BadRequestException('Ingresa un monto válido.');

    const servicePercent = section?.serviceFeePercent !== null && section?.serviceFeePercent !== undefined
      ? Number(section.serviceFeePercent)
      : (event.serviceFeePercent !== null && event.serviceFeePercent !== undefined ? Number(event.serviceFeePercent) : 0.12);
    const serviceFixed = section?.serviceFeeFixedPerTicket !== null && section?.serviceFeeFixedPerTicket !== undefined
      ? Number(section.serviceFeeFixedPerTicket)
      : (event.serviceFeeFixedPerTicket !== null && event.serviceFeeFixedPerTicket !== undefined ? Number(event.serviceFeeFixedPerTicket) : 0);
    const processingPercent = section?.processingFeePercent !== null && section?.processingFeePercent !== undefined
      ? Number(section.processingFeePercent)
      : (event.processingFeePercent !== null && event.processingFeePercent !== undefined ? Number(event.processingFeePercent) : 0.029);
    const processingFixed = section?.processingFeeFixedPerTicket !== null && section?.processingFeeFixedPerTicket !== undefined
      ? Number(section.processingFeeFixedPerTicket)
      : (event.processingFeeFixedPerTicket !== null && event.processingFeeFixedPerTicket !== undefined ? Number(event.processingFeeFixedPerTicket) : 0.30);

    const baseTotal = Math.round(unitPrice * safeQuantity * 100) / 100;
    const lpFee = Math.round(((unitPrice * servicePercent + serviceFixed) * safeQuantity) * 100) / 100;
    const processingFee = Math.round(((unitPrice * processingPercent + processingFixed) * safeQuantity) * 100) / 100;
    const total = Math.round((baseTotal + lpFee + processingFee) * 100) / 100;

    return { unitPrice, quantity: safeQuantity, baseTotal, lpFee, processingFee, total };
  }

  private getPublicAppUrl() {
    const rawAppUrl = this.configService.get<string>('APP_URL');
    return rawAppUrl && !rawAppUrl.includes('localhost')
      ? (rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`)
      : 'https://ticketsystem-jzgf.onrender.com';
  }

  private getPublicApiBaseUrl() {
    const rawApiUrl = this.configService.get<string>('API_URL');
    const fallbackApiUrl = 'https://ticketsystembackend.up.railway.app';
    const baseUrl = rawApiUrl && !rawApiUrl.includes('localhost')
      ? (rawApiUrl.startsWith('http') ? rawApiUrl : `https://${rawApiUrl}`)
      : fallbackApiUrl;
    return baseUrl.replace(/\/$/, '').replace(/\/api$/, '');
  }

  private getStripeCheckoutEventImages(event: Event) {
    const image = event.bannerImageUrl || event.imageUrl;
    if (!image || image.startsWith('data:')) {
      return image ? [`${this.getPublicApiBaseUrl()}/api/events/${event.slug}/og-image?kind=banner`] : [];
    }
    if (image.startsWith('http://') || image.startsWith('https://')) return [image];
    if (image.startsWith('/api/')) return [`${this.getPublicApiBaseUrl()}${image}`];
    if (image.startsWith('/')) return [`${this.getPublicApiBaseUrl()}${image}`];
    return [`${this.getPublicApiBaseUrl()}/${image}`];
  }

  async previewDoorSale(user: any, eventId: string, amount: number, quantity = 1, sectionId?: string) {
    const event = await this.ensureCanSellAtDoor(user, eventId);
    const section = sectionId ? await this.sectionRepo.findOne({ where: { id: sectionId, eventId } }) : null;
    if (sectionId && !section) throw new NotFoundException('Section not found');
    const invoice = this.calculateDoorSaleFees(event, amount, quantity, section);
    return {
      ...invoice,
      section: section ? { id: section.id, name: section.name, type: section.sectionType } : null,
      event: {
        id: event.id,
        title: event.title,
        venueName: event.venueName,
        eventDate: event.eventDate,
        currency: event.currency || 'USD',
      },
    };
  }

  async createDoorSaleCheckout(
    user: any,
    eventId: string,
    amount: number,
    quantity = 1,
    sectionId?: string,
    buyerEmail?: string,
    buyerName?: string,
  ) {
    const event = await this.ensureCanSellAtDoor(user, eventId);
    const section = sectionId ? await this.sectionRepo.findOne({ where: { id: sectionId, eventId } }) : null;
    if (sectionId && !section) throw new NotFoundException('Section not found');
    const invoice = this.calculateDoorSaleFees(event, amount, quantity, section);

    const checkoutBuyerEmail = buyerEmail?.trim();
    const checkoutBuyerName = buyerName?.trim();
    if (checkoutBuyerEmail) {
      if (!isValidEmailFormat(checkoutBuyerEmail)) {
        throw new BadRequestException('El correo no es válido. Revísalo antes de pagar.');
      }
      const suggestion = suggestEmailFix(checkoutBuyerEmail);
      if (suggestion) throw new BadRequestException(`Revisa tu correo: ¿quisiste decir ${suggestion}?`);
    }

    const seatsInfo = Array.from({ length: invoice.quantity }, (_, index) => ({
      seatId: '',
      sectionId: section?.id || null,
      sectionName: section?.name || 'Entrada en puerta',
      sectionType: section?.sectionType || 'general',
      rowLabel: 'GA',
      seatNumber: index + 1,
      price: invoice.unitPrice,
    }));

    const order = await this.orderRepo.save(this.orderRepo.create({
      userId: user.id,
      eventId,
      subtotal: invoice.baseTotal,
      lpFee: invoice.lpFee,
      processingFee: invoice.processingFee,
      total: invoice.total,
      status: OrderStatus.PENDING,
      ticketCount: invoice.quantity,
      seatsData: JSON.stringify(seatsInfo),
    }));

    const appUrl = this.getPublicAppUrl();
    const currency = (event.currency || 'USD').toLowerCase();
    const saleName = section?.name || 'Entrada en puerta';
    const eventImages = this.getStripeCheckoutEventImages(event);
    const productDescription = [
      `${invoice.quantity} entrada(s) · Venta en puerta`,
      event.venueName,
      event.eventDate ? new Date(event.eventDate).toLocaleString('es-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }) : null,
    ].filter(Boolean).join(' · ');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      ...(checkoutBuyerEmail ? { customer_email: checkoutBuyerEmail } : {}),
      locale: 'es',
      submit_type: 'pay',
      branding_settings: {
        display_name: 'LPTicket',
        background_color: '#050B12',
        button_color: '#FF6B00',
        border_style: 'rounded',
        font_family: 'inter',
      },
      custom_text: {
        submit: {
          message: 'Pago seguro procesado por Stripe. LPTicket emitirá la entrada al confirmarse el pago.',
        },
      },
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${saleName} - ${event.title}`,
              description: productDescription,
              ...(eventImages.length ? { images: eventImages } : {}),
            },
            unit_amount: Math.round(invoice.baseTotal * 100),
          },
          quantity: 1,
        },
        ...(invoice.lpFee > 0 ? [{
          price_data: { currency, product_data: { name: 'Cargo por servicio LPTicket' }, unit_amount: Math.round(invoice.lpFee * 100) },
          quantity: 1,
        }] : []),
        ...(invoice.processingFee > 0 ? [{
          price_data: { currency, product_data: { name: 'Tarifa de procesamiento' }, unit_amount: Math.round(invoice.processingFee * 100) },
          quantity: 1,
        }] : []),
      ],
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + (45 * 60),
      success_url: `${appUrl.replace(/\/$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl.replace(/\/$/, '')}/checkout/cancel`,
      payment_intent_data: {
        description: `LPTicket · ${saleName} · ${event.title}`,
      },
      metadata: {
        orderId: order.id,
        userId: user.id,
        eventId,
        buyerEmail: checkoutBuyerEmail || '',
        buyerName: checkoutBuyerName || '',
        source: 'door_sale',
      },
    });

    await this.orderRepo.update(order.id, { stripeSessionId: session.id });
    const qrData = await QRCode.toDataURL(session.url);
    return {
      sessionId: session.id,
      url: session.url,
      qrData,
      invoice,
      event: {
        id: event.id,
        title: event.title,
        venueName: event.venueName,
        eventDate: event.eventDate,
        currency: event.currency || 'USD',
      },
      section: section ? { id: section.id, name: section.name, type: section.sectionType } : null,
    };
  }

  async createTerminalConnectionToken(user: any) {
    if (!user?.id) throw new ForbiddenException('Authentication required');
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    const token = await this.stripe.terminal.connectionTokens.create();
    return { secret: token.secret };
  }

  private async getTerminalLocationId() {
    const configured = this.configService.get('STRIPE_TERMINAL_LOCATION_ID');
    if (configured) return configured;
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    const locations = await this.stripe.terminal.locations.list({ limit: 1 });
    const locationId = locations?.data?.[0]?.id;
    if (!locationId) {
      throw new BadRequestException('Configura STRIPE_TERMINAL_LOCATION_ID en Stripe/Railway antes de usar Tap to Pay.');
    }
    return locationId;
  }

  async createDoorSaleTapToPayIntent(user: any, eventId: string, amount: number, quantity = 1) {
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    const event = await this.ensureCanSellAtDoor(user, eventId);
    const invoice = this.calculateDoorSaleFees(event, amount, quantity, null);
    const seatsInfo = Array.from({ length: invoice.quantity }, (_, index) => ({
      seatId: '',
      sectionId: null,
      sectionName: 'Entrada en puerta',
      sectionType: 'general',
      rowLabel: 'GA',
      seatNumber: index + 1,
      price: invoice.unitPrice,
    }));

    const order = await this.orderRepo.save(this.orderRepo.create({
      userId: user.id,
      eventId,
      subtotal: invoice.baseTotal,
      lpFee: invoice.lpFee,
      processingFee: invoice.processingFee,
      total: invoice.total,
      status: OrderStatus.PENDING,
      ticketCount: invoice.quantity,
      seatsData: JSON.stringify(seatsInfo),
    }));

    const currency = (event.currency || 'USD').toLowerCase();
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(invoice.total * 100),
      currency,
      payment_method_types: ['card_present'],
      capture_method: 'automatic',
      description: `LPTicket - ${event.title} · Entrada en puerta`,
      metadata: {
        orderId: order.id,
        userId: user.id,
        eventId,
        source: 'door_sale_tap_to_pay',
      },
    });

    await this.orderRepo.update(order.id, { stripePaymentIntent: paymentIntent.id });
    return {
      orderId: order.id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      locationId: await this.getTerminalLocationId(),
      invoice,
      event: {
        id: event.id,
        title: event.title,
        venueName: event.venueName,
        eventDate: event.eventDate,
        currency: event.currency || 'USD',
      },
    };
  }

  async completeDoorSaleTapToPay(user: any, orderId: string, paymentIntentId: string) {
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['event'] });
    if (!order) throw new NotFoundException('Order not found');
    if (user.role !== UserRole.ADMIN && order.event.organizerId !== user.id) {
      const access = await this.scannerAccessRepo.findOne({
        where: { eventId: order.eventId, userId: user.id, status: ScannerAccessStatus.APPROVED },
      });
      if (!access) {
        throw new ForbiddenException('You do not have permission to complete this order');
      }
    }
    if (user.role !== UserRole.ADMIN && order.event.organizerId !== user.id && order.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to complete this order');
    }
    if (order.stripePaymentIntent && order.stripePaymentIntent !== paymentIntentId) {
      throw new BadRequestException('PaymentIntent does not match this order');
    }

    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata?.orderId !== orderId) {
      throw new BadRequestException('PaymentIntent metadata does not match this order');
    }
    if (paymentIntent.status === 'requires_capture') {
      await this.stripe.paymentIntents.capture(paymentIntentId);
    } else if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(`Payment is not complete: ${paymentIntent.status}`);
    }

    await this.finalizePaidOrder(orderId, paymentIntentId);
    return { success: true, orderId };
  }

  private async finalizePaidOrder(orderId: string, stripePaymentIntent?: string, buyerEmail?: string, buyerName?: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) return [];
    const existingTickets = await this.ticketRepo.count({ where: { orderId } });
    if (order.status === OrderStatus.PAID && existingTickets > 0) return this.ticketRepo.find({ where: { orderId } });
    if (order.status !== OrderStatus.PENDING && order.status !== OrderStatus.PAID) return [];

    await this.orderRepo.update(orderId, {
      status: OrderStatus.PAID,
      stripePaymentIntent: stripePaymentIntent || order.stripePaymentIntent,
      paidAt: new Date(),
    });

    const seatsInfo = JSON.parse(order.seatsData || '[]');
    const createdTickets: any[] = [];
    for (const seatInfo of seatsInfo) {
      const ticketCode = nanoid(12).toUpperCase();
      const appUrl = this.configService.get('APP_URL');
      const qrData = await QRCode.toDataURL(`${appUrl}/verify/${ticketCode}`);

      let validSeatId: string | null = seatInfo.seatId || null;
      if (validSeatId) {
        const seatExists = await this.seatRepo.findOne({ where: { id: validSeatId }, select: ['id'] });
        if (!seatExists) validSeatId = null;
      }

      const ticket = this.ticketRepo.create({
        ticketCode,
        orderId,
        eventId: order.eventId,
        userId: order.userId,
        seatId: validSeatId,
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

    try {
      const fullOrder = await this.orderRepo.findOne({
        where: { id: orderId },
        relations: ['user', 'event', 'event.organizer'],
      });
      if (fullOrder && fullOrder.user && createdTickets.length > 0) {
        await this.mailService.sendTicketEmail(
          buyerEmail || fullOrder.user.email,
          buyerName || fullOrder.user.firstName,
          fullOrder.event.title,
          createdTickets,
          {
            venueName: fullOrder.event.venueName,
            venueAddress: fullOrder.event.venueAddress,
            eventDate: fullOrder.event.eventDate?.toString(),
            eventTimezone: fullOrder.event.eventTimezone,
            currency: fullOrder.event.currency || 'USD',
            subtotal: Number(fullOrder.subtotal || 0),
            lpFee: Number(fullOrder.lpFee || 0),
            processingFee: Number(fullOrder.processingFee || 0),
            total: Number(fullOrder.total || 0),
            organizerEmail: fullOrder.event.organizer?.email || null,
          },
        );
      }
    } catch (err) {
      console.error('Error in post-payment email:', err);
    }

    return createdTickets;
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
    rawSpecialCode?: string,
    buyerEmail?: string,
    buyerName?: string,
  ) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Validate special code if provided
    let resolvedCode: string | null = null;
    let resolvedCodeId: string | null = null;
    let resolvedCodeOwnerId: string | null = null;
    if (rawSpecialCode && rawSpecialCode.trim()) {
      const normalizedCode = rawSpecialCode.trim().toUpperCase().replace(/\s+/g, '');
      const sc = await this.specialCodeRepo.findOne({ where: { code: normalizedCode } });
      if (!sc) throw new BadRequestException('Código especial no válido.');
      if (!sc.isActive) throw new BadRequestException('Este código especial no está activo.');
      if (sc.eventId && sc.eventId !== eventId) throw new BadRequestException('Este código especial no aplica para este evento.');
      resolvedCode = normalizedCode;
      resolvedCodeId = sc.id;
      resolvedCodeOwnerId = sc.ownerUserId;
    }

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
      specialCode: resolvedCode,
      specialCodeId: resolvedCodeId,
      specialCodeOwnerId: resolvedCodeOwnerId,
    });
    const savedOrder = await this.orderRepo.save(order);

    // Determine correct redirect URL based on environment
    const rawAppUrl = this.configService.get('APP_URL');
    const appUrl = rawAppUrl && !rawAppUrl.includes('localhost') 
      ? (rawAppUrl.startsWith('http') ? rawAppUrl : `https://${rawAppUrl}`)
      : 'https://ticketsystem-jzgf.onrender.com';

    const checkoutBuyerEmail = buyerEmail?.trim();
    const checkoutBuyerName = buyerName?.trim();

    // Guard against common email typos that bounce (e.g. icloud.con -> NXDOMAIN).
    if (checkoutBuyerEmail) {
      if (!isValidEmailFormat(checkoutBuyerEmail)) {
        throw new BadRequestException('El correo no es válido. Revísalo antes de pagar.');
      }
      const suggestion = suggestEmailFix(checkoutBuyerEmail);
      if (suggestion) {
        throw new BadRequestException(`Revisa tu correo: ¿quisiste decir ${suggestion}?`);
      }
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      ...(checkoutBuyerEmail ? { customer_email: checkoutBuyerEmail } : {}),
      line_items: lineItems,
      mode: 'payment',
      expires_at: Math.floor(Date.now() / 1000) + (30 * 60), 
      success_url: `${appUrl.replace(/\/$/, '')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl.replace(/\/$/, '')}/checkout/cancel`,
      metadata: {
        orderId: savedOrder.id,
        userId,
        eventId,
        buyerEmail: checkoutBuyerEmail || '',
        buyerName: checkoutBuyerName || '',
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
      if (!order) return;
      await this.finalizePaidOrder(
        orderId,
        session.payment_intent as string,
        session.customer_details?.email || session.metadata?.buyerEmail,
        session.customer_details?.name || session.metadata?.buyerName,
      );
    }

    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      await this.finalizePaidPaymentIntent(paymentIntent);
    }
  }

  private async finalizePaidPaymentIntent(paymentIntent: any) {
    const orderId = paymentIntent?.metadata?.orderId;
    if (!orderId) return;

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) return;
    if (order.stripePaymentIntent && order.stripePaymentIntent !== paymentIntent.id) return;
    if (paymentIntent.status !== 'succeeded') return;

    await this.finalizePaidOrder(orderId, paymentIntent.id);
  }

  /**
   * Cron: auto-recover PENDING orders whose Stripe payment succeeded but
   * whose webhook was never processed (cold start, wrong secret, etc.).
   * Runs every 5 minutes. Only processes orders older than 10 minutes
   * (gives Stripe time to deliver the webhook first).
   */
  @Cron('*/10 * * * * *')
  async recoverMissedWebhooks() {
    if (!this.stripe) return;

    const fiveSecondsAgo = new Date(Date.now() - 5 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const pendingOrders = await this.orderRepo.find({
      where: { status: OrderStatus.PENDING },
    });

    // Also catch PAID orders where ticket creation failed mid-flight (partial failure)
    const paidOrders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.status = :status', { status: OrderStatus.PAID })
      .andWhere('order.createdAt > :cutoff', { cutoff: twentyFourHoursAgo })
      .andWhere(
        'NOT EXISTS (SELECT 1 FROM tickets t WHERE t."orderId" = order.id)',
      )
      .getMany();

    const staleOrders = [
      ...pendingOrders.filter(o => {
        const created = new Date(o.createdAt);
        return created < fiveSecondsAgo && created > twentyFourHoursAgo;
      }),
      ...paidOrders,
    ];

    if (staleOrders.length === 0) return;
    console.log(`[Cron] Checking ${staleOrders.length} stale orders against Stripe...`);

    for (const order of staleOrders) {
      try {
        let session: any = null;

        if (order.stripePaymentIntent && !order.stripeSessionId) {
          const paymentIntent = await this.stripe.paymentIntents.retrieve(order.stripePaymentIntent);
          if (paymentIntent.status === 'requires_capture') {
            const captured = await this.stripe.paymentIntents.capture(order.stripePaymentIntent);
            await this.finalizePaidPaymentIntent(captured);
          } else if (paymentIntent.status === 'succeeded') {
            await this.finalizePaidPaymentIntent(paymentIntent);
          }
          continue;
        }

        if (order.stripeSessionId) {
          // Fast path: retrieve the exact session by stored ID
          session = await this.stripe.checkout.sessions.retrieve(order.stripeSessionId);
        } else {
          // Fallback: search recent sessions by orderId in metadata
          const list = await this.stripe.checkout.sessions.list({ limit: 100 });
          session = list.data.find((s: any) => s.metadata?.orderId === order.id) ?? null;
        }

        if (!session || session.payment_status !== 'paid') continue;

        console.log(`[Cron] Recovering order ${order.id} — Stripe session ${session.id} is paid`);
        await this.handleStripeWebhook({
          type: 'checkout.session.completed',
          data: { object: session },
        });
      } catch (err: any) {
        console.error(`[Cron] Error recovering order ${order.id}:`, err.message);
      }
    }
  }

  /**
   * Admin recovery: manually fulfill a PENDING order whose Stripe payment
   * succeeded but whose webhook was never processed (network failure, wrong
   * secret, cold-start race, etc.).
   * Verifies payment via Stripe API before issuing tickets.
   */
  /**
   * Re-sends the digital ticket email for the order that owns the given ticket
   * code. Only the buyer (order owner) may trigger it. Lets users regenerate the
   * email on demand (e.g. to receive the latest version) without buying again.
   */
  async resendTicketEmailByCode(
    code: string,
    requesterId: string,
    options?: { overrideEmail?: string; isAdmin?: boolean },
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { ticketCode: code } });
    if (!ticket) throw new NotFoundException('Entrada no encontrada');

    const order = await this.orderRepo.findOne({
      where: { id: ticket.orderId },
      relations: ['user', 'event', 'event.organizer'],
    });
    if (!order || !order.user) throw new NotFoundException('Pedido no encontrado');
    const isOwner = order.userId === requesterId;
    const isOrganizer = !!requesterId && order.event?.organizerId === requesterId;
    if (!isOwner && !isOrganizer && !options?.isAdmin) {
      throw new ForbiddenException('No autorizado');
    }

    // Optionally send to a corrected address (e.g. buyer typed icloud.con).
    let targetEmail = order.user.email;
    if (options?.overrideEmail) {
      const fixed = options.overrideEmail.trim();
      if (!isValidEmailFormat(fixed)) {
        throw new BadRequestException('El correo de destino no es válido.');
      }
      const suggestion = suggestEmailFix(fixed);
      if (suggestion) {
        throw new BadRequestException(`Revisa el correo: ¿quisiste decir ${suggestion}?`);
      }
      targetEmail = fixed;
    }

    const tickets = await this.ticketRepo.find({ where: { orderId: order.id } });
    if (!tickets.length) throw new NotFoundException('No hay entradas en este pedido');

    await this.mailService.sendTicketEmail(
      targetEmail,
      order.user.firstName,
      order.event.title,
      tickets,
      {
        venueName: order.event.venueName,
        venueAddress: order.event.venueAddress,
        eventDate: order.event.eventDate?.toString(),
        eventTimezone: order.event.eventTimezone,
        currency: order.event.currency || 'USD',
        subtotal: Number(order.subtotal || 0),
        lpFee: Number(order.lpFee || 0),
        processingFee: Number(order.processingFee || 0),
        total: Number(order.total || 0),
        organizerEmail: order.event.organizer?.email || null,
      },
    );

    return { success: true, email: targetEmail };
  }

  async fulfillPendingOrder(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['user', 'event'],
    });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (order.status === OrderStatus.PAID) {
      const ticketCount = await this.ticketRepo.count({ where: { orderId } });
      if (ticketCount > 0) return { alreadyProcessed: true, status: order.status, ticketCount };
      // PAID but no tickets — fall through to re-issue
    } else if (order.status !== OrderStatus.PENDING) {
      return { alreadyProcessed: true, status: order.status, ticketCount: 0 };
    }

    // Verify payment with Stripe before issuing tickets
    if (!this.stripe) throw new BadRequestException('Stripe not configured');
    if (!order.stripeSessionId) throw new NotFoundException('No Stripe session ID stored for this order');

    const session = await this.stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (!session) throw new NotFoundException('Stripe session not found');
    if (session.payment_status !== 'paid') {
      throw new BadRequestException(`Payment not completed — Stripe status: ${session.payment_status}`);
    }

    // Reuse the webhook fulfillment path
    await this.handleStripeWebhook({
      type: 'checkout.session.completed',
      data: { object: session },
    });

    const tickets = await this.ticketRepo.find({ where: { orderId } });
    return { recovered: true, ticketCount: tickets.length, sessionId: session.id };
  }

  /**
   * Retrieves all orders for a specific user.
   */
  async getUserOrders(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { userId },
      relations: ['event'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
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
  /**
   * Internal lookup — returns the full ticket entity with relations.
   * Used by wallet pass generation and email resend, NOT exposed directly.
   */
  async getTicketByCode(code: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { ticketCode: code },
      relations: ['event', 'user', 'order'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  /**
   * Returns the ticket's QR as a PNG buffer (public). Mail clients that block
   * inline CID images can still load this URL, so the confirmation email always
   * shows a working QR.
   */
  async getTicketQrPng(code: string): Promise<Buffer> {
    const ticket = await this.ticketRepo.findOne({
      where: { ticketCode: code },
      select: ['id', 'ticketCode', 'qrData'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Prefer the stored data-URL; fall back to regenerating from the verify URL.
    const stored = ticket.qrData || '';
    if (stored.startsWith('data:image/png;base64,')) {
      return Buffer.from(stored.replace(/^data:image\/png;base64,/, ''), 'base64');
    }
    const appUrl = this.configService.get('APP_URL');
    return QRCode.toBuffer(`${appUrl}/verify/${ticket.ticketCode}`, { width: 320, margin: 1 });
  }

  /**
   * Public verification view — this endpoint is unauthenticated (gate scanning).
   * Returns only the fields needed to display/verify a ticket, never the buyer's
   * password hash, address, payment data or full order/user record.
   */
  async getPublicTicketByCode(code: string) {
    const ticket = await this.getTicketByCode(code);
    const u = ticket.user;
    const attendeeName =
      [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || 'Invitado';
    const order = (ticket as any).order;
    return {
      // Fields the digital ticket / receipt needs. The QR and the attendee's
      // name are part of the ticket itself, so they are shown here. We still
      // withhold the buyer's email, phone, address, password hash and any other
      // account data — only the order's money breakdown is exposed for the receipt.
      id: ticket.id,
      ticketCode: ticket.ticketCode,
      orderId: ticket.orderId,
      status: ticket.status,
      sectionName: ticket.sectionName,
      rowLabel: ticket.rowLabel,
      seatNumber: ticket.seatNumber,
      seatLabel: (ticket as any).seatLabel ?? null,
      price: ticket.price,
      qrData: ticket.qrData,
      createdAt: ticket.createdAt,
      attendeeName,
      // Minimal buyer shape so existing receipt UI (ticket.user.firstName/lastName)
      // keeps working — name only, no contact details.
      user: u ? { firstName: u.firstName, lastName: u.lastName } : null,
      order: order
        ? {
            id: order.id,
            subtotal: order.subtotal,
            lpFee: order.lpFee,
            processingFee: order.processingFee,
            total: order.total,
          }
        : null,
      event: ticket.event
        ? {
            id: ticket.event.id,
            title: ticket.event.title,
            slug: ticket.event.slug,
            eventDate: ticket.event.eventDate,
            eventTimezone: ticket.event.eventTimezone,
            venueName: ticket.event.venueName,
            venueAddress: ticket.event.venueAddress,
            imageUrl: ticket.event.imageUrl,
            bannerImageUrl: ticket.event.bannerImageUrl,
            currency: ticket.event.currency,
          }
        : null,
    };
  }

  /**
   * Authorization helper: ensure the requesting user owns the event (or is admin).
   * Prevents IDOR where any authenticated user could read another organizer's
   * sales, attendee emails or scanner stats by guessing an event id.
   */
  private async assertEventAccess(eventId: string, user: { id: string; role?: string }) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (user?.role !== UserRole.ADMIN && event.organizerId !== user?.id) {
      throw new ForbiddenException('No tienes permiso para acceder a este evento');
    }
    return event;
  }

  /**
   * Validates a ticket (Scanning Logic).
   * Ensures the user has permission to scan and that the ticket hasn't been used.
   */
  async getScannerEventStats(eventId: string, user: { id: string; role?: string }) {
    await this.assertEventAccess(eventId, user);
    return this.computeScannerEventStats(eventId);
  }

  // Internal stats computation without an ownership check — only called from
  // contexts that have already authorized the caller (e.g. validateTicket).
  private async computeScannerEventStats(eventId: string) {
    // Capacity per section is computed in ONE aggregated query instead of a
    // per-section count loop (which made gate scanning slow). For seated
    // sections we need the real seat count, so we LEFT JOIN + GROUP BY and let
    // SQL count seats in a single round-trip.
    const sectionRows: Array<{
      sectionType: string; capacity: string | number; rows: string | number;
      seatsPerRow: string | number; seatCount: string | number;
    }> = await this.sectionRepo
      .createQueryBuilder('section')
      .select('section.sectionType', 'sectionType')
      .addSelect('section.capacity', 'capacity')
      .addSelect('section.rows', 'rows')
      .addSelect('section.seatsPerRow', 'seatsPerRow')
      .addSelect('COUNT(seat.id)', 'seatCount')
      .leftJoin(Seat, 'seat', 'seat.sectionId = section.id')
      .where('section.eventId = :eventId', { eventId })
      .groupBy('section.id')
      .getRawMany();

    let totalCapacity = 0;
    for (const row of sectionRows) {
      const type = String(row.sectionType || '').toLowerCase();
      if (type === 'stage' || type === 'decor') continue;
      const capField = Number(row.capacity) || 0;
      const rowsCalc = (Number(row.rows) || 0) * (Number(row.seatsPerRow) || 0);
      const seatCount = Number(row.seatCount) || 0;
      totalCapacity += type === 'standing'
        ? Math.max(capField, rowsCalc)     // GA: no seat records
        : Math.max(seatCount, rowsCalc);   // seated/vip/table
    }

    const [activeTickets, usedTickets] = await Promise.all([
      this.ticketRepo.count({ where: { eventId, status: TicketStatus.ACTIVE } }),
      this.ticketRepo.count({ where: { eventId, status: TicketStatus.USED } }),
    ]);

    const totalIssued = activeTickets + usedTickets;

    return {
      totalCapacity,
      totalIssued,
      totalPurchased: totalIssued,
      ticketsToScan: activeTickets,
      ticketsEntered: usedTickets,
    };
  }

  async validateTicket(code: string, user: any, options?: { eventId?: string; allowScannerAccess?: boolean }) {
    // Lightweight lookup — only the fields needed to authorize + display the
    // scan result. The heavy event/order relations and per-event stats are NOT
    // loaded here, so the gate response is near-instant. The scanner UI keeps
    // its live counts fresh via the separate /scanner-stats polling endpoint.
    const ticket = await this.ticketRepo.findOne({
      where: { ticketCode: code },
      relations: ['user', 'event'],
    });
    if (!ticket) {
      return { valid: false, message: 'Ticket not found' };
    }

    if (options?.eventId && ticket.eventId !== options.eventId) {
      throw new ForbiddenException('This ticket does not belong to the selected event');
    }

    // Authorization: admins, event organizer, or a pre-approved scanner access flow.
    if (!options?.allowScannerAccess && user.role !== 'admin' && ticket.event?.organizerId !== user.id) {
      throw new ForbiddenException('You do not have permission to validate tickets for this event');
    }

    if (ticket.status === TicketStatus.USED) {
      return { valid: false, message: 'This ticket has already been used', ticket };
    }
    if (ticket.status === TicketStatus.CANCELLED) {
      return { valid: false, message: 'This ticket was cancelled', ticket };
    }

    // Mark as USED to prevent double-entry.
    await this.ticketRepo.update(ticket.id, { status: TicketStatus.USED });
    ticket.status = TicketStatus.USED;
    return { valid: true, message: 'Valid Ticket — entry confirmed', ticket };
  }

  /**
   * Aggregate sales data for an event.
   */
  async getEventSales(eventId: string, user: { id: string; role?: string }) {
    await this.assertEventAccess(eventId, user);
    const orders = await this.orderRepo.find({
      where: { eventId, status: OrderStatus.PAID },
      relations: ['user'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });
    const ordersMissingPaidAt = orders.filter((order) => !order.paidAt);
    if (ordersMissingPaidAt.length > 0) {
      await Promise.all(
        ordersMissingPaidAt.map((order) =>
          this.orderRepo.update(order.id, { paidAt: order.createdAt }),
        ),
      );
      ordersMissingPaidAt.forEach((order) => {
        order.paidAt = order.createdAt;
      });
    }
    const orderIds = orders.map((order) => order.id);
    if (orderIds.length > 0) {
      const tickets = await this.ticketRepo.find({
        where: { orderId: In(orderIds) },
        order: { createdAt: 'ASC' },
      });
      const ticketsByOrder = new Map<string, Ticket[]>();
      tickets.forEach((ticket) => {
        const existingTickets = ticketsByOrder.get(ticket.orderId) || [];
        existingTickets.push(ticket);
        ticketsByOrder.set(ticket.orderId, existingTickets);
      });
      orders.forEach((order) => {
        (order as any).tickets = ticketsByOrder.get(order.id) || [];
      });
    }

    // Organizer revenue = ticket sales only (subtotal), excluding the buyer's service fee.
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.subtotal), 0);
    const totalTickets = orders.reduce((sum, o) => sum + o.ticketCount, 0);
    return { orders, totalRevenue, totalTickets, totalOrders: orders.length };
  }

  /**
   * Aggregate stats across ALL events owned by an organizer in a single SQL query.
   * Replaces N+1 of getEventSales() calls from the dashboard.
   */
  async getOrganizerStats(organizerId: string) {
    const STRIPE_PERCENT = 0.029;
    const STRIPE_FIXED = 0.30;

    // 1) Money + counts totals (paid orders across all the organizer's events).
    const result = await this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('events', 'e', 'e.id = o."eventId"')
      .where('e."organizerId" = :organizerId', { organizerId })
      .andWhere('o.status = :status', { status: OrderStatus.PAID })
      .select('COALESCE(SUM(o.subtotal), 0)', 'totalRevenue')
      .addSelect('COALESCE(SUM(o.total), 0)', 'totalCharged')
      .addSelect('COALESCE(SUM(o."ticketCount"), 0)', 'totalTickets')
      .addSelect('COUNT(o.id)', 'totalOrders')
      .getRawOne();

    const totalRevenue = Number(result?.totalRevenue) || 0; // ticket sales (organizer)
    const totalCharged = Number(result?.totalCharged) || 0; // what buyers paid
    const totalOrders = Number(result?.totalOrders) || 0;
    const serviceFees = Math.max(0, +(totalCharged - totalRevenue).toFixed(2));
    const stripeFees = totalCharged > 0
      ? +(totalCharged * STRIPE_PERCENT + totalOrders * STRIPE_FIXED).toFixed(2)
      : 0;
    const netEstimated = +Math.max(0, totalRevenue - stripeFees).toFixed(2);

    // 2) Sales per day for the last 14 days.
    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);
    const dayRows = await this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('events', 'e', 'e.id = o."eventId"')
      .where('e."organizerId" = :organizerId', { organizerId })
      .andWhere('o.status = :status', { status: OrderStatus.PAID })
      .andWhere('COALESCE(o."paidAt", o."createdAt") >= :since', { since })
      .select(`TO_CHAR(COALESCE(o."paidAt", o."createdAt"), 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(o.id)', 'orders')
      .addSelect('COALESCE(SUM(o."ticketCount"), 0)', 'tickets')
      .addSelect('COALESCE(SUM(o.subtotal), 0)', 'revenue')
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany();

    const salesByDay = dayRows.map((r) => ({
      date: r.date,
      orders: Number(r.orders) || 0,
      tickets: Number(r.tickets) || 0,
      revenue: Number(r.revenue) || 0,
    }));

    // 3) Check-in summary (scanned vs pending tickets across all events).
    const checkin = await this.ticketRepo
      .createQueryBuilder('t')
      .innerJoin('events', 'e', 'e.id = t."eventId"')
      .where('e."organizerId" = :organizerId', { organizerId })
      .select(`COUNT(CASE WHEN t.status = 'used' THEN 1 END)`, 'scanned')
      .addSelect(`COUNT(CASE WHEN t.status = 'active' THEN 1 END)`, 'pending')
      .getRawOne();

    const scannedTickets = Number(checkin?.scanned) || 0;
    const pendingTickets = Number(checkin?.pending) || 0;

    return {
      totalRevenue,
      totalCharged,
      serviceFees,
      stripeFees,
      netEstimated,
      stripePercent: STRIPE_PERCENT,
      stripeFixed: STRIPE_FIXED,
      totalTickets: Number(result?.totalTickets) || 0,
      totalOrders,
      scannedTickets,
      pendingTickets,
      salesByDay,
    };
  }

  /**
   * Retrieves list of attendees for an event.
   */
  async getEventAttendees(eventId: string, user: { id: string; role?: string }) {
    await this.assertEventAccess(eventId, user);
    return this.ticketRepo.find({
      where: { eventId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Gate search — find an event's tickets by attendee name, email, table/section
   * or code, GROUPED BY buyer. Used at the door when a QR can't be scanned: staff
   * search a person, see all the tickets that person bought, then open a ticket.
   */
  async searchEventTicketsGrouped(
    eventId: string,
    query: string,
    user: { id: string; role?: string },
  ) {
    await this.assertEventAccess(eventId, user);
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const like = `%${q.toLowerCase()}%`;
    const tickets = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .where('ticket.eventId = :eventId', { eventId })
      .andWhere(
        `(
          LOWER(user.firstName) LIKE :like OR
          LOWER(user.lastName) LIKE :like OR
          LOWER(user.firstName || ' ' || user.lastName) LIKE :like OR
          LOWER(user.email) LIKE :like OR
          LOWER(ticket.sectionName) LIKE :like OR
          LOWER(ticket.ticketCode) LIKE :like
        )`,
        { like },
      )
      .orderBy('ticket.createdAt', 'ASC')
      .limit(200)
      .getMany();

    // Group all matching tickets by buyer (by user id, falling back to email).
    const groups = new Map<string, {
      buyerId: string;
      name: string;
      email: string;
      ticketCount: number;
      scannedCount: number;
      tickets: { ticketCode: string; status: string; seat: string }[];
    }>();

    for (const ticket of tickets) {
      const u = ticket.user;
      const key = u?.id || u?.email || ticket.ticketCode;
      const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || 'Invitado';
      const seat = [ticket.sectionName, ticket.rowLabel, ticket.seatNumber].filter(Boolean).join(' · ') || 'General';
      if (!groups.has(key)) {
        groups.set(key, { buyerId: key, name, email: u?.email || '', ticketCount: 0, scannedCount: 0, tickets: [] });
      }
      const g = groups.get(key)!;
      g.ticketCount += 1;
      if (ticket.status === TicketStatus.USED) g.scannedCount += 1;
      g.tickets.push({ ticketCode: ticket.ticketCode, status: ticket.status, seat });
    }

    return Array.from(groups.values()).slice(0, 30);
  }

  /**
   * Legacy flat (non-grouped) gate search — kept for any caller that still wants
   * a flat list of tickets by name / email / code.
   */
  async searchEventTickets(
    eventId: string,
    query: string,
    user: { id: string; role?: string },
  ) {
    await this.assertEventAccess(eventId, user);
    const q = (query || '').trim();
    if (q.length < 2) return [];

    const like = `%${q.toLowerCase()}%`;
    const tickets = await this.ticketRepo
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .where('ticket.eventId = :eventId', { eventId })
      .andWhere(
        `(
          LOWER(user.firstName) LIKE :like OR
          LOWER(user.lastName) LIKE :like OR
          LOWER(user.firstName || ' ' || user.lastName) LIKE :like OR
          LOWER(user.email) LIKE :like OR
          LOWER(ticket.sectionName) LIKE :like OR
          LOWER(ticket.ticketCode) LIKE :like
        )`,
        { like },
      )
      .orderBy('ticket.createdAt', 'ASC')
      .limit(25)
      .getMany();

    // Return only what the gate needs (no buyer PII beyond name/email).
    return tickets.map((ticket) => {
      const u = ticket.user;
      const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || 'Invitado';
      const seat = [ticket.sectionName, ticket.rowLabel, ticket.seatNumber].filter(Boolean).join(' · ');
      return {
        ticketCode: ticket.ticketCode,
        status: ticket.status,
        name,
        email: u?.email || '',
        seat: seat || 'General',
      };
    });
  }

  /**
   * Finds a detailed order by ID.
   */
  async getOrderById(orderId: string, user?: any) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['event', 'user'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (user && user.role !== 'admin' && order.userId !== user.id) {
      throw new ForbiddenException('No tienes permiso para ver este recibo');
    }

    const tickets = await this.ticketRepo.find({
      where: { orderId },
      order: { createdAt: 'ASC' },
    });

    return { ...order, tickets };
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
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['organizer'] });
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
      paidAt: new Date(),
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

    // Send the invitations via email to the recipient
    const ticketEmailParams = {
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      eventDate: event.eventDate?.toString(),
      eventTimezone: event.eventTimezone,
    };
    try {
      await this.mailService.sendTicketEmail(email, name, event.title, createdTickets, ticketEmailParams);
    } catch (e) {
      console.error('Error sending free ticket email:', e);
    }

    // Send a copy to the organizer
    const organizerEmail = (event as any).organizer?.email;
    if (organizerEmail && organizerEmail !== email) {
      try {
        const organizerName = [(event as any).organizer?.firstName, (event as any).organizer?.lastName].filter(Boolean).join(' ') || 'Organizador';
        await this.mailService.sendTicketEmail(organizerEmail, organizerName, event.title, createdTickets, {
          ...ticketEmailParams,
          note: `Copia de las entradas enviadas a ${name} (${email})`,
        } as any);
      } catch (e) {
        console.error('Error sending organizer copy email:', e);
      }
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

    // Format event date for the email with time in the event's timezone
    const eventDateStr = event.eventDate && event.eventTimezone
      ? (() => {
          const date = new Date(event.eventDate);
          const tz = event.eventTimezone || 'UTC';
          const dayName = date.toLocaleDateString('es', { weekday: 'long', timeZone: tz });
          const dateStr = date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
          const timeStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz });
          const tzName = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
            .formatToParts(date)
            .find((p: any) => p.type === 'timeZoneName')?.value || '';
          return `${dayName}, ${dateStr} — ${timeStr} ${tzName}`;
        })()
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

  private getAppUrl() {
    const raw = this.configService.get<string>('APP_URL') || 'https://www.lpticket.com';
    return raw.startsWith('http://') || raw.startsWith('https://')
      ? raw.replace(/\/$/, '')
      : `https://${raw.replace(/\/$/, '')}`;
  }

  private formatEventDate(date: Date, timezone = 'UTC') {
    const tz = timezone || 'UTC';
    const eventDate = new Date(date);
    const day = eventDate.toLocaleDateString('es-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: tz,
    });
    const time = eventDate.toLocaleTimeString('es-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    });
    const zone = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(eventDate)
      .find((part) => part.type === 'timeZoneName')?.value || '';
    return `${day}, ${time} ${zone}`.trim();
  }

  private csvCell(value: any) {
    const text = String(value ?? '').replace(/"/g, '""');
    return `"${text}"`;
  }

  private ticketLocation(ticket: Ticket) {
    const section = String(ticket.sectionName || '').trim();
    const row = String(ticket.rowLabel || '').trim();
    const seat = ticket.seatNumber !== null && ticket.seatNumber !== undefined ? String(ticket.seatNumber) : '';
    if (/^(mesa|table)\b/i.test(section)) return [section, seat ? `Silla ${seat}` : ''].filter(Boolean).join(' - ');
    if (/^(mesa|table)\b/i.test(row)) return [`Mesa ${row.replace(/^(mesa|table)\s*/i, '')}`, seat ? `Silla ${seat}` : ''].filter(Boolean).join(' - ');
    if (/^\d+$/.test(section) && seat) return `Mesa ${section} - Silla ${seat}`;
    if (row === 'GA') return section || 'Entrada general';
    return [section, row ? `Fila ${row}` : '', seat ? `Asiento ${seat}` : ''].filter(Boolean).join(' · ') || 'Entrada general';
  }

  private buildAttendeeCsv(event: Event, tickets: Ticket[]) {
    const header = ['Evento', 'Nombre', 'Email', 'Telefono', 'Ticket Code', 'Ubicacion', 'Seccion', 'Fila/Mesa', 'Asiento/Silla', 'Estado', 'Precio', 'Order ID', 'Fecha Compra'];
    const rows = tickets.map((ticket) => {
      const user: any = ticket.user || {};
      const order: any = ticket.order || {};
      const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email || 'Invitado';
      return [
        event.title,
        name,
        user.email || '',
        user.phone || '',
        ticket.ticketCode,
        this.ticketLocation(ticket),
        ticket.sectionName || '',
        ticket.rowLabel || '',
        ticket.seatNumber ?? '',
        ticket.status,
        Number(ticket.price || 0).toFixed(2),
        ticket.orderId,
        order.paidAt || order.createdAt || ticket.createdAt,
      ];
    });
    return [header, ...rows].map((row) => row.map((cell) => this.csvCell(cell)).join(',')).join('\n');
  }

  private async buildPostEventReport(event: Event) {
    const [orders, tickets] = await Promise.all([
      this.orderRepo.find({
        where: { eventId: event.id, status: OrderStatus.PAID },
        relations: ['user'],
        order: { paidAt: 'ASC', createdAt: 'ASC' },
      }),
      this.ticketRepo.find({
        where: { eventId: event.id },
        relations: ['user', 'order'],
        order: { createdAt: 'ASC' },
      }),
    ]);

    const paidOrderIds = new Set(orders.map((order) => order.id));
    const paidTickets = tickets.filter((ticket) => paidOrderIds.has(ticket.orderId) && ticket.status !== TicketStatus.CANCELLED);
    const totalOrders = orders.length;
    const ticketRevenue = orders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);
    const lpFees = orders.reduce((sum, order) => sum + Number(order.lpFee || 0), 0);
    const processingFees = orders.reduce((sum, order) => sum + Number(order.processingFee || 0), 0);
    const grossSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const scannedTickets = paidTickets.filter((ticket) => ticket.status === TicketStatus.USED).length;
    const pendingTickets = paidTickets.filter((ticket) => ticket.status === TicketStatus.ACTIVE).length;
    const totalTickets = paidTickets.length;
    const scanRate = totalTickets > 0 ? Math.round((scannedTickets / totalTickets) * 100) : 0;
    const averageOrder = totalOrders > 0 ? grossSales / totalOrders : 0;
    const currency = event.currency || 'USD';

    const sectionMap = new Map<string, { name: string; tickets: number; revenue: number }>();
    paidTickets.forEach((ticket) => {
      const name = String(ticket.sectionName || '').trim() || 'General';
      const current = sectionMap.get(name) || { name, tickets: 0, revenue: 0 };
      current.tickets += 1;
      current.revenue += Number(ticket.price || 0);
      sectionMap.set(name, current);
    });
    const topSections = Array.from(sectionMap.values()).sort((a, b) => b.revenue - a.revenue);

    const salesByDayMap = new Map<string, { date: string; orders: number; tickets: number; revenue: number }>();
    orders.forEach((order) => {
      const date = new Date(order.paidAt || order.createdAt).toLocaleDateString('es-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: event.eventTimezone || 'UTC',
      });
      const current = salesByDayMap.get(date) || { date, orders: 0, tickets: 0, revenue: 0 };
      current.orders += 1;
      current.tickets += Number(order.ticketCount || 0);
      current.revenue += Number(order.subtotal || 0);
      salesByDayMap.set(date, current);
    });

    const codeMap = new Map<string, { code: string; orders: number; tickets: number; revenue: number; commission: number }>();
    orders.filter((order) => order.specialCode).forEach((order) => {
      const code = String(order.specialCode || '').toUpperCase();
      const current = codeMap.get(code) || { code, orders: 0, tickets: 0, revenue: 0, commission: 0 };
      const ticketCount = Number(order.ticketCount || 0);
      current.orders += 1;
      current.tickets += ticketCount;
      current.revenue += Number(order.subtotal || 0);
      current.commission += ticketCount * Number(event.creatorCommission || 0);
      codeMap.set(code, current);
    });

    const organizer: any = event.organizer || {};
    const organizerName = [organizer.firstName, organizer.lastName].filter(Boolean).join(' ') || organizer.username || 'organizador';
    const appUrl = this.getAppUrl();
    return {
      organizerName,
      eventTitle: event.title,
      eventDateLabel: this.formatEventDate(event.eventDate, event.eventTimezone),
      venueLabel: [event.venueName, event.venueAddress].filter(Boolean).join(' — ') || 'Lugar por confirmar',
      flyerUrl: event.imageUrl || event.bannerImageUrl,
      reportUrl: `${appUrl}/organizer/events/${event.id}`,
      currency,
      totals: {
        grossSales,
        ticketRevenue,
        lpFees,
        processingFees,
        netEstimated: Math.max(0, ticketRevenue - processingFees),
        totalOrders,
        totalTickets,
        scannedTickets,
        pendingTickets,
        scanRate,
        averageOrder,
      },
      topSections,
      salesByDay: Array.from(salesByDayMap.values()),
      specialCodes: Array.from(codeMap.values()).sort((a, b) => b.revenue - a.revenue),
      csv: {
        filename: `lpticket-${event.slug || event.id}-asistentes.csv`,
        content: this.buildAttendeeCsv(event, paidTickets),
      },
    };
  }

  async getPostEventReportPreview(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Evento no encontrado');
    const report = await this.buildPostEventReport(event);
    const organizer: any = event.organizer || {};
    return {
      defaultEmail: organizer.email || '',
      sentAt: event.postEventReportSentAt,
      report: {
        eventTitle: report.eventTitle,
        eventDateLabel: report.eventDateLabel,
        venueLabel: report.venueLabel,
        currency: report.currency,
        totals: report.totals,
        topSections: report.topSections.slice(0, 8),
        salesByDay: report.salesByDay.slice(-7),
        specialCodes: report.specialCodes.slice(0, 8),
      },
    };
  }

  async sendManualPostEventReport(eventId: string, overrideEmail?: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Evento no encontrado');
    const organizer: any = event.organizer || {};
    const targetEmail = String(overrideEmail || organizer.email || '').trim();
    if (!targetEmail) throw new BadRequestException('Este evento no tiene correo destino');
    if (!isValidEmailFormat(targetEmail)) throw new BadRequestException('Correo inválido');

    const report = await this.buildPostEventReport(event);
    const sent = await this.mailService.sendPostEventReportEmail(targetEmail, report);
    if (!sent) throw new BadRequestException('No se pudo enviar el resumen');

    event.postEventReportSentAt = new Date();
    await this.eventRepo.save(event);
    return { success: true, email: targetEmail, sentAt: event.postEventReportSentAt };
  }

  @Cron('0 5 * * * *')
  async handlePostEventReports() {
    console.log('[Cron] Checking post-event organizer reports...');
    const now = new Date();
    const explicitEndCutoff = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const fallbackStartCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const events = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.organizer', 'organizer')
      .where('event."postEventReportSentAt" IS NULL')
      .andWhere('event.status IN (:...statuses)', { statuses: [EventStatus.PUBLISHED, EventStatus.COMPLETED] })
      .andWhere(`(
        (event."eventEndDate" IS NOT NULL AND event."eventEndDate" <= :explicitEndCutoff)
        OR
        (event."eventEndDate" IS NULL AND event."eventDate" <= :fallbackStartCutoff)
      )`, { explicitEndCutoff, fallbackStartCutoff })
      .orderBy('event.eventDate', 'ASC')
      .limit(20)
      .getMany();

    for (const event of events) {
      try {
        const organizerEmail = (event.organizer as any)?.email;
        if (!organizerEmail) {
          console.warn(`[Cron] Skipping post-event report for ${event.id}: organizer has no email.`);
          continue;
        }
        const report = await this.buildPostEventReport(event);
        const sent = await this.mailService.sendPostEventReportEmail(organizerEmail, report);
        if (sent) {
          event.postEventReportSentAt = new Date();
          await this.eventRepo.save(event);
          console.log(`[Cron] Post-event report sent for ${event.title}.`);
        }
      } catch (err) {
        console.error(`[Cron] Error sending post-event report for event ${event.id}:`, err);
      }
    }
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
