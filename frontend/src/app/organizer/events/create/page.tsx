'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import {
  HiOutlineArrowLeft,
  HiOutlinePhotograph,
  HiOutlineMap,
  HiOutlineX,
} from 'react-icons/hi';
import Link from 'next/link';
import VenueMapBuilder from '@/components/events/VenueMapBuilder';

const buildLocalEventDate = (date: string, time: string) => {
  const safeTime = time || '00:00';
  return new Date(`${date}T${safeTime}:00`).toISOString();
};

export default function CreateEventPage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const { categories, refreshCategories } = useCategories();

  useEffect(() => { refreshCategories(); }, []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    venueName: '',
    venueAddress: '',
    eventDate: '',
    eventTime: '',
    doorsOpen: '',
  });
  const [step, setStep] = useState<1 | 2>(1);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');

  const updateForm = (field: string, value: string) => setForm({ ...form, [field]: value });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onload = () => setBannerPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      // Clean up empty optional fields
      const payload: any = { ...form, hasSeatMap: true };
      if (form.eventDate) {
        payload.eventDate = buildLocalEventDate(form.eventDate, form.eventTime);
      }
      if (form.doorsOpen) {
        payload.doorsOpen = new Date(`${form.eventDate}T${form.doorsOpen}:00`).toISOString();
      } else {
        delete payload.doorsOpen;
      }
      delete payload.eventTime;
      if (!payload.description) delete payload.description;
      if (!payload.venueAddress) delete payload.venueAddress;

      // 1. Create event
      const { data: event } = await api.post('/events', payload);

      // 2. Upload image if selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await api.post(`/events/${event.id}/image`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // 2b. Upload banner if selected
      if (bannerFile) {
        const formData = new FormData();
        formData.append('image', bannerFile);
        await api.post(`/events/${event.id}/image/banner`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      setCreatedEventId(event.id);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || (lang === 'es' ? 'Error al crear el evento' : 'Error creating event'));
    } finally {
      setCreating(false);
    }
  };


  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <Link href="/organizer/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500 transition-colors mb-3">
          <HiOutlineArrowLeft className="w-4 h-4" />
          {t('orgMyEvents')}
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-2xl lg:text-3xl text-gray-900">{step === 1 ? t('orgCreateEvent') : (lang === 'es' ? 'Diseño del Escenario' : 'Stage Design')}</h1>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`px-4 py-1.5 rounded-full transition-colors ${step === 1 ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>{lang === 'es' ? '1. Detalles' : '1. Details'}</span>
            <span className="text-gray-300 font-bold">/</span>
            <span className={`px-4 py-1.5 rounded-full transition-colors ${step === 2 ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>{lang === 'es' ? '2. Escenario' : '2. Stage'}</span>
          </div>
        </div>
      </div>

      {step === 1 ? (
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-center gap-2 animate-shake">
            <HiOutlineX className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Event Details (Expanded) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 shadow-sm">
              <h2 className="font-bold text-xl text-gray-900 mb-6">{lang === 'es' ? 'Información del Evento' : 'Event Information'}</h2>

              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgEventTitle')} *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm('title', e.target.value)}
                    className="input py-3 text-base"
                    placeholder={lang === 'es' ? 'Ej: Gran Concierto de Salsa' : 'Ex: Big Salsa Concert'}
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgEventDesc')}</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm('description', e.target.value)}
                    className="input min-h-[160px] resize-y py-3 text-base"
                    placeholder={lang === 'es' ? 'Describe tu evento detalladamente...' : 'Describe your event in detail...'}
                  />
                </div>

                {/* Category + Venue */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgCategory')} *</label>
                    <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="input py-3">
                      <option value="" disabled>{lang === 'es' ? '-- Selecciona una categoría --' : '-- Select a category --'}</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.slug}>{cat.icon} {lang === 'en' ? cat.labelEn : cat.labelEs}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgVenue')} *</label>
                    <input
                      type="text"
                      value={form.venueName}
                      onChange={(e) => updateForm('venueName', e.target.value)}
                      className="input py-3"
                      placeholder={lang === 'es' ? 'Ej: Teatro Baralt' : 'Ex: Main Theater'}
                      required
                    />
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgVenueAddress')}</label>
                  <input
                    type="text"
                    value={form.venueAddress}
                    onChange={(e) => updateForm('venueAddress', e.target.value)}
                    className="input py-3"
                    placeholder={lang === 'es' ? 'Dirección completa del lugar' : 'Full venue address'}
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgEventDate')} *</label>
                    <input
                      type="date"
                      value={form.eventDate}
                      onChange={(e) => updateForm('eventDate', e.target.value)}
                      onClick={(e) => {
                        if (document.activeElement === e.currentTarget) {
                          e.currentTarget.blur();
                        }
                      }}
                      className="input py-3"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{lang === 'es' ? 'Hora del evento *' : 'Event Time *'}</label>
                    <input
                      type="time"
                      value={form.eventTime}
                      onChange={(e) => updateForm('eventTime', e.target.value)}
                      className="input py-3"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgDoorsOpen')}</label>
                    <input
                      type="time"
                      value={form.doorsOpen}
                      onChange={(e) => updateForm('doorsOpen', e.target.value)}
                      onClick={(e) => {
                        if (document.activeElement === e.currentTarget) {
                          e.currentTarget.blur();
                        }
                      }}
                      className="input py-3"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Image & Sticky Submit */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-8 shadow-sm">
              <h2 className="font-bold text-lg text-gray-900 mb-4">{t('orgEventImage')}</h2>
              <div className="space-y-4">
                <div className="aspect-[3/4] w-full rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group hover:border-primary-300 transition-colors">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <HiOutlinePhotograph className="w-16 h-16 text-gray-300 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <label className="btn-secondary w-full py-2.5 text-sm justify-center cursor-pointer font-bold flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <HiOutlinePhotograph className="w-4 h-4" />
                    {lang === 'es' ? 'Imagen Miniatura' : 'Thumbnail Image'}
                  </div>
                  <span className="text-[10px] opacity-60 font-medium">({lang === 'es' ? 'Recomendado: 900x1200px' : 'Recommended: 900x1200px'})</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>

                <h2 className="font-bold text-lg text-gray-900 mt-6 mb-4">{lang === 'es' ? 'Imagen Banner' : 'Banner Image'}</h2>
                <div className="aspect-[21/8] w-full rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group hover:border-primary-300 transition-colors">
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="Banner Preview" className="w-full h-full object-cover" />
                  ) : (
                    <HiOutlinePhotograph className="w-16 h-16 text-gray-300 group-hover:scale-110 transition-transform" />
                  )}
                </div>
                
                <label className="btn-secondary w-full py-2.5 text-sm justify-center cursor-pointer font-bold flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <HiOutlinePhotograph className="w-4 h-4" />
                    {lang === 'es' ? 'Subir Banner' : 'Upload Banner'}
                  </div>
                  <span className="text-[10px] opacity-60 font-medium">({lang === 'es' ? 'Recomendado: 2520x960px' : 'Recommended: 2520x960px'})</span>
                  <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                </label>
                <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-widest">
                  PNG, JPG · {lang === 'es' ? 'Máx 5MB' : 'Max 5MB'}
                </p>
                
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <button
                    type="submit"
                    disabled={creating}
                    className="btn-primary w-full py-4 text-sm font-bold shadow-xl shadow-primary-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {creating ? (lang === 'es' ? 'Guardando...' : 'Saving...') : (lang === 'es' ? 'Siguiente Paso' : 'Next Step')}
                  </button>
                  <Link href="/organizer/events" className="btn-secondary w-full text-center py-3 text-sm font-bold border-transparent hover:bg-red-50 hover:text-red-600">
                    {t('orgCancel')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-lg text-gray-900">{lang === 'es' ? 'Configura tu Escenario' : 'Configure Your Stage Layout'}</h2>
              <p className="text-gray-500 text-sm">{lang === 'es' ? 'Organiza las mesas y áreas del evento como desees.' : 'Arrange the tables and areas of the event as you wish.'}</p>
            </div>
            <button onClick={() => router.push('/organizer/events')} className="btn-secondary text-sm">
              {lang === 'es' ? 'Terminar y Salir' : 'Finish & Exit'}
            </button>
          </div>
          {createdEventId && (
            <VenueMapBuilder
              eventId={createdEventId}
              initialSections={[]}
              onSaved={() => router.push('/organizer/events')}
            />
          )}
        </div>
      )}
    </div>
  );
}
