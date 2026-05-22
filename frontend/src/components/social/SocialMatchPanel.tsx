'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiOutlineEyeOff,
  HiOutlineLocationMarker,
  HiOutlineSparkles,
  HiOutlineUserGroup,
} from 'react-icons/hi';
import type { Event } from '@/types';
import {
  getMySocialMatch,
  getSocialMatchMessages,
  getSocialMatchSuggestions,
  requestSocialMatchConnection,
  sendSocialMatchMessage,
  saveSocialMatchPreference,
  updateSocialMatchConnection,
  SocialMatchConnection,
  SocialMatchMessage,
  SocialMatchPreference,
  SocialMatchSuggestion,
  SocialMatchSummary,
  socialMatchInterestOptions,
} from '@/lib/socialMatch';
import type { SocialMatchConnectionProfile } from '@/lib/socialMatch';
import SocialMatchSwiper from './SocialMatchSwiper';

type Props = {
  lang: 'es' | 'en';
};

const emptyPreference = (eventId: string): SocialMatchPreference => ({
  eventId,
  isActive: false,
  interests: [],
  industry: '',
  instagram: '',
  privateMode: true,
  invisibleMode: false,
  shareInstagram: false,
  shareLocation: false,
});

function ConnectionProfileCard({ profile, lang }: { profile: SocialMatchConnectionProfile; lang: 'es' | 'en' }) {
  const hasDetails = profile.industry || (profile.interests && profile.interests.length > 0) || profile.instagram;
  if (!hasDetails) return null;
  return (
    <div className="mt-3 pt-3 border-t border-orange-100 space-y-2">
      {profile.industry && (
        <p className="text-xs text-gray-600">
          <span className="font-semibold">{lang === 'es' ? 'Industria' : 'Industry'}:</span> {profile.industry}
        </p>
      )}
      {profile.interests && profile.interests.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.interests.map((interest) => {
            const opt = socialMatchInterestOptions.find((o) => o.id === interest);
            return (
              <span key={interest} className="px-2 py-0.5 rounded-full bg-orange-100 text-[#F97316] text-xs font-semibold">
                {opt ? (lang === 'es' ? opt.es : opt.en) : interest}
              </span>
            );
          })}
        </div>
      )}
      {profile.instagram && (
        <p className="text-xs font-semibold text-[#F97316]">@{profile.instagram.replace(/^@/, '')}</p>
      )}
    </div>
  );
}

export default function SocialMatchPanel({ lang }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [preferences, setPreferences] = useState<SocialMatchPreference[]>([]);
  const [summaries, setSummaries] = useState<SocialMatchSummary[]>([]);
  const [connections, setConnections] = useState<SocialMatchConnection[]>([]);
  const [suggestions, setSuggestions] = useState<SocialMatchSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [activeChatId, setActiveChatId] = useState('');
  const [chatMessages, setChatMessages] = useState<SocialMatchMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  const selectedPreference = useMemo(() => {
    if (!selectedEventId) return null;
    return preferences.find((item) => item.eventId === selectedEventId) || emptyPreference(selectedEventId);
  }, [preferences, selectedEventId]);

  const selectedSummary = summaries.find((item) => item.eventId === selectedEventId);

  const copy = {
    title: 'Social Match',
    subtitle: lang === 'es'
      ? 'Conecta con personas compatibles en los eventos donde ya tienes entrada.'
      : 'Connect with compatible people at events where you already have a ticket.',
    noEvents: lang === 'es'
      ? 'Compra una entrada para activar Social Match en ese evento.'
      : 'Buy a ticket to activate Social Match for that event.',
    event: lang === 'es' ? 'Evento' : 'Event',
    interests: lang === 'es' ? 'Intereses' : 'Interests',
    active: lang === 'es' ? 'Activar Social Match' : 'Activate Social Match',
    industry: lang === 'es' ? 'Industria o área' : 'Industry or field',
    instagram: lang === 'es' ? 'Instagram opcional' : 'Optional Instagram',
    save: lang === 'es' ? 'Guardar Social Match' : 'Save Social Match',
    saving: lang === 'es' ? 'Guardando...' : 'Saving...',
    saved: lang === 'es' ? 'Social Match actualizado' : 'Social Match updated',
    error: lang === 'es' ? 'No se pudo guardar Social Match' : 'Could not save Social Match',
    connect: lang === 'es' ? 'Solicitar conexión' : 'Request connection',
    sent: lang === 'es' ? 'Solicitud enviada' : 'Request sent',
    requests: lang === 'es' ? 'Solicitudes de conexión' : 'Connection requests',
    suggestions: lang === 'es' ? 'Perfiles sugeridos' : 'Suggested profiles',
    noSuggestions: lang === 'es' ? 'Aún no hay perfiles compatibles para este evento.' : 'No compatible profiles for this event yet.',
    accept: lang === 'es' ? 'Aceptar' : 'Accept',
    decline: lang === 'es' ? 'Rechazar' : 'Decline',
    cancel: lang === 'es' ? 'Cancelar' : 'Cancel',
    chat: lang === 'es' ? 'Chat' : 'Chat',
    messagePlaceholder: lang === 'es' ? 'Escribe un mensaje...' : 'Write a message...',
    send: lang === 'es' ? 'Enviar' : 'Send',
  };

  useEffect(() => {
    loadSocialMatch();
  }, []);

  useEffect(() => {
    if (selectedEventId && selectedPreference?.isActive) {
      loadSuggestions(selectedEventId);
    } else {
      setSuggestions([]);
    }
  }, [selectedEventId, selectedPreference?.isActive]);


  useEffect(() => {
    if (!activeChatId) return;

    const interval = window.setInterval(async () => {
      try {
        const data = await getSocialMatchMessages(activeChatId);
        setChatMessages(data.messages || []);
      } catch (error) {
        console.error(error);
      }
    }, 6000);

    return () => window.clearInterval(interval);
  }, [activeChatId]);

  const loadSocialMatch = async () => {
    try {
      setLoading(true);
      const data = await getMySocialMatch();
      setEvents(data.eligibleEvents || []);
      setPreferences(data.preferences || []);
      setSummaries(data.summaries || []);
      setConnections(data.connections || []);
      setSelectedEventId((current) => current || data.eligibleEvents?.[0]?.id || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async (eventId: string) => {
    try {
      setLoadingSuggestions(true);
      const data = await getSocialMatchSuggestions(eventId);
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error(error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const updatePreference = (patch: Partial<SocialMatchPreference>) => {
    if (!selectedEventId) return;
    setPreferences((current) => {
      const existing = current.find((item) => item.eventId === selectedEventId) || emptyPreference(selectedEventId);
      return [...current.filter((item) => item.eventId !== selectedEventId), { ...existing, ...patch }];
    });
  };

  const toggleInterest = (interest: string) => {
    const current = selectedPreference?.interests || [];
    updatePreference({
      interests: current.includes(interest)
        ? current.filter((item) => item !== interest)
        : [...current, interest],
    });
  };

  const handleSave = async () => {
    if (!selectedEventId || !selectedPreference) return;
    if (selectedPreference.isActive && (selectedPreference.interests || []).length === 0) {
      toast.error(lang === 'es' ? 'Selecciona al menos un interés' : 'Select at least one interest');
      return;
    }

    try {
      setSaving(true);
      const result = await saveSocialMatchPreference(selectedEventId, selectedPreference);
      setPreferences((current) => [...current.filter((item) => item.eventId !== selectedEventId), result.preference]);
      setSummaries((current) => {
        const next = current.filter((item) => item.eventId !== selectedEventId);
        return result.summary ? [...next, result.summary] : next;
      });
      if (result.preference?.isActive) await loadSuggestions(selectedEventId);
      else setSuggestions([]);
      toast.success(copy.saved);
    } catch (error) {
      console.error(error);
      toast.error(copy.error);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestConnection = async (receiverId: string) => {
    if (!selectedEventId) return;
    try {
      await requestSocialMatchConnection(selectedEventId, receiverId);
      toast.success(copy.sent);
      await loadSocialMatch();
      await loadSuggestions(selectedEventId);
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo enviar la solicitud' : 'Could not send request');
    }
  };

  const handleUpdateConnection = async (connectionId: string, status: 'accepted' | 'declined' | 'cancelled') => {
    try {
      await updateSocialMatchConnection(connectionId, status);
      await loadSocialMatch();
      window.dispatchEvent(new Event('social-match-updated'));
      toast.success(lang === 'es' ? 'Solicitud actualizada' : 'Request updated');
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo actualizar la solicitud' : 'Could not update request');
    }
  };


  const openChat = async (connectionId: string) => {
    try {
      setActiveChatId(connectionId);
      setChatLoading(true);
      const data = await getSocialMatchMessages(connectionId);
      setChatMessages(data.messages || []);
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo abrir el chat' : 'Could not open chat');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!activeChatId || !chatDraft.trim()) return;
    try {
      setChatSending(true);
      const saved = await sendSocialMatchMessage(activeChatId, chatDraft);
      setChatMessages((current) => [...current, saved]);
      setChatDraft('');
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo enviar el mensaje' : 'Could not send message');
    } finally {
      setChatSending(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
        <div className="h-6 w-40 bg-gray-100 rounded mb-4 animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] text-center">
        <HiOutlineUserGroup className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-bold text-xl text-gray-900">{copy.title}</h3>
        <p className="text-gray-500 mt-2">{copy.noEvents}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 text-[#F97316] text-xs font-bold uppercase tracking-wider mb-3">
            <HiOutlineSparkles className="w-4 h-4" />
            Premium
          </div>
          <h3 className="font-bold text-2xl text-gray-900">{copy.title}</h3>
          <p className="text-gray-500 text-sm mt-1 max-w-xl">{copy.subtitle}</p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <span className="text-sm font-bold text-gray-700">{copy.active}</span>
          <input type="checkbox" checked={Boolean(selectedPreference?.isActive)} onChange={(event) => updatePreference({ isActive: event.target.checked })} className="w-5 h-5 accent-orange-500" />
        </label>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{copy.event}</label>
          <select value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="input bg-gray-50 border-gray-200">
            {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{copy.interests}</label>
          <div className="flex flex-wrap gap-2">
            {socialMatchInterestOptions.map((interest) => {
              const selected = (selectedPreference?.interests || []).includes(interest.id);
              return (
                <button key={interest.id} type="button" onClick={() => toggleInterest(interest.id)} className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${selected ? 'bg-[#0A375A] border-[#0A375A] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-[rgba(249,115,22,0.42)] hover:text-[#F97316]'}`}>
                  {lang === 'es' ? interest.es : interest.en}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{copy.industry}</label>
            <input value={selectedPreference?.industry || ''} onChange={(event) => updatePreference({ industry: event.target.value })} className="input bg-gray-50 border-gray-200" placeholder={lang === 'es' ? 'Ej. Música, finanzas, real estate' : 'Ex. Music, finance, real estate'} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{copy.instagram}</label>
            <input value={selectedPreference?.instagram || ''} onChange={(event) => updatePreference({ instagram: event.target.value })} className="input bg-gray-50 border-gray-200" placeholder="@lpticket" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 cursor-pointer">
            <input type="checkbox" checked={Boolean(selectedPreference?.privateMode)} onChange={(event) => updatePreference({ privateMode: event.target.checked })} className="w-4 h-4 accent-orange-500" />
            <HiOutlineUserGroup className="w-5 h-5 text-[#0A375A]" />
            <span className="text-sm font-semibold text-gray-700">{lang === 'es' ? 'Modo privado' : 'Private mode'}</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 cursor-pointer">
            <input type="checkbox" checked={Boolean(selectedPreference?.invisibleMode)} onChange={(event) => updatePreference({ invisibleMode: event.target.checked })} className="w-4 h-4 accent-orange-500" />
            <HiOutlineEyeOff className="w-5 h-5 text-[#0A375A]" />
            <span className="text-sm font-semibold text-gray-700">{lang === 'es' ? 'Modo invisible' : 'Invisible mode'}</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 cursor-pointer">
            <input type="checkbox" checked={Boolean(selectedPreference?.shareInstagram)} onChange={(event) => updatePreference({ shareInstagram: event.target.checked })} className="w-4 h-4 accent-orange-500" />
            <HiOutlineSparkles className="w-5 h-5 text-[#0A375A]" />
            <span className="text-sm font-semibold text-gray-700">{lang === 'es' ? 'Compartir Instagram solo si ambos aceptan' : 'Share Instagram only if both accept'}</span>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 cursor-pointer">
            <input type="checkbox" checked={Boolean(selectedPreference?.shareLocation)} onChange={(event) => updatePreference({ shareLocation: event.target.checked })} className="w-4 h-4 accent-orange-500" />
            <HiOutlineLocationMarker className="w-5 h-5 text-[#0A375A]" />
            <span className="text-sm font-semibold text-gray-700">{lang === 'es' ? 'Permitir ubicación aproximada solo si ambos aceptan' : 'Allow approximate location only if both accept'}</span>
          </label>
        </div>

        {selectedSummary && (
          <div className="rounded-2xl border border-[rgba(249,115,22,0.22)] bg-orange-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#F97316] mb-2">{lang === 'es' ? 'Sugerencias compatibles' : 'Compatible suggestions'}</p>
            <div className="space-y-1">
              {selectedSummary.messages.map((message) => <p key={message} className="text-sm font-semibold text-gray-800">{message}</p>)}
            </div>
          </div>
        )}

        {selectedPreference?.isActive && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0A375A] mb-3">{copy.suggestions}</p>
            {loadingSuggestions ? (
              <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
            ) : suggestions.length > 0 ? (
              <SocialMatchSwiper
                suggestions={suggestions}
                lang={lang}
                onConnect={async (userId) => {
                  await handleRequestConnection(userId);
                }}
              />
            ) : (
              <p className="text-sm text-gray-500">{copy.noSuggestions}</p>
            )}
          </div>
        )}

        {connections.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0A375A] mb-3">{copy.requests}</p>
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className={`rounded-xl border p-4 ${connection.status === 'accepted' ? 'border-orange-100 bg-orange-50/40' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">{connection.otherUserName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{connection.eventTitle} · {connection.status}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {connection.status === 'pending' && connection.direction === 'incoming' && (
                        <>
                          <button type="button" onClick={() => handleUpdateConnection(connection.id, 'accepted')} className="px-3 py-2 rounded-lg bg-[#0A375A] text-white text-xs font-bold">{copy.accept}</button>
                          <button type="button" onClick={() => handleUpdateConnection(connection.id, 'declined')} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold">{copy.decline}</button>
                        </>
                      )}
                      {connection.status === 'pending' && connection.direction === 'outgoing' && (
                        <button type="button" onClick={() => handleUpdateConnection(connection.id, 'cancelled')} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold">{copy.cancel}</button>
                      )}
                      {connection.status === 'accepted' && (
                        <button type="button" onClick={() => openChat(connection.id)} className="px-3 py-2 rounded-lg bg-[#F97316] text-white text-xs font-bold">{copy.chat}</button>
                      )}
                    </div>
                  </div>
                  {connection.status === 'accepted' && connection.profile && (
                    <ConnectionProfileCard profile={connection.profile} lang={lang} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}


        {activeChatId && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#0A375A]">{copy.chat}</p>
              <button type="button" onClick={() => setActiveChatId('')} className="text-xs font-bold text-gray-400 hover:text-gray-700">Cerrar</button>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl bg-gray-50 p-3 space-y-2">
              {chatLoading ? (
                <div className="h-16 bg-white rounded-xl animate-pulse" />
              ) : chatMessages.length > 0 ? (
                chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.isMine ? 'bg-[#0A375A] text-white' : 'bg-white text-gray-800 border border-gray-100'}`}>
                      {!message.isMine && <p className="text-[10px] font-bold text-gray-400 mb-1">{message.senderName}</p>}
                      <p>{message.message}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No hay mensajes todavía.</p>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="input bg-gray-50 border-gray-200"
                placeholder={copy.messagePlaceholder}
              />
              <button type="button" onClick={handleSendMessage} disabled={chatSending || !chatDraft.trim()} className="px-4 rounded-xl bg-[#F97316] text-white text-sm font-bold disabled:opacity-50">
                {copy.send}
              </button>
            </div>
          </div>
        )}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3.5 rounded-lg font-bold shadow-lg shadow-orange-500/20 disabled:opacity-60">
          {saving ? copy.saving : copy.save}
        </button>
      </div>
    </div>
  );
}
