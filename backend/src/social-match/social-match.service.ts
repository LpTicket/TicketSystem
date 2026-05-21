import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Event, SocialMatchInterest, SocialMatchPreference, Ticket, TicketStatus } from '../database/entities';

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
    @InjectRepository(SocialMatchPreference) private readonly preferenceRepo: Repository<SocialMatchPreference>,
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Event) private readonly eventRepo: Repository<Event>,
  ) {}

  async getMySocialMatch(userId: string) {
    const eligibleEvents = await this.getEligibleEvents(userId);
    const eventIds = eligibleEvents.map((event) => event.id);
    const preferences = eventIds.length ? await this.preferenceRepo.find({ where: { userId, eventId: In(eventIds) } }) : [];
    const summaries = await Promise.all(preferences.filter((p) => p.isActive).map((p) => this.buildSummary(p)));
    return { eligibleEvents, preferences, summaries, interests: Object.values(SocialMatchInterest) };
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
      where: { eventId: preference.eventId, isActive: true, invisibleMode: false, userId: Not(preference.userId) },
    });
    const event = await this.eventRepo.findOne({ where: { id: preference.eventId } });
    const shared = compatible.filter((item) => (item.interests || []).some((interest) => interests.includes(interest)));
    const industry = compatible.filter((item) => Boolean(preference.industry && item.industry && item.industry.toLowerCase() === preference.industry.toLowerCase()));
    const location = compatible.filter((item) => item.shareLocation && preference.shareLocation);

    return {
      eventId: preference.eventId,
      eventTitle: event?.title || 'Evento',
      compatibleCount: shared.length,
      industryCount: industry.length,
      locationReadyCount: location.length,
      messages: this.buildMessages(shared.length, industry.length, location.length),
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
