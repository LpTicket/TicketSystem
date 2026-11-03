'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineBell, HiOutlineCheck, HiOutlineExclamationCircle, HiOutlineMail, HiOutlineSearch, HiOutlineShieldCheck, HiOutlineDeviceMobile, HiOutlineChatAlt2, HiOutlineRefresh } from 'react-icons/hi';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import styles from './notifications.module.css';

type Channel = 'email' | 'sms' | 'whatsapp' | 'push';
type Audience = 'client' | 'organizer' | 'admin';
type NotificationItem = {
  key: string; group: string; channel: Channel; audience: Audience;
  title: string; titleEn: string; description: string; descriptionEn: string;
  enabled: boolean; warning?: boolean;
};
type Settings = { version: number; updatedAt: string; items: NotificationItem[] };

const channels = [
  { id: 'email', es: 'Correo electrónico', en: 'Email', icon: HiOutlineMail },
  { id: 'sms', es: 'SMS', en: 'SMS', icon: HiOutlineDeviceMobile },
  { id: 'whatsapp', es: 'WhatsApp', en: 'WhatsApp', icon: HiOutlineChatAlt2 },
  { id: 'push', es: 'Push', en: 'Push', icon: HiOutlineBell },
] as const;
const groups = [
  { id: 'accounts', es: 'Cuentas y acceso', en: 'Accounts and access', detailEs: 'Cada momento de la relación con tus usuarios.', detailEn: 'Every moment of your relationship with users.' },
  { id: 'sales', es: 'Ventas y tickets', en: 'Sales and tickets', detailEs: 'Entradas, comprobantes y copias para tu equipo.', detailEn: 'Tickets, receipts and copies for your team.' },
  { id: 'events', es: 'Eventos y organizadores', en: 'Events and organizers', detailEs: 'Desde la aprobación hasta el reporte final.', detailEn: 'From approval to the final report.' },
  { id: 'support', es: 'Contacto y soporte', en: 'Contact and support', detailEs: 'Las consultas que llegan a administración.', detailEn: 'Inquiries received by administration.' },
  { id: 'campaigns', es: 'Marketing y campañas', en: 'Marketing and campaigns', detailEs: 'Control de envíos para cada canal de comunicación.', detailEn: 'Delivery controls for every communication channel.' },
];

export default function NotificationsPage() {
  const { lang } = useLang();
  const es = lang === 'es';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [audience, setAudience] = useState<Audience | 'all'>('all');

  const load = useCallback(() => api.get<Settings>('/admin/notifications')
    .then(({ data }) => {
      setSettings(data); setDraft({}); setError(''); setSaveError('');
    }).catch(() => {
      setError('load');
    }).finally(() => { setLoading(false); }), []);

  const reload = () => { setLoading(true); setError(''); setSaveError(''); void load(); };

  useEffect(() => { void load(); }, [load]);
  const items = settings?.items || [];
  const enabled = (item: NotificationItem) => draft[item.key] ?? item.enabled;
  const changes = items.filter((item) => enabled(item) !== item.enabled);
  const dirty = changes.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const audienceLabel = (value: Audience) => ({ client: es ? 'Cliente' : 'Customer', organizer: es ? 'Organizador' : 'Organizer', admin: es ? 'Administración' : 'Administration' })[value];
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = items.filter((item) => (channel === 'all' || channel === item.channel)
    && (audience === 'all' || audience === item.audience)
    && normalize(`${es ? item.title : item.titleEn} ${es ? item.description : item.descriptionEn} ${audienceLabel(item.audience)} ${item.channel}`).includes(normalize(search.trim())));
  const activeCount = items.filter((item) => item.enabled).length;
  const criticalChanges = changes.filter((item) => item.warning && !enabled(item));

  const setVisible = (value: boolean) => {
    setDraft((current) => ({ ...current, ...Object.fromEntries(visible.map((item) => [item.key, value])) }));
    setSaveError('');
  };

  const save = async () => {
    if (!settings || !dirty || saving) return;
    setSaving(true); setSaveError('');
    try {
      const { data } = await api.patch<Settings>('/admin/notifications', {
        version: settings.version,
        changes: changes.map((item) => ({ key: item.key, enabled: enabled(item) })),
      });
      setSettings(data); setDraft({});
      toast.success(es ? 'Configuración de notificaciones guardada' : 'Notification settings saved');
    } catch (error: unknown) {
      const status = (error as { response?: { status?: number } }).response?.status;
      setSaveError(status === 409
        ? (es ? 'Otro administrador guardó cambios. Descarta tu edición y recarga la configuración antes de continuar.' : 'Another administrator saved changes. Discard your edits and reload settings to continue.')
        : (es ? 'No se guardaron los cambios. Puedes volver a intentarlo.' : 'Changes were not saved. You can try again.'));
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="notifications-title">
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}><HiOutlineBell aria-hidden="true" />{es ? 'CENTRO DE COMUNICACIÓN' : 'COMMUNICATION CENTER'}</div>
          <h1 id="notifications-title" className={styles.title}>{es ? 'Notificaciones' : 'Notifications'}</h1>
          <p>{es ? 'Tú decides qué se envía. Un solo lugar para controlar cada aviso de LPTicket.' : 'You decide what gets sent. One place to control every LPTicket notification.'}</p>
        </div>
        <div className={styles.adminBadge}><HiOutlineShieldCheck aria-hidden="true" /><span>{es ? 'Solo administración' : 'Administration only'}<small>{es ? 'Configuración global de la plataforma' : 'Platform-wide settings'}</small></span></div>
      </section>

      {loading ? <div className={styles.state} role="status"><HiOutlineRefresh className="animate-spin" />{es ? 'Cargando notificaciones…' : 'Loading notifications…'}</div>
        : error ? <div className={styles.state} role="alert"><HiOutlineExclamationCircle /><p>{es ? 'No se pudo cargar la configuración. Verifica que el backend y la tabla de notificaciones estén preparados.' : 'Could not load settings. Check that the backend and notification table are ready.'}</p><button type="button" className={styles.secondary} onClick={reload}>{es ? 'Reintentar' : 'Retry'}</button></div>
        : settings && <>
          <div className={styles.stats}>
            <div><span>{es ? 'Tipos de notificación' : 'Notification types'}</span><strong>{items.length}</strong><small>{es ? 'Todos tus avisos, en un lugar' : 'All your notifications, in one place'}</small></div>
            <div><span className={styles.dotLabel}><i className={styles.activeDot} />{es ? 'Activadas' : 'Enabled'}</span><strong>{activeCount}</strong><small>{es ? 'Habilitadas en la configuración guardada' : 'Enabled in saved settings'}</small></div>
            <div><span className={styles.dotLabel}><i />{es ? 'Desactivadas' : 'Disabled'}</span><strong>{items.length - activeCount}</strong><small>{es ? 'Pausadas por configuración' : 'Paused in settings'}</small></div>
            <div><span>{es ? 'Canales' : 'Channels'}</span><strong>4</strong><small>{es ? 'Correo · SMS · WhatsApp · Push' : 'Email · SMS · WhatsApp · Push'}</small></div>
          </div>

          <div className={styles.notice}><HiOutlineShieldCheck aria-hidden="true" /><p>{es ? 'Estos controles se aplican a toda la plataforma, tanto web como app. Activar un aviso permite su envío cuando ocurra la acción correspondiente y el canal esté configurado.' : 'These controls apply across the website and app. Enabling a notification allows delivery when its trigger occurs and the channel is configured.'}</p></div>

          <section className={styles.catalog} aria-label={es ? 'Catálogo de notificaciones' : 'Notification catalog'}>
            <div className={styles.toolbar}>
              <div><h2>{es ? 'Tus notificaciones' : 'Your notifications'}</h2><p>{es ? 'Personaliza cada punto de contacto.' : 'Customize every point of contact.'}</p></div>
              <label className={styles.search}><HiOutlineSearch aria-hidden="true" /><span className="sr-only">{es ? 'Buscar notificación' : 'Search notifications'}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={es ? 'Buscar notificación…' : 'Search notifications…'} /></label>
            </div>
            <div className={styles.filters}>
              <div className={styles.tabs} role="group" aria-label={es ? 'Filtrar por canal' : 'Filter by channel'}>
                <button type="button" aria-pressed={channel === 'all'} onClick={() => setChannel('all')}>{es ? 'Todas' : 'All'}<span>{items.length}</span></button>
                {channels.map((entry) => <button key={entry.id} type="button" aria-pressed={channel === entry.id} onClick={() => setChannel(entry.id)}><entry.icon aria-hidden="true" />{es ? entry.es : entry.en}<span>{items.filter((item) => item.channel === entry.id).length}</span></button>)}
              </div>
              <label className={styles.audience}><span className="sr-only">{es ? 'Filtrar por destinatario' : 'Filter by recipient'}</span><select value={audience} onChange={(event) => setAudience(event.target.value as Audience | 'all')}><option value="all">{es ? 'Todos los destinatarios' : 'All recipients'}</option>{(['client', 'organizer', 'admin'] as const).map((entry) => <option key={entry} value={entry}>{audienceLabel(entry)}</option>)}</select></label>
            </div>
            <div className={styles.bulk}><span>{visible.length} {es ? (visible.length === 1 ? 'notificación' : 'notificaciones') : (visible.length === 1 ? 'notification' : 'notifications')}</span><div><button type="button" disabled={saving || !visible.length} onClick={() => setVisible(true)}>{es ? 'Activar visibles' : 'Enable visible'}</button><button type="button" disabled={saving || !visible.length} onClick={() => setVisible(false)}>{es ? 'Desactivar visibles' : 'Disable visible'}</button></div></div>

            {groups.map((group) => {
              const entries = visible.filter((item) => item.group === group.id);
              if (!entries.length) return null;
              return <section key={group.id} className={styles.group} aria-labelledby={`group-${group.id}`}>
                <header className={styles.groupHeader}><div><h3 id={`group-${group.id}`}>{es ? group.es : group.en}</h3><p>{es ? group.detailEs : group.detailEn}</p></div><span>{entries.length.toString().padStart(2, '0')}</span></header>
                {entries.map((item) => {
                  const Icon = channels.find((entry) => entry.id === item.channel)!.icon;
                  const changed = enabled(item) !== item.enabled;
                  return <div key={item.key} className={styles.row} data-changed={changed}>
                    <div className={styles.channelIcon}><Icon aria-hidden="true" /></div>
                    <div className={styles.rowCopy}>
                      <div className={styles.rowTitle}><h4 id={`title-${item.key}`}>{es ? item.title : item.titleEn}</h4>{changed && <span className={styles.pending}>{es ? 'Sin guardar' : 'Unsaved'}</span>}</div>
                      <p id={`description-${item.key}`}>{es ? item.description : item.descriptionEn}</p>
                      <div className={styles.tags}><span>{audienceLabel(item.audience)}</span><span>{item.channel === 'email' ? (es ? 'Correo' : 'Email') : item.channel === 'sms' ? 'SMS' : item.channel === 'whatsapp' ? 'WhatsApp' : 'Push'}</span>{item.warning && <span className={styles.important}>{es ? 'Aviso esencial' : 'Essential notification'}</span>}</div>
                    </div>
                    <div className={styles.toggleWrap}><span>{enabled(item) ? (es ? 'Activada' : 'Enabled') : (es ? 'Desactivada' : 'Disabled')}</span><button type="button" role="switch" aria-checked={enabled(item)} aria-labelledby={`title-${item.key}`} aria-describedby={`description-${item.key}`} disabled={saving} className={styles.switch} onClick={() => { setDraft((current) => ({ ...current, [item.key]: !enabled(item) })); setSaveError(''); }}><span>{enabled(item) && <HiOutlineCheck aria-hidden="true" />}</span></button></div>
                  </div>;
                })}
              </section>;
            })}
            {!visible.length && <div className={styles.state}><HiOutlineSearch /><p>{es ? 'No hay notificaciones con estos filtros.' : 'No notifications match these filters.'}</p><button type="button" className={styles.secondary} onClick={() => { setSearch(''); setChannel('all'); setAudience('all'); }}>{es ? 'Limpiar filtros' : 'Clear filters'}</button></div>}
          </section>

          {criticalChanges.length > 0 && <div className={styles.warning} role="alert"><HiOutlineExclamationCircle aria-hidden="true" /><div><strong>{es ? 'Vas a desactivar avisos esenciales' : 'You are disabling essential notifications'}</strong><p>{criticalChanges.map((item) => es ? item.title : item.titleEn).join(' · ')}. {es ? 'Al guardar, los usuarios dejarán de recibir estos correos, incluso si los solicitan.' : 'After saving, users will no longer receive these emails, even when requested.'}</p></div></div>}
          {saveError && <div className={styles.warning} role="alert"><HiOutlineExclamationCircle aria-hidden="true" /><p>{saveError}</p></div>}
          <div className={styles.saveBar}>
            <div role="status" aria-live="polite"><span className={styles.saveStatus}>{dirty ? <HiOutlineBell aria-hidden="true" /> : <HiOutlineCheck aria-hidden="true" />}{dirty ? `${changes.length} ${es ? (changes.length === 1 ? 'cambio sin guardar' : 'cambios sin guardar') : (changes.length === 1 ? 'unsaved change' : 'unsaved changes')}` : (es ? 'Configuración al día' : 'Settings up to date')}</span><small>{dirty ? (es ? 'Se aplicarán cuando guardes.' : 'Changes apply when you save.') : `${es ? 'Última actualización: ' : 'Last updated: '}${new Date(settings.updatedAt).toLocaleString(es ? 'es-US' : 'en-US')}`}</small></div>
            <div className={styles.saveActions}><button type="button" className={styles.secondary} disabled={saving || (!dirty && !saveError)} onClick={() => { if (saveError) reload(); else { setDraft({}); setSaveError(''); } }}>{saveError ? (es ? 'Descartar y recargar' : 'Discard and reload') : (es ? 'Descartar' : 'Discard')}</button><button type="button" className={styles.primary} disabled={!dirty || saving} onClick={() => void save()}>{saving ? <HiOutlineRefresh className="animate-spin" aria-hidden="true" /> : <HiOutlineCheck aria-hidden="true" />}{saving ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Guardar cambios' : 'Save changes')}</button></div>
          </div>
          <p className={styles.footnote}>{es ? 'Los cambios afectan a los próximos envíos. No recuperan mensajes omitidos ni retiran mensajes ya enviados o aceptados por un proveedor. Las preferencias de cada evento y la disponibilidad de los proveedores también se respetan.' : 'Changes affect future sends. They do not recover skipped messages or recall messages already sent or accepted by a provider. Event settings and provider availability still apply.'}</p>
        </>}
    </div>
  );
}
