'use client';

import { useState } from 'react';
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
  HiOutlineUsers,
} from 'react-icons/hi';

const channels = [
  {
    title: 'Banner Home',
    description: 'Administra promociones visuales para mostrar en la pagina principal.',
    status: 'Estructura lista',
    icon: HiOutlinePhotograph,
  },
  {
    title: 'Email Marketing',
    description: 'Prepara campanas para comunicar eventos, ofertas y novedades.',
    status: 'Proximamente',
    icon: HiOutlineMail,
  },
  {
    title: 'SMS',
    description: 'Envios cortos para recordatorios, accesos y promociones urgentes.',
    status: 'Proximamente',
    icon: HiOutlineDeviceMobile,
  },
  {
    title: 'WhatsApp',
    description: 'Mensajes directos para audiencias segmentadas y seguimiento.',
    status: 'Proximamente',
    icon: HiOutlineChatAlt2,
  },
];

export default function AdminMarketingPage() {
  const [bannerTitle, setBannerTitle] = useState('LPTicket');
  const [bannerSubtitle, setBannerSubtitle] = useState('Impulsa tus eventos con una plataforma moderna, segura y profesional.');
  const [bannerImage, setBannerImage] = useState('');
  const [buttonText, setButtonText] = useState('Conocer mas');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-orange-600">
            <HiOutlineSpeakerphone className="h-4 w-4" />
            Marketing
          </div>
          <h1 className="mt-3 text-3xl font-black text-[#0A375A]">Centro de Marketing</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-500">
            Un espacio para banners, campanas, audiencias, email, SMS y WhatsApp. Primero dejamos la estructura lista y luego conectamos los envios reales.
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

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          ['Banners activos', '0', HiOutlinePhotograph],
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

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-[#F97316]">
              <HiOutlinePhotograph className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-950">Banner publicitario del Home</h2>
              <p className="text-sm text-gray-500">Estructura preparada para promocionar LPTicket sin crear un evento.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">Titulo</span>
              <input
                value={bannerTitle}
                onChange={(event) => setBannerTitle(event.target.value)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-wide text-gray-500">Mensaje</span>
              <textarea
                value={bannerSubtitle}
                onChange={(event) => setBannerSubtitle(event.target.value)}
                rows={3}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-gray-500">URL de imagen</span>
                <input
                  value={bannerImage}
                  onChange={(event) => setBannerImage(event.target.value)}
                  placeholder="https://..."
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-wide text-gray-500">Boton</span>
                <input
                  value={buttonText}
                  onChange={(event) => setButtonText(event.target.value)}
                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button className="rounded-xl bg-[#0A375A] px-5 py-3 text-sm font-black text-white shadow-lg shadow-[#0A375A]/10">
                Guardar borrador
              </button>
              <button className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 hover:bg-gray-50">
                Vista previa
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div
            className="relative min-h-[340px] p-6 text-white"
            style={{
              backgroundImage: bannerImage
                ? `linear-gradient(120deg, rgba(10,55,90,0.88), rgba(249,115,22,0.68)), url(${bannerImage})`
                : 'linear-gradient(120deg, #0A375A 0%, #174A71 48%, #F97316 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute right-5 top-5 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase backdrop-blur">
              Preview
            </div>
            <div className="flex min-h-[290px] flex-col justify-end">
              <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-black uppercase backdrop-blur">
                <HiOutlineBadgeCheck className="h-4 w-4" />
                Publicidad LPTicket
              </div>
              <h3 className="text-4xl font-black leading-tight">{bannerTitle || 'LPTicket'}</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-white/85">{bannerSubtitle}</p>
              <button className="mt-6 w-fit rounded-xl bg-white px-5 py-3 text-sm font-black text-[#0A375A]">
                {buttonText || 'Conocer mas'}
              </button>
            </div>
          </div>
        </div>
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
              <div className="mt-4 inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#F97316]">
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
              La pantalla queda lista para conectar base de datos, subida de imagenes y proveedores de envio.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
