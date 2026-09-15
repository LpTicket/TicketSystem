import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ValidateTicketDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsOptional()
  @IsIn(['qr', 'manual'])
  admissionMethod?: 'qr' | 'manual';
}
