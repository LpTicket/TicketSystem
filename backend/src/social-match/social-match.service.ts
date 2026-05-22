import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import {
  Event,
  SocialMatchConnection,
  SocialMatchConnectionStatus,
  SocialMatchInterest,
  SocialMatchMessage,
  SocialMatchPreference,
  Ticket,
  TicketStatus,
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

    const candidates = await this.preferenceRepo.find({
      where: { eventId, isActive: true, invisibleMode: false, userId: Not(userId) },
      relations: ['user'],
    });

    const myInterests = myPreference.interests || [];
    const suggestions = candidates
      .filter((candidate) => !connectedUserIds.has(candidate.userId))
      .map((candidate) => {
        const sharedInterests = (candidate.interests || []).filter((interest) => myInterests.includes(interest));
        const industryMatch = Boolean(myPreference.industry && candidate.industry && candidate.industry.toLowerCase() === myPreference.industry.toLowerCase());
        const score = sharedInterests.length + (industryMatch ? 2 : 0) + (candidate.shareLocation && myPreference.shareLocation ? 1 : 0);

        return {
          userId: candidate.userId,
          displayName: candidate.privateMode ? 'Asistente compatible' : `${candidate.user?.firstName || 'Asistente'} ${candidate.user?.lastName?.[0] || ''}.`.trim(),
          sharedInterests,
          industryMatch,
          industry: candidate.industry || null,
          canShareLocationLater: candidate.shareLocation && myPreference.shareLocation,
          score,
        };
      })
      .filter((suggestion) => suggestion.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return { suggestions };
  }

  async requestConnection(userId: string, eventId: string, receiverId: string) {
    if (!receiverId || receiverId === userId) throw new BadRequestException('Selecciona una conexión válida.');

    await this.ensureActivePreference(userId, eventId);
    await this.ensureActivePreference(receiverId, eventId);

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
      if (connection.requesterId !== userId) throw new ForbiddenException('Solo quien envió la solicitud puede cancelarla.');
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

    return connections.map((connection) => {
      const otherUser = connection.requesterId === userId ? connection.receiver : connection.requester;
      return {
        id: connection.id,
        eventId: connection.eventId,
        eventTitle: connection.event?.title || 'Evento',
        status: connection.status,
        direction: connection.requesterId === userId ? 'outgoing' : 'incoming',
        otherUserName: otherUser ? `${otherUser.firstName} ${otherUser.lastName?.[0] || ''}.`.trim() : 'Asistente',
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
}
