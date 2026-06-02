'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
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
    status: 'Disponible',
    icon: HiOutlineDeviceMobile,
  },
  {
    title: 'WhatsApp',
    description: 'Mensajes directos para audiencias segmentadas.',
    status: 'Disponible',
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

  const [smsMessage, setSmsMessage] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [sending, setSending] = useState<'' | 'email' | 'sms' | 'whatsapp'>('');

  // Audience per channel: 'all' = todos, 'specify' = elegidos de la lista.
  const [emailAudience, setEmailAudience] = useState<'all' | 'specify'>('all');
  const [smsAudience, setSmsAudience] = useState<'all' | 'specify'>('all');
  const [waAudience, setWaAudience] = useState<'all' | 'specify'>('all');

  type Recipient = { id: string; name: string; email: string; phone: string };
  const [recipientsList, setRecipientsList] = useState<Recipient[]>([]);
  const [emailSel, setEmailSel] = useState<string[]>([]);
  const [smsSel, setSmsSel] = useState<string[]>([]);
  const [waSel, setWaSel] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState<{ email: string; sms: string; whatsapp: string }>({ email: '', sms: '', whatsapp: '' });

  useEffect(() => {
    api.get('/marketing/admin/recipients').then((r) => setRecipientsList(r.data || [])).catch(() => {});
  }, []);

  const toggleSel = (
    setSel: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
  ) => setSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const renderPicker = (
    channel: 'email' | 'sms' | 'whatsapp',
    field: 'email' | 'phone',
    sel: string[],
    setSel: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    const q = pickerSearch[channel].toLowerCase();
    const list = recipientsList.filter(
      (u) => u[field] && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.phone.includes(q)),
    );
    return (
      <div className="mt-2 rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-3">
        <input
          value={pickerSearch[channel]}
          onChange={(e) => setPickerSearch((p) => ({ ...p, [channel]: e.target.value }))}
          placeholder="Buscar usuario…"
          className="w-full rounded-lg border border-[rgba(246,198,95,0.18)] bg-[#071827] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#F97316]"
        />
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
          <span>{sel.length} seleccionado(s)</span>
          <div className="flex gap-3">
            <button type="button" onClick={() => setSel(list.map((u) => u.id))} className="font-bold text-[#F97316]">Todos</button>
            <button type="button" onClick={() => setSel([])} className="font-bold text-slate-400">Ninguno</button>
          </div>
        </div>
        <div className="mt-2 max-h-48 space-y-1 overflow-y-auto custom-scrollbar">
          {list.length === 0 && (
            <p className="py-2 text-center text-xs text-gray-500">Sin usuarios con {field === 'email' ? 'correo' : 'teléfono'}.</p>
          )}
          {list.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <input type="checkbox" checked={sel.includes(u.id)} onChange={() => toggleSel(setSel, u.id)} className="accent-[#F97316]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-200">{u.name || '(sin nombre)'}</span>
                <span className="block truncate text-[11px] text-gray-400">{field === 'email' ? u.email : u.phone}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  const handleSendEmail = async () => {
    if (!campaignSubject.trim() && !campaignName.trim()) {
      toast.error('Agrega un asunto o nombre de campaña.');
      return;
    }
    const recipients = emailAudience === 'specify'
      ? recipientsList.filter((u) => emailSel.includes(u.id)).map((u) => u.email).filter(Boolean)
      : undefined;
    if (emailAudience === 'specify' && (!recipients || recipients.length === 0)) {
      toast.error('Selecciona al menos un destinatario.');
      return;
    }
    const who = recipients ? `${recipients.length} destinatario(s)` : 'todos los usuarios';
    if (!confirm(`¿Enviar esta campaña de email a ${who}?`)) return;
    setSending('email');
    try {
      const { data } = await api.post('/marketing/admin/email-campaign', {
        subject: campaignSubject || campaignName,
        title: campaignName,
        preheader: campaignPreheader,
        link: campaignLink,
        imageData: emailArtPreview || undefined,
        recipients,
      });
      toast.success(`Email enviado: ${data.sent}/${data.total} (${data.failed} fallidos)`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al enviar el email');
    } finally { setSending(''); }
  };

  const handleSendMessaging = async (channel: 'sms' | 'whatsapp') => {
    const message = channel === 'sms' ? smsMessage : whatsappMessage;
    const audience = channel === 'sms' ? smsAudience : waAudience;
    const sel = channel === 'sms' ? smsSel : waSel;
    if (!message.trim()) { toast.error('Escribe un mensaje.'); return; }
    const recipients = audience === 'specify'
      ? recipientsList.filter((u) => sel.includes(u.id)).map((u) => u.phone).filter(Boolean)
      : undefined;
    if (audience === 'specify' && (!recipients || recipients.length === 0)) {
      toast.error('Selecciona al menos un destinatario con teléfono.');
      return;
    }
    const who = recipients ? `${recipients.length} número(s)` : 'todos los usuarios con teléfono';
    if (!confirm(`¿Enviar este ${channel === 'sms' ? 'SMS' : 'WhatsApp'} a ${who}?`)) return;
    setSending(channel);
    try {
      const { data } = await api.post(`/marketing/admin/${channel}-campaign`, { message, recipients });
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Enviado: ${data.sent}/${data.total} (${data.failed} fallidos)`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al enviar');
    } finally { setSending(''); }
  };

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
    <div className="marketing-shell premium-shell p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
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
            className="btn-primary w-fit px-5"
          >
            <HiOutlineSparkles className="h-5 w-5" />
            Disenar email
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
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
              <p className="text-sm text-gray-500">Envia correos reales a los destinatarios seleccionados.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-2xl border border-[rgba(249,115,22,0.22)] bg-[rgba(249,115,22,0.08)] p-4 sm:grid-cols-3">
            {['Diseno', 'Prueba', 'Envio'].map((step, index) => (
              <div key={step} className="rounded-2xl bg-[rgba(8,31,51,0.6)] border border-[rgba(246,198,95,0.12)] p-3 shadow-sm">
                <p className="text-xs font-black uppercase tracking-wide text-orange-400">Paso {index + 1}</p>
                <p className="mt-1 font-black text-white">{step}</p>
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
            <select
              value={emailAudience}
              onChange={(e) => setEmailAudience(e.target.value as 'all' | 'specify')}
              className="h-12 rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] text-slate-100 px-4 text-sm outline-none transition focus:border-[#F97316]"
            >
              <option value="all" className="bg-[#0b2236] text-slate-100">Enviar a todos los usuarios</option>
              <option value="specify" className="bg-[#0b2236] text-slate-100">Especificar destinatarios</option>
            </select>
            {emailAudience === 'specify' && renderPicker('email', 'email', emailSel, setEmailSel)}
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
            className="mt-5 flex min-h-[170px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[rgba(246,198,95,0.22)] bg-[rgba(8,31,51,0.45)] p-6 text-center transition hover:border-[rgba(249,115,22,0.5)] hover:bg-[rgba(249,115,22,0.08)]"
          >
            <HiOutlineUpload className="h-10 w-10 text-[#F97316]" />
            <span className="mt-3 text-base font-black text-slate-100">Subir arte principal del email</span>
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
            onClick={handleSendEmail}
            disabled={sending === 'email'}
            className="btn-primary mt-5 w-full py-4 disabled:opacity-60"
          >
            {sending === 'email' ? 'Enviando…' : 'Enviar campaña por email'}
          </button>
          <p className="mt-2 text-center text-[11px] text-gray-400">
            {emailAudience === 'all' ? 'Se envía a todos los usuarios registrados.' : 'Se envía solo a los correos especificados.'}
          </p>
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
                <img
                  src="/logo.png"
                  alt="LP Ticket"
                  className="mx-auto h-14 w-auto object-contain"
                />
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
                <div className="btn-primary mt-6 px-7">
                  {campaignLink ? 'VER DETALLES' : 'VER EVENTO'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SMS & WhatsApp campaigns */}
      <section className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[#0A375A]">
              <HiOutlineDeviceMobile className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950">SMS</h2>
              <p className="text-xs text-gray-500">Recordatorios, accesos y promociones urgentes.</p>
            </div>
          </div>
          <select
            value={smsAudience}
            onChange={(e) => setSmsAudience(e.target.value as 'all' | 'specify')}
            className="mt-4 h-11 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          >
            <option value="all" className="bg-[#0b2236] text-slate-100">Enviar a todos los usuarios</option>
            <option value="specify" className="bg-[#0b2236] text-slate-100">Especificar números</option>
          </select>
          {smsAudience === 'specify' && renderPicker('sms', 'phone', smsSel, setSmsSel)}
          <textarea
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            rows={4}
            maxLength={320}
            placeholder="Escribe tu mensaje SMS…"
            className="mt-2 w-full resize-none rounded-2xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-4 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          />
          <div className="mt-1 text-right text-[11px] text-gray-400">{smsMessage.length}/320</div>
          <button type="button" onClick={() => handleSendMessaging('sms')} disabled={sending === 'sms'} className="btn-primary mt-2 w-full py-3 disabled:opacity-60">
            {sending === 'sms' ? 'Enviando…' : 'Enviar SMS'}
          </button>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-green-600">
              <HiOutlineChatAlt2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950">WhatsApp</h2>
              <p className="text-xs text-gray-500">Mensajes directos para audiencias segmentadas.</p>
            </div>
          </div>
          <select
            value={waAudience}
            onChange={(e) => setWaAudience(e.target.value as 'all' | 'specify')}
            className="mt-4 h-11 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          >
            <option value="all" className="bg-[#0b2236] text-slate-100">Enviar a todos los usuarios</option>
            <option value="specify" className="bg-[#0b2236] text-slate-100">Especificar números</option>
          </select>
          {waAudience === 'specify' && renderPicker('whatsapp', 'phone', waSel, setWaSel)}
          <textarea
            value={whatsappMessage}
            onChange={(e) => setWhatsappMessage(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Escribe tu mensaje de WhatsApp…"
            className="mt-2 w-full resize-none rounded-2xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-4 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          />
          <div className="mt-1 text-right text-[11px] text-gray-400">{whatsappMessage.length}/1000</div>
          <button type="button" onClick={() => handleSendMessaging('whatsapp')} disabled={sending === 'whatsapp'} className="btn-primary mt-2 w-full py-3 disabled:opacity-60">
            {sending === 'whatsapp' ? 'Enviando…' : 'Enviar WhatsApp'}
          </button>
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
              <button type="button" onClick={removeBanner} className="group flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-red-100 hover:text-red-600 hover:shadow-lg active:translate-y-0 active:scale-95">
                <HiOutlineX className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
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
              <button type="button" onClick={removeMobileBanner} className="group flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:scale-105 hover:bg-red-100 hover:text-red-600 hover:shadow-lg active:translate-y-0 active:scale-95">
                <HiOutlineX className="h-5 w-5 transition-transform duration-200 group-hover:rotate-90" />
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
