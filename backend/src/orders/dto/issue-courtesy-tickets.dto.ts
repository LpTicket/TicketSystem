import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class IssueCourtesyTicketsDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  seatIds?: string[];

  @IsOptional()
  @IsUUID('4')
  sectionId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  quantity?: number;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsIn(['courtesy', 'sponsor', 'press', 'staff'])
  courtesyType?: 'courtesy' | 'sponsor' | 'press' | 'staff';

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
