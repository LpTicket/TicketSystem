import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, UseGuards, Query, Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CategoriesService } from './categories.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../database/entities';
import { IsString, IsOptional, IsBoolean, IsNumber, IsHexColor, Length } from 'class-validator';
import { Type } from 'class-transformer';

class CreateCategoryDto {
  @IsString() @Length(1, 50) slug: string;
  @IsString() @Length(1, 100) labelEs: string;
  @IsString() @Length(1, 100) labelEn: string;
  @IsOptional() @IsString() @Length(0, 120) subtitleEs?: string;
  @IsOptional() @IsString() @Length(0, 120) subtitleEn?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsNumber() @Type(() => Number) sortOrder?: number;
  @IsOptional() @IsString() imageData?: string | null;
}

class UpdateCategoryDto {
  @IsOptional() @IsString() @Length(1, 50) slug?: string;
  @IsOptional() @IsString() @Length(1, 100) labelEs?: string;
  @IsOptional() @IsString() @Length(1, 100) labelEn?: string;
  @IsOptional() @IsString() @Length(0, 120) subtitleEs?: string;
  @IsOptional() @IsString() @Length(0, 120) subtitleEn?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsNumber() @Type(() => Number) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() imageData?: string | null;
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /** Public: returns the updatedAt of the most recently modified category — clients poll this to detect changes */
  @Get('version')
  getVersion() {
    return this.categoriesService.getVersion();
  }

  /** Public: list active categories for dropdowns */
  @Get()
  findAll(@Query('all') all?: string) {
    return this.categoriesService.findAll(all === 'true');
  }

  @Get(':slug/image')
  async getImage(@Param('slug') slug: string, @Res() res: any) {
    const image = await this.categoriesService.getImageBySlug(slug);
    res.header('Content-Type', image.mimeType);
    res.header('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    res.header('Content-Length', image.buffer.length);
    return res.send(image.buffer);
  }

  /** Admin only: create new category */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  /** Admin only: update category */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  /** Admin only: delete category */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }
}
