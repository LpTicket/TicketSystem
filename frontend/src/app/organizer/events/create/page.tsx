'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { useCategories } from '@/context/CategoryContext';
import {
  HiOutlinePlusCircle,
  HiOutlineTrash,
  HiOutlineArrowLeft,
  HiOutlinePhotograph,
  HiOutlineMap,
  HiOutlineX,
} from 'react-icons/hi';
import Link from 'next/link';
import VenueMapBuilder from '@/components/events/VenueMapBuilder';

interface SectionForm {
  name: string;
  sectionType: string;
  rows: number;
  seatsPerRow: number;
  price: number;
  color: string;
}

const DEFAULT_SECTION: SectionForm = {
  name: '',
  sectionType: 'seated',
  rows: 5,
  seatsPerRow: 10,
  price: 25,
  color: '#f97316',
};

const SECTION_COLORS = ['#f97316', '#3b82f6', '#10b981', '#a855f7', '#ec4899', '#ef4444', '#f59e0b', '#6366f1'];

export default function CreateEventPage() {
  const router = useRouter();
  const { t, lang } = useLang();
  const { categories } = useCategories();

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'concierto',
    venueName: '',
    venueAddress: '',
    eventDate: '',
    doorsOpen: '',
  });

  const [sections, setSections] = useState<SectionForm[]>([{ ...DEFAULT_SECTION }]);
  const [hasSeatMap, setHasSeatMap] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');

  const updateForm = (field: string, value: string) => setForm({ ...form, [field]: value });

  const addSection = () => {
    const colorIndex = sections.length % SECTION_COLORS.length;
    setSections([...sections, { ...DEFAULT_SECTION, color: SECTION_COLORS[colorIndex] }]);
  };

  const removeSection = (index: number) => {
    if (sections.length <= 1) return;
    setSections(sections.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, field: string, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [field]: value };
    setSections(updated);
  };

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
      const payload: any = { ...form, hasSeatMap };
      if (!payload.doorsOpen) delete payload.doorsOpen;
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

      // 3. Create sections
      for (const sec of sections) {
        if (sec.name.trim()) {
          await api.post(`/events/${event.id}/sections`, sec);
        }
      }

      if (hasSeatMap) {
        setCreatedEventId(event.id);
        setStep(2);
      } else {
        router.push('/organizer/events');
      }
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
          <h1 className="font-bold text-2xl lg:text-3xl text-gray-900">{step === 1 ? t('orgCreateEvent') : 'Diseño del Escenario'}</h1>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`px-4 py-1.5 rounded-full transition-colors ${step === 1 ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>1. Detalles</span>
            <span className="text-gray-300 font-bold">/</span>
            <span className={`px-4 py-1.5 rounded-full transition-colors ${step === 2 ? 'bg-primary-500 text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}>2. Escenario</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgCategory')} *</label>
                    <select value={form.category} onChange={(e) => updateForm('category', e.target.value)} className="input py-3">
                      <option value="" disabled>-- Selecciona una categoría --</option>
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
                      type="datetime-local"
                      value={form.eventDate}
                      onChange={(e) => updateForm('eventDate', e.target.value)}
                      className="input py-3"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">{t('orgDoorsOpen')}</label>
                    <input
                      type="datetime-local"
                      value={form.doorsOpen}
                      onChange={(e) => updateForm('doorsOpen', e.target.value)}
                      className="input py-3"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* NEW: Seat Map Toggle & Section Builder */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 lg:p-8 shadow-sm space-y-6">
              <div className="flex items-center gap-3 p-4 bg-blue-50/40 border border-blue-100 rounded-xl">
                <input
                  type="checkbox"
                  id="hasSeatMap"
                  checked={hasSeatMap}
                  onChange={(e) => setHasSeatMap(e.target.checked)}
                  className="w-5 h-5 rounded text-primary-600 border-gray-300 focus:ring-primary-500 cursor-pointer"
                />
                <label htmlFor="hasSeatMap" className="cursor-pointer select-none">
                  <span className="block text-sm font-bold text-gray-900">{lang === 'es' ? 'Habilitar Mapa de Asientos Interactivo' : 'Enable Interactive Seating Chart'}</span>
                  <span className="block text-xs text-gray-500">{lang === 'es' ? 'Permite a los compradores elegir asientos específicos sobre un diseño gráfico interactivo.' : 'Allows buyers to choose specific seats on an interactive graphic layout.'}</span>
                </label>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="font-bold text-xl text-gray-900">{lang === 'es' ? 'Secciones de Entradas' : 'Ticket Sections'}</h2>
                    <p className="text-gray-500 text-sm">{lang === 'es' ? 'Define las áreas y precios de las entradas para tu evento.' : 'Define areas and ticket prices for your event.'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSection}
                    className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 font-bold"
                  >
                    <HiOutlinePlusCircle className="w-4 h-4" />
                    {lang === 'es' ? 'Agregar Sección' : 'Add Section'}
                  </button>
                </div>

                <div className="space-y-4">
                  {sections.map((sec, idx) => (
                    <div key={idx} className="p-5 rounded-xl border border-gray-200 bg-gray-50/50 space-y-4 relative animate-fade-in">
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSection(idx)}
                          className="absolute top-4 right-4 text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                          title={lang === 'es' ? 'Eliminar Sección' : 'Remove Section'}
                        >
                          <HiOutlineTrash className="w-5 h-5" />
                        </button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Section Name */}
                        <div className="sm:col-span-1">
                          <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'es' ? 'Nombre de la Sección *' : 'Section Name *'}</label>
                          <input
                            type="text"
                            value={sec.name}
                            onChange={(e) => updateSection(idx, 'name', e.target.value)}
                            className="input py-2 text-sm"
                            placeholder={lang === 'es' ? 'Ej: General, VIP' : 'Ex: General, VIP'}
                            required
                          />
                        </div>

                        {/* Section Type */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'es' ? 'Tipo' : 'Type'}</label>
                          <select
                            value={sec.sectionType}
                            onChange={(e) => updateSection(idx, 'sectionType', e.target.value)}
                            className="input py-2 text-sm"
                          >
                            <option value="standing">{lang === 'es' ? 'De Pie (Aforo General)' : 'Standing (GA)'}</option>
                            <option value="seated">{lang === 'es' ? 'Asientos Numerados' : 'Numbered Seating'}</option>
                            <option value="table">{lang === 'es' ? 'Mesas con Sillas' : 'Tables with Chairs'}</option>
                            <option value="vip">{lang === 'es' ? 'VIP' : 'VIP'}</option>
                          </select>
                        </div>

                        {/* Price */}
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'es' ? 'Precio de la Entrada *' : 'Ticket Price *'}</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              value={sec.price}
                              onChange={(e) => updateSection(idx, 'price', parseFloat(e.target.value) || 0)}
                              className="input py-2 pl-7 text-sm"
                              min="0"
                              step="0.01"
                              required
                            />
                          </div>
                        </div>
                      </div>

                      {/* Show rows / capacity fields based on type */}
                      {sec.sectionType !== 'standing' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'es' ? 'Filas' : 'Rows'}</label>
                            <input
                              type="number"
                              value={sec.rows}
                              onChange={(e) => updateSection(idx, 'rows', parseInt(e.target.value, 10) || 1)}
                              className="input py-2 text-sm"
                              min="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'es' ? 'Asientos por Fila' : 'Seats per Row'}</label>
                            <input
                              type="number"
                              value={sec.seatsPerRow}
                              onChange={(e) => updateSection(idx, 'seatsPerRow', parseInt(e.target.value, 10) || 1)}
                              className="input py-2 text-sm"
                              min="1"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 border-t border-gray-100">
                          <label className="block text-xs font-bold text-gray-700 mb-1">{lang === 'es' ? 'Capacidad (Aforo)' : 'Capacity (Max Attendees)'}</label>
                          <input
                            type="number"
                            value={sec.rows * sec.seatsPerRow}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 1;
                              updateSection(idx, 'rows', 1);
                              updateSection(idx, 'seatsPerRow', val);
                            }}
                            className="input py-2 text-sm"
                            min="1"
                            placeholder="Aforo máximo"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Image & Sticky Submit */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-8 shadow-sm">
              <h2 className="font-bold text-lg text-gray-900 mb-4">{t('orgEventImage')}</h2>
              <div className="space-y-4">
                <div className="aspect-[4/3] w-full rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group hover:border-primary-300 transition-colors">
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
                  <span className="text-[10px] opacity-60 font-medium">({lang === 'es' ? 'Recomendado: 800x600px' : 'Recommended: 800x600px'})</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                </label>

                <h2 className="font-bold text-lg text-gray-900 mt-6 mb-4">{lang === 'es' ? 'Imagen Banner' : 'Banner Image'}</h2>
                <div className="aspect-[21/9] w-full rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 group hover:border-primary-300 transition-colors">
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
                  <span className="text-[10px] opacity-60 font-medium">({lang === 'es' ? 'Recomendado: 1920x720px' : 'Recommended: 1920x720px'})</span>
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
                    {creating ? 'Guardando...' : 'Siguiente Paso'}
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
              <h2 className="font-semibold text-lg text-gray-900">Configura tu Escenario</h2>
              <p className="text-gray-500 text-sm">Organiza las mesas y áreas del evento como desees.</p>
            </div>
            <button onClick={() => router.push('/organizer/events')} className="btn-secondary text-sm">
              Terminar y Salir
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
