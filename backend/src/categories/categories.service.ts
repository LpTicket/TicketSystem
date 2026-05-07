import { Injectable, NotFoundException, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventCategoryEntity } from '../database/entities';

// Default system categories seeded on first startup
const SYSTEM_CATEGORIES = [
  { slug: 'concierto',   labelEs: 'Concierto',   labelEn: 'Concert',    icon: '🎵', color: '#f97316', sortOrder: 0 },
  { slug: 'teatro',      labelEs: 'Teatro',      labelEn: 'Theater',    icon: '🎭', color: '#8b5cf6', sortOrder: 1 },
  { slug: 'festival',    labelEs: 'Festival',    labelEn: 'Festival',   icon: '🎪', color: '#ec4899', sortOrder: 2 },
  { slug: 'comedia',     labelEs: 'Comedia',     labelEn: 'Comedy',     icon: '😂', color: '#eab308', sortOrder: 3 },
  { slug: 'deporte',     labelEs: 'Deporte',     labelEn: 'Sports',     icon: '⚽', color: '#22c55e', sortOrder: 4 },
  { slug: 'conferencia', labelEs: 'Conferencia', labelEn: 'Conference', icon: '🎤', color: '#06b6d4', sortOrder: 5 },
  { slug: 'infantil',    labelEs: 'Infantil',    labelEn: 'Kids',       icon: '🧒', color: '#3b82f6', sortOrder: 6 },
  { slug: 'otro',        labelEs: 'Otro',        labelEn: 'Other',      icon: '🎫', color: '#6b7280', sortOrder: 7 },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(EventCategoryEntity)
    private readonly categoryRepo: Repository<EventCategoryEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  /** Seed default categories once on startup if table is empty */
  async onModuleInit() {
    // Migrate events.category from PostgreSQL enum to varchar (safe no-op if already varchar)
    try {
      await this.dataSource.query(
        `ALTER TABLE events ALTER COLUMN category TYPE VARCHAR(50) USING category::text`,
      );
    } catch {
      // Column is already varchar or table doesn't exist yet — ignore
    }

    const count = await this.categoryRepo.count();
    if (count === 0) {
      await this.categoryRepo.save(
        SYSTEM_CATEGORIES.map((c) => this.categoryRepo.create(c)),
      );
    }
  }

  findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    return this.categoryRepo.find({ where, order: { sortOrder: 'ASC', labelEs: 'ASC' } });
  }

  async findOne(id: string) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Categoría no encontrada');
    return cat;
  }

  async create(dto: {
    slug: string; labelEs: string; labelEn: string;
    icon?: string; color?: string; sortOrder?: number;
  }) {
    const existing = await this.categoryRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Ya existe una categoría con el slug "${dto.slug}"`);
    const cat = this.categoryRepo.create(dto);
    return this.categoryRepo.save(cat);
  }

  async update(id: string, dto: Partial<{
    slug: string; labelEs: string; labelEn: string;
    icon: string; color: string; sortOrder: number; isActive: boolean;
  }>) {
    const cat = await this.findOne(id);
    Object.assign(cat, dto);
    return this.categoryRepo.save(cat);
  }

  async remove(id: string) {
    const cat = await this.findOne(id);
    await this.categoryRepo.remove(cat);
    return { deleted: true };
  }
}
