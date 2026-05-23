import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  Event,
  Order,
  SocialMatchConnection,
  SocialMatchConnectionStatus,
  SocialMatchInterest,
  SocialMatchMessage,
  SocialMatchPreference,
  Ticket,
  TicketStatus,
  User,
} from '../database/entities';

type UpdateSocialMatchDto = {
  isActive?: boolean;
  interests?: SocialMatchInterest[];
  industry?: string | null;
  instagram?: string | null;
  privateMode?: boolean;
  invisibleMode?: boolean;
  shareInstagram?: boolean;
  shareLocation?: boolean;
};

const allowedInterests = new Set(Object.values(SocialMatchInterest));

@Injectable()
export class SocialMatchService {
  constructor(
    @InjectRepository(SocialMatchPreference)
    private readonly preferenceRepo: Repository<SocialMatchPreference>,
    @InjectRepository(SocialMatchConnection)
    private readonly connectionRepo: Repository<SocialMatchConnection>,
    @InjectRepository(SocialMatchMessage)
    private readonly messageRepo: Repository<SocialMatchMessage>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getMySocialMatch(userId: string) {
    const eligibleEvents = await this.getEligibleEvents(userId);
    const eventIds = eligibleEvents.map((event) => event.id);
    const preferences = eventIds.length
      ? await this.preferenceRepo.find({ where: { userId, eventId: In(eventIds) } })
      : [];

    const summaries = await Promise.all(
      preferences.filter((preference) => preference.isActive).map((preference) => this.buildSummary(preference)),
    );

    const connections = await this.getConnections(userId);
    return { eligibleEvents, preferences, summaries, connections, interests: Object.values(SocialMatchInterest) };
  }

  async updatePreference(userId: string, eventId: string, dto: UpdateSocialMatchDto) {
    const canUseEvent = await this.userHasTicketForEvent(userId, eventId);
    if (!canUseEvent) throw new ForbiddenException('Social Match solo puede activarse en eventos donde tienes una entrada.');

    const interests = this.normalizeInterests(dto.interests || []);
    if (dto.isActive && interests.length === 0) throw new BadRequestException('Selecciona al menos un interés para activar Social Match.');

    let preference = await this.preferenceRepo.findOne({ where: { userId, eventId } });
    if (!preference) preference = this.preferenceRepo.create({ userId, eventId });

    preference.isActive = Boolean(dto.isActive);
    preference.interests = interests;
    preference.industry = this.cleanOptionalText(dto.industry);
    preference.instagram = this.cleanOptionalText(dto.instagram);
    preference.privateMode = dto.privateMode !== false;
    preference.invisibleMode = Boolean(dto.invisibleMode);
    preference.shareInstagram = Boolean(dto.shareInstagram);
    preference.shareLocation = Boolean(dto.shareLocation);

    const saved = await this.preferenceRepo.save(preference);
    const summary = saved.isActive ? await this.buildSummary(saved) : null;
    return { preference: saved, summary };
  }

  async getSuggestions(userId: string, eventId: string) {
    const myPreference = await this.preferenceRepo.findOne({ where: { userId, eventId, isActive: true } });
    if (!myPreference || myPreference.invisibleMode) return { suggestions: [] };

    const canUseEvent = await this.userHasTicketForEvent(userId, eventId);
    if (!canUseEvent) throw new ForbiddenException('Social Match solo puede usarse en eventos donde tienes una entrada.');

    const existingConnections = await this.connectionRepo.find({
      where: [
        { eventId, requesterId: userId },
        { eventId, receiverId: userId },
      ],
    });
    const connectedUserIds = new Set(existingConnections.flatMap((connection) => [connection.requesterId, connection.receiverId]));

    // Get ALL other ticket holders for this event
    const tickets = await this.ticketRepo.find({
      where: { eventId, status: TicketStatus.ACTIVE, userId: Not(userId) },
      relations: ['user'],
    });

    // De-duplicate by userId
    const seenUserIds = new Set<string>();
    const uniqueTickets = tickets.filter((t) => {
      if (seenUserIds.has(t.userId)) return false;
      seenUserIds.add(t.userId);
      return true;
    });

    // Load SM preferences for those users (optional — not all will have one)
    const otherUserIds = uniqueTickets.map((t) => t.userId);
    const otherPreferences = otherUserIds.length
      ? await this.preferenceRepo.find({ where: { eventId, userId: In(otherUserIds) } })
      : [];
    const prefMap = new Map(otherPreferences.map((p) => [p.userId, p]));

    const myInterests = myPreference.interests || [];
    const suggestions = uniqueTickets
      .filter((t) => {
        if (connectedUserIds.has(t.userId)) return false;
        const pref = prefMap.get(t.userId);
        if (pref?.invisibleMode) return false;
        return true;
      })
      .map((t) => {
        const pref = prefMap.get(t.userId);
        const sharedInterests = pref ? (pref.interests || []).filter((interest) => myInterests.includes(interest)) : [];
        const industryMatch = Boolean(myPreference.industry && pref?.industry && pref.industry.toLowerCase() === myPreference.industry.toLowerCase());
        const canShareLocationLater = Boolean(pref?.shareLocation && myPreference.shareLocation);
        const score = sharedInterests.length + (industryMatch ? 2 : 0) + (canShareLocationLater ? 1 : 0);
        // Show name unless user explicitly set privateMode; no preference = show name
        const isPrivate = pref ? pref.privateMode : false;

        return {
          userId: t.userId,
          displayName: isPrivate ? 'Asistente' : `${t.user?.firstName || 'Asistente'} ${t.user?.lastName?.[0] || ''}.`.trim(),
          sharedInterests,
          industryMatch,
          industry: pref?.industry || null,
          canShareLocationLater,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return { suggestions };
  }

  async requestConnection(userId: string, eventId: string, receiverId: string) {
    if (!receiverId || receiverId === userId) throw new BadRequestException('Selecciona una conexión válida.');

    await this.ensureActivePreference(userId, eventId);
    // Receiver only needs a ticket, not necessarily an active SM preference
    const receiverHasTicket = await this.userHasTicketForEvent(receiverId, eventId);
    if (!receiverHasTicket) throw new ForbiddenException('El destinatario no tiene entrada para este evento.');

    const existing = await this.connectionRepo.findOne({
      where: [
        { eventId, requesterId: userId, receiverId },
        { eventId, requesterId: receiverId, receiverId: userId },
      ],
    });

    if (existing) {
      if (existing.status === SocialMatchConnectionStatus.DECLINED || existing.status === SocialMatchConnectionStatus.CANCELLED) {
        existing.requesterId = userId;
        existing.receiverId = receiverId;
        existing.status = SocialMatchConnectionStatus.PENDING;
        return this.connectionRepo.save(existing);
      }
      return existing;
    }

    return this.connectionRepo.save(this.connectionRepo.create({
      eventId,
      requesterId: userId,
      receiverId,
      status: SocialMatchConnectionStatus.PENDING,
    }));
  }

  async updateConnection(
    userId: string,
    connectionId: string,
    status: SocialMatchConnectionStatus.ACCEPTED | SocialMatchConnectionStatus.DECLINED | SocialMatchConnectionStatus.CANCELLED,
  ) {
    const connection = await this.connectionRepo.findOne({
      where: { id: connectionId },
      relations: ['event', 'requester', 'receiver'],
    });
    if (!connection) throw new BadRequestException('Solicitud no encontrada.');

    if (status === SocialMatchConnectionStatus.CANCELLED) {
      const isMember = connection.requesterId === userId || connection.receiverId === userId;
      if (!isMember) throw new ForbiddenException('No tienes acceso a esta conexión.');
      // Pending: only requester can cancel. Accepted: either party can unmatch.
      if (connection.status === SocialMatchConnectionStatus.PENDING && connection.requesterId !== userId) {
        throw new ForbiddenException('Solo quien envió la solicitud puede cancelarla.');
      }
      connection.status = SocialMatchConnectionStatus.CANCELLED;
      return this.connectionRepo.save(connection);
    }

    if (connection.receiverId !== userId) throw new ForbiddenException('Solo quien recibe la solicitud puede responderla.');
    connection.status = status;
    return this.connectionRepo.save(connection);
  }

  async getMessages(userId: string, connectionId: string) {
    await this.ensureAcceptedConnectionMember(userId, connectionId);
    const messages = await this.messageRepo.find({
      where: { connectionId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
      take: 100,
    });

    return {
      messages: messages.map((message) => ({
        id: message.id,
        message: message.message,
        senderId: message.senderId,
        senderName: message.sender ? `${message.sender.firstName} ${message.sender.lastName?.[0] || ''}.`.trim() : 'Asistente',
        isMine: message.senderId === userId,
        createdAt: message.createdAt,
      })),
    };
  }

  async sendMessage(userId: string, connectionId: string, rawMessage: string) {
    await this.ensureAcceptedConnectionMember(userId, connectionId);

    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (!message) throw new BadRequestException('El mensaje no puede estar vacío.');
    if (message.length > 1000) throw new BadRequestException('El mensaje es demasiado largo.');

    const saved = await this.messageRepo.save(this.messageRepo.create({
      connectionId,
      senderId: userId,
      message,
    }));

    return {
      id: saved.id,
      message: saved.message,
      senderId: saved.senderId,
      isMine: true,
      createdAt: saved.createdAt,
    };
  }

  private async getEligibleEvents(userId: string) {
    const tickets = await this.ticketRepo.find({
      where: { userId, status: TicketStatus.ACTIVE },
      relations: ['event'],
      order: { createdAt: 'DESC' },
    });

    const seen = new Set<string>();
    return tickets
      .map((ticket) => ticket.event)
      .filter((event): event is Event => Boolean(event))
      .filter((event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id);
        return true;
      })
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }

  private async userHasTicketForEvent(userId: string, eventId: string) {
    const ticket = await this.ticketRepo.findOne({ where: { userId, eventId, status: TicketStatus.ACTIVE } });
    return Boolean(ticket);
  }

  private async ensureActivePreference(userId: string, eventId: string) {
    const preference = await this.preferenceRepo.findOne({ where: { userId, eventId, isActive: true } });
    if (!preference || preference.invisibleMode) throw new ForbiddenException('Ambas personas deben tener Social Match activo para conectar.');
    return preference;
  }

  private async ensureAcceptedConnectionMember(userId: string, connectionId: string) {
    const connection = await this.connectionRepo.findOne({ where: { id: connectionId } });
    if (!connection) throw new BadRequestException('Conexión no encontrada.');
    if (connection.status !== SocialMatchConnectionStatus.ACCEPTED) throw new ForbiddenException('El chat solo se activa cuando ambos aceptan la conexión.');
    if (connection.requesterId !== userId && connection.receiverId !== userId) throw new ForbiddenException('No tienes acceso a este chat.');
    return connection;
  }

  private async getConnections(userId: string) {
    const connections = await this.connectionRepo.find({
      where: [
        { requesterId: userId },
        { receiverId: userId },
      ],
      relations: ['event', 'requester', 'receiver'],
      order: { updatedAt: 'DESC' },
    });

    const accepted = connections.filter((c) => c.status === SocialMatchConnectionStatus.ACCEPTED);
    const otherPrefConditions = accepted.map((c) => ({
      userId: c.requesterId === userId ? c.receiverId : c.requesterId,
      eventId: c.eventId,
    }));
    const myPrefConditions = accepted.map((c) => ({ userId, eventId: c.eventId }));
    const [otherPrefs, myPrefs] = accepted.length
      ? await Promise.all([
          this.preferenceRepo.find({ where: otherPrefConditions }),
          this.preferenceRepo.find({ where: myPrefConditions }),
        ])
      : [[], []];

    return connections.map((connection) => {
      const otherUser = connection.requesterId === userId ? connection.receiver : connection.requester;
      const isAccepted = connection.status === SocialMatchConnectionStatus.ACCEPTED;

      let profile: { fullName: string; industry: string | null; interests: string[]; instagram: string | null } | null = null;
      if (isAccepted && otherUser) {
        const otherPref = otherPrefs.find((p) => p.userId === otherUser.id && p.eventId === connection.eventId);
        const myPref = myPrefs.find((p) => p.eventId === connection.eventId);
        profile = {
          fullName: `${otherUser.firstName} ${otherUser.lastName || ''}`.trim(),
          industry: otherPref?.industry ?? null,
          interests: otherPref?.interests ?? [],
          instagram: otherPref?.shareInstagram && myPref?.shareInstagram ? (otherPref?.instagram ?? null) : null,
        };
      }

      return {
        id: connection.id,
        eventId: connection.eventId,
        eventTitle: connection.event?.title || 'Evento',
        status: connection.status,
        direction: connection.requesterId === userId ? 'outgoing' : 'incoming',
        otherUserName: isAccepted && profile
          ? profile.fullName
          : (otherUser ? `${otherUser.firstName} ${otherUser.lastName?.[0] || ''}.`.trim() : 'Asistente'),
        profile,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      };
    });
  }

  private normalizeInterests(interests: SocialMatchInterest[]) {
    return [...new Set(interests)].filter((interest) => allowedInterests.has(interest));
  }

  private cleanOptionalText(value: string | null | undefined) {
    const cleaned = typeof value === 'string' ? value.trim() : '';
    return cleaned ? cleaned.slice(0, 80) : null;
  }

  private async buildSummary(preference: SocialMatchPreference) {
    const interests = preference.interests || [];
    const compatible = await this.preferenceRepo.find({
      where: {
        eventId: preference.eventId,
        isActive: true,
        invisibleMode: false,
        userId: Not(preference.userId),
      },
    });
    const event = await this.eventRepo.findOne({ where: { id: preference.eventId } });

    const sharedInterestMatches = compatible.filter((item) =>
      (item.interests || []).some((interest) => interests.includes(interest)),
    );
    const industryMatches = compatible.filter((item) =>
      Boolean(preference.industry && item.industry && item.industry.toLowerCase() === preference.industry.toLowerCase()),
    );
    const locationReadyMatches = compatible.filter((item) => item.shareLocation && preference.shareLocation);

    return {
      eventId: preference.eventId,
      eventTitle: event?.title || 'Evento',
      compatibleCount: sharedInterestMatches.length,
      industryCount: industryMatches.length,
      locationReadyCount: locationReadyMatches.length,
      messages: this.buildMessages(sharedInterestMatches.length, industryMatches.length, locationReadyMatches.length),
    };
  }

  private buildMessages(compatibleCount: number, industryCount: number, locationReadyCount: number) {
    const messages: string[] = [];
    if (compatibleCount > 0) messages.push(`${compatibleCount} personas compatibles asistirán`);
    if (industryCount > 0) messages.push(`${industryCount} asistentes comparten tu industria`);
    if (locationReadyCount > 0) messages.push(`${locationReadyCount} conexiones podrían compartir ubicación si ambos aceptan`);
    if (messages.length === 0) messages.push('Activado. Te avisaremos cuando aparezcan perfiles compatibles.');
    return messages;
  }

  async seedTestData(adminUserId: string) {
    // Find the first eligible event for the admin
    const eligibleEvents = await this.getEligibleEvents(adminUserId);
    if (!eligibleEvents.length) return { error: 'Admin has no eligible events with tickets' };
    const event = eligibleEvents[0];
    const eventId = event.id;

    // Get a section from the event
    const adminTicket = await this.ticketRepo.findOne({ where: { userId: adminUserId, eventId, status: TicketStatus.ACTIVE } });
    const sectionId = adminTicket?.sectionId;

    const testUsers = [
      { firstName: 'Mateo', lastName: 'Lopez', email: 'mateo.sm.test@lpticket.com', username: 'mateo_sm_test', interests: [SocialMatchInterest.BUSINESS, SocialMatchInterest.MUSIC_PARTY, SocialMatchInterest.MAKE_FRIENDS], industry: 'Marketing' },
      { firstName: 'Valentina', lastName: 'Ruiz', email: 'vale.sm.test@lpticket.com', username: 'vale_sm_test', interests: [SocialMatchInterest.BUSINESS, SocialMatchInterest.COLLABORATIONS, SocialMatchInterest.VIP_EXPERIENCE], industry: 'Tech' },
    ];

    const created: string[] = [];
    for (const tu of testUsers) {
      let user = await this.userRepo.findOne({ where: { email: tu.email } });
      if (!user) {
        user = await this.userRepo.save(this.userRepo.create({ ...tu, passwordHash: '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUP1KUOYTa', isActive: true }));
      }
      if (!user) continue;

      // Create ticket if needed
      const hasTicket = await this.ticketRepo.findOne({ where: { userId: user.id, eventId, status: TicketStatus.ACTIVE } });
      if (!hasTicket && sectionId) {
        const order = await this.orderRepo.save(this.orderRepo.create({ userId: user.id, eventId, subtotal: 0, total: 0, ticketCount: 1, status: 'paid' as any }));
        const code = 'SMTEST' + Math.random().toString(36).substring(2, 8).toUpperCase();
        await this.ticketRepo.save(this.ticketRepo.create({ orderId: order.id, userId: user.id, eventId, sectionId, rowLabel: 'GA', seatNumber: 1, ticketCode: code, status: TicketStatus.ACTIVE, price: 0 }));
      }

      // Create SM preference
      let pref = await this.preferenceRepo.findOne({ where: { userId: user.id, eventId } });
      if (!pref) pref = this.preferenceRepo.create({ userId: user.id, eventId });
      pref.isActive = true;
      pref.interests = tu.interests;
      pref.industry = tu.industry;
      pref.privateMode = false;
      pref.invisibleMode = false;
      pref.shareInstagram = true;
      pref.shareLocation = true;
      await this.preferenceRepo.save(pref);

      // Remove existing connections with admin
      await this.connectionRepo.delete({ requesterId: adminUserId, receiverId: user.id });
      await this.connectionRepo.delete({ requesterId: user.id, receiverId: adminUserId });

      created.push(`${tu.firstName} ${tu.lastName} (${user.id})`);
    }

    return { success: true, eventId, eventTitle: event.title, createdProfiles: created };
  }
}
