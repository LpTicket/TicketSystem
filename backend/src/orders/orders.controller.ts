import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, Request, RawBodyRequest, Req, Headers, Res,
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
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia' as any,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('checkout')
  createCheckout(
    @Body() body: { eventId: string; seatIds?: string[]; sectionId?: string; quantity?: number },
    @Request() req: any,
  ) {
    return this.ordersService.createCheckoutSession(
      req.user.id,
      body.eventId,
      body.seatIds || [],
      body.sectionId,
      body.quantity,
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
      event = this.stripe.webhooks.constructEvent(
        req.rawBody! as any,
        signature,
        webhookSecret!,
      );
    } catch (err) {
      return { received: false, error: 'Webhook signature verification failed' };
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
  getMyOrders(@Request() req: any) {
    return this.ordersService.getUserOrders(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my-tickets')
  getMyTickets(@Request() req: any) {
    return this.ordersService.getUserTickets(req.user.id);
  }

  @Get('ticket/:code')
  getTicketByCode(@Param('code') code: string) {
    return this.ordersService.getTicketByCode(code);
  }

  @Post('ticket/:code/validate')
  validateTicket(@Param('code') code: string) {
    return this.ordersService.validateTicket(code);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('ticket/:code/apple-wallet')
  async getAppleWallet(@Param('code') code: string, @Res() res: any) {
    const ticket = await this.ordersService.getTicketByCode(code);
    const buffer = await this.walletService.generateApplePass(ticket);
    res.type('application/vnd.apple.pkpass');
    res.header('Content-Disposition', `attachment; filename=ticket-${code}.pkpass`);
    res.send(buffer);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('ticket/:code/google-wallet')
  async getGoogleWallet(@Param('code') code: string) {
    const ticket = await this.ordersService.getTicketByCode(code);
    const url = await this.walletService.generateGoogleWalletLink(ticket);
    return { url };
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
  getOrder(@Param('id') id: string) {
    return this.ordersService.getOrderById(id);
  }
}
