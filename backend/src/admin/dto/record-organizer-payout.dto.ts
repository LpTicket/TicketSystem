import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RecordOrganizerPayoutDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
