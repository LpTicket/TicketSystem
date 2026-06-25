/**
 * VenueTemplatesService
 * EN: Reusable venue / seat-map templates an organizer can save and apply to
 *     new events instead of rebuilding the layout each time.
 * ES: Plantillas reutilizables de recinto / mapa de asientos que un organizador
 *     puede guardar y aplicar a nuevos eventos en lugar de reconstruir el diseño
 *     cada vez.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VenueTemplate } from '../database/entities/venue-template.entity';

@Injectable()
export class VenueTemplatesService {
  constructor(
    @InjectRepository(VenueTemplate)
    private venueTemplateRepository: Repository<VenueTemplate>,
  ) {}

  async findAll() {
    return this.venueTemplateRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async create(data: Partial<VenueTemplate>) {
    const template = this.venueTemplateRepository.create(data);
    return this.venueTemplateRepository.save(template);
  }

  async delete(id: string) {
    const result = await this.venueTemplateRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Template not found');
    }
  }
}
