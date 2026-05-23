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

export type SocialMatchSuggestion = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  sharedInterests: string[];
  industryMatch: boolean;
  industry: string | null;
  canShareLocationLater: boolean;
  score: number;
};

export type SocialMatchConnectionProfile = {
  fullName: string;
  industry: string | null;
  interests: string[];
  instagram: string | null;
};

export type SocialMatchConnection = {
  id: string;
  eventId: string;
  eventTitle: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  direction: 'incoming' | 'outgoing';
  otherUserName: string;
  profile: SocialMatchConnectionProfile | null;
  createdAt: string;
  updatedAt: string;
};

export async function getMySocialMatch() {
  const { data } = await api.get('/social-match/me');
  return data;
}

export async function saveSocialMatchPreference(eventId: string, payload: Partial<SocialMatchPreference>) {
  const { data } = await api.put(`/social-match/events/${eventId}/preferences`, payload);
  return data;
}

export async function getSocialMatchSuggestions(eventId: string) {
  const { data } = await api.get(`/social-match/events/${eventId}/suggestions`);
  return data;
}

export async function requestSocialMatchConnection(eventId: string, receiverId: string) {
  const { data } = await api.post('/social-match/connections', { eventId, receiverId });
  return data;
}

export async function updateSocialMatchConnection(connectionId: string, status: 'accepted' | 'declined' | 'cancelled') {
  const { data } = await api.put(`/social-match/connections/${connectionId}`, { status });
  return data;
}

export type SocialMatchMessage = {
  id: string;
  message: string;
  senderId: string;
  senderName?: string;
  isMine: boolean;
  createdAt: string;
};

export async function getSocialMatchMessages(connectionId: string) {
  const { data } = await api.get(`/social-match/connections/${connectionId}/messages`);
  return data;
}

export async function sendSocialMatchMessage(connectionId: string, message: string) {
  const { data } = await api.post(`/social-match/connections/${connectionId}/messages`, { message });
  return data;
}
