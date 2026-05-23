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
} from 'react-icons/hi';
import { FaInstagram } from 'react-icons/fa';
import type { Event } from '@/types';
import {
  getMySocialMatch,
  getSocialMatchSuggestions,
  requestSocialMatchConnection,
  saveSocialMatchPreference,
  updateSocialMatchConnection,
  uploadSocialMatchPhoto,
  deleteSocialMatchPhoto,
  SocialMatchConnection,
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

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
    </div>
  );
}
