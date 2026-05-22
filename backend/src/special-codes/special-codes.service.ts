import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, Order, OrderStatus, SpecialCode, User } from '../database/entities';

type SaveSpecialCodeDto = {
  code: string;
  ownerUserId: string;
  eventId?: string | null;
  isActive?: boolean;
};

@Injectable()
export class SpecialCodesService {
  constructor(
    @InjectRepository(SpecialCode)
    private readonly specialCodeRepo: Repository<SpecialCode>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

  async validateForCheckout(code: string | undefined | null, eventId: string) {
    const normalizedCode = this.normalizeCode(code || '');
    if (!normalizedCode) return null;

    const specialCode = await this.specialCodeRepo.findOne({
      where: { code: normalizedCode },
      relations: ['owner', 'event'],
    });

    if (!specialCode || !specialCode.isActive) {
      throw new BadRequestException('Código especial inválido o inactivo.');
    }

    if (specialCode.eventId && specialCode.eventId !== eventId) {
      throw new BadRequestException('Este código especial no aplica para este evento.');
    }

    return {
      id: specialCode.id,
      code: specialCode.code,
      ownerUserId: specialCode.ownerUserId,
      ownerName: specialCode.owner ? `${specialCode.owner.firstName} ${specialCode.owner.lastName}`.trim() : '',
      eventId: specialCode.eventId,
      eventTitle: specialCode.event?.title || null,
    };
  }

  async createCode(dto: SaveSpecialCodeDto) {
    const owner = await this.userRepo.findOne({ where: { id: dto.ownerUserId } });
    if (!owner) throw new NotFoundException('Usuario dueño del código no encontrado.');

    if (dto.eventId) {
      const event = await this.eventRepo.findOne({ where: { id: dto.eventId } });
      if (!event) throw new NotFoundException('Evento no encontrado.');
    }

    const code = this.normalizeCode(dto.code);
    if (!code) throw new BadRequestException('El código especial es requerido.');

    const existing = await this.specialCodeRepo.findOne({ where: { code } });
    if (existing) throw new BadRequestException('Ese código especial ya existe.');

    return this.specialCodeRepo.save(this.specialCodeRepo.create({
      code,
      ownerUserId: dto.ownerUserId,
      eventId: dto.eventId || null,
      isActive: dto.isActive ?? true,
    }));
  }

  async updateCode(id: string, dto: Partial<SaveSpecialCodeDto>) {
    const specialCode = await this.specialCodeRepo.findOne({ where: { id } });
    if (!specialCode) throw new NotFoundException('Código especial no encontrado.');

    if (dto.ownerUserId !== undefined) {
      const owner = await this.userRepo.findOne({ where: { id: dto.ownerUserId } });
      if (!owner) throw new NotFoundException('Usuario dueño del código no encontrado.');
      specialCode.ownerUserId = dto.ownerUserId;
    }

    if (dto.eventId !== undefined) {
      if (dto.eventId) {
        const event = await this.eventRepo.findOne({ where: { id: dto.eventId } });
        if (!event) throw new NotFoundException('Evento no encontrado.');
      }
      specialCode.eventId = dto.eventId || null;
    }

    if (dto.code !== undefined) {
      const code = this.normalizeCode(dto.code);
      if (!code) throw new BadRequestException('El código especial es requerido.');
      const duplicate = await this.specialCodeRepo.findOne({ where: { code } });
      if (duplicate && duplicate.id !== id) throw new BadRequestException('Ese código especial ya existe.');
      specialCode.code = code;
    }

    if (dto.isActive !== undefined) specialCode.isActive = dto.isActive;

    return this.specialCodeRepo.save(specialCode);
  }

  getAllCodes() {
    return this.specialCodeRepo.find({
      relations: ['owner', 'event'],
      order: { createdAt: 'DESC' },
    });
  }

  getMyCodes(userId: string) {
    return this.specialCodeRepo.find({
      where: { ownerUserId: userId },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMySales(userId: string) {
    const orders = await this.orderRepo.find({
      where: { specialCodeOwnerId: userId, status: OrderStatus.PAID },
      relations: ['event', 'user', 'specialCodeEntity'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });

    return orders.map((order) => ({
      id: order.id,
      code: order.specialCode,
      ownerUserId: order.specialCodeOwnerId,
      eventTitle: order.event?.title || '',
      buyerName: order.user ? `${order.user.firstName} ${order.user.lastName}`.trim() : '',
      buyerEmail: order.user?.email || '',
      ticketCount: order.ticketCount,
      total: Number(order.total),
      currency: order.event?.currency || 'USD',
      purchasedAt: order.paidAt || order.createdAt,
    }));
  }

  async getAllSales() {
    const orders = await this.orderRepo.find({
      where: { status: OrderStatus.PAID },
      relations: ['event', 'user', 'specialCodeEntity', 'specialCodeOwner'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });

    return orders
      .filter((order) => Boolean(order.specialCodeId))
      .map((order) => ({
        id: order.id,
        code: order.specialCode,
        ownerUserId: order.specialCodeOwnerId,
        ownerName: order.specialCodeOwner ? `${order.specialCodeOwner.firstName} ${order.specialCodeOwner.lastName}`.trim() : '',
        eventTitle: order.event?.title || '',
        buyerName: order.user ? `${order.user.firstName} ${order.user.lastName}`.trim() : '',
        buyerEmail: order.user?.email || '',
        ticketCount: order.ticketCount,
        total: Number(order.total),
        currency: order.event?.currency || 'USD',
        purchasedAt: order.paidAt || order.createdAt,
      }));
  }
}
