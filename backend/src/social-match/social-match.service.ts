import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { SocialMatchPreference, Ticket } from '../database/entities';

const ALLOWED_INTERESTS = [
  'professional_networking',
  'make_friends',
  'music_party',
  'business',
  'collaborations',
  'singles',
  'vip_experience',
  'other',
];

type PreferenceDto = {
  enabled?: boolean;
  interests?: string[];
  invisibleMode?: boolean;
  shareLocation?: boolean;
  instagram?: string;
  industry?: string;
};

@Injectable()
export class SocialMatchService {
  constructor(
    @InjectRepository(SocialMatchPreference)
    private readonly preferenceRepo: Repository<SocialMatchPreference>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async getMyPreferences(userId: string) {
    return this.preferenceRepo.find({
      where: { userId },
      relations: ['event'],
      order: { updatedAt: 'DESC' },
    });
  }

  async upsertPreference(userId: string, eventId: string, dto: PreferenceDto) {
    const interests = Array.isArray(dto.interests)
      ? dto.interests.filter((interest) => ALLOWED_INTERESTS.includes(interest))
      : [];

    let preference = await this.preferenceRepo.findOne({ where: { userId, eventId } });
    if (!preference) {
      preference = this.preferenceRepo.create({ userId, eventId });
    }

    preference.enabled = Boolean(dto.enabled);
    preference.interests = interests;
    preference.invisibleMode = Boolean(dto.invisibleMode);
    preference.shareLocation = Boolean(dto.shareLocation);
    preference.instagram = dto.instagram?.trim() || undefined;
    preference.industry = dto.industry?.trim() || undefined;

    return this.preferenceRepo.save(preference);
  }

  async getEventSummary(userId: string, eventId: string) {
    const myPreference = await this.preferenceRepo.findOne({ where: { userId, eventId } });
    const activePreferences = await this.preferenceRepo.find({
      where: {
        eventId,
        enabled: true,
        invisibleMode: false,
        userId: Not(userId),
      },
    });

    const myInterests = new Set(myPreference?.interests || []);
    const compatible = activePreferences.filter((preference) =>
      (preference.interests || []).some((interest) => myInterests.has(interest)),
    );

    const vipCompatibleCount = compatible.filter((preference) =>
      (preference.interests || []).includes('vip_experience'),
    ).length;

    const sharedInterestCount = compatible.reduce(
      (sum, preference) =>
        sum + (preference.interests || []).filter((interest) => myInterests.has(interest)).length,
      0,
    );

    const eventTickets = await this.ticketRepo.find({ where: { eventId } });
    const activeParticipantCount = activePreferences.length + (myPreference?.enabled ? 1 : 0);

    return {
      preference: myPreference || null,
      activeParticipantCount,
      compatibleCount: compatible.length,
      sharedInterestCount,
      vipCompatibleCount,
      ticketedAttendeeCount: eventTickets.length,
      suggestions: [
        compatible.length > 0 ? `${compatible.length} personas compatibles asistirán` : null,
        sharedInterestCount > 0 ? `${sharedInterestCount} intereses compartidos detectados` : null,
        vipCompatibleCount > 0 ? `${vipCompatibleCount} conexiones compatibles tienen interés VIP` : null,
      ].filter(Boolean),
    };
  }
}
