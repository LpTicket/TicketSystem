import api from '@/lib/api';

export const socialMatchInterestOptions = [
  { id: 'professional_networking', es: 'Networking profesional', en: 'Professional networking' },
  { id: 'make_friends', es: 'Hacer amigos', en: 'Make friends' },
  { id: 'music_party', es: 'Música y fiesta', en: 'Music and party' },
  { id: 'business', es: 'Negocios', en: 'Business' },
  { id: 'collaborations', es: 'Colaboraciones', en: 'Collaborations' },
  { id: 'singles', es: 'Solteros', en: 'Singles' },
  { id: 'vip_experience', es: 'VIP Experience', en: 'VIP Experience' },
  { id: 'other', es: 'Otros', en: 'Other' },
];

export type SocialMatchPreference = {
  id?: string;
  eventId: string;
  isActive: boolean;
  interests: string[] | null;
  industry?: string | null;
  instagram?: string | null;
  privateMode: boolean;
  invisibleMode: boolean;
  shareInstagram: boolean;
  shareLocation: boolean;
};

export type SocialMatchSummary = {
  eventId: string;
  eventTitle: string;
  compatibleCount: number;
  industryCount: number;
  locationReadyCount: number;
  messages: string[];
};

export async function getMySocialMatch() {
  const { data } = await api.get('/social-match/me');
  return data;
}

export async function saveSocialMatchPreference(eventId: string, payload: Partial<SocialMatchPreference>) {
  const { data } = await api.put(`/social-match/events/${eventId}/preferences`, payload);
  return data;
}
