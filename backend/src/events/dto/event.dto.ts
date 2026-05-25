import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsNumber, Min } from 'class-validator';
import { EventCategory } from '../../database/entities';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  category: string;

  @IsString()
  venueName: string;

  @IsOptional()
  @IsString()
  venueAddress?: string;

  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsString()
  eventTimezone?: string;

  @IsOptional()
  @IsDateString()
  doorsOpen?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  hasSeatMap?: boolean;

  @IsOptional()
  @IsBoolean()
  showStage?: boolean;

  @IsOptional()
  @IsString()
  bannerPosition?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTicketsPerTransaction?: number;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  venueName?: string;

  @IsOptional()
  @IsString()
  venueAddress?: string;

  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @IsOptional()
  @IsString()
  eventTimezone?: string;

  @IsOptional()
  @IsDateString()
  doorsOpen?: string;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  publicVisible?: boolean;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  hasSeatMap?: boolean;

  @IsOptional()
  @IsBoolean()
  showStage?: boolean;

  @IsOptional()
  @IsString()
  bannerPosition?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTicketsPerTransaction?: number;
}

export class EventQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  includePast?: string;
}
