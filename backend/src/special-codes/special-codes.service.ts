/**
 * SpecialCodesService
 * EN: Promoter/creator discount-and-commission codes — admin CRUD, per-event
 *     listing (ownership-checked), per-code commission, and payout summaries
 *     for code owners. Used to track and reward sales driven by each code.
 * ES: Códigos de descuento y comisión de promotor/creador — CRUD de admin,
 *     listado por evento (con verificación de propiedad), comisión por código y
 *     resúmenes de pagos para los dueños de códigos. Sirve para rastrear y
 *     recompensar las ventas generadas por cada código.
 */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  async getCodesByEvent(eventId: string, user?: { id: string; role?: string }) {
    // Authorization: only the event's organizer (or an admin) may list its codes,
    // owners and per-buyer commission data. Prevents IDOR by event id.
    if (user) {
      const event = await this.eventRepo.findOne({ where: { id: eventId } });
      if (!event) throw new NotFoundException('Evento no encontrado.');
      if (user.role !== 'admin' && event.organizerId !== user.id) {
        throw new ForbiddenException('No tienes permiso para ver los codigos de este evento.');
      }
    }

    const codes = await this.specialCodeRepo.find({
      where: { eventId },
      relations: ['owner', 'event'],
      order: { createdAt: 'ASC' },
    });

    const orders = await this.orderRepo.find({
      where: { eventId, status: OrderStatus.PAID, specialCode: Not(IsNull()) },
      relations: ['user'],
      order: { paidAt: 'DESC', createdAt: 'DESC' },
    });

    return codes.map((code) => {
      const codeOrders = orders.filter((order) => String(order.specialCode || '').toUpperCase() === code.code);
      const eventCommission = code.event ? Number(code.event.creatorCommission || 0) : 0;
      const commission = Number(code.commissionFixed || 0) > 0 ? Number(code.commissionFixed || 0) : eventCommission;
      const ticketCount = codeOrders.reduce((sum, order) => sum + Number(order.ticketCount || 1), 0);

      return {
        ...code,
        ticketCount,
        totalGenerated: Math.round(ticketCount * commission * 100) / 100,
        orders: codeOrders.map((order) => ({
          id: order.id,
          ticketCount: Number(order.ticketCount || 1),
          total: Number(order.total || 0),
          paidAt: order.paidAt || order.createdAt,
          commissionGenerated: Math.round(Number(order.ticketCount || 1) * commission * 100) / 100,
          buyer: order.user ? {
            firstName: order.user.firstName,
            lastName: order.user.lastName,
            email: order.user.email,
          } : null,
        })),
      };
    });
  }

  async updateCodeRewardByOrganizer(codeId: string, eventId: string, organizerId: string, commissionFixed: number) {
    const event = await this.eventRepo.findOne({ where: { id: eventId, organizerId } });
    if (!event) throw new ForbiddenException('No tienes acceso a este evento.');
    const code = await this.specialCodeRepo.findOne({ where: { id: codeId, eventId } });
    if (!code) throw new NotFoundException('Código no encontrado.');
    if (commissionFixed < 0) throw new BadRequestException('El monto no puede ser negativo.');
    code.commissionFixed = commissionFixed;
    return this.specialCodeRepo.save(code);
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

  async getMyPayoutSummary(ownerUserId: string) {
    const summary = await this.getCommissionSummary();
    return summary.filter((entry) => entry.ownerUserId === ownerUserId);
  }

  async getEventPayoutSummary(eventId: string, user: { id: string; role?: string }) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado.');
    if (user.role !== 'admin' && event.organizerId !== user.id) {
      throw new ForbiddenException('No tienes permiso para ver los pagos de este evento.');
    }

    const [codes, summary] = await Promise.all([
      this.specialCodeRepo.find({ where: { eventId }, relations: ['owner', 'event'] }),
      this.getCommissionSummary(),
    ]);
    const entries = summary.filter((entry) => entry.eventId === eventId);
    const totalEarned = entries.reduce((sum, entry) => sum + Number(entry.totalEarned || 0), 0);
    const totalPaid = entries.reduce((sum, entry) => sum + Number(entry.totalPaid || 0), 0);
    const balance = entries.reduce((sum, entry) => sum + Number(entry.balance || 0), 0);

    return {
      eventId,
      eventTitle: event.title,
      activeCodes: codes.filter((code) => code.isActive).length,
      totalCodes: codes.length,
      totalEarned: Math.round(totalEarned * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      balance: Math.round(balance * 100) / 100,
      pending: Math.round(balance * 100) / 100,
      entries,
    };
  }

  async getCommissionSummary() {
    const [codes, orders, payouts] = await Promise.all([
      this.specialCodeRepo.find({ relations: ['owner', 'event'] }),
      this.orderRepo.find({
        where: { status: OrderStatus.PAID, specialCode: Not(IsNull()) },
        relations: ['event'],
      }),
      this.payoutRepo.find({ relations: ['owner', 'event'], order: { paidAt: 'DESC' } }),
    ]);

    const findCodeForOrder = (order: typeof orders[number]) => {
      const orderCode = String(order.specialCode || '').toUpperCase();
      return codes.find((code) => {
        const sameId = order.specialCodeId && code.id === order.specialCodeId;
        const sameCode = code.code === orderCode;
        const sameEvent = !code.eventId || code.eventId === order.eventId;
        return sameId || (sameCode && sameEvent);
      });
    };

    const effectiveCommission = (code: typeof codes[number], event?: Event | null) => {
      const codeCommission = Number(code.commissionFixed || 0);
      if (codeCommission > 0) return codeCommission;
      return Number((event || code.event)?.creatorCommission || 0);
    };

    const summaryMap = new Map<string, {
      eventId: string;
      eventTitle: string;
      ownerUserId: string;
      ownerName: string;
      ownerEmail: string;
      codes: { code: string; commissionFixed: number; eventTitle: string | null }[];
      totalTickets: number;
      totalEarned: number;
      totalPaid: number;
      payouts: { id: string; amount: number; note: string | null; paidAt: Date }[];
    }>();

    const ensureEntry = (eventId: string, eventTitle: string, code: typeof codes[number]) => {
      const key = `${eventId}:${code.ownerUserId}`;
      if (!summaryMap.has(key)) {
        summaryMap.set(key, {
          eventId,
          eventTitle,
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
      return summaryMap.get(key)!;
    };

    for (const order of orders) {
      const code = findCodeForOrder(order);
      if (!code || !order.eventId) continue;
      const eventTitle = order.event?.title || code.event?.title || 'Evento';
      const commission = effectiveCommission(code, order.event);
      const ticketCount = Number(order.ticketCount || 1);
      const entry = ensureEntry(order.eventId, eventTitle, code);
      entry.totalTickets += ticketCount;
      entry.totalEarned += commission * ticketCount;

      if (!entry.codes.some((item) => item.code === code.code)) {
        entry.codes.push({
          code: code.code,
          commissionFixed: commission,
          eventTitle,
        });
      }
    }

    for (const payout of payouts) {
      if (!payout.eventId) continue;
      const relatedCode = codes.find((code) => code.ownerUserId === payout.ownerUserId && (!code.eventId || code.eventId === payout.eventId));
      if (!relatedCode) continue;
      const eventTitle = payout.event?.title || relatedCode.event?.title || 'Evento';
      const entry = ensureEntry(payout.eventId, eventTitle, relatedCode);
      entry.totalPaid += Number(payout.amount);
      entry.payouts.push({
        id: payout.id,
        amount: Number(payout.amount),
        note: payout.note,
        paidAt: payout.paidAt,
      });
    }

    return Array.from(summaryMap.values())
      .map((entry) => ({
        ...entry,
        balance: Math.round((entry.totalEarned - entry.totalPaid) * 100) / 100,
        totalEarned: Math.round(entry.totalEarned * 100) / 100,
        totalPaid: Math.round(entry.totalPaid * 100) / 100,
      }))
      .sort((a, b) => b.balance - a.balance || a.eventTitle.localeCompare(b.eventTitle));
  }

  async recordPayout(eventId: string, ownerUserId: string, amount: number, note?: string) {
    const owner = await this.userRepo.findOne({ where: { id: ownerUserId } });
    if (!owner) throw new NotFoundException('Usuario no encontrado.');
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado.');
    if (!amount || amount <= 0) throw new BadRequestException('El monto debe ser mayor a 0.');

    const summary = await this.getCommissionSummary();
    const entry = summary.find((item) => item.eventId === eventId && item.ownerUserId === ownerUserId);
    if (!entry || entry.balance <= 0) throw new BadRequestException('No hay saldo pendiente para este creador en este evento.');
    if (amount > entry.balance + 0.001) throw new BadRequestException('El pago no puede ser mayor al saldo pendiente.');

    return this.payoutRepo.save(
      this.payoutRepo.create({
        eventId,
        ownerUserId,
        amount,
        note: note?.trim() || null,
      }),
    );
  }
  async remove(id: string) {
    const code = await this.specialCodeRepo.findOne({ where: { id } });
    if (!code) {
      throw new NotFoundException('Special code not found');
    }

    await this.specialCodeRepo.delete(id);
    return { deleted: true };
  }

}
