/**
 * OrdersController — routes under /api/orders
 * EN: Stripe checkout & webhook, ticket lookup/validation/resend, wallet passes,
 *     my-orders/my-tickets, door sales, and organizer reports (sales, attendees,
 *     scanner-stats) plus seat blocking, free invites and reminders.
 *     The Stripe webhook is unauthenticated but signature-verified.
 * ES: Checkout y webhook de Stripe, consulta/validación/reenvío de tickets, pases
 *     de wallet, mis-órdenes/mis-tickets, ventas en puerta y reportes del
 *     organizador (ventas, asistentes, stats de escáner) más bloqueo de asientos,
 *     invitaciones gratis y recordatorios. El webhook de Stripe no requiere auth
 *     pero verifica la firma.
 */
import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Request, RawBodyRequest, Req, Headers, Res,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { WalletService } from '../common/services/wallet.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Stripe = require('stripe');

@Controller('orders')
export class OrdersController {
  private stripe: any;

  constructor(
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
  ) {
    const mode = this.configService.get('STRIPE_MODE') || 'test';
    const key = mode === 'production'
      ? this.configService.get('STRIPE_SECRET_KEY_PROD')
      : (this.configService.get('STRIPE_SECRET_KEY_TEST') || this.configService.get('STRIPE_SECRET_KEY'));
    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2024-12-18.acacia' as any,
      });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('checkout')
  createCheckout(
    @Body() body: { eventId: string; seatIds?: string[]; sectionId?: string; quantity?: number; specialCode?: string; buyerEmail?: string; buyerName?: string },
    @Request() req: any,
  ) {
    return this.ordersService.createCheckoutSession(
      req.user.id,
      body.eventId,
      body.seatIds || [],
      body.sectionId,
      body.quantity,
      body.specialCode,
      body.buyerEmail,
      body.buyerName,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('door-sale/preview')
  previewDoorSale(
    @Query() query: { eventId: string; amount: string; quantity?: string; sectionId?: string },
    @Request() req: any,
  ) {
    return this.ordersService.previewDoorSale(
      req.user,
      query.eventId,
      Number(query.amount || 0),
      query.quantity ? parseInt(query.quantity, 10) : 1,
      query.sectionId,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('door-sale/checkout')
  createDoorSaleCheckout(
    @Body() body: { eventId: string; amount: number; quantity?: number; sectionId?: string; buyerEmail?: string; buyerName?: string },
    @Request() req: any,
  ) {
    return this.ordersService.createDoorSaleCheckout(
      req.user,
      body.eventId,
      Number(body.amount || 0),
      body.quantity || 1,
      body.sectionId,
      body.buyerEmail,
      body.buyerName,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('terminal/connection-token')
  createTerminalConnectionToken(@Request() req: any) {
    return this.ordersService.createTerminalConnectionToken(req.user);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('door-sale/tap-to-pay-intent')
  createDoorSaleTapToPayIntent(
    @Body() body: { eventId: string; amount: number; quantity?: number },
    @Request() req: any,
  ) {
    return this.ordersService.createDoorSaleTapToPayIntent(
      req.user,
      body.eventId,
      Number(body.amount || 0),
      body.quantity || 1,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('door-sale/tap-to-pay-complete')
  completeDoorSaleTapToPay(
    @Body() body: { orderId: string; paymentIntentId: string },
    @Request() req: any,
  ) {
    return this.ordersService.completeDoorSaleTapToPay(
      req.user,
      body.orderId,
      body.paymentIntentId,
    );
  }

  @SkipThrottle()
  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
    @Res() res: any,
  ) {
    const mode = this.configService.get('STRIPE_MODE') || 'test';
    const webhookSecret = mode === 'production'
      ? this.configService.get('STRIPE_WEBHOOK_SECRET_PROD')
      : (this.configService.get('STRIPE_WEBHOOK_SECRET_TEST') || this.configService.get('STRIPE_WEBHOOK_SECRET'));
    let event: any;

    try {
      // Fastify stores the raw body on req.rawBody (populated by NestJS rawBody:true option).
      // Stripe MUST receive the raw Buffer/string — a parsed object will fail HMAC verification.
      const rawBody = req.rawBody ?? req.body;
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret!);
    } catch (err: any) {
      console.error('❌ Webhook Signature Error:', err.message);
      // Return 400 so Stripe knows the webhook failed and will retry it.
      return res.status(400).send({ received: false, error: err.message });
    }

    try {
      await this.ordersService.handleStripeWebhook(event);
    } catch (err: any) {
      console.error('❌ Webhook Processing Error:', err.message);
      // Still return 200 so Stripe marks it as delivered; cron will recover any failed orders
    }
    return res.status(200).send({ received: true });
  }

  // Invoice preview (no auth needed — wizard uses this before payment)
  @Get('preview-invoice')
  previewInvoice(
    @Query() query: { eventId: string; seatIds?: string; sectionId?: string; quantity?: string },
  ) {
    const seatIds = query.seatIds ? query.seatIds.split(',').filter(Boolean) : [];
    return this.ordersService.previewInvoice(
      query.eventId,
      seatIds,
      query.sectionId,
      query.quantity ? parseInt(query.quantity, 10) : undefined,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-orders')
  getMyOrders(
    @Request() req: any,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20'
  ) {
    return this.ordersService.getUserOrders(req.user.id, parseInt(page, 10), parseInt(limit, 10));
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-tickets')
  getMyTickets(
    @Request() req: any,
    @Query('sessionId') sessionId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '12'
  ) {
    return this.ordersService.getUserTickets(req.user.id, sessionId, parseInt(page, 10), parseInt(limit, 10));
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('user/:userId/tickets')
  getUserTicketsForAdmin(@Param('userId') userId: string) {
    return this.ordersService.getUserTickets(userId);
  }

  // Public (unauthenticated) gate verification — returns a sanitized view only.
  @Get('ticket/:code')
  getTicketByCode(@Param('code') code: string) {
    return this.ordersService.getPublicTicketByCode(code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('ticket/:code/validate')
  validateTicket(@Param('code') code: string, @Request() req: any) {
    return this.ordersService.validateTicket(code, req.user);
  }

  @Get('ticket/:code/apple-wallet')
  async getAppleWallet(@Param('code') code: string, @Res() res: any) {
    const ticket = await this.ordersService.getTicketByCode(code);
    try {
      const buffer = await this.walletService.generateApplePass(ticket);
      res.type('application/vnd.apple.pkpass');
      res.header('Content-Disposition', `attachment; filename=ticket-${code}.pkpass`);
      res.send(buffer);
    } catch (err: any) {
      console.error('[OrdersController] Apple Wallet generation error:', err);
      res.status(503).send({ message: `Error: ${err.message || err}` });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('ticket/:code/resend-email')
  resendTicketEmail(
    @Param('code') code: string,
    @Request() req: any,
    @Body() body: { email?: string },
  ) {
    return this.ordersService.resendTicketEmailByCode(code, req.user.id, {
      overrideEmail: body?.email,
      isAdmin: req.user.role === 'admin',
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('ticket/:code/google-wallet')
  async getGoogleWallet(@Param('code') code: string) {
    const ticket = await this.ordersService.getTicketByCode(code);
    try {
      const url = await this.walletService.generateGoogleWalletLink(ticket);
      return { url };
    } catch (err: any) {
      throw new HttpException('Google Wallet no está configurado aún. Contacta al soporte.', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/recover/:orderId')
  recoverOrder(@Param('orderId') orderId: string) {
    return this.ordersService.fulfillPendingOrder(orderId);
  }

  // Organizer endpoints
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('event/:eventId/scanner-stats')
  getScannerStats(@Param('eventId') eventId: string, @Request() req: any) {
    return this.ordersService.getScannerEventStats(eventId, req.user);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('event/:eventId/sales')
  getEventSales(@Param('eventId') eventId: string, @Request() req: any) {
    return this.ordersService.getEventSales(eventId, req.user);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('organizer/stats')
  getOrganizerStats(@Request() req: any) {
    return this.ordersService.getOrganizerStats(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('event/:eventId/attendees')
  getEventAttendees(@Param('eventId') eventId: string, @Request() req: any) {
    return this.ordersService.getEventAttendees(eventId, req.user);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  getOrder(@Param('id') id: string, @Request() req: any) {
    return this.ordersService.getOrderById(id, req.user);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('seats/:seatId/toggle-block')
  toggleBlockSeat(
    @Param('seatId') seatId: string,
    @Request() req: any
  ) {
    return this.ordersService.toggleBlockSeat(seatId, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('event/:eventId/free-tickets')
  issueFreeTickets(
    @Param('eventId') eventId: string,
    @Body() body: { seatIds: string[]; email: string; name: string },
    @Request() req: any
  ) {
    return this.ordersService.issueFreeTickets(eventId, body.seatIds, body.email, body.name, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Post('event/:eventId/send-reminder')
  sendEventReminder(
    @Param('eventId') eventId: string,
    @Body() body: { daysUntilEvent?: number; customMessage?: string },
    @Request() req: any
  ) {
    return this.ordersService.sendEventReminder(
      eventId,
      req.user.id,
      body.daysUntilEvent,
      body.customMessage,
    );
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Put('event/:eventId/reminder-settings')
  saveReminderSettings(
    @Param('eventId') eventId: string,
    @Body() body: { autoReminderEnabled: boolean; autoReminderDays: number; autoReminderMessage?: string },
    @Request() req: any
  ) {
    return this.ordersService.saveReminderSettings(
      eventId,
      req.user.id,
      body,
    );
  }
}
