import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Event, EventStatus, EventCategory, VenueSection, Seat, SeatStatus, User } from '../database/entities';
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
      where.eventDate = LessThanOrEqual(new Date(query.endDate));
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
    return this.eventRepo.find({
      where: { status: EventStatus.PUBLISHED, isFeatured: true },
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
    if (event.organizerId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar este evento');
    }
    await this.eventRepo.update(id, dto);
    return this.findById(id);
  }

  async publish(id: string, userId: string) {
    const event = await this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException();
    }

    // Calculate min/max prices from sections
    const sections = await this.sectionRepo.find({ where: { eventId: id } });
    const prices = sections.map((s) => Number(s.price));
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const maxPrice = prices.length ? Math.max(...prices) : 0;

    await this.eventRepo.update(id, {
      status: EventStatus.PUBLISHED,
      minPrice,
      maxPrice,
    });
    return this.findById(id);
  }

  async delete(id: string, userId: string) {
    const event = await this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException();
    }
    await this.eventRepo.delete(id);
    return { message: 'Evento eliminado' };
  }

  async uploadImage(id: string, filename: string, userId: string) {
    const event = await this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException();
    }
    const imageUrl = `/uploads/${filename}`;
    await this.eventRepo.update(id, { imageUrl });
    return { imageUrl };
  }

  async uploadBannerImage(id: string, filename: string, userId: string) {
    const event = await this.findById(id);
    if (event.organizerId !== userId) {
      throw new ForbiddenException();
    }
    const bannerImageUrl = `/uploads/${filename}`;
    await this.eventRepo.update(id, { bannerImageUrl });
    return { bannerImageUrl };
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

    // Generate seats for seated sections
    if (saved.sectionType === 'seated' || saved.sectionType === 'vip') {
      const seats: Partial<Seat>[] = [];
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
      await this.seatRepo.save(seats);
    }

    return saved;
  }

  async getSections(eventId: string) {
    return this.sectionRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC' },
    });
  }

  async syncSections(eventId: string, sectionsData: any[], userId: string) {
    const event = await this.findById(eventId);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para gestionar este mapa');
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
          await this.sectionRepo.update(data.id, sectionData);
        }
      }
    }

    return this.getSections(eventId);
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

    const seatMap = await Promise.all(
      sections.map(async (section) => {
        const seats = await this.seatRepo.find({
          where: { sectionId: section.id },
          order: { rowLabel: 'ASC', seatNumber: 'ASC' },
        });
        // Unlock expired seats
        const now = new Date();
        for (const seat of seats) {
          if (seat.status === SeatStatus.LOCKED && seat.lockExpiresAt && seat.lockExpiresAt < now) {
            seat.status = SeatStatus.AVAILABLE;
            seat.lockedBy = null as any;
            seat.lockExpiresAt = null as any;
            await this.seatRepo.save(seat);
          }
        }
        return { ...section, seats };
      }),
    );

    return seatMap;
  }

  async lockSeats(seatIds: string[], userId: string) {
    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    for (const seatId of seatIds) {
      const seat = await this.seatRepo.findOne({ where: { id: seatId } });
      if (!seat) throw new NotFoundException(`Asiento ${seatId} no encontrado`);
      if (seat.status === SeatStatus.SOLD) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} ya vendido`);
      }
      if (seat.status === SeatStatus.LOCKED && seat.lockedBy !== userId) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} no disponible`);
      }

      seat.status = SeatStatus.LOCKED;
      seat.lockedBy = userId;
      seat.lockExpiresAt = lockExpiry;
      await this.seatRepo.save(seat);
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
