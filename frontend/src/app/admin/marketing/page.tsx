'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import {
  HiOutlineBadgeCheck,
  HiOutlineChartBar,
  HiOutlineChatAlt2,
  HiOutlineCursorClick,
  HiOutlineDeviceMobile,
  HiOutlineMail,
  HiOutlinePhotograph,
  HiOutlinePresentationChartLine,
  HiOutlineSpeakerphone,
  HiOutlineSparkles,
  HiOutlineUpload,
  HiOutlineUsers,
  HiOutlineX,
} from 'react-icons/hi';

const channels = [
  {
    title: 'Banner Home',
    description: 'Banner publicitario dentro del carrusel principal.',
    status: 'Activo',
    icon: HiOutlinePhotograph,
  },
  {
    title: 'Email Marketing',
    description: 'Campanas para comunicar eventos, ofertas y novedades.',
    status: 'Proximamente',
    icon: HiOutlineMail,
  },
  {
    title: 'SMS',
    description: 'Recordatorios, accesos y promociones urgentes.',
    status: 'Proximamente',
    icon: HiOutlineDeviceMobile,
  },
  {
    title: 'WhatsApp',
    description: 'Mensajes directos para audiencias segmentadas.',
    status: 'Proximamente',
    icon: HiOutlineChatAlt2,
  },
];

export default function AdminMarketingPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerFileName, setBannerFileName] = useState('');
  const [bannerStatus, setBannerStatus] = useState<'draft' | 'active'>('draft');

  useEffect(() => {
    const savedBanner = localStorage.getItem('lpMarketingBannerPreview');
    const savedFileName = localStorage.getItem('lpMarketingBannerFileName');
    const savedStatus = localStorage.getItem('lpMarketingBannerStatus');

    if (savedBanner) setBannerPreview(savedBanner);
    if (savedFileName) setBannerFileName(savedFileName);
    if (savedStatus === 'active' || savedStatus === 'draft') setBannerStatus(savedStatus);
  }, []);

  const handleBannerFile = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecciona una imagen valida para el banner.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setBannerPreview(result);
      setBannerFileName(file.name);
      setBannerStatus('draft');

      localStorage.setItem('lpMarketingBannerPreview', result);
      localStorage.setItem('lpMarketingBannerFileName', file.name);
      localStorage.setItem('lpMarketingBannerStatus', 'draft');
    };
    reader.readAsDataURL(file);
  };

  const removeBanner = async () => {
    setBannerPreview('');
    setBannerFileName('');
    setBannerStatus('draft');

    localStorage.removeItem('lpMarketingBannerPreview');
    localStorage.removeItem('lpMarketingBannerFileName');
    localStorage.removeItem('lpMarketingBannerStatus');

    try {
      await api.delete('/marketing/admin/banner/home');
    } catch (error) {
      console.error('[remove marketing banner error]', error);
    }
  };

  const publishBanner = async () => {
    if (!bannerPreview) return;

    try {
      await api.post('/marketing/admin/banner/home', {
        imageData: bannerPreview,
        fileName: bannerFileName || 'banner-home',
      });

      setBannerStatus('active');
      localStorage.setItem('lpMarketingBannerStatus', 'active');
      alert('Banner publicado correctamente. Ya puede mostrarse en el Home.');
    } catch (error: any) {
      console.error('[publish marketing banner error]', error);
      alert(error?.response?.data?.message || 'No se pudo publicar el banner.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-600">
            <HiOutlineSpeakerphone className="h-4 w-4" />
            Marketing
          </div>
          <h1 className="mt-3 text-3xl font-black text-[#0A375A]">Banner publicitario</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
            Sube un diseno terminado para que rote dentro del carrusel principal junto a los eventos destacados.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
        >
          <HiOutlineSparkles className="h-5 w-5" />
          Nueva campana
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Vista previa del banner</h2>
            <p className="mt-1 text-xs text-gray-400">Formato largo para el carrusel principal del Home.</p>
          </div>

          <div className={`w-fit rounded-full px-3 py-1 text-xs font-black ${bannerStatus === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#F97316]'}`}>
            {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {bannerPreview ? (
            <div className="rounded-2xl bg-gradient-to-br from-[#0A375A]/10 via-white to-[#F97316]/10 p-3">
              <div className="overflow-hidden rounded-xl bg-black shadow-2xl shadow-[rgba(10,55,90,0.18)]">
                <div className="relative aspect-[3.05/1] w-full">
                  <img
                    src={bannerPreview}
                    alt="Preview del banner publicitario"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[330px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
                <HiOutlinePhotograph className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-base font-black text-gray-900">Aun no hay banner cargado</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                Sube un diseno listo y aqui aparecera en formato horizontal.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#F97316]">
              <HiOutlineUpload className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Subir banner</h2>
              <p className="text-sm text-gray-500">Carga el arte final del banner publicitario.</p>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleBannerFile(event.dataTransfer.files?.[0]);
            }}
            className="mt-6 flex min-h-[255px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white px-6 py-8 text-center transition hover:border-[#F97316] hover:bg-orange-50/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => handleBannerFile(event.target.files?.[0])}
            />

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#F97316] shadow-sm ring-1 ring-gray-100">
              <HiOutlineUpload className="h-8 w-8" />
            </div>

            <h3 className="mt-5 text-base font-black text-gray-950">Haz clic para subir tu banner</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              Tambien puedes arrastrar la imagen aqui. Usa un diseno horizontal en alta calidad.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-500 shadow-sm ring-1 ring-gray-100">
                Recomendado: 1600 x 520 px
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-gray-500 shadow-sm ring-1 ring-gray-100">
                JPG, PNG o WebP
              </span>
            </div>
          </div>

          {bannerFileName && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-gray-900">{bannerFileName}</p>
                <p className="text-xs font-semibold text-gray-500">
                  Estado: {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}
                </p>
              </div>
              <button
                type="button"
                onClick={removeBanner}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 transition hover:bg-red-100"
                aria-label="Eliminar banner"
              >
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
              <HiOutlineBadgeCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Publicacion</h2>
              <p className="text-sm text-gray-500">Guarda el banner para mostrarlo en el carrusel principal.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-start gap-3">
              <HiOutlinePhotograph className="mt-0.5 h-5 w-5 shrink-0 text-[#0A375A]" />
              <div>
                <p className="text-sm font-black text-gray-950">Rotacion en Home</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  Este banner se mezcla con los eventos destacados. Si el visitante usa las flechas o espera unos segundos, aparecera como una imagen mas dentro del carrusel.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!bannerPreview}
              onClick={publishBanner}
              className="rounded-xl bg-[#0A375A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#0A375A]/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Publicar banner
            </button>
            <button
              type="button"
              disabled={!bannerPreview}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cambiar imagen
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ['Banners activos', bannerStatus === 'active' ? '1' : '0', HiOutlinePhotograph],
          ['Audiencias', '0', HiOutlineUsers],
          ['Campanas', '0', HiOutlinePresentationChartLine],
          ['Clicks', '0', HiOutlineCursorClick],
        ].map(([label, value, Icon]) => (
          <div key={label as string} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-500">{label as string}</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 text-3xl font-black text-gray-950">{value as string}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        {channels.map((channel) => {
          const Icon = channel.icon;

          return (
            <div key={channel.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-[#0A375A]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-black text-gray-950">{channel.title}</h3>
              <p className="mt-2 min-h-[64px] text-sm leading-6 text-gray-500">{channel.description}</p>
              <div className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${channel.status === 'Activo' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#F97316]'}`}>
                {channel.status}
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
            <HiOutlineChartBar className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-950">Proximas conexiones</h2>
            <p className="text-sm text-gray-500">
              Luego conectamos audiencias, email marketing, SMS, WhatsApp y analiticas de campanas.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
