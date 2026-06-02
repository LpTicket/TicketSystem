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

  /** Send a Twilio message (SMS or WhatsApp) using the REST API (no SDK). */
  private async sendTwilioMessage(to: string, body: string, channel: 'sms' | 'whatsapp') {
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    const fromSms = this.config.get<string>('TWILIO_SMS_FROM');
    const fromWa = this.config.get<string>('TWILIO_WHATSAPP_FROM');
    if (!sid || !token) throw new Error('NOT_CONFIGURED');
    const from = channel === 'whatsapp' ? `whatsapp:${fromWa}` : fromSms;
    const toAddr = channel === 'whatsapp' ? `whatsapp:${to}` : to;
    const params = new URLSearchParams({ To: toAddr, From: from || '', Body: body });
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

  private async sendMessagingCampaign(message: string, channel: 'sms' | 'whatsapp', recipients?: string[]): Promise<CampaignResult> {
    if (!message?.trim()) throw new BadRequestException('El mensaje es obligatorio');
    const sid = this.config.get<string>('TWILIO_ACCOUNT_SID');
    const token = this.config.get<string>('TWILIO_AUTH_TOKEN');
    if (!sid || !token) {
      return { sent: 0, failed: 0, total: 0, error: 'Twilio no está configurado (faltan TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).' };
    }
    let phones: string[];
    if (recipients && recipients.length) {
      phones = recipients.map((p) => String(p).trim()).filter(Boolean);
    } else {
      const users = await this.getRecipients();
      phones = users.filter((u) => u.phone && u.phone.trim()).map((u) => u.phone.trim());
    }
    let sent = 0, failed = 0;
    for (const phone of phones) {
      try {
        await this.sendTwilioMessage(phone, message, channel);
        sent++;
      } catch {
        failed++;
      }
    }
    return { sent, failed, total: phones.length };
  }

  sendSmsCampaign(message: string, recipients?: string[]) {
    return this.sendMessagingCampaign(message, 'sms', recipients);
  }

  sendWhatsappCampaign(message: string, recipients?: string[]) {
    return this.sendMessagingCampaign(message, 'whatsapp', recipients);
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
