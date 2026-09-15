import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class TapPaymentStatusDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @Matches(/^pi_[a-zA-Z0-9]+$/)
  paymentIntentId: string;

  @IsOptional()
  @IsIn(['verify', 'cancel'])
  action?: 'verify' | 'cancel';
}
