import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Event, EventStatus, EventCategory, VenueSection, Seat, SeatStatus, User, Ticket, Order } from '../database/entities';
import { CreateEventDto, UpdateEventDto, EventQueryDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(VenueSection)
    private readonly sectionRepo: Repository<VenueSection>,
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
  ) {}

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }

  async create(dto: CreateEventDto, organizerId: string) {
    const slug = this.generateSlug(dto.title);
    const event = this.eventRepo.create({
      ...dto,
      slug,
      organizerId,
      currency: dto.currency || 'USD',
      status: EventStatus.DRAFT,
    });
    return this.eventRepo.save(event);
  }

  async findAll(query: EventQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const { MoreThanOrEqual, LessThanOrEqual, Between } = require('typeorm');
    const where: any = { status: EventStatus.PUBLISHED };

    // Default to future events only unless includePast or custom start date is supplied
    if (query.includePast !== 'true' && !query.startDate) {
      where.eventDate = MoreThanOrEqual(new Date());
    }

    if (query.category) where.category = query.category;
    if (query.search) where.title = ILike(`%${query.search}%`);

    // Price Filtering
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      where.minPrice = Between(query.minPrice, query.maxPrice);
    } else if (query.minPrice !== undefined) {
      where.minPrice = MoreThanOrEqual(query.minPrice);
    } else if (query.maxPrice !== undefined) {
      where.minPrice = LessThanOrEqual(query.maxPrice);
    }

    // Date Filtering
    if (query.startDate && query.endDate) {
      where.eventDate = Between(new Date(query.startDate), new Date(query.endDate));
    } else if (query.startDate) {
      where.eventDate = MoreThanOrEqual(new Date(query.startDate));
    } else if (query.endDate) {
      if (query.includePast === 'true') {
        where.eventDate = LessThanOrEqual(new Date(query.endDate));
      } else {
        where.eventDate = Between(new Date(), new Date(query.endDate));
      }
    }

    const [events, total] = await this.eventRepo.findAndCount({
      where,
      order: { eventDate: 'ASC' },
      skip,
      take: limit,
      relations: ['organizer'],
    });

    return {
      events,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFeatured() {
    const { MoreThanOrEqual } = require('typeorm');
    return this.eventRepo.find({
      where: { 
        status: EventStatus.PUBLISHED, 
        isFeatured: true,
        eventDate: MoreThanOrEqual(new Date())
      },
      order: { eventDate: 'ASC' },
      take: 6,
    });
  }

  async findBySlug(slug: string) {
    const event = await this.eventRepo.findOne({
      where: { slug },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const sections = await this.sectionRepo.find({
      where: { eventId: event.id },
      order: { sortOrder: 'ASC' },
    });

    return { ...event, sections };
  }

  async findById(id: string) {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async update(id: string, dto: UpdateEventDto, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para editar este evento');
    }
    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      await this.eventRepo.update(id, {
        pendingTitle: dto.title,
        pendingDescription: dto.description,
        pendingVenueName: dto.venueName,
        pendingEventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        pendingCategory: dto.category,
      });
    } else {
      await this.eventRepo.update(id, dto);
    }
    return this.findById(id);
  }

  async publish(id: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException();
    }

    await this.eventRepo.update(id, {
      status: EventStatus.PENDING_APPROVAL,
    });
    return this.findById(id);
  }

  async delete(id: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException();
    }
    
    // Cascade delete related entities to avoid foreign key constraint violations
    await this.eventRepo.manager.transaction(async (manager) => {
      // 1. Delete tickets
      await manager.delete(Ticket, { eventId: id });
      
      // 2. Delete orders
      await manager.delete(Order, { eventId: id });
      
      // 3. Delete seats (must be done by finding sections first, or by join, but simpler is to delete all seats for sections of this event)
      const sections = await manager.find(VenueSection, { where: { eventId: id } });
      if (sections.length > 0) {
        const sectionIds = sections.map(s => s.id);
        // TypeORM delete with IN clause
        await manager.createQueryBuilder().delete().from(Seat).where("sectionId IN (:...sectionIds)", { sectionIds }).execute();
        
        // 4. Delete sections
        await manager.delete(VenueSection, { eventId: id });
      }
      
      // 5. Delete event
      await manager.delete(Event, { id });
    });
    
    return { message: 'Evento eliminado' };
  }

  async uploadImage(id: string, url: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException();
    }
    
    // If it's a full URL, a data URI (Base64), or already an absolute path, use it as is.
    const imageUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) ? url : `/uploads/${url}`;

    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      await this.eventRepo.update(id, { pendingImageUrl: imageUrl });
    } else {
      await this.eventRepo.update(id, { imageUrl });
    }
    return { imageUrl };
  }

  async uploadBannerImage(id: string, url: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException();
    }
    
    // If it's a full URL, a data URI (Base64), or already an absolute path, use it as is.
    const bannerImageUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) ? url : `/uploads/${url}`;

    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      await this.eventRepo.update(id, { pendingBannerImageUrl: bannerImageUrl });
    } else {
      await this.eventRepo.update(id, { bannerImageUrl });
    }
    return { bannerImageUrl };
  }

  async deleteImage(id: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') throw new ForbiddenException();

    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      event.pendingImageUrl = null;
    } else {
      event.imageUrl = null;
    }
    await this.eventRepo.save(event);
    return { success: true };
  }

  async deleteBannerImage(id: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') throw new ForbiddenException();

    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      event.pendingBannerImageUrl = null;
    } else {
      event.bannerImageUrl = null;
    }
    await this.eventRepo.save(event);
    return { success: true };
  }

  async getOrganizerEvents(organizerId: string) {
    return this.eventRepo.find({
      where: { organizerId },
      order: { createdAt: 'DESC' },
    });
  }

  // Seat map management
  async createSection(eventId: string, data: Partial<VenueSection>, userId: string) {
    const event = await this.findById(eventId);
    if (event.organizerId !== userId) throw new ForbiddenException();

    const section = this.sectionRepo.create({ ...data, eventId });
    const saved = await this.sectionRepo.save(section);

    // Generate seats for seated, vip OR table sections
    if (saved.sectionType === 'seated' || saved.sectionType === 'vip' || saved.sectionType === 'table') {
      const seats: Partial<Seat>[] = [];
      
      if (saved.sectionType === 'table') {
        // For tables, we use capacity as the number of seats around the table
        const seatCount = saved.seatsPerRow || 6; // Default to 6 if not specified
        for (let s = 1; s <= seatCount; s++) {
          seats.push({
            sectionId: saved.id,
            rowLabel: 'Mesa',
            seatNumber: s,
            status: SeatStatus.AVAILABLE,
          });
        }
      } else {
        // Standard grid for seated/vip
        for (let r = 1; r <= saved.rows; r++) {
          const rowLabel = String.fromCharCode(64 + r); // A, B, C...
          for (let s = 1; s <= saved.seatsPerRow; s++) {
            seats.push({
              sectionId: saved.id,
              rowLabel,
              seatNumber: s,
              status: SeatStatus.AVAILABLE,
            });
          }
        }
      }
      
      if (seats.length > 0) {
        await this.seatRepo.save(seats);
      }
    }

    return saved;
  }

  async getSections(eventId: string) {
    return this.sectionRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC' },
    });
  }

  async syncSections(
    eventId: string,
    sectionsData: any[],
    userId: string,
    viewportOpts?: { defaultViewX?: number; defaultViewY?: number; defaultViewZoom?: number; showStage?: boolean },
  ) {
    const event = await this.findById(eventId);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para gestionar este mapa');
    }

    if (viewportOpts) {
      if (typeof viewportOpts.defaultViewX === 'number') event.defaultViewX = viewportOpts.defaultViewX;
      if (typeof viewportOpts.defaultViewY === 'number') event.defaultViewY = viewportOpts.defaultViewY;
      if (typeof viewportOpts.defaultViewZoom === 'number') event.defaultViewZoom = viewportOpts.defaultViewZoom;
      if (typeof viewportOpts.showStage === 'boolean') event.showStage = viewportOpts.showStage;
      await this.eventRepo.save(event);
    }

    const existingSections = await this.sectionRepo.find({ where: { eventId } });
    const incomingIds = sectionsData.filter(s => s.id && !s.id.startsWith('temp-')).map(s => s.id);

    // 1. Delete sections that are in DB but NOT in incoming request
    const toDelete = existingSections.filter(s => !incomingIds.includes(s.id));
    if (toDelete.length > 0) {
      await this.sectionRepo.remove(toDelete);
    }

    // 2. Update existing or Create new
    for (const data of sectionsData) {
      const isNew = !data.id || data.id.startsWith('temp-');
      
      const sectionData = { ...data };
      if (isNew) delete sectionData.id;

      if (isNew) {
        await this.createSection(eventId, sectionData, userId);
      } else {
        // Only update if it belongs to this event
        const exists = existingSections.find(s => s.id === data.id);
        if (exists) {
          // Check if layout changed to regenerate seats
          const layoutChanged = 
            exists.rows !== sectionData.rows || 
            exists.seatsPerRow !== sectionData.seatsPerRow ||
            exists.sectionType !== sectionData.sectionType;

          await this.sectionRepo.update(data.id, sectionData);

          if (layoutChanged) {
            // Delete old seats and regenerate
            await this.seatRepo.delete({ sectionId: data.id });
            
            const updated = await this.sectionRepo.findOne({ where: { id: data.id } });
            if (updated && (updated.sectionType === 'seated' || updated.sectionType === 'vip' || updated.sectionType === 'table')) {
               const seats: Partial<Seat>[] = [];
               const overrides = updated.seatsConfig ? JSON.parse(updated.seatsConfig) : {};
               
               if (updated.sectionType === 'table') {
                 const seatCount = updated.seatsPerRow || 6;
                 for (let s = 1; s <= seatCount; s++) {
                   const key = `seat-${s}`;
                   const isReserved = overrides[key]?.reserved || false;
                   seats.push({ 
                     sectionId: updated.id, 
                     rowLabel: 'Mesa', 
                     seatNumber: s, 
                     status: isReserved ? SeatStatus.LOCKED : SeatStatus.AVAILABLE,
                     lockExpiresAt: null // Permanent block if reserved
                   });
                 }
               } else {
                 for (let r = 1; r <= updated.rows; r++) {
                   const rowLabel = String.fromCharCode(64 + r);
                   for (let s = 1; s <= updated.seatsPerRow; s++) {
                     const key = `${rowLabel}-${s}`;
                     const isReserved = overrides[key]?.reserved || false;
                     seats.push({ 
                       sectionId: updated.id, 
                       rowLabel, 
                       seatNumber: s, 
                       status: isReserved ? SeatStatus.LOCKED : SeatStatus.AVAILABLE,
                       lockExpiresAt: null
                     });
                   }
                 }
               }
               if (seats.length > 0) await this.seatRepo.save(seats);
            }
          } else {
            // Layout didn't change, but seat blocks (seatsConfig) might have.
            // Sync status for existing seats based on seatsConfig overrides.
            const overrides = sectionData.seatsConfig ? JSON.parse(sectionData.seatsConfig) : null;
            if (overrides) {
              const currentSeats = await this.seatRepo.find({ where: { sectionId: data.id } });
              for (const seat of currentSeats) {
                // Skip sold seats
                if (seat.status === SeatStatus.SOLD) continue;

                const key = exists.sectionType === 'table' ? `seat-${seat.seatNumber}` : `${seat.rowLabel}-${seat.seatNumber}`;
                const isReservedInConfig = overrides[key]?.reserved || false;
                
                // If it's a permanent lock (no expiry) or available, sync it.
                // We don't want to overwrite temporary locks (lockExpiresAt != null) held by buyers.
                if (seat.status === SeatStatus.AVAILABLE || (seat.status === SeatStatus.LOCKED && !seat.lockExpiresAt)) {
                  const newStatus = isReservedInConfig ? SeatStatus.LOCKED : SeatStatus.AVAILABLE;
                  if (seat.status !== newStatus) {
                    seat.status = newStatus;
                    seat.lockExpiresAt = null; // Ensure it's permanent
                    await this.seatRepo.save(seat);
                  }
                }
              }
            }
          }
        }
      }
    }

    // Recalculate min/max prices from updated sections
    const finalSections = await this.sectionRepo.find({ where: { eventId } });
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const s of finalSections) {
      // Skip non-purchasable sections
      if (s.sectionType === 'stage' || s.sectionType === 'decor') continue;

      let config: any = {};
      try {
        if (s.seatsConfig) config = JSON.parse(s.seatsConfig);
      } catch (e) {}

      const hasSeats = await this.seatRepo.count({ where: { sectionId: s.id } });
      
      if (hasSeats === 0) {
        // General Admission section
        const p = Number(s.price);
        if (p < minPrice) minPrice = p;
        if (p > maxPrice) maxPrice = p;
      } else {
        // Seated section
        const seats = await this.seatRepo.find({ where: { sectionId: s.id } });
        for (const seat of seats) {
          const key = s.sectionType === 'table' ? `seat-${seat.seatNumber}` : `${seat.rowLabel}-${seat.seatNumber}`;
          const seatPrice = (config[key] && config[key].price !== undefined && config[key].price !== null) 
            ? Number(config[key].price) 
            : Number(s.price);
            
          if (seatPrice < minPrice) minPrice = seatPrice;
          if (seatPrice > maxPrice) maxPrice = seatPrice;
        }
      }
    }

    if (minPrice === Infinity) minPrice = 0;
    if (maxPrice === -Infinity) maxPrice = 0;

    await this.eventRepo.update(eventId, { minPrice, maxPrice });

    return this.getSeatMap(eventId);
  }

  async getSeats(sectionId: string) {
    return this.seatRepo.find({
      where: { sectionId },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });
  }

  async getSeatMap(eventId: string) {
    const sections = await this.sectionRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC' },
    });

    if (sections.length === 0) return [];

    const sectionIds = sections.map(s => s.id);
    const { In, LessThan } = require('typeorm');
    const now = new Date();

    // Bulk unlock expired seats for this event's sections
    await this.seatRepo.update(
      {
        sectionId: In(sectionIds),
        status: SeatStatus.LOCKED,
        lockExpiresAt: LessThan(now),
      },
      {
        status: SeatStatus.AVAILABLE,
        lockedBy: null as any,
        lockExpiresAt: null as any,
      }
    );

    // Fetch all seats in one query
    const allSeats = await this.seatRepo.find({
      where: { sectionId: In(sectionIds) },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });

    // Group seats by section
    return sections.map(section => {
      return {
        ...section,
        seats: allSeats.filter(s => s.sectionId === section.id),
      };
    });
  }

  async lockSeats(seatIds: string[], userId: string) {
    const { MoreThan, Not, In, IsNull } = require('typeorm');
    const now = new Date();

    // Check if the user is attempting to exceed the limit of 10 reserved seats
    const currentlyLockedCount = await this.seatRepo.count({
      where: {
        lockedBy: userId,
        status: SeatStatus.LOCKED,
        lockExpiresAt: MoreThan(now),
        id: Not(In(seatIds)), // Exclude the seats we are trying to lock/refresh
      },
    });

    if (currentlyLockedCount + seatIds.length > 10) {
      throw new BadRequestException(
        currentlyLockedCount > 0
          ? `Límite de reserva excedido. Solo puedes tener hasta 10 asientos reservados simultáneamente (ya posees ${currentlyLockedCount} reservados).`
          : 'No puedes reservar más de 10 asientos por transacción.'
      );
    }

    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    for (const seatId of seatIds) {
      const seat = await this.seatRepo.findOne({ where: { id: seatId } });
      if (!seat) throw new NotFoundException(`Asiento ${seatId} no encontrado`);
      if (seat.status === SeatStatus.SOLD) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} ya vendido`);
      }
      if (seat.status === SeatStatus.LOCKED && seat.lockedBy !== userId && seat.lockExpiresAt && new Date() < seat.lockExpiresAt) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} no disponible`);
      }

      // Atomic update to prevent race conditions
      const where: any = { id: seatId, status: seat.status };
      if (seat.lockedBy === null) {
        where.lockedBy = IsNull();
      } else {
        where.lockedBy = seat.lockedBy;
      }

      const updateResult = await this.seatRepo.update(
        where,
        { status: SeatStatus.LOCKED, lockedBy: userId, lockExpiresAt: lockExpiry }
      );
      
      if (updateResult.affected === 0) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} no disponible (modificado por otra transacción)`);
      }
    }

    return { message: 'Asientos bloqueados', expiresAt: lockExpiry };
  }

  async unlockUserSeats(userId: string) {
    await this.seatRepo
      .createQueryBuilder()
      .update(Seat)
      .set({ status: SeatStatus.AVAILABLE, lockedBy: null as any, lockExpiresAt: null as any })
      .where('lockedBy = :userId', { userId })
      .execute();
  }
}
