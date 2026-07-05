'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  HiOutlineEyeOff,
  HiOutlineLocationMarker,
  HiOutlineSparkles,
  HiOutlineUserGroup,
  HiOutlineCamera,
  HiOutlineTrash,
  HiOutlineChatAlt2,
  HiOutlinePaperAirplane,
  HiOutlineX,
} from 'react-icons/hi';
import { FaInstagram } from 'react-icons/fa';
import type { Event } from '@/types';
import {
  getMySocialMatch,
  getSocialMatchSuggestions,
  getSocialMatchMessages,
  dismissSocialMatchSuggestion,
  requestSocialMatchConnection,
  saveSocialMatchPreference,
  sendSocialMatchMessage,
  updateSocialMatchConnection,
  uploadSocialMatchPhoto,
  deleteSocialMatchPhoto,
  deleteSocialMatchChat,
  SocialMatchConnection,
  SocialMatchMessage,
  SocialMatchPreference,
  SocialMatchSuggestion,
  SocialMatchSummary,
  socialMatchInterestOptions,
} from '@/lib/socialMatch';
import { useAuthStore } from '@/stores/auth';
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
  privateMode: false,
  invisibleMode: false,
  shareInstagram: false,
  shareLocation: false,
});


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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState(0);
  const [brokenPhotos, setBrokenPhotos] = useState<Set<string>>(new Set());
  const [activeChatConnection, setActiveChatConnection] = useState<SocialMatchConnection | null>(null);
  const [chatMessages, setChatMessages] = useState<SocialMatchMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  const selectedPreference = useMemo(() => {
    if (!selectedEventId) return null;
    return preferences.find((item) => item.eventId === selectedEventId) || emptyPreference(selectedEventId);
  }, [preferences, selectedEventId]);

  const selectedSummary = summaries.find((item) => item.eventId === selectedEventId);
  const acceptedConnections = connections.filter((connection) => connection.status === 'accepted');

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
    myConnections: lang === 'es' ? 'Mis conexiones' : 'My connections',
    myConnectionsSubtitle: lang === 'es'
      ? 'Personas con match confirmado. Toca una tarjeta para abrir el chat.'
      : 'Confirmed matches. Tap a card to open the chat.',
    chat: lang === 'es' ? 'Chatear' : 'Chat',
    noConnections: lang === 'es'
      ? 'Cuando ambos acepten una conexión, aparecerá aquí.'
      : 'When both people accept a connection, it will appear here.',
    suggestions: lang === 'es' ? 'Perfiles sugeridos' : 'Suggested profiles',
    noSuggestions: lang === 'es' ? 'Aún no hay perfiles compatibles para este evento.' : 'No compatible profiles for this event yet.',
    accept: lang === 'es' ? 'Aceptar' : 'Accept',
    decline: lang === 'es' ? 'Rechazar' : 'Decline',
    cancel: lang === 'es' ? 'Cancelar' : 'Cancel',
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeChatConnection]);


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

  const myPhotos = selectedPreference?.photos || [];

  const handleUploadPhoto = async (file: File) => {
    if (!selectedEventId) return;
    if (myPhotos.length >= 6) { toast.error(lang === 'es' ? 'Máximo 6 fotos' : 'Maximum 6 photos'); return; }
    try {
      setUploadingPhoto(true);
      const result = await uploadSocialMatchPhoto(selectedEventId, file);
      setPreferences((cur) => cur.map((p) => p.eventId === selectedEventId ? { ...p, photos: result.photos } : p));
    } catch {
      toast.error(lang === 'es' ? 'Error al subir foto' : 'Could not upload photo');
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (index: number) => {
    if (!selectedEventId) return;
    try {
      const result = await deleteSocialMatchPhoto(selectedEventId, index);
      setPreferences((cur) => cur.map((p) => p.eventId === selectedEventId ? { ...p, photos: result.photos } : p));
    } catch {
      toast.error(lang === 'es' ? 'Error al eliminar foto' : 'Could not delete photo');
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

  const handleDismissSuggestion = async (receiverId: string) => {
    if (!selectedEventId) return;
    try {
      await dismissSocialMatchSuggestion(selectedEventId, receiverId);
      await loadSocialMatch();
      await loadSuggestions(selectedEventId);
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo ocultar el perfil' : 'Could not hide profile');
      throw error;
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

  const openConnectionChat = async (connection: SocialMatchConnection) => {
    setActiveChatConnection(connection);
    setChatMessages([]);
    setChatDraft('');
    try {
      setLoadingChat(true);
      const data = await getSocialMatchMessages(connection.id);
      setChatMessages(data.messages || []);
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo abrir el chat' : 'Could not open chat');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!activeChatConnection || !chatDraft.trim() || sendingChat) return;
    try {
      setSendingChat(true);
      const saved = await sendSocialMatchMessage(activeChatConnection.id, chatDraft.trim());
      setChatMessages((current) => [...current, saved]);
      setChatDraft('');
      window.dispatchEvent(new Event('social-match-updated'));
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo enviar el mensaje' : 'Could not send message');
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteConnectionChat = async (connection: SocialMatchConnection) => {
    if (!confirm(lang === 'es' ? '¿Eliminar este chat de tu lista?' : 'Delete this chat from your list?')) return;
    try {
      await deleteSocialMatchChat(connection.id);
      setConnections((current) => current.filter((item) => item.id !== connection.id));
      if (activeChatConnection?.id === connection.id) {
        setActiveChatConnection(null);
        setChatMessages([]);
        setChatDraft('');
      }
      window.dispatchEvent(new Event('social-match-updated'));
      toast.success(lang === 'es' ? 'Chat eliminado' : 'Chat deleted');
    } catch (error) {
      console.error(error);
      toast.error(lang === 'es' ? 'No se pudo eliminar el chat' : 'Could not delete chat');
    }
  };

  const closeConnectionChat = () => {
    setActiveChatConnection(null);
    setChatMessages([]);
    setChatDraft('');
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

        {/* Photo gallery */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            {lang === 'es' ? `Mis fotos (${myPhotos.length}/6)` : `My photos (${myPhotos.length}/6)`}
          </label>
          <div className="flex flex-wrap gap-3">
            {myPhotos.map((photo, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden group">
                <img src={photo} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(i)}
                  className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <HiOutlineTrash className="w-5 h-5 text-white" />
                </button>
              </div>
            ))}
            {myPhotos.length < 6 && (
              <label className={`w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all ${uploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                <HiOutlineCamera className="w-6 h-6 text-gray-400" />
                <span className="text-[10px] text-gray-400 mt-1">{uploadingPhoto ? '...' : (lang === 'es' ? 'Agregar' : 'Add')}</span>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadPhoto(f); }}
                />
              </label>
            )}
          </div>
        </div>

        {/* My card preview */}
        {(() => {
          const allPhotos = (selectedPreference?.photos || []).filter((src) => !brokenPhotos.has(src));
          const clampedIndex = Math.min(previewPhotoIndex, Math.max(0, allPhotos.length - 1));
          const isPrivate = selectedPreference?.privateMode ?? false;
          const displayName = isPrivate ? 'Asistente' : `${user?.firstName || ''} ${(user?.lastName || '')[0] || ''}.`.trim();
          return (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                {lang === 'es' ? 'Así te ven los demás' : 'How others see you'}
              </label>
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm max-w-xs">
                {allPhotos.length > 0 ? (
                  <div className="relative h-[560px] bg-[#0A375A]">
                    <img
                      src={allPhotos[clampedIndex]}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={() => {
                        setBrokenPhotos((prev) => new Set([...prev, allPhotos[clampedIndex]]));
                        setPreviewPhotoIndex((p) => Math.max(0, p - 1));
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {allPhotos.length > 1 && (
                      <>
                        <button type="button" onClick={() => setPreviewPhotoIndex((p) => Math.max(0, p - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center text-lg font-bold">‹</button>
                        <button type="button" onClick={() => setPreviewPhotoIndex((p) => Math.min(allPhotos.length - 1, p + 1))} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/30 text-white flex items-center justify-center text-lg font-bold">›</button>
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-1">
                          {allPhotos.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === clampedIndex ? 'bg-white' : 'bg-white/40'}`} />)}
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 text-white">
                      <p className="font-black text-base">{displayName}</p>
                      {selectedPreference?.industry && <p className="text-xs text-white/80">{selectedPreference.industry}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6 bg-gradient-to-br from-[#0A375A] to-[#134E7A] text-white">
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-black uppercase mb-2">
                      {displayName.charAt(0)}
                    </div>
                    <p className="font-black text-base">{displayName}</p>
                    {selectedPreference?.industry && <p className="text-xs text-white/70">{selectedPreference.industry}</p>}
                  </div>
                )}
                {(selectedPreference?.interests || []).length > 0 && (
                  <div className="px-4 pt-4 pb-3 bg-white">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2.5">
                      {lang === 'es' ? 'Intereses' : 'Interests'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedPreference?.interests || []).map((id) => {
                        const opt = socialMatchInterestOptions.find((o) => o.id === id);
                        return (
                          <span key={id} className="px-3 py-1.5 rounded-xl bg-orange-50 text-[#F97316] text-xs font-bold border border-orange-200">
                            {opt ? (lang === 'es' ? opt.es : opt.en) : id}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {selectedPreference?.instagram && (
                  <div className="px-4 pb-4 bg-white">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200">
                      <FaInstagram className="w-4 h-4 text-[#E1306C] shrink-0" />
                      <span className="text-sm font-black text-gray-800">@{selectedPreference.instagram.replace(/^@/, '')}</span>
                      <span className="text-[10px] text-gray-400 ml-auto shrink-0">{lang === 'es' ? 'solo si ambos aceptan' : 'only if both accept'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {selectedSummary && (
          <div className="rounded-2xl border border-[rgba(249,115,22,0.22)] bg-orange-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#F97316] mb-2">{lang === 'es' ? 'Sugerencias compatibles' : 'Compatible suggestions'}</p>
            <div className="space-y-1">
              {selectedSummary.messages.map((message) => <p key={message} className="text-sm font-semibold text-gray-800">{message}</p>)}
            </div>
          </div>
        )}


        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 border-b border-gray-100 bg-gray-50/70">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#0A375A]">{copy.myConnections}</p>
              <p className="text-xs text-gray-500 mt-1">{copy.myConnectionsSubtitle}</p>
            </div>
            <span className="w-fit rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#F97316] border border-orange-100">
              {acceptedConnections.length}
            </span>
          </div>

          {acceptedConnections.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <HiOutlineChatAlt2 className="w-9 h-9 text-gray-200 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-500">{copy.noConnections}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
              {acceptedConnections.map((connection) => {
                const photos = connection.profile?.photos || [];
                const firstPhoto = photos[0];
                const interests = connection.profile?.interests || [];
                return (
                  <div
                    key={connection.id}
                    className="group text-left rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] transition-all overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => openConnectionChat(connection)}
                      className="w-full text-left"
                    >
                    <div className="flex gap-3 p-3">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0A375A] to-[#F97316] overflow-hidden shrink-0 flex items-center justify-center text-white text-lg font-black">
                        {firstPhoto ? <img src={firstPhoto} alt="" className="w-full h-full object-cover" /> : connection.otherUserName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-gray-900 truncate">{connection.otherUserName}</p>
                            <p className="text-xs text-gray-500 truncate">{connection.eventTitle}</p>
                          </div>
                          <span className="hidden sm:inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0A375A] px-2.5 py-1 text-[10px] font-black text-white group-hover:bg-[#F97316] transition-colors">
                            <HiOutlineChatAlt2 className="w-3.5 h-3.5" />
                            {copy.chat}
                          </span>
                        </div>

                        {connection.profile?.industry && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{connection.profile.industry}</p>
                        )}

                        {interests.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {interests.slice(0, 3).map((id) => {
                              const opt = socialMatchInterestOptions.find((item) => item.id === id);
                              return (
                                <span key={id} className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold text-[#F97316]">
                                  {opt ? (lang === 'es' ? opt.es : opt.en) : id}
                                </span>
                              );
                            })}
                            {interests.length > 3 && (
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-500">
                                +{interests.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    </button>
                    <div className="flex items-center justify-end gap-2 border-t border-gray-50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteConnectionChat(connection)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-100 transition-colors"
                      >
                        <HiOutlineTrash className="w-3.5 h-3.5" />
                        {lang === 'es' ? 'Eliminar chat' : 'Delete chat'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                onSkip={async (userId) => {
                  await handleDismissSuggestion(userId);
                }}
              />
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold text-gray-500">{lang === 'es' ? 'No hay perfiles pendientes por descubrir' : 'No pending profiles to discover'}</p>
                <p className="text-xs text-gray-400 mt-1">{lang === 'es' ? 'Vuelve más tarde, nuevos asistentes podrían unirse.' : 'Check back later, new attendees might join.'}</p>
              </div>
            )}
          </div>
        )}

        {connections.some((c) => c.status === 'pending') && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-[#0A375A] mb-3">{copy.requests}</p>
            <div className="space-y-3">
              {connections.filter((c) => c.status === 'pending').map((connection) => (
                <div key={connection.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900">{connection.otherUserName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{connection.eventTitle} · {connection.direction === 'incoming' ? (lang === 'es' ? 'quiere conectar contigo' : 'wants to connect') : (lang === 'es' ? 'solicitud enviada' : 'request sent')}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {connection.direction === 'incoming' && (
                        <>
                          <button type="button" onClick={() => handleUpdateConnection(connection.id, 'accepted')} className="px-3 py-2 rounded-lg bg-[#0A375A] text-white text-xs font-bold">{copy.accept}</button>
                          <button type="button" onClick={() => handleUpdateConnection(connection.id, 'declined')} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold">{copy.decline}</button>
                        </>
                      )}
                      {connection.direction === 'outgoing' && (
                        <button type="button" onClick={() => handleUpdateConnection(connection.id, 'cancelled')} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 text-xs font-bold">{copy.cancel}</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3.5 rounded-lg font-bold shadow-lg shadow-orange-500/20 disabled:opacity-60">
          {saving ? copy.saving : copy.save}
        </button>
      </div>

      {activeChatConnection && (
        <div className="fixed inset-0 z-[120] bg-slate-900/45 px-4 py-6 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg max-h-[86vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center gap-3 px-4 py-3 bg-[#0A375A] text-white shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-white/15 overflow-hidden shrink-0 flex items-center justify-center text-sm font-black">
                {activeChatConnection.profile?.photos?.[0]
                  ? <img src={activeChatConnection.profile.photos[0]} alt="" className="w-full h-full object-cover" />
                  : activeChatConnection.otherUserName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black truncate">{activeChatConnection.otherUserName}</p>
                <p className="text-xs text-white/60 truncate">{activeChatConnection.eventTitle}</p>
              </div>
              <button
                type="button"
                onClick={closeConnectionChat}
                className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                aria-label={lang === 'es' ? 'Cerrar chat' : 'Close chat'}
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {(activeChatConnection.profile?.interests || []).length > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex gap-1.5 overflow-x-auto shrink-0">
                {(activeChatConnection.profile?.interests || []).map((id) => {
                  const opt = socialMatchInterestOptions.find((item) => item.id === id);
                  return (
                    <span key={id} className="rounded-full bg-white border border-orange-100 px-2.5 py-1 text-[10px] font-bold text-[#F97316] whitespace-nowrap">
                      {opt ? (lang === 'es' ? opt.es : opt.en) : id}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="min-h-[260px] max-h-[52vh] overflow-y-auto px-4 py-4 space-y-2 bg-gray-50/60">
              {loadingChat ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((item) => <div key={item} className="h-9 bg-white rounded-2xl animate-pulse" />)}
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center">
                  <HiOutlineChatAlt2 className="w-9 h-9 text-gray-200 mb-2" />
                  <p className="text-sm font-semibold text-gray-400">
                    {lang === 'es' ? 'Aún no hay mensajes.' : 'No messages yet.'}
                  </p>
                  <p className="text-xs text-gray-300 mt-1">
                    {lang === 'es' ? 'Empieza la conversación con tu match.' : 'Start the conversation with your match.'}
                  </p>
                </div>
              ) : (
                chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                      message.isMine
                        ? 'bg-[#0A375A] text-white rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-md'
                    }`}>
                      {message.message}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex items-center gap-2 p-3 border-t border-gray-100 bg-white shrink-0">
              <input
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                placeholder={lang === 'es' ? 'Escribe un mensaje...' : 'Write a message...'}
                className="flex-1 min-w-0 text-sm px-3 py-2.5 rounded-2xl bg-gray-50 border border-gray-200 outline-none focus:border-orange-300 transition-colors"
              />
              <button
                type="button"
                onClick={handleSendChatMessage}
                disabled={!chatDraft.trim() || sendingChat}
                className="w-10 h-10 rounded-full bg-[#F97316] text-white flex items-center justify-center hover:bg-orange-600 disabled:opacity-40 transition-colors shrink-0"
                aria-label={lang === 'es' ? 'Enviar mensaje' : 'Send message'}
              >
                <HiOutlinePaperAirplane className="w-5 h-5 -rotate-45" />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
