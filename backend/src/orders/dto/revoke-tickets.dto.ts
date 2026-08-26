import { ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { TicketRevocationSeatAction } from '../../database/entities';

export class RevokeTicketsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ticketIds: string[];

  @IsEnum(TicketRevocationSeatAction)
  seatAction: TicketRevocationSeatAction;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
