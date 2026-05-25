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

type BannerStatus = 'draft' | 'active';

const channels = [
  {
    title: 'Banner Home',
    description: 'Banner publicitario dentro del carrusel principal.',
    status: 'Activo',
    icon: HiOutlinePhotograph,
  },
  {
    title: 'Email Marketing',
    description: 'Diseno premium listo para preparar campanas visuales.',
    status: 'Diseno',
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
  const emailArtInputRef = useRef<HTMLInputElement | null>(null);

  const [bannerPreview, setBannerPreview] = useState('');
  const [bannerFileName, setBannerFileName] = useState('');
  const [mobileBannerPreview, setMobileBannerPreview] = useState('');
  const [mobileBannerFileName, setMobileBannerFileName] = useState('');
  const [bannerStatus, setBannerStatus] = useState<BannerStatus>('draft');

  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignPreheader, setCampaignPreheader] = useState('');
  const [campaignLink, setCampaignLink] = useState('');
  const [emailArtPreview, setEmailArtPreview] = useState('');
  const [emailArtFileName, setEmailArtFileName] = useState('');

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
      .catch((error: unknown) => {
        console.error('[load marketing banner preview error]', error);
      });
  }, []);

  const handleImageFile = (
    file: File | undefined,
    onLoad: (result: string, fileName: string) => void,
    invalidMessage: string,
  ) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert(invalidMessage);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      onLoad(result, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFile = (file?: File) => {
    handleImageFile(file, (result, fileName) => {
      setBannerPreview(result);
      setBannerFileName(fileName);
      setBannerStatus('draft');
      localStorage.setItem('lpMarketingBannerPreview', result);
      localStorage.setItem('lpMarketingBannerFileName', fileName);
      localStorage.setItem('lpMarketingBannerStatus', 'draft');
    }, 'Selecciona una imagen valida para el banner.');
  };

  const handleMobileBannerFile = (file?: File) => {
    handleImageFile(file, (result, fileName) => {
      setMobileBannerPreview(result);
      setMobileBannerFileName(fileName);
      setBannerStatus('draft');
      localStorage.setItem('lpMarketingMobileBannerPreview', result);
      localStorage.setItem('lpMarketingMobileBannerFileName', fileName);
      localStorage.setItem('lpMarketingBannerStatus', 'draft');
    }, 'Selecciona una imagen valida para el banner movil.');
  };

  const handleEmailArtFile = (file?: File) => {
    handleImageFile(file, (result, fileName) => {
      setEmailArtPreview(result);
      setEmailArtFileName(fileName);
    }, 'Selecciona una imagen valida para el arte del email.');
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
    } catch (error: unknown) {
      console.error('[remove marketing banner error]', error);
    }
  };

  const removeMobileBanner = async () => {
    setMobileBannerPreview('');
    setMobileBannerFileName('');
    setBannerStatus('draft');

    localStorage.removeItem('lpMarketingMobileBannerPreview');
    localStorage.removeItem('lpMarketingMobileBannerFileName');
    localStorage.setItem('lpMarketingBannerStatus', 'draft');

    try {
      await api.delete('/marketing/admin/banner/home-mobile');
    } catch (error: unknown) {
      console.error('[remove mobile marketing banner error]', error);
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
    } catch (error: unknown) {
      console.error('[publish marketing banner error]', error);
      alert('No se pudo publicar el banner.');
    }
  };

  const statCards = [
    { label: 'Banners activos', value: bannerStatus === 'active' ? '1' : '0', icon: HiOutlinePhotograph },
    { label: 'Audiencias', value: '0', icon: HiOutlineUsers },
    { label: 'Campanas', value: emailArtPreview || campaignName ? '1' : '0', icon: HiOutlinePresentationChartLine },
    { label: 'Clicks', value: '0', icon: HiOutlineCursorClick },
  ];

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-600">
              <HiOutlineSpeakerphone className="h-4 w-4" />
              Marketing
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight text-[#0A375A] sm:text-4xl">
              Centro de marketing
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Administra banners y prepara campanas visuales premium antes de activar envios reales.
            </p>
          </div>

          <button
            type="button"
            onClick={() => document.getElementById('email-designer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600"
          >
            <HiOutlineSparkles className="h-5 w-5" />
            Disenar email
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-500">{card.label}</p>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0A375A] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-3xl font-black text-gray-950">{card.value}</p>
              </div>
            );
          })}
        </div>
      </div>

      <section id="email-designer" className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#F97316]">
              <HiOutlineMail className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-950">Disenador de Email Marketing</h2>
              <p className="text-sm text-gray-500">Modo visual. No envia correos reales todavia.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 p-4 sm:grid-cols-3">
            {['Diseno', 'Prueba', 'Envio'].map((step, index) => (
              <div key={step} className="rounded-2xl bg-white p-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-orange-500">Paso {index + 1}</p>
                <p className="mt-1 font-black text-gray-950">{step}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            <input
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-[#F97316]"
              placeholder="Nombre interno de campana"
            />
            <input
              value={campaignSubject}
              onChange={(event) => setCampaignSubject(event.target.value)}
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-[#F97316]"
              placeholder="Asunto del correo"
            />
            <input
              value={campaignPreheader}
              onChange={(event) => setCampaignPreheader(event.target.value)}
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-[#F97316]"
              placeholder="Preheader / texto corto bajo el asunto"
            />
            <select className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-[#F97316]">
              <option>Todos los usuarios</option>
              <option>Todos los compradores</option>
              <option>Compradores de un evento</option>
            </select>
            <input
              value={campaignLink}
              onChange={(event) => setCampaignLink(event.target.value)}
              className="h-12 rounded-xl border border-gray-200 px-4 text-sm outline-none transition focus:border-[#F97316]"
              placeholder="Link del boton o evento"
            />
          </div>

          <input
            ref={emailArtInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleEmailArtFile(event.target.files?.[0])}
          />

          <button
            type="button"
            onClick={() => emailArtInputRef.current?.click()}
            className="mt-5 flex min-h-[170px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/60 p-6 text-center transition hover:border-orange-200 hover:bg-orange-50/40"
          >
            <HiOutlineUpload className="h-10 w-10 text-[#F97316]" />
            <span className="mt-3 text-base font-black text-gray-950">Subir arte principal del email</span>
            <span className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
              Recomendado: 1200 px de ancho, JPG optimizado, menos de 1 MB.
            </span>
          </button>

          {emailArtFileName && (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="truncate text-sm font-black text-gray-950">{emailArtFileName}</p>
              <p className="text-xs font-bold text-gray-500">Arte cargado para preview</p>
            </div>
          )}

          <button
            type="button"
            disabled
            className="mt-5 w-full rounded-2xl bg-slate-300 px-5 py-4 text-sm font-black text-white"
          >
            Guardar borrador en fase 2
          </button>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-950">Preview premium</h2>
              <p className="text-sm text-gray-500">Vista tipo email para aprobar el arte antes de activar pruebas.</p>
            </div>
            <span className="w-fit rounded-full bg-green-50 px-4 py-2 text-sm font-black text-green-600">Sin envio real</span>
          </div>

          <div className="mt-6 rounded-[2rem] bg-slate-100 p-4 sm:p-6">
            <div className="overflow-hidden rounded-[1.5rem] border border-gray-200 bg-white shadow-sm">
              <div className="p-6 text-center">
                <div className="mx-auto inline-flex items-center gap-3 text-[#F97316]">
                  <div className="rounded-2xl bg-[#F97316] px-3 py-2 text-xl font-black text-white">LP</div>
                  <span className="text-3xl font-black">LPTicket</span>
                </div>
              </div>

              {emailArtPreview ? (
                <img src={emailArtPreview} alt="Arte del email" className="w-full object-contain" />
              ) : (
                <div className="mx-6 flex min-h-[320px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 text-center">
                  <HiOutlinePhotograph className="h-12 w-12 text-gray-300" />
                  <p className="mt-4 text-sm font-black text-gray-400">Tu arte de Photoshop aparecera aqui</p>
                </div>
              )}

              <div className="px-6 py-8 text-center">
                <h3 className="text-2xl font-black text-[#0A375A]">
                  {campaignName || 'Titulo opcional de campana'}
                </h3>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
                  {campaignPreheader || 'Texto breve opcional para acompanar la imagen principal del email.'}
                </p>
                <div className="mt-6 inline-flex rounded-2xl bg-[#F97316] px-7 py-3 text-sm font-black text-white">
                  {campaignLink ? 'VER DETALLES' : 'VER EVENTO'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Banner Home</h2>
            <p className="mt-1 text-sm text-gray-400">Vista compacta del banner publicado en el carrusel principal.</p>
          </div>
          <div className={`w-fit rounded-full px-4 py-2 text-sm font-black ${bannerStatus === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#F97316]'}`}>
            {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}
          </div>
        </div>

        <div className="grid gap-5 p-5 xl:grid-cols-[1fr_340px]">
          <div className="rounded-3xl bg-gray-50 p-4">
            {bannerPreview ? (
              <div className="overflow-hidden rounded-2xl bg-black shadow-sm">
                <img src={bannerPreview} alt="Preview del banner publicitario" className="aspect-[3.05/1] w-full object-cover" />
              </div>
            ) : (
              <div className="flex aspect-[3.05/1] items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white text-sm font-bold text-gray-400">
                Sin banner publicado
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-gray-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Movil</h3>
              <p className="text-xs text-gray-400">Formato flyer para celulares.</p>
            </div>
            {mobileBannerPreview ? (
              <div className="mx-auto max-w-[220px] overflow-hidden rounded-2xl bg-black shadow-sm">
                <img src={mobileBannerPreview} alt="Preview movil del banner" className="aspect-[3/4] w-full object-cover" />
              </div>
            ) : (
              <div className="mx-auto flex aspect-[3/4] max-w-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white text-sm font-bold text-gray-400">
                Sin flyer movil
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#F97316]">
              <HiOutlineUpload className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950">Subir banner</h2>
              <p className="text-xs text-gray-500">Arte horizontal para Home.</p>
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleBannerFile(event.target.files?.[0])} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center transition hover:border-orange-200 hover:bg-orange-50/40">
            <HiOutlineUpload className="mx-auto h-7 w-7 text-[#F97316]" />
            <p className="mt-2 font-black text-gray-950">Cambiar banner</p>
            <p className="mt-1 text-xs text-gray-500">Recomendado: 1600 x 520 px.</p>
          </button>

          {bannerFileName && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-gray-950">{bannerFileName}</p>
                <p className="text-xs font-bold text-gray-500">Estado: {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}</p>
              </div>
              <button type="button" onClick={removeBanner} className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0A375A]">
              <HiOutlineDeviceMobile className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950">Subir banner movil</h2>
              <p className="text-xs text-gray-500">Flyer vertical para celulares.</p>
            </div>
          </div>

          <input ref={mobileFileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleMobileBannerFile(event.target.files?.[0])} />
          <button type="button" onClick={() => mobileFileInputRef.current?.click()} className="mt-4 w-full rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center transition hover:border-blue-200 hover:bg-blue-50/40">
            <HiOutlineDeviceMobile className="mx-auto h-7 w-7 text-[#0A375A]" />
            <p className="mt-2 font-black text-gray-950">Cambiar flyer movil</p>
            <p className="mt-1 text-xs text-gray-500">Recomendado: 1080 x 1440 px.</p>
          </button>

          {mobileBannerFileName && (
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-gray-200 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-gray-950">{mobileBannerFileName}</p>
                <p className="text-xs font-bold text-gray-500">Movil</p>
              </div>
              <button type="button" onClick={removeMobileBanner} className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500">
                <HiOutlineX className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <HiOutlineBadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950">Publicacion</h2>
              <p className="text-xs text-gray-500">Guarda el banner en el Home.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="font-black text-gray-950">Rotacion en Home</p>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              El banner se mezcla con eventos destacados y aparece dentro del carrusel.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button type="button" onClick={publishBanner} disabled={!bannerPreview} className="rounded-2xl bg-[#0A375A] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              Publicar banner
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black text-gray-700">
              Cambiar imagen
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {channels.map((channel) => {
          const Icon = channel.icon;
          const active = channel.status === 'Activo';
          const ready = channel.status === 'Diseno';

          return (
            <div key={channel.title} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-[#0A375A]">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-black text-gray-950">{channel.title}</h3>
              <p className="mt-2 min-h-[54px] text-sm leading-6 text-gray-500">{channel.description}</p>
              <span className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-black ${active ? 'bg-green-50 text-green-600' : ready ? 'bg-blue-50 text-[#0A375A]' : 'bg-orange-50 text-[#F97316]'}`}>
                {channel.status}
              </span>
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-[#0A375A]">
            <HiOutlineChartBar className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-950">Proximas conexiones</h2>
            <p className="text-sm leading-6 text-gray-500">
              Luego conectamos guardado de campanas, prueba al administrador, agenda, envios reales y analiticas de apertura.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
