'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import type { IconType } from 'react-icons';
import { HiOutlineSparkles, HiOutlineUserGroup, HiOutlineEyeOff, HiOutlineLocationMarker } from 'react-icons/hi';
import { Event } from '@/types';
import { getMySocialMatch, saveSocialMatchPreference, SocialMatchPreference, SocialMatchSummary, socialMatchInterestOptions } from '@/lib/socialMatch';

type Props = { lang: 'es' | 'en' };

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

export default function SocialMatchPanel({ lang }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [preferences, setPreferences] = useState<SocialMatchPreference[]>([]);
  const [summaries, setSummaries] = useState<SocialMatchSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  const selectedPreference = useMemo(() => {
    if (!selectedEventId) return null;
    return preferences.find((item) => item.eventId === selectedEventId) || emptyPreference(selectedEventId);
  }, [preferences, selectedEventId]);

  const selectedSummary = summaries.find((item) => item.eventId === selectedEventId);
  const privacyOptions: { key: keyof SocialMatchPreference; label: string; Icon: IconType }[] = [
    { key: 'privateMode', label: lang === 'es' ? 'Modo privado' : 'Private mode', Icon: HiOutlineUserGroup },
    { key: 'invisibleMode', label: lang === 'es' ? 'Modo invisible' : 'Invisible mode', Icon: HiOutlineEyeOff },
    { key: 'shareInstagram', label: lang === 'es' ? 'Compartir Instagram solo si ambos aceptan' : 'Share Instagram only if both accept', Icon: HiOutlineSparkles },
    { key: 'shareLocation', label: lang === 'es' ? 'Permitir ubicación aproximada solo si ambos aceptan' : 'Allow approximate location only if both accept', Icon: HiOutlineLocationMarker },
  ];

  const copy = {
    title: 'Social Match',
    subtitle: lang === 'es' ? 'Conecta con personas compatibles en los eventos donde ya tienes entrada.' : 'Connect with compatible people at events where you already have a ticket.',
    noEvents: lang === 'es' ? 'Compra una entrada para activar Social Match en ese evento.' : 'Buy a ticket to activate Social Match for that event.',
    event: lang === 'es' ? 'Evento' : 'Event',
    interests: lang === 'es' ? 'Intereses' : 'Interests',
    active: lang === 'es' ? 'Activar Social Match' : 'Activate Social Match',
    industry: lang === 'es' ? 'Industria o área' : 'Industry or field',
    instagram: lang === 'es' ? 'Instagram opcional' : 'Optional Instagram',
    save: lang === 'es' ? 'Guardar Social Match' : 'Save Social Match',
    saving: lang === 'es' ? 'Guardando...' : 'Saving...',
    saved: lang === 'es' ? 'Social Match actualizado' : 'Social Match updated',
    error: lang === 'es' ? 'No se pudo guardar Social Match' : 'Could not save Social Match',
  };

  useEffect(() => { loadSocialMatch(); }, []);

  const loadSocialMatch = async () => {
    try {
      setLoading(true);
      const data = await getMySocialMatch();
      setEvents(data.eligibleEvents || []);
      setPreferences(data.preferences || []);
      setSummaries(data.summaries || []);
      setSelectedEventId((current) => current || data.eligibleEvents?.[0]?.id || '');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = (patch: Partial<SocialMatchPreference>) => {
    if (!selectedEventId) return;
    setPreferences((current) => {
      const existing = current.find((item) => item.eventId === selectedEventId) || emptyPreference(selectedEventId);
      const next = { ...existing, ...patch };
      return [...current.filter((item) => item.eventId !== selectedEventId), next];
    });
  };

  const toggleInterest = (interest: string) => {
    const current = selectedPreference?.interests || [];
    updatePreference({ interests: current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest] });
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
      toast.success(copy.saved);
    } catch (error) {
      console.error(error);
      toast.error(copy.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)]"><div className="h-6 w-40 bg-gray-100 rounded mb-4 animate-pulse" /><div className="h-24 bg-gray-100 rounded-2xl animate-pulse" /></div>;

  if (events.length === 0) {
    return (
      <div className="bg-white border border-gray-100 rounded-3xl p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] text-center">
        <HiOutlineUserGroup className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="font-bold text-xl text-gray-900">{copy.title}</h3>
        <p className="text-gray-500 mt-2">{copy.noEvents}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 text-xs font-bold uppercase tracking-wider mb-3"><HiOutlineSparkles className="w-4 h-4" />Premium</div>
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
              return <button key={interest.id} type="button" onClick={() => toggleInterest(interest.id)} className={`px-3 py-2 rounded-full text-xs font-bold border transition-all ${selected ? 'bg-[#0a375a] border-[#0a375a] text-white' : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}>{lang === 'es' ? interest.es : interest.en}</button>;
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{copy.industry}</label><input value={selectedPreference?.industry || ''} onChange={(event) => updatePreference({ industry: event.target.value })} className="input bg-gray-50 border-gray-200" placeholder={lang === 'es' ? 'Ej. Música, finanzas, real estate' : 'Ex. Music, finance, real estate'} /></div>
          <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{copy.instagram}</label><input value={selectedPreference?.instagram || ''} onChange={(event) => updatePreference({ instagram: event.target.value })} className="input bg-gray-50 border-gray-200" placeholder="@lpticket" /></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {privacyOptions.map(({ key, label, Icon }) => (
            <label key={key} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4 cursor-pointer">
              <input type="checkbox" checked={Boolean(selectedPreference?.[key])} onChange={(event) => updatePreference({ [key]: event.target.checked } as Partial<SocialMatchPreference>)} className="w-4 h-4 accent-orange-500" />
              <Icon className="w-5 h-5 text-[#0a375a]" />
              <span className="text-sm font-semibold text-gray-700">{label}</span>
            </label>
          ))}
        </div>

        {selectedSummary && <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-4"><p className="text-xs font-bold uppercase tracking-wider text-orange-600 mb-2">{lang === 'es' ? 'Sugerencias compatibles' : 'Compatible suggestions'}</p><div className="space-y-1">{selectedSummary.messages.map((message) => <p key={message} className="text-sm font-semibold text-gray-800">{message}</p>)}</div></div>}

        <button onClick={handleSave} disabled={saving} className="btn-primary w-full py-3.5 rounded-xl font-bold shadow-lg shadow-orange-500/20 disabled:opacity-60">{saving ? copy.saving : copy.save}</button>
      </div>
    </div>
  );
}
