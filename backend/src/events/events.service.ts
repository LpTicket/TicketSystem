/**
 * EventsService
 * EN: Core event logic — create/update/publish/delete events, manage seat-map
 *     sections and seats, handle images, list an organizer's own events, and
 *     route price/commission change requests. Enforces organizer/admin ownership.
 * ES: Lógica central de eventos — crear/actualizar/publicar/eliminar eventos,
 *     gestionar secciones y asientos del mapa, manejar imágenes, listar los
 *     eventos del organizador y encaminar solicitudes de cambio de precio/comisión.
 *     Aplica la propiedad de organizador/admin.
 */
import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Event, EventStatus, EventCategory, VenueSection, Seat, SeatStatus, User, Ticket, TicketStatus, Order, OrderStatus, EventCategoryEntity } from '../database/entities';
import { CreateEventDto, UpdateEventDto, EventQueryDto } from './dto/event.dto';

// How long an event stays visible/purchasable after its start time when the
// organizer did NOT set an explicit end time. Covers late buyers / walk-ins.
const EVENT_VISIBILITY_GRACE_HOURS = 6;

/**
 * EventsService
 * Core service for managing the lifecycle of events, venue sections, and seat inventory.
 * Handles everything from event creation and publishing to complex seat-locking logic.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(VenueSection)
    private readonly sectionRepo: Repository<VenueSection>,
    @InjectRepository(Seat)
    private readonly seatRepo: Repository<Seat>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async invalidateEventsCache(slug?: string, eventId?: string) {
    await this.cache.del('events:featured');
    if (slug) await this.cache.del(`event:slug:${slug}`);
    if (eventId) await this.cache.del(`event:seatmap:${eventId}`);
    const v = ((await this.cache.get<number>('events:list:v') || 0) + 1);
    await this.cache.set('events:list:v', v, 0);
  }

  /**
   * generateSlug
   * Generates a unique, URL-friendly slug based on the event title.
   * Includes a timestamp-based hash to prevent collisions.
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);
  }

  private async ensureValidCategorySlug(category: string | undefined | null): Promise<string> {
    const slug = String(category || '').trim();
    if (!slug) throw new BadRequestException('Selecciona una categoría válida para el evento');

    const exists = await this.eventRepo.manager.findOne(EventCategoryEntity, { where: { slug } });
    if (!exists) throw new BadRequestException(`La categoría "${slug}" no existe`);

    return slug;
  }

  private routeBase64EventImage(slug: string, url: string | null, kind: 'image' | 'banner') {
    if (!url?.startsWith('data:')) return url;
    return `/api/events/${slug}/og-image?kind=${kind}`;
  }

  private routeBase64EventImages(event: Event) {
    return {
      ...event,
      imageUrl: this.routeBase64EventImage(event.slug, event.imageUrl, 'image'),
      bannerImageUrl: this.routeBase64EventImage(event.slug, event.bannerImageUrl, 'banner'),
      organizer: event.organizer ? this.toSafeOrganizer(event.organizer) as any : undefined,
    };
  }

  private toSafeOrganizer(user: User) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * create
   * Initializes a new event in 'DRAFT' status.
   */
  async create(dto: CreateEventDto, organizerId: string) {
    const slug = this.generateSlug(dto.title);
    const category = await this.ensureValidCategorySlug(dto.category);
    const event = this.eventRepo.create({
      ...dto,
      category,
      slug,
      organizerId,
      currency: dto.currency || 'USD',
      status: EventStatus.DRAFT,
    });
    return this.eventRepo.save(event);
  }

  /**
   * findAll
   * Primary search engine for the event marketplace.
   * Supports filtering by category, search terms, price ranges, and dates.
   * Defaults to showing only future PUBLISHED events.
   */
  async findAll(query: EventQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    // Cache simple browse requests (no filters, page 1).
    const isSimple = !query.category && !query.search && !query.minPrice && !query.maxPrice
      && !query.startDate && !query.endDate && !query.includePast && page === 1;
    if (isSimple) {
      const v = (await this.cache.get<number>('events:list:v') || 0);
      const cacheKey = `events:list:${v}:${limit}`;
      const cached = await this.cache.get<any>(cacheKey);
      if (cached) return cached;
    }

    const qb = this.eventRepo
      .createQueryBuilder('event')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.publicVisible = :publicVisible', { publicVisible: true });

    // Hide events that are already over, UNLESS includePast / a startDate is set.
    // "Over" = the event's end has passed. We use eventEndDate when the organizer
    // set one; otherwise eventDate + a grace period (so late buyers / walk-ins
    // can still find an event that has started but not finished).
    if (query.includePast !== 'true' && !query.startDate) {
      qb.andWhere(
        `COALESCE(event."eventEndDate", event."eventDate" + (:graceHours * INTERVAL '1 hour')) >= :now`,
        { graceHours: EVENT_VISIBILITY_GRACE_HOURS, now: new Date() },
      );
    }

    if (query.category) qb.andWhere('event.category = :category', { category: query.category });
    if (query.search) qb.andWhere('event.title ILIKE :search', { search: `%${query.search}%` });

    // Price range filtering (based on event's calculated minPrice)
    if (query.minPrice !== undefined && query.maxPrice !== undefined) {
      qb.andWhere('event.minPrice BETWEEN :minPrice AND :maxPrice', { minPrice: query.minPrice, maxPrice: query.maxPrice });
    } else if (query.minPrice !== undefined) {
      qb.andWhere('event.minPrice >= :minPrice', { minPrice: query.minPrice });
    } else if (query.maxPrice !== undefined) {
      qb.andWhere('event.minPrice <= :maxPrice', { maxPrice: query.maxPrice });
    }

    // Date range filtering (by start date)
    if (query.startDate && query.endDate) {
      qb.andWhere('event.eventDate BETWEEN :start AND :end', { start: new Date(query.startDate), end: new Date(query.endDate) });
    } else if (query.startDate) {
      qb.andWhere('event.eventDate >= :start', { start: new Date(query.startDate) });
    } else if (query.endDate) {
      if (query.includePast === 'true') {
        qb.andWhere('event.eventDate <= :end', { end: new Date(query.endDate) });
      } else {
        qb.andWhere('event.eventDate BETWEEN :now AND :end', { now: new Date(), end: new Date(query.endDate) });
      }
    }

    const [events, total] = await qb
      .orderBy('event.eventDate', 'ASC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const result = {
      events: events.map((event) => this.routeBase64EventImages(event)),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };

    if (isSimple) {
      const v = (await this.cache.get<number>('events:list:v') || 0);
      await this.cache.set(`events:list:${v}:${limit}`, result, 60_000);
    }

    return result;
  }

  /**
   * findFeatured
   * Returns a limited list of active events marked as featured for the homepage.
   */
  async findFeatured() {
    const cached = await this.cache.get<any[]>('events:featured');
    if (cached) return cached;

    const events = await this.eventRepo
      .createQueryBuilder('event')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.isFeatured = :isFeatured', { isFeatured: true })
      .andWhere('event.publicVisible = :publicVisible', { publicVisible: true })
      .andWhere(
        `COALESCE(event."eventEndDate", event."eventDate" + (:graceHours * INTERVAL '1 hour')) >= :now`,
        { graceHours: EVENT_VISIBILITY_GRACE_HOURS, now: new Date() },
      )
      .orderBy('event.eventDate', 'ASC')
      .take(6)
      .getMany();
    const result = events.map((event) => this.routeBase64EventImages(event));
    await this.cache.set('events:featured', result, 60_000);
    return result;
  }

  /**
   * findBySlug
   * Retrieves full event details and sections for the public event page.
   */
  async findBySlug(slug: string) {
    const cacheKey = `event:slug:${slug}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const event = await this.eventRepo.findOne({
      where: { slug },
      relations: ['organizer'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const sections = await this.sectionRepo.find({
      where: { eventId: event.id },
      order: { sortOrder: 'ASC' },
    });

    const categoryEntity = event.category
      ? await this.eventRepo.manager.findOne(EventCategoryEntity, { where: { slug: event.category } })
      : null;

    const cleaned = this.routeBase64EventImages(event);
    const result = {
      ...cleaned,
      categoryName: categoryEntity?.labelEs || event.category,
      categoryNameEn: categoryEntity?.labelEn || event.category,
      sections,
    };
    await this.cache.set(cacheKey, result, 60_000);
    return result;
  }

  async findById(id: string) {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async getOgImageBySlug(slug: string, kind: 'image' | 'banner' = 'image') {
    this.logger.log(`[OG-IMAGE] Fetching ${kind} for slug: ${slug}`);
    const event = await this.eventRepo.findOne({ where: { slug } });
    if (!event) {
      this.logger.warn(`[OG-IMAGE] Event not found for slug: ${slug}`);
      throw new NotFoundException(`Evento con slug "${slug}" no encontrado`);
    }

    const image = kind === 'banner'
      ? event.bannerImageUrl || event.imageUrl
      : event.imageUrl;
    if (!image) {
      this.logger.warn(`[OG-IMAGE] No image found for slug: ${slug}`);
      throw new NotFoundException(`No hay imagen guardada para evento "${slug}"`);
    }
    this.logger.log(`[OG-IMAGE] Image format: ${image.substring(0, 50)}...`);

    // Base64 stored directly in the DB (most common for new uploads)
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
    }

    // External HTTP(S) URL — proxy the image
    if (image.startsWith('http://') || image.startsWith('https://')) {
      try {
        const res = await fetch(image);
        if (!res.ok) throw new NotFoundException(`Imagen externa retornó ${res.status}`);
        const mimeType = res.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await res.arrayBuffer());
        return { mimeType, buffer };
      } catch (err) {
        throw new NotFoundException(`Error al proxear imagen ${image}: ${String(err)}`);
      }
    }

    // Local /uploads/ path — try to read from disk
    try {
      const cleanPath = image.replace(/^\//, '');
      const filePath = path.join(process.cwd(), cleanPath);
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
        return { mimeType: mimeMap[ext] || 'image/jpeg', buffer };
      }
    } catch (err) {
      this.logger.error(`Error reading local image ${image}:`, err);
    }

    throw new NotFoundException(`No se pudo servir imagen (formato no soportado o archivo no existe): ${image}`);
  }

  /**
   * update
   * Updates event metadata. If the event is already PUBLISHED, changes are
   * stored in 'pending' fields for admin review instead of overwriting live data.
   */
  async update(id: string, dto: UpdateEventDto, userId: string) {
    const event = await this.findById(id);
    const cleanDto: UpdateEventDto = { ...dto };

    if (cleanDto.category !== undefined) {
      cleanDto.category = await this.ensureValidCategorySlug(cleanDto.category);
    }

    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });

    // Check ownership or admin privileges
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException('No tienes permiso para editar este evento');
    }

    // Approval flow for published events
    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      const pendingUpdate: Partial<Event> = {
        pendingTitle: cleanDto.title,
        pendingDescription: cleanDto.description,
        pendingVenueName: cleanDto.venueName,
        ...(cleanDto.category !== undefined ? { category: cleanDto.category, pendingCategory: null } : {}),
        // Timezone is always updated immediately so the displayed time stays
        // consistent with whatever wall-clock time the organizer entered.
        ...(cleanDto.eventTimezone !== undefined ? { eventTimezone: cleanDto.eventTimezone } : {}),
        // End time only controls listing visibility (no public-facing approval
        // needed), so apply it immediately even for published events.
        ...(cleanDto.eventEndDate !== undefined
          ? { eventEndDate: cleanDto.eventEndDate ? new Date(cleanDto.eventEndDate) : null }
          : {}),
      };

      if (cleanDto.eventDate) {
        await this.eventRepo.update(id, {
          ...pendingUpdate,
          eventDate: new Date(cleanDto.eventDate),
          pendingEventDate: null,
          autoReminderSent: false,
        });
      } else {
        await this.eventRepo.update(id, pendingUpdate);
      }
    } else {
      await this.eventRepo.update(id, cleanDto);
    }

    await this.invalidateEventsCache();
    return this.findById(id);
  }

  /**
   * publish
   * Moves event to 'PENDING_APPROVAL' state for admin verification.
   */
  async publish(id: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException();
    }

    await this.eventRepo.update(id, {
      status: EventStatus.PENDING_APPROVAL,
    });
    await this.invalidateEventsCache();
    return this.findById(id);
  }

  /**
   * delete
   * Performs a cascading cleanup of all event-related data within a single transaction.
   * Removes tickets, orders, seats, and sections.
   */
  async delete(id: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') {
      throw new ForbiddenException();
    }
    
    await this.eventRepo.manager.transaction(async (manager) => {
      await manager.delete(Ticket, { eventId: id });
      await manager.delete(Order, { eventId: id });
      
      const sections = await manager.find(VenueSection, { where: { eventId: id } });
      if (sections.length > 0) {
        const sectionIds = sections.map(s => s.id);
        await manager.createQueryBuilder().delete().from(Seat).where("sectionId IN (:...sectionIds)", { sectionIds }).execute();
        await manager.delete(VenueSection, { eventId: id });
      }
      
      await manager.delete(Event, { id });
    });

    await this.invalidateEventsCache();
    return { message: 'Evento eliminado' };
  }

  /**
   * Image upload helpers (Main & Banner)
   * Handles storage path normalization and pending approval logic.
   */
  async uploadImage(id: string, url: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') throw new ForbiddenException();
    
    const imageUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) ? url : `/uploads/${url}`;

    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      await this.eventRepo.update(id, { pendingImageUrl: imageUrl });
    } else {
      await this.eventRepo.update(id, { imageUrl });
      await this.cache.del(`event:slug:${event.slug}`);
    }
    return { imageUrl };
  }

  async uploadBannerImage(id: string, url: string, userId: string) {
    const event = await this.findById(id);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') throw new ForbiddenException();

    const bannerImageUrl = (url.startsWith('http') || url.startsWith('data:') || url.startsWith('/')) ? url : `/uploads/${url}`;

    if (event.status === EventStatus.PUBLISHED && user?.role !== 'admin') {
      await this.eventRepo.update(id, { pendingBannerImageUrl: bannerImageUrl });
    } else {
      await this.eventRepo.update(id, { bannerImageUrl });
      await this.cache.del(`event:slug:${event.slug}`);
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
      await this.cache.del(`event:slug:${event.slug}`);
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
      await this.cache.del(`event:slug:${event.slug}`);
    }
    await this.eventRepo.save(event);
    return { success: true };
  }

  async getOrganizerEvents(organizerId: string) {
    const events = await this.eventRepo.find({
      where: { organizerId },
      order: { createdAt: 'DESC' },
    });
    if (!events.length) return [];

    const eventIds = events.map((event) => event.id);
    const orderRows = await this.eventRepo.manager.getRepository(Order)
      .createQueryBuilder('o')
      .select('o."eventId"', 'eventId')
      .addSelect('COALESCE(SUM(o."ticketCount"), 0)', 'soldTickets')
      .addSelect('COALESCE(SUM(o.subtotal), 0)', 'totalRevenue')
      .where('o."eventId" IN (:...eventIds)', { eventIds })
      .andWhere('o.status = :status', { status: OrderStatus.PAID })
      .groupBy('o."eventId"')
      .getRawMany();

    const statsByEventId = new Map(orderRows.map((row) => [
      row.eventId,
      {
        soldTickets: Number(row.soldTickets || 0),
        totalRevenue: Number(row.totalRevenue || 0),
      },
    ]));

    const slugs = [...new Set(events.map((e) => e.category).filter(Boolean))];
    const categoryEntities = slugs.length
      ? await this.eventRepo.manager.find(EventCategoryEntity, { where: slugs.map((s) => ({ slug: s })) })
      : [];
    const catBySlug = new Map(categoryEntities.map((c) => [c.slug, c]));

    return events.map((event) => {
      const cat = catBySlug.get(event.category);
      return {
        ...this.routeBase64EventImages(event),
        soldTickets: statsByEventId.get(event.id)?.soldTickets || 0,
        totalRevenue: statsByEventId.get(event.id)?.totalRevenue || 0,
        categoryName: cat?.labelEs || event.category,
        categoryNameEn: cat?.labelEn || event.category,
      };
    });
  }

  // --- Seat Map & Inventory Management ---

  /**
   * createSection
   * Adds a new section to the venue and automatically generates the seat grid
   * based on rows and seatsPerRow config.
   */
  async createSection(eventId: string, data: Partial<VenueSection>, userId: string) {
    const event = await this.findById(eventId);
    if (event.organizerId !== userId) throw new ForbiddenException();

    // GA/standing sections must have a non-zero capacity so the scanner counts them.
    const normalized: Partial<VenueSection> = { ...data };
    if (String(normalized.sectionType).toLowerCase() === 'standing' && !Number(normalized.capacity)) {
      normalized.capacity = 100;
    }

    const section = this.sectionRepo.create({ ...normalized, eventId });
    const saved = await this.sectionRepo.save(section);

    // Auto-generate seat objects for purchasable section types
    if (saved.sectionType === 'seated' || saved.sectionType === 'vip' || saved.sectionType === 'table') {
      const seats: Partial<Seat>[] = [];
      
      if (saved.sectionType === 'table') {
        // Tables use 'seatsPerRow' as the count of chairs around the table
        const seatCount = saved.seatsPerRow || 6;
        for (let s = 1; s <= seatCount; s++) {
          seats.push({
            sectionId: saved.id,
            rowLabel: 'Mesa',
            seatNumber: s,
            status: SeatStatus.AVAILABLE,
          });
        }
      } else {
        // Standard alphanumeric grid (A1, A2...)
        for (let r = 1; r <= saved.rows; r++) {
          const rowLabel = String.fromCharCode(64 + r); // Converts 1->A, 2->B...
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

  /**
   * syncSections
   * Powerful synchronization tool that aligns the database sections and seats
   * with the incoming JSON state from the Venue Designer.
   * Handles deletion of removed sections, position updates, and seat grid regeneration.
   */
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

    // Update global viewport defaults for this event
    if (viewportOpts) {
      if (typeof viewportOpts.defaultViewX === 'number') event.defaultViewX = viewportOpts.defaultViewX;
      if (typeof viewportOpts.defaultViewY === 'number') event.defaultViewY = viewportOpts.defaultViewY;
      if (typeof viewportOpts.defaultViewZoom === 'number') event.defaultViewZoom = viewportOpts.defaultViewZoom;
      if (typeof viewportOpts.showStage === 'boolean') event.showStage = viewportOpts.showStage;
      await this.eventRepo.save(event);
    }

    const existingSections = await this.sectionRepo.find({ where: { eventId } });
    const incomingIds = sectionsData.filter(s => s.id && !s.id.startsWith('temp-')).map(s => s.id);

    // 1. Remove orphaned sections
    const toDelete = existingSections.filter(s => !incomingIds.includes(s.id));
    if (toDelete.length > 0) {
      await this.sectionRepo.remove(toDelete);
    }

    // 2. Process incoming sections
    for (const data of sectionsData) {
      const isNew = !data.id || data.id.startsWith('temp-');
      const sectionData = { ...data };
      if (isNew) delete sectionData.id;

      // GA/standing sections must have a non-zero capacity so the scanner counts them.
      if (String(sectionData.sectionType).toLowerCase() === 'standing' && !Number(sectionData.capacity)) {
        sectionData.capacity = 100;
      }

      if (isNew) {
        await this.createSection(eventId, sectionData, userId);
      } else {
        const exists = existingSections.find(s => s.id === data.id);
        if (exists) {
          // Check if structural changes (rows/cols) require seat regeneration
          const layoutChanged =
            exists.rows !== sectionData.rows ||
            exists.seatsPerRow !== sectionData.seatsPerRow ||
            exists.sectionType !== sectionData.sectionType;

          await this.sectionRepo.update(data.id, sectionData);

          if (layoutChanged) {
            // Re-generate entire seat set for this section
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
                    const customLabel = overrides[key]?.rowLabel || 'Mesa';
                    const customSeatNumber = overrides[key]?.seatNumber !== undefined ? overrides[key].seatNumber : s;
                    seats.push({ 
                      sectionId: updated.id, 
                      rowLabel: customLabel, 
                      seatNumber: customSeatNumber, 
                      status: isReserved ? SeatStatus.LOCKED : SeatStatus.AVAILABLE,
                      lockExpiresAt: null
                    });
                  }
                } else {
                  for (let r = 1; r <= updated.rows; r++) {
                    const defaultRowLabel = String.fromCharCode(64 + r);
                    for (let s = 1; s <= updated.seatsPerRow; s++) {
                      const key = `${defaultRowLabel}-${s}`;
                      const isReserved = overrides[key]?.reserved || false;
                      const customLabel = overrides[key]?.rowLabel || defaultRowLabel;
                      const customSeatNumber = overrides[key]?.seatNumber !== undefined ? overrides[key].seatNumber : s;
                      seats.push({ 
                        sectionId: updated.id, 
                        rowLabel: customLabel, 
                        seatNumber: customSeatNumber, 
                        status: isReserved ? SeatStatus.LOCKED : SeatStatus.AVAILABLE,
                        lockExpiresAt: null
                      });
                    }
                  }
                }
                if (seats.length > 0) await this.seatRepo.save(seats);
            }
          } else {
            // Only metadata (prices/offsets/custom labels) changed, sync custom labels and permanent blocks
            const overrides = sectionData.seatsConfig ? JSON.parse(sectionData.seatsConfig) : null;
            if (overrides) {
              const currentSeats = await this.seatRepo.find({
                where: { sectionId: data.id },
                order: { id: 'ASC' }
              });

              let seatIndex = 0;
              const rows = exists.rows || 1;
              const seatsPerRow = exists.seatsPerRow || 1;
              const seatsToUpdate: Seat[] = [];

              if (exists.sectionType === 'table') {
                for (let s = 1; s <= seatsPerRow; s++) {
                  const seat = currentSeats[seatIndex++];
                  if (!seat) break;
                  if (seat.status === SeatStatus.SOLD) continue;

                  const key = `seat-${s}`;
                  const legacyKey = `seat-${seat.seatNumber}`;
                  const override = overrides[key] || overrides[legacyKey] || {};
                  const isReservedInConfig = override.reserved || false;
                  const customLabel = override.rowLabel || 'Mesa';
                  const customSeatNumber = override.seatNumber !== undefined ? override.seatNumber : s;

                  seat.rowLabel = customLabel;
                  seat.seatNumber = customSeatNumber;

                  if (seat.status === SeatStatus.AVAILABLE || (seat.status === SeatStatus.LOCKED && !seat.lockExpiresAt)) {
                    seat.status = isReservedInConfig ? SeatStatus.LOCKED : SeatStatus.AVAILABLE;
                    seat.lockedBy = isReservedInConfig ? userId : null as any;
                    seat.lockExpiresAt = null;
                  }
                  seatsToUpdate.push(seat);
                }
              } else {
                for (let r = 1; r <= rows; r++) {
                  const defaultRowLabel = String.fromCharCode(64 + r);
                  for (let s = 1; s <= seatsPerRow; s++) {
                    const seat = currentSeats[seatIndex++];
                    if (!seat) break;
                    if (seat.status === SeatStatus.SOLD) continue;

                    const key = `${defaultRowLabel}-${s}`;
                    const legacyKey = `${seat.rowLabel}-${seat.seatNumber}`;
                    const override = overrides[key] || overrides[legacyKey] || {};
                    const isReservedInConfig = override.reserved || false;
                    const customLabel = override.rowLabel || defaultRowLabel;
                    const customSeatNumber = override.seatNumber !== undefined ? override.seatNumber : s;

                    seat.rowLabel = customLabel;
                    seat.seatNumber = customSeatNumber;

                    if (seat.status === SeatStatus.AVAILABLE || (seat.status === SeatStatus.LOCKED && !seat.lockExpiresAt)) {
                      seat.status = isReservedInConfig ? SeatStatus.LOCKED : SeatStatus.AVAILABLE;
                      seat.lockedBy = isReservedInConfig ? userId : null as any;
                      seat.lockExpiresAt = null;
                    }
                    seatsToUpdate.push(seat);
                  }
                }
              }
              if (seatsToUpdate.length > 0) await this.seatRepo.save(seatsToUpdate);
            }
          }
        }
      }
    }

    // Post-sync: recalculate global event price range for the marketplace search
    const finalSections = await this.sectionRepo.find({ where: { eventId } });
    const finalSectionIds = finalSections.map(s => s.id);
    const { In: InOp } = require('typeorm');
    const allFinalSeats = finalSectionIds.length > 0
      ? await this.seatRepo.find({ where: { sectionId: InOp(finalSectionIds) } })
      : [];
    const seatsBySectionId = new Map<string, typeof allFinalSeats>();
    for (const seat of allFinalSeats) {
      const arr = seatsBySectionId.get(seat.sectionId) || [];
      arr.push(seat);
      seatsBySectionId.set(seat.sectionId, arr);
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (const s of finalSections) {
      if (s.sectionType === 'stage' || s.sectionType === 'decor') continue;
      let config: any = {};
      try { if (s.seatsConfig) config = JSON.parse(s.seatsConfig); } catch (e) {}

      const seats = seatsBySectionId.get(s.id) || [];
      if (seats.length === 0) {
        const p = Number(s.price);
        if (p > 0 && p < minPrice) minPrice = p;
        if (p > maxPrice) maxPrice = p;
      } else {
        for (const seat of seats) {
          const key = s.sectionType === 'table' ? `seat-${seat.seatNumber}` : `${seat.rowLabel}-${seat.seatNumber}`;
          const seatPrice = (config[key] && config[key].price !== undefined && config[key].price !== null)
            ? Number(config[key].price) : Number(s.price);
          if (seatPrice > 0 && seatPrice < minPrice) minPrice = seatPrice;
          if (seatPrice > maxPrice) maxPrice = seatPrice;
        }
      }
    }

    await this.eventRepo.update(eventId, {
      minPrice: minPrice === Infinity ? 0 : minPrice,
      maxPrice: maxPrice === -Infinity ? 0 : maxPrice,
    });

    // Invalidate both caches: seatmap structure changed, and event detail price range changed
    const updatedEvent = await this.findById(eventId);
    await this.cache.del(`event:seatmap:${eventId}`);
    await this.cache.del(`event:slug:${updatedEvent.slug}`);
    await this.invalidateEventsCache();

    return this.getSeatMap(eventId);
  }

  async getSeats(sectionId: string) {
    return this.seatRepo.find({
      where: { sectionId },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });
  }

  /**
   * getSeatMap
   * Retrieves the comprehensive interactive map data.
   * CRITICAL: Automatically clears expired temporary locks before returning data.
   */
  async getSeatMap(eventId: string) {
    const cacheKey = `event:seatmap:${eventId}`;

    const sections = await this.sectionRepo.find({
      where: { eventId },
      order: { sortOrder: 'ASC' },
    });

    if (sections.length === 0) return [];

    const sectionIds = sections.map(s => s.id);
    const { In, LessThan } = require('typeorm');
    const now = new Date();

    // Cleanup expired holds from users who abandoned their carts
    const expiredCount = await this.seatRepo.count({
      where: { sectionId: In(sectionIds), status: SeatStatus.LOCKED, lockExpiresAt: LessThan(now) },
    });
    if (expiredCount > 0) {
      await this.seatRepo.update(
        { sectionId: In(sectionIds), status: SeatStatus.LOCKED, lockExpiresAt: LessThan(now) },
        { status: SeatStatus.AVAILABLE, lockedBy: null as any, lockExpiresAt: null as any },
      );
      // Invalidate stale cache after releasing expired holds
      await this.cache.del(cacheKey);
    }

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const allSeats = await this.seatRepo.find({
      where: { sectionId: In(sectionIds) },
      order: { rowLabel: 'ASC', seatNumber: 'ASC' },
    });

    // Count sold tickets per section (GA/standing areas have no seat rows).
    const ticketRows = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.sectionId', 'sectionId')
      .addSelect('COUNT(t.id)', 'count')
      .where('t.sectionId IN (:...ids)', { ids: sectionIds })
      .andWhere('t.status IN (:...st)', { st: [TicketStatus.ACTIVE, TicketStatus.USED] })
      .groupBy('t.sectionId')
      .getRawMany();
    const soldBySection = new Map<string, number>(
      ticketRows.map((r: any) => [r.sectionId, Number(r.count) || 0]),
    );

    const result = sections.map(section => ({
      ...section,
      seats: allSeats.filter(s => s.sectionId === section.id),
      soldTickets: soldBySection.get(section.id) || 0,
    }));

    // Short TTL: seat availability changes on every purchase/lock
    await this.cache.set(cacheKey, result, 15_000);
    return result;
  }

  /**
   * lockSeats
   * Reserves specific seats for a user during the 10-minute checkout window.
   * Uses an atomic update strategy to ensure no two users can reserve the same seat.
   * Limits each user to 10 concurrent reservations.
   */
  async lockSeats(seatIds: string[], userId: string) {
    if (seatIds.length === 0) return { message: 'No seats provided' };
    const { MoreThan, Not, In, IsNull } = require('typeorm');
    const now = new Date();

    const firstSeat = await this.seatRepo.findOne({
      where: { id: seatIds[0] },
      relations: ['section', 'section.event'],
    });
    if (!firstSeat) throw new NotFoundException('Asiento no encontrado');
    const maxLimit = firstSeat.section?.event?.maxTicketsPerTransaction || 10;

    // Enforce platform limits to prevent inventory abuse
    const currentlyLockedCount = await this.seatRepo.count({
      where: {
        lockedBy: userId,
        status: SeatStatus.LOCKED,
        lockExpiresAt: MoreThan(now),
        id: Not(In(seatIds)), 
      },
    });

    if (currentlyLockedCount + seatIds.length > maxLimit) {
      throw new BadRequestException(
        `Límite de reserva excedido (Máx ${maxLimit}). Ya posees ${currentlyLockedCount} reservados.`
      );
    }

    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    for (const seatId of seatIds) {
      const seat = await this.seatRepo.findOne({ where: { id: seatId } });
      if (!seat) throw new NotFoundException(`Asiento ${seatId} no encontrado`);
      
      // Validation: Is it already sold or held by someone else?
      if (seat.status === SeatStatus.SOLD) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} ya vendido`);
      }
      if (seat.status === SeatStatus.LOCKED && seat.lockedBy !== userId && seat.lockExpiresAt && new Date() < seat.lockExpiresAt) {
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} no disponible`);
      }

      // Atomic UPDATE to prevent double-booking race conditions
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
        throw new ForbiddenException(`Asiento ${seat.rowLabel}${seat.seatNumber} modificado por otra transacción`);
      }
    }

    // Invalidate seatmap cache so the next viewer sees updated seat availability
    const eventId = firstSeat.section?.event?.id;
    if (eventId) await this.cache.del(`event:seatmap:${eventId}`);

    return { message: 'Asientos bloqueados', expiresAt: lockExpiry };
  }

  /**
   * unlockUserSeats
   * Explicitly releases all temporary holds for a specific user (e.g., on cart clear).
   */
  async unlockUserSeats(userId: string) {
    // Find affected events before releasing, to invalidate their seatmap caches
    const lockedSeats = await this.seatRepo.find({
      where: { lockedBy: userId, status: SeatStatus.LOCKED },
      relations: ['section'],
    });
    const affectedEventIds = [...new Set(lockedSeats.map(s => s.section?.eventId).filter(Boolean))];

    await this.seatRepo
      .createQueryBuilder()
      .update(Seat)
      .set({ status: SeatStatus.AVAILABLE, lockedBy: null as any, lockExpiresAt: null as any })
      .where('lockedBy = :userId', { userId })
      .execute();

    for (const eid of affectedEventIds) {
      await this.cache.del(`event:seatmap:${eid}`);
    }
  }

  async requestCreatorCommissionChange(eventId: string, amount: number, userId: string) {
    const event = await this.findById(eventId);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') throw new ForbiddenException();
    if (amount < 0) throw new BadRequestException('El monto no puede ser negativo');

    if (user?.role === 'admin' || event.status === EventStatus.DRAFT) {
      await this.eventRepo.update(eventId, { creatorCommission: amount, pendingCreatorCommission: null });
    } else {
      await this.eventRepo.update(eventId, { pendingCreatorCommission: amount });
    }
    return this.findById(eventId);
  }

  async requestSectionPriceChange(eventId: string, sectionId: string, price: number, userId: string) {
    const event = await this.findById(eventId);
    const user = await this.eventRepo.manager.findOne(User, { where: { id: userId } });
    if (event.organizerId !== userId && user?.role !== 'admin') throw new ForbiddenException();

    const section = await this.sectionRepo.findOne({ where: { id: sectionId, eventId } });
    if (!section) throw new NotFoundException('Sección no encontrada');

    if (user?.role === 'admin' || event.status === EventStatus.DRAFT) {
      await this.sectionRepo.update(sectionId, { price, pendingPrice: null });
    } else {
      await this.sectionRepo.update(sectionId, { pendingPrice: price });
    }

    return this.sectionRepo.findOne({ where: { id: sectionId } });
  }
}
