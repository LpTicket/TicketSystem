import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { MarketingBanner } from './marketing-banner.entity';
import { User } from '../database/entities/user.entity';
import { MailService } from '../common/services/mail.service';

type CampaignResult = { sent: number; failed: number; total: number; error?: string };

@Injectable()
export class MarketingService {
  constructor(
    @InjectRepository(MarketingBanner)
    private readonly bannerRepo: Repository<MarketingBanner>,
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
    return { sent, failed, total: phones.length, error: failed > 0 && sent === 0 ? lastError.slice(0, 300) : undefined };
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

  async getActiveHomeBanner() {
    const desktop = await this.bannerRepo.findOne({
      where: { placement: 'home', isActive: true },
      order: { updatedAt: 'DESC' },
    });

    if (!desktop) return null;

    const mobile = await this.bannerRepo.findOne({
      where: { placement: 'home-mobile', isActive: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      ...desktop,
      mobileImageData: mobile?.imageData || null,
      mobileFileName: mobile?.fileName || null,
    };
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
