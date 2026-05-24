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
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);

  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerFileName, setBannerFileName] = useState('');
  const [mobileBannerPreview, setMobileBannerPreview] = useState('');
  const [mobileBannerFileName, setMobileBannerFileName] = useState('');
  const [bannerStatus, setBannerStatus] = useState<'draft' | 'active'>('draft');

  useEffect(() => {
    const savedBanner = localStorage.getItem('lpMarketingBannerPreview');
    const savedFileName = localStorage.getItem('lpMarketingBannerFileName');
    const savedMobileBanner = localStorage.getItem('lpMarketingMobileBannerPreview');
    const savedMobileFileName = localStorage.getItem('lpMarketingMobileBannerFileName');
    const savedStatus = localStorage.getItem('lpMarketingBannerStatus');

    if (savedBanner) setBannerPreview(savedBanner);
    if (savedFileName) setBannerFileName(savedFileName);
    if (savedMobileBanner) setMobileBannerPreview(savedMobileBanner);
    if (savedMobileFileName) setMobileBannerFileName(savedMobileFileName);
    if (savedStatus === 'active' || savedStatus === 'draft') setBannerStatus(savedStatus);
  }, []);

  const handleImageFile = (file: File | undefined, mode: 'desktop' | 'mobile') => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecciona una imagen valida.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';

      if (mode === 'desktop') {
        setBannerPreview(result);
        setBannerFileName(file.name);
        localStorage.setItem('lpMarketingBannerPreview', result);
        localStorage.setItem('lpMarketingBannerFileName', file.name);
      } else {
        setMobileBannerPreview(result);
        setMobileBannerFileName(file.name);
        localStorage.setItem('lpMarketingMobileBannerPreview', result);
        localStorage.setItem('lpMarketingMobileBannerFileName', file.name);
      }

      setBannerStatus('draft');
      localStorage.setItem('lpMarketingBannerStatus', 'draft');
    };

    reader.readAsDataURL(file);
  };

  const removeBanner = async () => {
    setBannerPreview('');
    setBannerFileName('');
    setMobileBannerPreview('');
    setMobileBannerFileName('');
    setBannerStatus('draft');

    localStorage.removeItem('lpMarketingBannerPreview');
    localStorage.removeItem('lpMarketingBannerFileName');
    localStorage.removeItem('lpMarketingMobileBannerPreview');
    localStorage.removeItem('lpMarketingMobileBannerFileName');
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
        mobileImageData: mobileBannerPreview || null,
        mobileFileName: mobileBannerFileName || null,
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
            Sube el banner desktop y, si deseas, un flyer vertical especial para celulares.
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
            <p className="mt-1 text-xs text-gray-400">Formato largo para desktop y formato flyer para movil.</p>
          </div>

          <div className={`w-fit rounded-full px-3 py-1 text-xs font-black ${bannerStatus === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#F97316]'}`}>
            {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_280px]">
          <div>
            {bannerPreview ? (
              <div className="rounded-2xl bg-gradient-to-br from-[#0A375A]/10 via-white to-[#F97316]/10 p-3">
                <div className="overflow-hidden rounded-xl bg-black shadow-2xl shadow-[rgba(10,55,90,0.18)]">
                  <div className="relative aspect-[3.05/1] w-full">
                    <img
                      src={bannerPreview}
                      alt="Preview del banner desktop"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <HiOutlinePhotograph className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-base font-black text-gray-900">Aun no hay banner desktop</h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                  Sube un diseno horizontal para desktop.
                </p>
              </div>
            )}
          </div>

          <div>
            {mobileBannerPreview ? (
              <div className="rounded-2xl bg-gradient-to-br from-[#0A375A]/10 via-white to-[#F97316]/10 p-3">
                <div className="overflow-hidden rounded-xl bg-black shadow-xl shadow-[rgba(10,55,90,0.14)]">
                  <div className="relative aspect-[3/4] w-full">
                    <img
                      src={mobileBannerPreview}
                      alt="Preview del banner movil"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                <HiOutlineDeviceMobile className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-base font-black text-gray-900">Formato movil</h3>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Sube un flyer vertical para celulares.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#F97316]">
              <HiOutlineUpload className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Subir banner desktop</h2>
              <p className="text-sm text-gray-500">Imagen horizontal para pantallas grandes.</p>
            </div>
          </div>

          <div
            onClick={() => desktopInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleImageFile(event.dataTransfer.files?.[0], 'desktop');
            }}
            className="mt-6 flex min-h-[235px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white px-6 py-8 text-center transition hover:border-[#F97316] hover:bg-orange-50/40"
          >
            <input
              ref={desktopInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => handleImageFile(event.target.files?.[0], 'desktop')}
            />

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#F97316] shadow-sm ring-1 ring-gray-100">
              <HiOutlineUpload className="h-8 w-8" />
            </div>

            <h3 className="mt-5 text-base font-black text-gray-950">Subir banner horizontal</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              Recomendado: 1600 x 520 px.
            </p>
          </div>

          {bannerFileName && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-gray-900">{bannerFileName}</p>
                <p className="text-xs font-semibold text-gray-500">Desktop</p>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
              <HiOutlineDeviceMobile className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Subir banner movil</h2>
              <p className="text-sm text-gray-500">Flyer vertical para celulares, como los flyers de eventos.</p>
            </div>
          </div>

          <div
            onClick={() => mobileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleImageFile(event.dataTransfer.files?.[0], 'mobile');
            }}
            className="mt-6 flex min-h-[235px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white px-6 py-8 text-center transition hover:border-[#F97316] hover:bg-orange-50/40"
          >
            <input
              ref={mobileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => handleImageFile(event.target.files?.[0], 'mobile')}
            />

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#0A375A] shadow-sm ring-1 ring-gray-100">
              <HiOutlineDeviceMobile className="h-8 w-8" />
            </div>

            <h3 className="mt-5 text-base font-black text-gray-950">Subir flyer movil</h3>
            <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
              Recomendado: 1080 x 1440 px o formato 3:4.
            </p>
          </div>

          {mobileBannerFileName && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-gray-900">{mobileBannerFileName}</p>
                <p className="text-xs font-semibold text-gray-500">Movil</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
              <HiOutlineBadgeCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Publicacion</h2>
              <p className="text-sm text-gray-500">El banner desktop es obligatorio. El movil es opcional.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={!bannerPreview}
              onClick={publishBanner}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0A375A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#0A375A]/10 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Publicar banner
            </button>
            <button
              type="button"
              disabled={!bannerPreview && !mobileBannerPreview}
              onClick={removeBanner}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-black text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <HiOutlineX className="mr-2 h-5 w-5" />
              Eliminar
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
