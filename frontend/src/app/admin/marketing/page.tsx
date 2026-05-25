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
    description: 'Diseña campañas premium antes de activar envíos reales.',
    status: 'Diseño listo',
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
  const mobileFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerFileName, setBannerFileName] = useState('');
  const [mobileBannerPreview, setMobileBannerPreview] = useState('');
  const [mobileBannerFileName, setMobileBannerFileName] = useState('');
  const [bannerStatus, setBannerStatus] = useState<'draft' | 'active'>('draft');

  useEffect(() => {
    const savedBanner = localStorage.getItem('lpMarketingBannerPreview');
    const savedFileName = localStorage.getItem('lpMarketingBannerFileName');
    const savedStatus = localStorage.getItem('lpMarketingBannerStatus');
    const savedMobileBanner = localStorage.getItem('lpMarketingMobileBannerPreview');
    const savedMobileFileName = localStorage.getItem('lpMarketingMobileBannerFileName');

    if (savedBanner) setBannerPreview(savedBanner);
    if (savedFileName) setBannerFileName(savedFileName);
    if (savedMobileBanner) setMobileBannerPreview(savedMobileBanner);
    if (savedMobileFileName) setMobileBannerFileName(savedMobileFileName);
    if (savedStatus === 'active' || savedStatus === 'draft') setBannerStatus(savedStatus);

    api.get('/marketing/banner/home')
      .then(({ data }) => {
        if (!data?.imageData) return;

        setBannerPreview(data.imageData);
        setBannerFileName(data.fileName || 'banner-home');

        localStorage.setItem('lpMarketingBannerPreview', data.imageData);
        localStorage.setItem('lpMarketingBannerFileName', data.fileName || 'banner-home');

        if (data.mobileImageData) {
          setMobileBannerPreview(data.mobileImageData);
          setMobileBannerFileName(data.mobileFileName || 'banner-home-mobile');

          localStorage.setItem('lpMarketingMobileBannerPreview', data.mobileImageData);
          localStorage.setItem('lpMarketingMobileBannerFileName', data.mobileFileName || 'banner-home-mobile');
        }

        setBannerStatus('active');
        localStorage.setItem('lpMarketingBannerStatus', 'active');
      })
      .catch((error) => {
        console.error('[load marketing banner preview error]', error);
      });
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

  const handleMobileBannerFile = (file?: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecciona una imagen valida para el banner movil.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setMobileBannerPreview(result);
      setMobileBannerFileName(file.name);
      setBannerStatus('draft');

      localStorage.setItem('lpMarketingMobileBannerPreview', result);
      localStorage.setItem('lpMarketingMobileBannerFileName', file.name);
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
    <div className="space-y-4 pb-8 sm:space-y-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center lg:max-w-none lg:flex-row lg:items-end lg:justify-between lg:text-left">
        <div>
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-600 sm:text-xs lg:mx-0">
            <HiOutlineSpeakerphone className="h-4 w-4" />
            Marketing
          </div>
          <h1 className="mx-auto mt-3 max-w-[340px] text-3xl font-black leading-tight text-[#0A375A] sm:max-w-none sm:text-4xl lg:mx-0 lg:text-3xl">Centro de marketing</h1>
          <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-gray-500 sm:max-w-2xl lg:mx-0 lg:max-w-3xl">
            Prepara banners y diseña campañas de email premium antes de activar envíos reales.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex w-fit items-center justify-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 sm:px-5 sm:py-3 sm:text-sm lg:ml-auto"
        >
          <HiOutlineSparkles className="h-5 w-5" />
          Diseñar email
        </button>
      </div>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-4 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-gray-500 sm:text-sm">Vista previa del banner</h2>
            <p className="mt-1 text-xs text-gray-400">Formato largo para el carrusel principal del Home.</p>
          </div>

          <div className={`w-fit rounded-full px-3 py-1 text-xs font-black ${bannerStatus === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#F97316]'}`}>
            {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:gap-5 sm:p-6 xl:grid-cols-[1fr_280px]">
          <div>
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

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Vista previa movil</h3>
              <p className="mt-1 text-xs text-gray-400">Formato flyer para celulares.</p>
            </div>

            {mobileBannerPreview ? (
              <div className="rounded-2xl bg-gradient-to-br from-[#0A375A]/10 via-white to-[#F97316]/10 p-2 sm:p-3">
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
              <div className="mx-auto flex min-h-[260px] max-w-[250px] flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center sm:min-h-[300px] xl:max-w-none">
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

      <section className="grid gap-4 sm:gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#F97316]">
              <HiOutlineUpload className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950 sm:text-lg">Subir banner</h2>
              <p className="text-sm leading-5 text-gray-500">Carga el arte final del banner publicitario.</p>
            </div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleBannerFile(event.dataTransfer.files?.[0]);
            }}
            className="mt-5 flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white px-5 py-7 text-center transition hover:border-[#F97316] hover:bg-orange-50/40 sm:mt-6 sm:min-h-[255px] sm:px-6 sm:py-8"
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

            <h3 className="mt-4 text-sm font-black text-gray-950 sm:mt-5 sm:text-base">Haz clic para subir tu banner</h3>
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

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0A375A]/5 text-[#0A375A]">
              <HiOutlineDeviceMobile className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950 sm:text-lg">Subir banner movil</h2>
              <p className="text-sm text-gray-500">Flyer vertical para celulares, como los flyers de eventos.</p>
            </div>
          </div>

          <div
            onClick={() => mobileFileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleMobileBannerFile(event.dataTransfer.files?.[0]);
            }}
            className="mt-5 flex min-h-[210px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white px-5 py-7 text-center transition hover:border-[#0A375A] hover:bg-blue-50/40 sm:mt-6 sm:min-h-[255px] sm:px-6 sm:py-8"
          >
            <input
              ref={mobileFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => handleMobileBannerFile(event.target.files?.[0])}
            />

            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#0A375A] shadow-sm ring-1 ring-gray-100">
              <HiOutlineDeviceMobile className="h-8 w-8" />
            </div>

            <h3 className="mt-4 text-sm font-black text-gray-950 sm:mt-5 sm:text-base">Subir flyer movil</h3>
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

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
              disabled={!bannerPreview}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cambiar imagen
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#F97316]">
              <HiOutlineMail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Diseñador de Email Marketing</h2>
              <p className="text-sm text-gray-500">Borrador visual seguro. Todavía no envía correos reales.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
            <p className="text-sm font-black text-orange-700">Fase segura</p>
            <p className="mt-1 text-sm leading-6 text-orange-700/80">
              Aquí podrás subir un arte hecho en Photoshop, revisar el diseño del correo y luego activar prueba al administrador en la siguiente fase.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <input className="input text-sm" placeholder="Nombre interno de campaña" />
            <input className="input text-sm" placeholder="Asunto del correo" />
            <input className="input text-sm" placeholder="Preheader / texto corto bajo el asunto" />
            <select className="input text-sm" defaultValue="all_users">
              <option value="all_users">Todos los usuarios</option>
              <option value="all_buyers">Todos los compradores</option>
              <option value="event_buyers">Compradores de un evento</option>
            </select>
            <input className="input text-sm" placeholder="Link del botón o evento" />
          </div>

          <div className="mt-5 flex min-h-[185px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-br from-orange-50/40 to-white px-5 py-7 text-center">
            <HiOutlineUpload className="h-9 w-9 text-[#F97316]" />
            <h3 className="mt-3 text-sm font-black text-gray-950">Área para arte del email</h3>
            <p className="mt-2 text-sm leading-6 text-gray-500">Recomendado: 1200 px de ancho, JPG optimizado, menos de 1 MB.</p>
          </div>

          <button type="button" disabled className="mt-5 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-[#0A375A] px-5 py-3 text-sm font-black text-white opacity-50">
            Guardar campaña próximamente
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-gray-950">Preview premium</h2>
              <p className="text-sm text-gray-500">Estructura visual propuesta para el correo.</p>
            </div>
            <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-600">Sin envío real</div>
          </div>

          <div className="mt-5 rounded-3xl bg-[#f5f7fb] p-4">
            <div className="mx-auto max-w-[640px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl shadow-slate-200/80">
              <div className="p-6 text-center">
                <img src="/logo-email-orange.png" alt="LPTicket" className="mx-auto h-auto w-[180px]" />
              </div>
              <div className="px-4 pb-4">
                <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-center">
                  <div>
                    <HiOutlinePhotograph className="mx-auto h-12 w-12 text-gray-300" />
                    <p className="mt-3 text-sm font-black text-gray-400">Tu arte de Photoshop aparecerá aquí</p>
                  </div>
                </div>
              </div>
              <div className="px-8 pb-8 text-center">
                <h3 className="text-2xl font-black leading-tight text-[#0A375A]">Título opcional de campaña</h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">Texto breve opcional para acompañar la imagen principal del email.</p>
                <div className="mt-5 inline-flex rounded-xl bg-[#F97316] px-5 py-3 text-xs font-black uppercase tracking-wide text-white">Ver evento</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
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

      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
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

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
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
