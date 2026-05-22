import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, SpecialCode, User } from '../database/entities';

type CreateSpecialCodeDto = {
  code: string;
  ownerUserId: string;
  eventId?: string | null;
  isActive?: boolean;
};

type UpdateSpecialCodeDto = Partial<CreateSpecialCodeDto>;

@Injectable()
export class SpecialCodesService {
  constructor(
    @InjectRepository(SpecialCode)
    private readonly specialCodeRepo: Repository<SpecialCode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  async validateForCheckout(code?: string, eventId?: string) {
    if (!code || !code.trim()) return null;

    const normalized = this.normalizeCode(code);
    const specialCode = await this.specialCodeRepo.findOne({
      where: { code: normalized, isActive: true },
    });

    if (!specialCode) {
      throw new BadRequestException('Codigo especial invalido o inactivo.');
    }

    if (specialCode.eventId && eventId && specialCode.eventId !== eventId) {
      throw new BadRequestException('Este codigo especial no aplica para este evento.');
    }

    return specialCode;
  }

  async createCode(dto: CreateSpecialCodeDto) {
    const code = this.normalizeCode(dto.code);
    if (!code) throw new BadRequestException('El codigo es requerido.');

    const owner = await this.userRepo.findOne({ where: { id: dto.ownerUserId } });
    if (!owner) throw new NotFoundException('Usuario dueno del codigo no encontrado.');

    if (dto.eventId) {
      const event = await this.eventRepo.findOne({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Evento no encontrado.');
    }

    const existing = await this.specialCodeRepo.findOne({ where: { code } });
    if (existing) throw new BadRequestException('Este codigo especial ya existe.');

    return this.specialCodeRepo.save(
      this.specialCodeRepo.create({
        code,
        ownerUserId: dto.ownerUserId,
        eventId: dto.eventId || null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateCode(id: string, dto: UpdateSpecialCodeDto) {
    const specialCode = await this.specialCodeRepo.findOne({ where: { id } });
    if (!specialCode) throw new NotFoundException('Codigo especial no encontrado.');

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (!code) throw new BadRequestException('El codigo es requerido.');
      specialCode.code = code;
    }

    if (dto.ownerUserId !== undefined) {
      const owner = await this.userRepo.findOne({ where: { id: dto.ownerUserId } });
      if (!owner) throw new NotFoundException('Usuario dueno del codigo no encontrado.');
      specialCode.ownerUserId = dto.ownerUserId;
    }

    if (dto.eventId !== undefined) {
      if (dto.eventId) {
        const event = await this.eventRepo.findOne({ where: { id: dto.eventId } });
        if (!event) throw new NotFoundException('Evento no encontrado.');
      }
      specialCode.eventId = dto.eventId || null;
    }

    if (dto.isActive !== undefined) {
      specialCode.isActive = dto.isActive;
    }

    return this.specialCodeRepo.save(specialCode);
  }

  getAllCodes() {
    return this.specialCodeRepo.find({
      relations: ['owner', 'event'],
      order: { createdAt: 'DESC' },
    });
  }

  getMyCodes(ownerUserId: string) {
    return this.specialCodeRepo.find({
      where: { ownerUserId },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }
}
