import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, IsNull, Repository } from 'typeorm';
import { Event, Order, OrderStatus, SpecialCode, SpecialCodePayout, User } from '../database/entities';

type CreateSpecialCodeDto = {
  code: string;
  ownerUserId: string;
  eventId?: string | null;
  isActive?: boolean;
  commissionFixed?: number;
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
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(SpecialCodePayout)
    private readonly payoutRepo: Repository<SpecialCodePayout>,
  ) {}

  normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/\s+/g, '');
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
        commissionFixed: dto.commissionFixed ?? 0,
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

    if (dto.commissionFixed !== undefined) {
      specialCode.commissionFixed = dto.commissionFixed;
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

  getMyCodeSales(ownerUserId: string) {
    return this.orderRepo.find({
      where: { specialCodeOwnerId: ownerUserId, status: OrderStatus.PAID },
      relations: ['event', 'user'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });
  }

  getAllCodeSales() {
    return this.orderRepo.find({
      where: { status: OrderStatus.PAID, specialCode: Not(IsNull()) },
      relations: ['event', 'user'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });
  }

  async getCommissionSummary() {
    const codes = await this.specialCodeRepo.find({ relations: ['owner', 'event'] });
    const orders = await this.orderRepo.find({
      where: { status: OrderStatus.PAID, specialCode: Not(IsNull()) },
      relations: ['event'],
    });
    // Helper: determine effective commission for a code
    const effectiveCommission = (code: typeof codes[number]) => {
      const eventCommission = code.event ? Number(code.event.creatorCommission || 0) : 0;
      return eventCommission > 0 ? eventCommission : Number(code.commissionFixed || 0);
    };
    const payouts = await this.payoutRepo.find({ relations: ['owner'], order: { paidAt: 'DESC' } });

    // Group by ownerUserId
    const ownerMap = new Map<string, {
      ownerUserId: string;
      ownerName: string;
      ownerEmail: string;
      codes: { code: string; commissionFixed: number; eventTitle: string | null }[];
      totalTickets: number;
      totalEarned: number;
      totalPaid: number;
      payouts: { id: string; amount: number; note: string | null; paidAt: Date }[];
    }>();

    for (const code of codes) {
      if (!ownerMap.has(code.ownerUserId)) {
        ownerMap.set(code.ownerUserId, {
          ownerUserId: code.ownerUserId,
          ownerName: code.owner ? `${code.owner.firstName} ${code.owner.lastName}` : code.ownerUserId,
          ownerEmail: code.owner?.email || '',
          codes: [],
          totalTickets: 0,
          totalEarned: 0,
          totalPaid: 0,
          payouts: [],
        });
      }
      const commission = effectiveCommission(code);
      ownerMap.get(code.ownerUserId)!.codes.push({
        code: code.code,
        commissionFixed: commission,
        eventTitle: code.event?.title || null,
      });
    }

    // Calculate earnings from orders
    for (const order of orders) {
      const code = codes.find((c) => c.code === order.specialCode);
      if (!code) continue;
      const entry = ownerMap.get(code.ownerUserId);
      if (!entry) continue;
      const commission = effectiveCommission(code);
      entry.totalTickets += order.ticketCount || 1;
      entry.totalEarned += commission * (order.ticketCount || 1);
    }

    // Add payouts
    for (const payout of payouts) {
      const entry = ownerMap.get(payout.ownerUserId);
      if (!entry) continue;
      entry.totalPaid += Number(payout.amount);
      entry.payouts.push({
        id: payout.id,
        amount: Number(payout.amount),
        note: payout.note,
        paidAt: payout.paidAt,
      });
    }

    return Array.from(ownerMap.values()).map((entry) => ({
      ...entry,
      balance: Math.round((entry.totalEarned - entry.totalPaid) * 100) / 100,
      totalEarned: Math.round(entry.totalEarned * 100) / 100,
      totalPaid: Math.round(entry.totalPaid * 100) / 100,
    }));
  }

  async recordPayout(ownerUserId: string, amount: number, note?: string) {
    const owner = await this.userRepo.findOne({ where: { id: ownerUserId } });
    if (!owner) throw new NotFoundException('Usuario no encontrado.');
    if (!amount || amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0.');

    return this.payoutRepo.save(
      this.payoutRepo.create({
        ownerUserId,
        amount,
        note: note?.trim() || null,
      }),
    );
  }
}
