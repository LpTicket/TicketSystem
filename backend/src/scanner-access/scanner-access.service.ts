import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, MoreThanOrEqual, Repository } from 'typeorm';
import { Event, EventStatus, ScannerAccess, ScannerAccessStatus, User, UserRole } from '../database/entities';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class ScannerAccessService {
  constructor(
    @InjectRepository(ScannerAccess)
    private readonly scannerAccessRepo: Repository<ScannerAccess>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly ordersService: OrdersService,
  ) {}

  private async findEventForRequest(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId }, relations: ['organizer'] });
    if (!event) throw new NotFoundException('Event not found');
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Only published events can receive scanner access requests');
    }
    return event;
  }

  private async ensureOrganizerCanManage(eventId: string, user: any) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (user.role !== UserRole.ADMIN && event.organizerId !== user.id) {
      throw new ForbiddenException('You do not have permission to manage scanner access for this event');
    }
    return event;
  }

  async searchEvents(q: string) {
    const search = String(q || '').trim();
    if (search.length < 2) return [];
    const where = [
      { status: EventStatus.PUBLISHED, publicVisible: true, eventDate: MoreThanOrEqual(new Date()), title: ILike(`%${search}%`) },
      { status: EventStatus.PUBLISHED, publicVisible: true, eventDate: MoreThanOrEqual(new Date()), venueName: ILike(`%${search}%`) },
    ];
    return this.eventRepo.find({
      where,
      order: { eventDate: 'ASC' },
      take: 12,
      select: ['id', 'title', 'slug', 'eventDate', 'status', 'venueName', 'imageUrl', 'bannerImageUrl', 'organizerId'],
    });
  }

  async requestAccess(eventId: string, userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.isActive) throw new ForbiddenException('User is not active');

    const event = await this.findEventForRequest(eventId);
    if (event.organizerId === userId) {
      throw new BadRequestException('The organizer already has scanner access for this event');
    }

    let access = await this.scannerAccessRepo.findOne({ where: { eventId, userId }, relations: ['event', 'user'] });
    if (access) {
      if ([ScannerAccessStatus.REJECTED, ScannerAccessStatus.REVOKED].includes(access.status)) {
        access.status = ScannerAccessStatus.PENDING;
        access.approvedAt = null;
        access.rejectedAt = null;
        access.revokedAt = null;
        access.decidedById = null;
        return this.scannerAccessRepo.save(access);
      }
      return access;
    }

    access = this.scannerAccessRepo.create({
      eventId,
      organizerId: event.organizerId,
      userId,
      status: ScannerAccessStatus.PENDING,
    });
    await this.scannerAccessRepo.save(access);
    return this.scannerAccessRepo.findOneOrFail({ where: { id: access.id }, relations: ['event', 'user'] });
  }

  async getMine(userId: string) {
    return this.scannerAccessRepo.find({
      where: { userId },
      relations: ['event', 'user'],
      order: { requestedAt: 'DESC' },
    });
  }

  async getOrganizerRequests(user: any, eventId?: string) {
    if (eventId) await this.ensureOrganizerCanManage(eventId, user);
    const where: any = { organizerId: user.id };
    if (user.role === UserRole.ADMIN) delete where.organizerId;
    if (eventId) where.eventId = eventId;

    return this.scannerAccessRepo.find({
      where,
      relations: ['event', 'user', 'decidedBy'],
      order: { requestedAt: 'DESC' },
    });
  }

  async decideRequest(id: string, status: ScannerAccessStatus.APPROVED | ScannerAccessStatus.REJECTED | ScannerAccessStatus.REVOKED, user: any) {
    const access = await this.scannerAccessRepo.findOne({ where: { id }, relations: ['event', 'user'] });
    if (!access) throw new NotFoundException('Scanner access request not found');
    await this.ensureOrganizerCanManage(access.eventId, user);

    access.status = status;
    access.decidedById = user.id;
    access.approvedAt = status === ScannerAccessStatus.APPROVED ? new Date() : null;
    access.rejectedAt = status === ScannerAccessStatus.REJECTED ? new Date() : access.rejectedAt;
    access.revokedAt = status === ScannerAccessStatus.REVOKED ? new Date() : null;

    await this.scannerAccessRepo.save(access);
    return this.scannerAccessRepo.findOneOrFail({ where: { id }, relations: ['event', 'user', 'decidedBy'] });
  }

  async userCanScanEvent(userId: string, eventId: string) {
    const access = await this.scannerAccessRepo.findOne({
      where: { userId, eventId, status: ScannerAccessStatus.APPROVED },
    });
    return !!access;
  }

  async validateTicketForEmployee(eventId: string, code: string, user: any) {
    const access = await this.scannerAccessRepo.findOne({
      where: { eventId, userId: user.id, status: ScannerAccessStatus.APPROVED },
      relations: ['event'],
    });
    if (!access) {
      throw new ForbiddenException('You do not have scanner access for this event');
    }
    return this.ordersService.validateTicket(code, user, { eventId, allowScannerAccess: true });
  }
}
