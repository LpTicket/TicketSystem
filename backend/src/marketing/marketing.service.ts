/**
 * MarketingService
 * EN: Home banners (desktop/mobile), and email / SMS / WhatsApp / push
 *     campaigns to recipient lists, plus push-token registration and the
 *     transactional welcome messages used on registration.
 * ES: Banners de inicio (escritorio/móvil) y campañas de email / SMS / WhatsApp
 *     / push a listas de destinatarios, además del registro de tokens de push y
 *     los mensajes de bienvenida transaccionales del registro.
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MarketingBanner } from './marketing-banner.entity';
import { PushToken } from './push-token.entity';
import { User } from '../database/entities/user.entity';
import { MailService } from '../common/services/mail.service';

type CampaignResult = { sent: number; failed: number; total: number; error?: string };

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingBanner)
    private readonly bannerRepo: Repository<MarketingBanner>,
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Active users we can reach (have an email/phone). */
  private async getRecipients() {
    return this.userRepo.find({
      where: { isActive: true },
      select: ['id', 'email', 'phone', 'firstName'],
    });
  }

  /** Public list (admin) for the recipient picker: name + email + phone. */
  async getRecipientsList() {
    const users = await this.userRepo.find({
      where: { isActive: true },
      select: ['id', 'firstName', 'lastName', 'email', 'phone'],
      order: { firstName: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
      email: u.email || '',
      phone: (u.phone || '').trim(),
    }));
  }

  async registerPushToken(userId: string, dto: { token?: string; platform?: string }) {
    const token = String(dto?.token || '').trim();
    if (!token || !token.startsWith('ExponentPushToken[')) {
      throw new BadRequestException('Token push inválido');
    }

    const existing = await this.pushTokenRepo.findOne({ where: { token } });
    const next = existing
      ? this.pushTokenRepo.merge(existing, { userId, platform: dto.platform || existing.platform, isActive: true })
      : this.pushTokenRepo.create({ token, userId, platform: dto.platform || 'unknown', provider: 'expo', isActive: true });

    const saved = await this.pushTokenRepo.save(next);
    return { ok: true, id: saved.id };
  }

  async sendPushCampaign(dto: {
    title?: string;
    message?: string;
    audience?: 'all' | 'user';
    userId?: string;
    link?: string;
    data?: Record<string, unknown>;
  }) {
    const title = String(dto?.title || '').trim();
    const message = String(dto?.message || '').trim();
    const link = String(dto?.link || '').trim();
    if (!title || !message) throw new BadRequestException('Título y mensaje son obligatorios');
    if (dto.audience === 'user' && !dto.userId) throw new BadRequestException('Selecciona un usuario');
    if (link && !/^https?:\/\//i.test(link) && !/^lpticket:\/\//i.test(link)) {
      throw new BadRequestException('Link push inválido');
    }

    const where = dto.audience === 'user'
      ? { isActive: true, userId: dto.userId }
      : { isActive: true };
    const tokens = await this.pushTokenRepo.find({ where });
    const uniqueTokens = Array.from(new Set(tokens.map((entry) => entry.token).filter(Boolean)));

    if (uniqueTokens.length === 0) {
      return { sent: 0, failed: 0, total: 0, error: 'No hay dispositivos con push activo para esta audiencia.' };
    }

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueTokens.length; i += 100) chunks.push(uniqueTokens.slice(i, i + 100));

    let sent = 0;
    let failed = 0;
    let lastError = '';
    const httpFetch: typeof fetch = (globalThis as any).fetch;

    for (const chunk of chunks) {
      const messages = chunk.map((to) => ({
        to,
        title,
        body: message,
        sound: 'default',
        data: { ...(dto.data || {}), ...(link ? { url: link, link } : {}) },
      }));
      try {
        const res = await httpFetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });
        const json: any = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.errors?.[0]?.message || `Expo push failed (${res.status})`);

        const receipts = Array.isArray(json?.data) ? json.data : [];
        receipts.forEach((receipt: any) => {
          if (receipt?.status === 'ok') sent++;
          else {
            failed++;
            lastError = receipt?.message || lastError;
          }
        });
      } catch (e: any) {
        failed += chunk.length;
        lastError = e?.message || String(e);
      }
    }

    return { sent, failed, total: uniqueTokens.length, error: failed > 0 ? lastError.slice(0, 300) : undefined };
  }

  /** Send an email marketing campaign — to all active users, or to an explicit
   *  list of emails when `recipients` is provided. */
  async sendEmailCampaign(dto: {
    subject?: string; title?: string; preheader?: string; imageData?: string | null; link?: string;
    recipients?: string[];
  }): Promise<CampaignResult> {
    let targets: { email: string }[];
    if (dto.recipients && dto.recipients.length) {
      targets = dto.recipients.map((e) => ({ email: String(e).trim() })).filter((t) => t.email);
    } else {
      const users = await this.getRecipients();
      targets = users.filter((u) => u.email).map((u) => ({ email: u.email }));
    }
    let sent = 0, failed = 0;
    for (const u of targets) {
      try {
        await this.mailService.sendMarketingEmail(u.email, {
          subject: dto.subject || dto.title || 'LP Ticket',
          title: dto.title,
          preheader: dto.preheader,
          imageData: dto.imageData,
          link: dto.link,
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return { sent, failed, total: targets.length };
  }

  /** Normalize a phone to E.164. Assumes US (+1) when no country code is given. */
  private normalizePhone(raw: string): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (trimmed.startsWith('+')) {
      const digits = trimmed.slice(1).replace(/\D/g, '');
      return digits.length >= 8 ? `+${digits}` : null;
    }
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;            // US 10-digit
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`; // 1XXXXXXXXXX
    if (digits.length >= 8) return `+${digits}`;               // already has country code
    return null;
  }

  /** Send a Twilio message (SMS or WhatsApp) via the REST API (no SDK).
   *  For WhatsApp it can use an approved Content template (contentSid + variables). */
  private async sendTwilioMessage(
    to: string,
    channel: 'sms' | 'whatsapp',
    opts: { body?: string; contentSid?: string; contentVariables?: Record<string, string> },
  ) {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromSms = this.config.get<string>('TWILIO_SMS_FROM');
    const fromWa = this.config.get<string>('TWILIO_WHATSAPP_FROM');
    if (!sid || !token) throw new Error('NOT_CONFIGURED');
    const from = channel === 'whatsapp' ? `whatsapp:${fromWa}` : fromSms;
    const toAddr = channel === 'whatsapp' ? `whatsapp:${to}` : to;
    const params = new URLSearchParams({ To: toAddr, From: from || '' });
    if (opts.contentSid) {
      params.set('ContentSid', opts.contentSid);
      if (opts.contentVariables) params.set('ContentVariables', JSON.stringify(opts.contentVariables));
    } else {
      params.set('Body', opts.body || '');
    }
    const httpFetch: typeof fetch = (globalThis as any).fetch;
    const res = await httpFetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) throw new Error(await res.text());
  }

  private async sendMessagingCampaign(
    message: string,
    channel: 'sms' | 'whatsapp',
    recipients?: string[],
    lang?: 'es' | 'en',
  ): Promise<CampaignResult> {
    if (!message?.trim()) throw new BadRequestException('El mensaje es obligatorio');
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      return { sent: 0, failed: 0, total: 0, error: 'Twilio no está configurado (faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).' };
    }

    // WhatsApp business-initiated messages need an approved Content template.
    const contentSid = channel === 'whatsapp'
      ? this.config.get<string>(lang === 'en' ? 'TWILIO_WHATSAPP_CONTENT_SID_EN' : 'TWILIO_WHATSAPP_CONTENT_SID_ES')
      : undefined;

    // Build {phone, name} targets (name fills template variable {{1}}).
    const users = await this.getRecipients();
    const nameByPhone = new Map<string, string>();
    users.forEach((u) => {
      const p = u.phone && this.normalizePhone(u.phone);
      if (p) nameByPhone.set(p, u.firstName || '');
    });

    let rawPhones: string[];
    if (recipients && recipients.length) {
      rawPhones = recipients.map((p) => String(p));
    } else {
      rawPhones = users.filter((u) => u.phone && u.phone.trim()).map((u) => u.phone);
    }
    const phones = Array.from(
      new Set(rawPhones.map((p) => this.normalizePhone(p)).filter((p): p is string => !!p)),
    );

    if (channel === 'whatsapp' && !contentSid) {
      return { sent: 0, failed: 0, total: phones.length, error: `Falta el ContentSid de WhatsApp (TWILIO_WHATSAPP_CONTENT_SID_${lang === 'en' ? 'EN' : 'ES'}).` };
    }

    let sent = 0, failed = 0;
    let lastError = '';
    for (const phone of phones) {
      try {
        if (channel === 'whatsapp' && contentSid) {
          await this.sendTwilioMessage(phone, channel, {
            contentSid,
            contentVariables: { '1': nameByPhone.get(phone) || (lang === 'en' ? 'there' : 'hola'), '2': message },
          });
        } else {
          await this.sendTwilioMessage(phone, channel, { body: message });
        }
        sent++;
      } catch (e: any) {
        failed++;
        // Surface Twilio's reason — extract the readable message from its JSON error.
        const raw = e?.message || String(e);
        try {
          const parsed = JSON.parse(raw);
          lastError = `${parsed.message || raw}${parsed.code ? ` (code ${parsed.code})` : ''}`;
        } catch {
          lastError = raw;
        }
      }
    }
    return { sent, failed, total: phones.length, error: failed > 0 ? lastError.slice(0, 300) : undefined };
  }

  sendSmsCampaign(message: string, recipients?: string[]) {
    return this.sendMessagingCampaign(message, 'sms', recipients);
  }

  sendWhatsappCampaign(message: string, recipients?: string[], lang?: 'es' | 'en') {
    return this.sendMessagingCampaign(message, 'whatsapp', recipients, lang);
  }

  /** Fire-and-forget welcome WhatsApp (Utility template) sent right after a user
   *  registers. Uses TWILIO_WHATSAPP_WELCOME_SID. Never throws — registration must
   *  not fail because messaging is down or unconfigured. */
  async sendWelcomeWhatsapp(rawPhone: string, firstName?: string, lang?: 'es' | 'en'): Promise<void> {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    // Pick the language-specific welcome template, falling back to the single SID.
    const langSid = this.config.get<string>(
      lang === 'en' ? 'TWILIO_WHATSAPP_WELCOME_SID_EN' : 'TWILIO_WHATSAPP_WELCOME_SID_ES',
    );
    const contentSid = langSid || this.config.get<string>('TWILIO_WHATSAPP_WELCOME_SID');
    if (!sid || !token || !contentSid) return; // not configured — skip silently
    const phone = this.normalizePhone(rawPhone || '');
    if (!phone) return;
    try {
      await this.sendTwilioMessage(phone, 'whatsapp', {
        contentSid,
        contentVariables: { '1': firstName || (lang === 'en' ? 'there' : 'hola') },
      });
    } catch (e: any) {
      console.error('Welcome WhatsApp failed:', e?.message || e);
    }
  }

  private parseImageData(imageData: string | null | undefined) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(String(imageData || '').trim());
    if (!match) return null;
    return { mimeType: match[1], buffer: Buffer.from(match[2], 'base64') };
  }

  private bannerImageUrl(banner: MarketingBanner, variant: 'desktop' | 'mobile' = 'desktop') {
    const stamp = encodeURIComponent(String(banner.updatedAt?.getTime?.() || banner.id));
    return `/api/marketing/banner/home/image?id=${encodeURIComponent(banner.id)}&variant=${variant}&v=${stamp}`;
  }

  private serializeHomeBanner(banner: MarketingBanner, includeData = false) {
    const hasMobileImage = Boolean(banner.mobileImageData);
    const base: any = {
      id: banner.id,
      placement: banner.placement,
      title: banner.title,
      fileName: banner.fileName,
      mobileFileName: banner.mobileFileName,
      bannerType: banner.bannerType || 'banner',
      displayMode: banner.displayMode || 'once',
      sortOrder: banner.sortOrder || 0,
      linkUrl: banner.linkUrl || null,
      isActive: banner.isActive,
      createdAt: banner.createdAt,
      updatedAt: banner.updatedAt,
      imageUrl: this.bannerImageUrl(banner, 'desktop'),
      mobileImageUrl: hasMobileImage ? this.bannerImageUrl(banner, 'mobile') : null,
    };

    if (includeData) {
      base.imageData = banner.imageData;
      base.mobileImageData = banner.mobileImageData || null;
    }

    return base;
  }

  async getActiveHomeBanner(includeData = false) {
    const desktop = await this.bannerRepo.findOne({
      where: { placement: 'home', isActive: true },
      order: { sortOrder: 'ASC', updatedAt: 'DESC' },
    });

    if (!desktop) return null;

    const mobile = await this.bannerRepo.findOne({
      where: { placement: 'home-mobile', isActive: true },
      order: { updatedAt: 'DESC' },
    });

    const imageUrl = this.bannerImageUrl(desktop, 'desktop');
    const mobileImageUrl = mobile
      ? `/api/marketing/banner/home/image?variant=mobile&v=${encodeURIComponent(String(mobile.updatedAt?.getTime?.() || mobile.id))}`
      : null;

    if (includeData) {
      return {
        ...this.serializeHomeBanner(desktop, true),
        imageUrl,
        mobileImageData: desktop.mobileImageData || mobile?.imageData || null,
        mobileImageUrl,
        mobileFileName: desktop.mobileFileName || mobile?.fileName || null,
      };
    }

    return {
      ...this.serializeHomeBanner(desktop, false),
      imageUrl,
      mobileImageUrl,
      mobileFileName: desktop.mobileFileName || mobile?.fileName || null,
    };
  }

  async getHomeBanners(includeData = false) {
    const banners = await this.bannerRepo.find({
      where: { placement: 'home', isActive: true },
      order: { sortOrder: 'ASC', updatedAt: 'DESC' },
    });
    return banners.map((banner) => this.serializeHomeBanner(banner, includeData));
  }

  async getHomeBannerImage(variant: 'desktop' | 'mobile' = 'desktop', id?: string) {
    const banner = id
      ? await this.bannerRepo.findOne({ where: { id, isActive: true } })
      : await this.bannerRepo.findOne({
        where: { placement: variant === 'mobile' ? 'home-mobile' : 'home', isActive: true },
        order: { sortOrder: 'ASC', updatedAt: 'DESC' },
      });
    const image = this.parseImageData(variant === 'mobile' ? (banner?.mobileImageData || banner?.imageData) : banner?.imageData);
    if (!banner || !image) throw new BadRequestException('Banner no disponible');
    return image;
  }

  async saveHomeBanner(data: { imageData: string; fileName?: string; mobileImageData?: string | null; mobileFileName?: string | null }) {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    await this.bannerRepo.update(
      { placement: 'home-mobile', isActive: true },
      { isActive: false },
    );

    const banner = this.bannerRepo.create({
      placement: 'home',
        title: 'Banner Home',
        imageData: data.imageData,
        fileName: data.fileName || 'banner-home',
        mobileImageData: data.mobileImageData || null,
        mobileFileName: data.mobileFileName || null,
        bannerType: 'banner',
        displayMode: 'once',
        isActive: true,
      });

    const savedDesktop = await this.bannerRepo.save(banner);

    if (data.mobileImageData) {
      const mobileBanner = this.bannerRepo.create({
        placement: 'home-mobile',
        title: 'Banner Home Mobile',
        imageData: data.mobileImageData,
        fileName: data.mobileFileName || 'banner-home-mobile',
        isActive: true,
      });

      await this.bannerRepo.save(mobileBanner);
    }

    return savedDesktop;
  }

  async saveHomeBannerItem(data: {
    id?: string;
    title?: string;
    imageData: string;
    fileName?: string;
    mobileImageData?: string | null;
    mobileFileName?: string | null;
    bannerType?: string;
    displayMode?: string;
    sortOrder?: number;
    linkUrl?: string | null;
    isActive?: boolean;
  }) {
    const displayMode = ['once', 'every3', 'every5'].includes(data.displayMode || '') ? data.displayMode : 'once';
    const bannerType = data.bannerType === 'ad' ? 'ad' : 'banner';
    const payload = {
      placement: 'home',
      title: data.title?.trim() || (bannerType === 'ad' ? 'Publicidad Home' : 'Banner Home'),
      imageData: data.imageData,
      fileName: data.fileName || 'banner-home',
      mobileImageData: data.mobileImageData || null,
      mobileFileName: data.mobileFileName || null,
      bannerType,
      displayMode,
      sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
      linkUrl: data.linkUrl?.trim() || null,
      isActive: data.isActive !== false,
    };

    if (data.id) {
      await this.bannerRepo.update({ id: data.id }, payload);
      const updated = await this.bannerRepo.findOne({ where: { id: data.id } });
      if (updated) return this.serializeHomeBanner(updated, true);
    }

    const saved = await this.bannerRepo.save(this.bannerRepo.create(payload));
    return this.serializeHomeBanner(saved, true);
  }

  async updateHomeBannerItem(id: string, data: Partial<{
    title: string;
    imageData: string;
    fileName: string;
    mobileImageData: string | null;
    mobileFileName: string | null;
    bannerType: string;
    displayMode: string;
    sortOrder: number;
    linkUrl: string | null;
    isActive: boolean;
  }>) {
    const next: any = {};
    if (typeof data.title === 'string') next.title = data.title.trim() || 'Banner Home';
    if (typeof data.imageData === 'string') next.imageData = data.imageData;
    if (typeof data.fileName === 'string') next.fileName = data.fileName;
    if ('mobileImageData' in data) next.mobileImageData = data.mobileImageData || null;
    if ('mobileFileName' in data) next.mobileFileName = data.mobileFileName || null;
    if (data.bannerType) next.bannerType = data.bannerType === 'ad' ? 'ad' : 'banner';
    if (data.displayMode) next.displayMode = ['once', 'every3', 'every5'].includes(data.displayMode) ? data.displayMode : 'once';
    if (data.sortOrder !== undefined) next.sortOrder = Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0;
    if ('linkUrl' in data) next.linkUrl = data.linkUrl?.trim() || null;
    if (typeof data.isActive === 'boolean') next.isActive = data.isActive;

    await this.bannerRepo.update({ id }, next);
    const updated = await this.bannerRepo.findOne({ where: { id } });
    if (!updated) throw new BadRequestException('Banner no disponible');
    return this.serializeHomeBanner(updated, true);
  }

  async removeHomeBannerItem(id: string) {
    await this.bannerRepo.update({ id }, { isActive: false });
    return { ok: true };
  }

  async removeHomeBanner() {
    await this.bannerRepo.update(
      { placement: 'home', isActive: true },
      { isActive: false },
    );

    return { ok: true };
  }

  async removeHomeMobileBanner() {
    await this.bannerRepo.update(
      { placement: 'home-mobile', isActive: true },
      { isActive: false },
    );

    return { ok: true };
  }
}
