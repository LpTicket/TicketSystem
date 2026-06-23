'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import {
  HiOutlineBadgeCheck,
  HiOutlineBell,
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
type BannerType = 'banner' | 'ad';
type BannerDisplayMode = 'once' | 'every3' | 'every5';

type MarketingHomeBanner = {
  id: string;
  title?: string;
  imageData?: string | null;
  imageUrl?: string | null;
  mobileImageData?: string | null;
  mobileImageUrl?: string | null;
  fileName?: string | null;
  mobileFileName?: string | null;
  bannerType?: BannerType | string | null;
  displayMode?: BannerDisplayMode | string | null;
  sortOrder?: number | null;
  isActive?: boolean;
};

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
  const [marketingBanners, setMarketingBanners] = useState<MarketingHomeBanner[]>([]);
  const [selectedBannerId, setSelectedBannerId] = useState<string | null>(null);
  const [bannerType, setBannerType] = useState<BannerType>('banner');
  const [bannerDisplayMode, setBannerDisplayMode] = useState<BannerDisplayMode>('once');

  const [campaignName, setCampaignName] = useState('');
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignPreheader, setCampaignPreheader] = useState('');
  const [campaignLink, setCampaignLink] = useState('');
  const [emailArtPreview, setEmailArtPreview] = useState('');
  const [emailArtFileName, setEmailArtFileName] = useState('');

  const [smsMessage, setSmsMessage] = useState('');
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushAudience, setPushAudience] = useState<'all' | 'user'>('all');
  const [pushUserId, setPushUserId] = useState('');
  const [pushUserPickerOpen, setPushUserPickerOpen] = useState(false);
  const [pushDestination, setPushDestination] = useState<'none' | 'event' | 'external'>('none');
  const [pushEventId, setPushEventId] = useState('');
  const [pushLink, setPushLink] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [sending, setSending] = useState<'' | 'email' | 'sms' | 'push' | 'whatsapp'>('');

  // Audience per channel: 'all' = todos, 'specify' = elegidos de la lista.
  const [emailAudience, setEmailAudience] = useState<'all' | 'specify'>('all');
  const [smsAudience, setSmsAudience] = useState<'all' | 'specify'>('all');
  const [waAudience, setWaAudience] = useState<'all' | 'specify'>('all');
  const [waLang, setWaLang] = useState<'es' | 'en'>('es');

  type Recipient = { id: string; name: string; email: string; phone: string };
  const [recipientsList, setRecipientsList] = useState<Recipient[]>([]);
  const [emailSel, setEmailSel] = useState<string[]>([]);
  const [smsSel, setSmsSel] = useState<string[]>([]);
  const [waSel, setWaSel] = useState<string[]>([]);
  const [pushEvents, setPushEvents] = useState<any[]>([]);
  const [pickerSearch, setPickerSearch] = useState<{ email: string; sms: string; whatsapp: string; push: string }>({ email: '', sms: '', whatsapp: '', push: '' });

  // Styled confirmation modal (replaces native confirm()).
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; resolve: (v: boolean) => void } | null>(null);
  const askConfirm = (title: string, message: string) =>
    new Promise<boolean>((resolve) => setConfirmModal({ title, message, resolve }));
  const closeConfirm = (value: boolean) => {
    confirmModal?.resolve(value);
    setConfirmModal(null);
  };

  useEffect(() => {
    api.get('/marketing/admin/recipients').then((r) => setRecipientsList(r.data || [])).catch(() => {});
    api.get('/events').then((r) => {
      const data = r.data;
      setPushEvents(Array.isArray(data) ? data : data?.events || data?.data || []);
    }).catch(() => {});
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
      (u) => (field === 'phone'
        // WhatsApp: show all users, not just those with phone
        ? (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || '').includes(q))
        : (u[field] && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone || '').includes(q)))
      ),
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
            <p className="py-2 text-center text-xs text-gray-500">Sin usuarios.</p>
          )}
          {list.map((u) => {
            const contactValue = field === 'email' ? u.email : u.phone;
            const noPhone = field === 'phone' && !u.phone;
            return (
              <label key={u.id} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 ${noPhone ? 'opacity-50' : ''}`}>
                <input type="checkbox" checked={sel.includes(u.id)} onChange={() => toggleSel(setSel, u.id)} className="accent-[#F97316]" disabled={noPhone} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{u.name || u.email}</span>
                <span className="shrink-0 text-[11px] text-gray-400">{noPhone ? 'Sin teléfono' : contactValue}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const pushUserQuery = pickerSearch.push.trim().toLowerCase();
  const selectedPushUser = recipientsList.find((u) => u.id === pushUserId);
  const filteredPushUsers = recipientsList.filter((u) => {
    if (!pushUserQuery) return true;
    const haystack = `${u.name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
    return pushUserQuery.split(/\s+/).every((term) => haystack.includes(term));
  });

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
    if (!(await askConfirm('Enviar campaña de email', `¿Enviar esta campaña de email a ${who}?`))) return;
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
    const channelLabel = channel === 'sms' ? 'SMS' : 'WhatsApp';
    if (!(await askConfirm(`Enviar ${channelLabel}`, `¿Enviar este ${channelLabel} a ${who}?`))) return;
    setSending(channel);
    try {
      const { data } = await api.post(`/marketing/admin/${channel}-campaign`, {
        message,
        recipients,
        ...(channel === 'whatsapp' ? { lang: waLang } : {}),
      });
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Enviado: ${data.sent}/${data.total} (${data.failed} fallidos)`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al enviar');
    } finally { setSending(''); }
  };

  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushMessage.trim()) {
      toast.error('Escribe título y mensaje.');
      return;
    }
    if (pushAudience === 'user' && !pushUserId) {
      toast.error('Selecciona un usuario.');
      return;
    }
    const selectedEvent = pushEvents.find((event) => String(event.id) === pushEventId);
    if (pushDestination === 'event' && !selectedEvent) {
      toast.error('Selecciona un evento.');
      return;
    }
    const link = pushDestination === 'event'
      ? `lpticket://event/${selectedEvent?.slug || selectedEvent?.id}`
      : pushDestination === 'external'
        ? pushLink.trim()
        : '';
    if (pushDestination === 'external' && link && !/^https?:\/\//i.test(link)) {
      toast.error('Usa un link que empiece con https://');
      return;
    }
    const who = pushAudience === 'user'
      ? recipientsList.find((u) => u.id === pushUserId)?.name || 'un usuario'
      : 'todos los dispositivos activos';
    if (!(await askConfirm('Enviar push', `¿Enviar esta notificación push a ${who}?`))) return;
    setSending('push');
    try {
      const { data } = await api.post('/marketing/admin/push-campaign', {
        title: pushTitle.trim(),
        message: pushMessage.trim(),
        audience: pushAudience,
        userId: pushAudience === 'user' ? pushUserId : undefined,
        link: link || undefined,
      });
      if (data.error) toast.error(data.error);
      else toast.success(`Push enviado: ${data.sent}/${data.total} (${data.failed} fallidos)`);
      setPushTitle('');
      setPushMessage('');
      setPushLink('');
      setPushEventId('');
      setPushDestination('none');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo enviar el push');
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

    api.get('/marketing/admin/banners/home?includeData=true')
      .then(({ data }) => {
        const items: MarketingHomeBanner[] = Array.isArray(data) ? data : [];
        setMarketingBanners(items);
        if (!items.length) return;

        const first = items[0];
        setSelectedBannerId(first.id);
        setBannerType(first.bannerType === 'ad' ? 'ad' : 'banner');
        setBannerDisplayMode(['once', 'every3', 'every5'].includes(first.displayMode || '') ? first.displayMode as BannerDisplayMode : 'once');
        setBannerPreview(first.imageData || first.imageUrl || '');
        setBannerFileName(first.fileName || 'banner-home');
        setMobileBannerPreview(first.mobileImageData || first.mobileImageUrl || '');
        setMobileBannerFileName(first.mobileFileName || '');
        setBannerStatus(first.isActive === false ? 'draft' : 'active');
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

  const selectMarketingBanner = (item: MarketingHomeBanner) => {
    setSelectedBannerId(item.id);
    setBannerType(item.bannerType === 'ad' ? 'ad' : 'banner');
    setBannerDisplayMode(['once', 'every3', 'every5'].includes(item.displayMode || '') ? item.displayMode as BannerDisplayMode : 'once');
    setBannerPreview(item.imageData || item.imageUrl || '');
    setBannerFileName(item.fileName || 'banner-home');
    setMobileBannerPreview(item.mobileImageData || item.mobileImageUrl || '');
    setMobileBannerFileName(item.mobileFileName || '');
    setBannerStatus(item.isActive === false ? 'draft' : 'active');
  };

  const createNewMarketingBanner = (nextType: BannerType = bannerType) => {
    setSelectedBannerId(null);
    setBannerType(nextType);
    setBannerDisplayMode('once');
    setBannerPreview('');
    setBannerFileName('');
    setMobileBannerPreview('');
    setMobileBannerFileName('');
    setBannerStatus('draft');
  };

  const removeBanner = async () => {
    const currentId = selectedBannerId;
    setBannerPreview('');
    setBannerFileName('');
    setBannerStatus('draft');
    setSelectedBannerId(null);

    localStorage.removeItem('lpMarketingBannerPreview');
    localStorage.removeItem('lpMarketingBannerFileName');
    localStorage.removeItem('lpMarketingBannerStatus');

    try {
      if (currentId) {
        await api.delete(`/marketing/admin/banners/home/${currentId}`);
        setMarketingBanners((items) => items.filter((item) => item.id !== currentId));
      } else {
        await api.delete('/marketing/admin/banner/home');
      }
    } catch (error: unknown) {
      console.error('[remove marketing banner error]', error);
    }
  };

  const removeMobileBanner = async () => {
    const currentId = selectedBannerId;
    setMobileBannerPreview('');
    setMobileBannerFileName('');
    setBannerStatus('draft');

    localStorage.removeItem('lpMarketingMobileBannerPreview');
    localStorage.removeItem('lpMarketingMobileBannerFileName');
    localStorage.setItem('lpMarketingBannerStatus', 'draft');

    try {
      if (currentId) {
        await api.patch(`/marketing/admin/banners/home/${currentId}`, { mobileImageData: null, mobileFileName: null });
        setMarketingBanners((items) => items.map((item) => (
          item.id === currentId ? { ...item, mobileImageData: null, mobileImageUrl: null, mobileFileName: null } : item
        )));
      } else {
        await api.delete('/marketing/admin/banner/home-mobile');
      }
    } catch (error: unknown) {
      console.error('[remove mobile marketing banner error]', error);
    }
  };

  const publishBanner = async () => {
    if (!bannerPreview) return;

    try {
      const { data } = await api.post('/marketing/admin/banners/home', {
        id: selectedBannerId || undefined,
        title: bannerType === 'ad' ? 'Publicidad Home' : 'Banner Home',
        imageData: bannerPreview,
        fileName: bannerFileName || 'banner-home',
        mobileImageData: mobileBannerPreview || null,
        mobileFileName: mobileBannerFileName || null,
        bannerType,
        displayMode: bannerDisplayMode,
        sortOrder: marketingBanners.length,
        isActive: true,
      });

      setBannerStatus('active');
      setSelectedBannerId(data.id);
      setMarketingBanners((items) => [data, ...items.filter((item) => item.id !== data.id)]);
      localStorage.setItem('lpMarketingBannerStatus', 'active');
      toast.success(selectedBannerId ? 'Cambios guardados.' : 'Banner publicado correctamente.');
    } catch (error: unknown) {
      console.error('[publish marketing banner error]', error);
      toast.error('No se pudo publicar el banner.');
    }
  };

  const visibleMarketingBanners = marketingBanners.filter((item) => (item.bannerType === 'ad' ? 'ad' : 'banner') === bannerType);
  const statCards = [
    { label: 'Banners activos', value: String(marketingBanners.length), icon: HiOutlinePhotograph },
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
                  <div className="public-premium-icon flex h-10 w-10 shrink-0 items-center justify-center">
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
            <span className="w-fit rounded-full bg-orange-50 px-4 py-2 text-sm font-black text-orange-600">Mail</span>
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

      {/* SMS, Push & WhatsApp campaigns */}
      <section className="grid gap-5 xl:grid-cols-3">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-[#F97316]">
              <HiOutlineBell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-950">Notificaciones push</h2>
              <p className="text-xs text-gray-500">Avisos directos a la app, para todos o un usuario.</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setPushAudience('all')} className={`rounded-xl border px-3 py-2 text-xs font-black ${pushAudience === 'all' ? 'border-orange-300 bg-orange-50 text-[#F97316]' : 'border-gray-200 text-gray-500'}`}>Todos</button>
            <button type="button" onClick={() => setPushAudience('user')} className={`rounded-xl border px-3 py-2 text-xs font-black ${pushAudience === 'user' ? 'border-orange-300 bg-orange-50 text-[#F97316]' : 'border-gray-200 text-gray-500'}`}>Usuario</button>
          </div>

          {pushAudience === 'user' && (
            <div className="mt-2 rounded-2xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-3">
              <button
                type="button"
                onClick={() => setPushUserPickerOpen((open) => !open)}
                className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#071827] px-3 py-2 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F97316]/15 text-xs font-black text-[#F97316]">
                  {(selectedPushUser?.name || selectedPushUser?.email || '?').trim().slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-100">{selectedPushUser?.name || 'Seleccionar usuario'}</span>
                  <span className="block truncate text-[11px] text-gray-400">{selectedPushUser?.email || 'Toca para buscar por nombre, email o teléfono'}</span>
                </span>
                <span className="text-xs font-black text-[#F97316]">{pushUserPickerOpen ? 'Cerrar' : 'Buscar'}</span>
              </button>
              {pushUserPickerOpen && (
                <>
                  <input
                    value={pickerSearch.push}
                    onChange={(e) => setPickerSearch((p) => ({ ...p, push: e.target.value }))}
                    placeholder="Buscar por nombre, email o teléfono…"
                    className="mt-2 h-10 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#071827] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
                    autoFocus
                  />
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{filteredPushUsers.length} usuario(s)</span>
                    {pushUserId && (
                      <button
                        type="button"
                        onClick={() => {
                          setPushUserId('');
                          setPickerSearch((p) => ({ ...p, push: '' }));
                        }}
                        className="font-black text-[#F97316]"
                      >
                        Limpiar
                      </button>
                    )}
                  </div>
                  <div className="mt-2 max-h-[336px] overflow-y-auto pr-1 custom-scrollbar">
                    {filteredPushUsers.length === 0 ? (
                      <p className="py-3 text-center text-xs text-gray-500">No encontramos usuarios con ese texto.</p>
                    ) : filteredPushUsers.map((u) => {
                      const selected = pushUserId === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setPushUserId(u.id);
                            setPushUserPickerOpen(false);
                            setPickerSearch((p) => ({ ...p, push: '' }));
                          }}
                          className={`mb-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition ${selected ? 'bg-[#F97316]/15 ring-1 ring-[#F97316]/40' : 'hover:bg-white/5'}`}
                        >
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${selected ? 'bg-[#F97316] text-white' : 'bg-white/10 text-slate-300'}`}>
                            {(u.name || u.email || '?').trim().slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-slate-100">{u.name || u.email}</span>
                            <span className="block truncate text-[11px] text-gray-400">{u.email || u.phone || 'Sin contacto'}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <input
            value={pushTitle}
            onChange={(e) => setPushTitle(e.target.value)}
            maxLength={80}
            placeholder="Título de la notificación"
            className="mt-2 h-11 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          />
          <textarea
            value={pushMessage}
            onChange={(e) => setPushMessage(e.target.value)}
            rows={4}
            maxLength={120}
            placeholder="Mensaje push…"
            className="mt-2 w-full resize-none rounded-2xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-4 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          />
          <div className="mt-1 text-right text-[11px] text-gray-400">{pushMessage.length}/120</div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {([
              ['none', 'Sin destino'],
              ['event', 'Evento'],
              ['external', 'Link'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPushDestination(key)}
                className={`rounded-xl border px-2 py-2 text-[11px] font-black ${pushDestination === key ? 'border-orange-300 bg-orange-50 text-[#F97316]' : 'border-gray-200 text-gray-500'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {pushDestination === 'event' && (
            <select
              value={pushEventId}
              onChange={(e) => setPushEventId(e.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
            >
              <option value="" className="bg-[#0b2236] text-slate-100">Seleccionar evento</option>
              {pushEvents.map((event) => (
                <option key={event.id || event.slug} value={event.id} className="bg-[#0b2236] text-slate-100">{event.title || event.name || 'Evento'}</option>
              ))}
            </select>
          )}

          {pushDestination === 'external' && (
            <input
              value={pushLink}
              onChange={(e) => setPushLink(e.target.value)}
              placeholder="https://tu-link.com"
              className="mt-2 h-11 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
            />
          )}

          <div className="mt-3 rounded-2xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-gray-500">Preview</p>
            <p className="mt-2 truncate text-sm font-black text-slate-100">{pushTitle || 'LPTicket'}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400">{pushMessage || 'Tu notificación se verá así.'}</p>
          </div>

          <button type="button" onClick={handleSendPush} disabled={sending === 'push'} className="btn-primary mt-3 w-full py-3 disabled:opacity-60">
            {sending === 'push' ? 'Enviando…' : 'Enviar push'}
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
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-400">Plantilla:</span>
            <div className="flex rounded-lg border border-[rgba(246,198,95,0.18)] overflow-hidden">
              <button type="button" onClick={() => setWaLang('es')} className={`px-3 py-1 text-xs font-bold ${waLang === 'es' ? 'bg-[#F97316] text-white' : 'text-slate-300'}`}>ES</button>
              <button type="button" onClick={() => setWaLang('en')} className={`px-3 py-1 text-xs font-bold ${waLang === 'en' ? 'bg-[#F97316] text-white' : 'text-slate-300'}`}>EN</button>
            </div>
          </div>
          <select
            value={waAudience}
            onChange={(e) => setWaAudience(e.target.value as 'all' | 'specify')}
            className="mt-2 h-11 w-full rounded-xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] px-3 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          >
            <option value="all" className="bg-[#0b2236] text-slate-100">Enviar a todos los usuarios</option>
            <option value="specify" className="bg-[#0b2236] text-slate-100">Especificar números</option>
          </select>
          {waAudience === 'specify' && renderPicker('whatsapp', 'phone', waSel, setWaSel)}
          <p className="mt-2 text-[11px] text-gray-400">
            Tu texto va en <span className="font-bold text-[#F97316]">{'{{2}}'}</span>. El nombre del cliente se completa solo en <span className="font-bold text-[#F97316]">{'{{1}}'}</span>. Si quieres un enlace, escríbelo dentro del mensaje.
          </p>
          <textarea
            value={whatsappMessage}
            onChange={(e) => setWhatsappMessage(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={waLang === 'es' ? 'Escribe tu mensaje…' : 'Type your message…'}
            className="mt-1 w-full resize-none rounded-2xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] p-4 text-sm text-slate-100 outline-none focus:border-[#F97316]"
          />
          <div className="mt-1 text-right text-[11px] text-gray-400">{whatsappMessage.length}/1000</div>
          {/* WhatsApp-style preview */}
          <div className="mt-2 rounded-2xl bg-[#0b141a] p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Vista previa</p>
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[#075e54]/30 border border-[#25d36633] px-3 py-2 text-[13px] leading-snug text-slate-100 whitespace-pre-wrap">
              {(() => {
                const msg = whatsappMessage || (waLang === 'es' ? 'tu mensaje aquí' : 'your message here');
                const selNames = waAudience === 'specify'
                  ? recipientsList.filter((u) => waSel.includes(u.id)).map((u) => (u.name || '').split(' ')[0]).filter(Boolean)
                  : [];
                const nameToken = selNames.length === 1 ? selNames[0] : (waLang === 'es' ? '[Nombre]' : '[Name]');
                return waLang === 'es'
                  ? `Hola ${nameToken} 👋 ${msg}`
                  : `Hi ${nameToken} 👋 ${msg}`;
              })()}
            </div>
            <p className="mt-1 text-[10px] text-gray-500">Referencial — el marco lo define la plantilla aprobada ({waLang.toUpperCase()}).</p>
          </div>
          <button type="button" onClick={() => handleSendMessaging('whatsapp')} disabled={sending === 'whatsapp'} className="btn-primary mt-2 w-full py-3 disabled:opacity-60">
            {sending === 'whatsapp' ? 'Enviando…' : `Enviar WhatsApp (${waLang.toUpperCase()})`}
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wide text-gray-500">Gestión de banner</h2>
            <p className="mt-1 text-sm text-gray-400">Administra banners y publicidades del carrusel principal.</p>
          </div>
          <div className={`w-fit rounded-full px-4 py-2 text-sm font-black ${bannerStatus === 'active' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-[#F97316]'}`}>
            {bannerStatus === 'active' ? 'Publicado' : 'Borrador'}
          </div>
        </div>

        <div className="p-5">
          <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Qué quieres gestionar</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {([
                { id: 'banner', label: 'Banner' },
                { id: 'ad', label: 'Publicidad' },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const first = marketingBanners.find((banner) => (banner.bannerType === 'ad' ? 'ad' : 'banner') === item.id);
                    if (first) selectMarketingBanner(first);
                    else createNewMarketingBanner(item.id);
                  }}
                  className={`rounded-2xl px-4 py-2 text-sm font-black transition ${bannerType === item.id ? 'bg-[#0A375A] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-200'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() => createNewMarketingBanner(bannerType)}
                className={`min-w-[150px] rounded-2xl border p-3 text-left transition ${!selectedBannerId ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}
              >
                <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-orange-200 bg-orange-50 text-[#F97316]">
                  <HiOutlineUpload className="h-6 w-6" />
                </div>
                <p className="mt-2 text-sm font-black text-gray-950">{bannerType === 'ad' ? 'Nueva publicidad' : 'Nuevo banner'}</p>
                <p className="text-xs font-bold text-gray-400">Subir fotos</p>
              </button>
              {visibleMarketingBanners.map((item, index) => {
                const img = item.imageData || item.imageUrl || '';
                const active = selectedBannerId === item.id;
                const frequency = item.displayMode === 'every3' ? 'Cada 3' : item.displayMode === 'every5' ? 'Cada 5' : 'Una vez';
                return (
                  <button
                    key={item.id || index}
                    type="button"
                    onClick={() => selectMarketingBanner(item)}
                    className={`min-w-[150px] rounded-2xl border p-3 text-left transition ${active ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white hover:border-orange-200'}`}
                  >
                    {img ? (
                      <img src={img} alt="Banner" className="h-16 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="h-16 rounded-xl bg-gray-100" />
                    )}
                    <p className="mt-2 truncate text-sm font-black text-gray-950">{bannerType === 'ad' ? 'Publicidad' : 'Banner'}</p>
                    <p className="text-xs font-bold text-gray-400">{frequency}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_340px]">
            <div className="rounded-3xl bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Escritorio</h3>
                  <p className="text-xs text-gray-400">Banner horizontal para app y web desktop.</p>
                </div>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700">
                  {bannerPreview ? 'Cambiar foto' : 'Subir desde fotos'}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleBannerFile(event.target.files?.[0])} />
              {bannerPreview ? (
                <div className="overflow-hidden rounded-2xl bg-black shadow-sm">
                  <img src={bannerPreview} alt="Preview del banner publicitario" className="aspect-[3.05/1] w-full object-cover" />
                </div>
              ) : (
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex aspect-[3.05/1] w-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white text-sm font-bold text-gray-400">
                  Subir banner horizontal
                </button>
              )}
              {bannerFileName && <p className="mt-3 truncate text-xs font-bold text-gray-500">{bannerFileName}</p>}
            </div>

            <div className="rounded-3xl bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide text-gray-500">Móvil</h3>
                  <p className="text-xs text-gray-400">Flyer vertical para web móvil.</p>
                </div>
                <button type="button" onClick={() => mobileFileInputRef.current?.click()} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-700">
                  {mobileBannerPreview ? 'Cambiar foto' : 'Subir desde fotos'}
                </button>
              </div>
              <input ref={mobileFileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleMobileBannerFile(event.target.files?.[0])} />
              {mobileBannerPreview ? (
                <div className="mx-auto max-w-[220px] overflow-hidden rounded-2xl bg-black shadow-sm">
                  <img src={mobileBannerPreview} alt="Preview movil del banner" className="aspect-[3/4] w-full object-cover" />
                </div>
              ) : (
                <button type="button" onClick={() => mobileFileInputRef.current?.click()} className="mx-auto flex aspect-[3/4] w-full max-w-[220px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white text-sm font-bold text-gray-400">
                  Subir flyer móvil
                </button>
              )}
              {mobileBannerFileName && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-bold text-gray-500">{mobileBannerFileName}</p>
                  <button type="button" onClick={removeMobileBanner} className="text-xs font-black text-red-500">Borrar móvil</button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-gray-500">Frecuencia en el carrusel</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {([
                { id: 'once', label: 'Una vez' },
                { id: 'every3', label: 'Cada 3' },
                { id: 'every5', label: 'Cada 5' },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBannerDisplayMode(item.id)}
                  className={`rounded-2xl px-4 py-3 text-sm font-black transition ${bannerDisplayMode === item.id ? 'bg-[#0A375A] text-white' : 'border border-gray-200 bg-white text-gray-600 hover:border-orange-200'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={publishBanner} disabled={!bannerPreview} className="rounded-2xl bg-[#0A375A] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {selectedBannerId ? 'Guardar cambios' : 'Publicar banner'}
              </button>
              <button type="button" onClick={removeBanner} disabled={!bannerPreview && !selectedBannerId} className="rounded-2xl border border-red-100 bg-red-50 px-5 py-3 text-sm font-black text-red-500 disabled:cursor-not-allowed disabled:opacity-40">
                Borrar escritorio
              </button>
            </div>
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

      {confirmModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl border border-[rgba(246,198,95,0.18)] bg-[#0b2236] shadow-[0_30px_80px_rgba(0,0,0,0.6)] animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <div className="public-premium-icon flex h-10 w-10 shrink-0 items-center justify-center">
                <HiOutlineSpeakerphone className="h-5 w-5" />
              </div>
              <h3 className="text-base font-black text-white">{confirmModal.title}</h3>
            </div>
            <p className="px-5 py-5 text-sm leading-6 text-slate-300">{confirmModal.message}</p>
            <div className="flex gap-3 px-5 pb-5">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className="btn-primary flex-1 px-4 py-3 text-sm"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
