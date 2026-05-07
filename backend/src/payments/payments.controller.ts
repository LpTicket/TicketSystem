import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service';
import { PaymentMethodType } from '../database/entities/payment-method.entity';

@Controller('payments')
@UseGuards(AuthGuard('jwt'))
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('methods')
  getPaymentMethods(@Request() req: any) {
    return this.paymentsService.getPaymentMethods(req.user.id);
  }

  @Post('methods')
  addPaymentMethod(
    @Request() req: any,
    @Body() body: { type: PaymentMethodType; last4: string; brand: string; providerId: string; isDefault?: boolean }
  ) {
    return this.paymentsService.addPaymentMethod(req.user.id, body);
  }

  @Delete('methods/:id')
  deletePaymentMethod(@Request() req: any, @Param('id') id: string) {
    return this.paymentsService.deletePaymentMethod(req.user.id, id);
  }
}
