import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class FreeRegistrationDto {
  @IsUUID()
  eventId: string;

  @IsUUID()
  requestId: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  seatIds?: string[];

  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsEmail()
  @MaxLength(254)
  buyerEmail: string;

  @IsString()
  @MaxLength(100)
  buyerName: string;
}
