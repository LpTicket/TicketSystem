import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Request, RawBodyRequest, Req, Headers, Res,
  HttpException, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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
    const key = this.configService.get('STRIPE_SECRET_KEY');
    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2024-12-18.acacia' as any,
      });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('checkout')
  createCheckout(
    @Body() body: { eventId: string; seatIds?: string[]; sectionId?: string; quantity?: number; specialCode?: string },
    @Request() req: any,
  ) {
    return this.ordersService.createCheckoutSession(
      req.user.id,
      body.eventId,
      body.seatIds || [],
      body.sectionId,
      body.quantity,
      body.specialCode,
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    let event: any;

    try {
      const rawBody = req.rawBody || req.body;
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret!,
      );
    } catch (err: any) {
      console.error('❌ Webhook Signature Error:', err.message);
      return { received: false, error: `Webhook signature verification failed: ${err.message}` };
    }

    await this.ordersService.handleStripeWebhook(event);
    return { received: true };
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

  @Get('ticket/:code')
  getTicketByCode(@Param('code') code: string) {
    return this.ordersService.getTicketByCode(code);
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

  // Organizer endpoints
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('event/:eventId/sales')
  getEventSales(@Param('eventId') eventId: string) {
    return this.ordersService.getEventSales(eventId);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @Get('event/:eventId/attendees')
  getEventAttendees(@Param('eventId') eventId: string) {
    return this.ordersService.getEventAttendees(eventId);
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
