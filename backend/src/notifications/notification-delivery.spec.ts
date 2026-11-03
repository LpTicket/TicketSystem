import { BadRequestException } from '@nestjs/common';
import { MailService } from '../common/services/mail.service';
import { NotificationKey } from './notification-catalog';
import { MarketingService } from '../marketing/marketing.service';
import { OrdersService } from '../orders/orders.service';

const fixture = (disabled: NotificationKey[]) => {
  const settings = {
    isEnabled: jest.fn(async (key: NotificationKey) => !disabled.includes(key)),
    requireEnabled: jest.fn(async (key: NotificationKey) => { if (disabled.includes(key)) throw new BadRequestException('Desactivada'); }),
  };
  const values: Record<string, string> = { ADMIN_EMAIL: 'admin@example.com', SMTP_FROM: 'test@example.com', APP_URL: 'https://example.com' };
  const mail = new MailService({ get: (key: string) => values[key] } as any, settings as any);
  const sendMail = jest.fn().mockResolvedValue({ accepted: ['buyer@example.com'], rejected: [] });
  (mail as any).transporter = { sendMail };
  return { mail, sendMail, settings };
};

describe('Notification delivery controls', () => {
  it.each([
    ['welcome_email', (mail: MailService) => mail.sendWelcomeEmail('buyer@example.com')],
    ['new_user_admin', (mail: MailService) => mail.sendAdminNewUserNotification({ email: 'buyer@example.com' }, 'web')],
    ['password_reset', (mail: MailService) => mail.sendPasswordResetEmail('buyer@example.com', 'Ana', 'https://example.com/reset')],
    ['event_approval_request', (mail: MailService) => mail.sendEventApprovalRequestEmail({} as any)],
    ['event_approved', (mail: MailService) => mail.sendEventApprovedEmail({} as any)],
    ['support_reminder_organizer', (mail: MailService) => mail.sendEventSupportReminder('owner@example.com', {} as any, 'organizer')],
    ['support_reminder_admin', (mail: MailService) => mail.sendEventSupportReminder('admin@example.com', {} as any, 'admin')],
    ['post_event_report', (mail: MailService) => mail.sendPostEventReportEmail('owner@example.com', {} as any)],
  ] as const)('does not hand disabled %s notifications to SMTP', async (key, call) => {
    const { mail, sendMail } = fixture([key]);
    await call(mail);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ['ticket_email', (mail: MailService) => mail.sendTicketEmail('buyer@example.com', 'Ana', 'Gala', [])],
    ['manual_invoice', (mail: MailService) => mail.sendManualInvoiceEmail('buyer@example.com', {} as any)],
    ['attendee_reminder', (mail: MailService) => mail.sendReminderEmail('buyer@example.com', 'Ana', 'Gala', '', '', '', 1)],
    ['contact_email', (mail: MailService) => mail.sendContactEmail('Ana', 'buyer@example.com', 'Ayuda', 'Consulta')],
    ['marketing_email', (mail: MailService) => mail.sendMarketingEmail('buyer@example.com', { subject: 'Gala' })],
  ] as const)('reports disabled %s as unsent instead of pretending delivery succeeded', async (key, call) => {
    const { mail, sendMail } = fixture([key]);
    await expect(call(mail)).rejects.toBeInstanceOf(BadRequestException);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each(['ticket_copy_admin', 'ticket_copy_organizer'] as const)('independently excludes %s from ticket copies', async (key) => {
    const { mail, sendMail } = fixture([key]);
    await mail.sendTicketEmail('buyer@example.com', 'Ana', 'Gala', [], { organizerEmail: 'owner@example.com' });
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'buyer@example.com', bcc: [key === 'ticket_copy_admin' ? 'owner@example.com' : 'admin@example.com'] });
  });

  it('does not send login email when both alerts are off', async () => {
    const { mail, sendMail } = fixture(['login_client', 'login_admin']);
    await mail.sendLoginNotifications({ email: 'buyer@example.com' }, 'Email');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('keeps organizer report delivery while excluding the disabled administrative copy', async () => {
    const { mail, sendMail } = fixture(['post_event_copy_admin']);
    const report = {
      organizerName: 'Ana', eventTitle: 'Gala', eventDateLabel: '3 de noviembre', venueLabel: 'Salón', reportUrl: 'https://example.com/report', currency: 'USD',
      totals: { grossSales: 10, ticketRevenue: 8, lpFees: 2, processingFees: 0, netEstimated: 8, totalOrders: 1, totalTickets: 1, blockedTickets: 0, scannedTickets: 0, pendingTickets: 1, scanRate: 0, averageOrder: 10 },
      topSections: [], salesByDay: [], specialCodes: [],
    };
    await mail.sendPostEventReportEmail('buyer@example.com', report);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe('buyer@example.com');
  });

  it.each(['login_client', 'login_admin'] as const)('delivers a login alert only to the enabled audience (%s)', async (disabled) => {
    const { mail, sendMail } = fixture([disabled]);
    await mail.sendLoginNotifications({ email: 'buyer@example.com', firstName: '<Ana>' }, 'Google');
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].to).toBe(disabled === 'login_client' ? 'admin@example.com' : 'buyer@example.com');
    expect(sendMail.mock.calls[0][0].html).not.toContain('<Ana>');
  });

  it.each([
    ['marketing_email', (service: MarketingService) => service.createEmailCampaign({ subject: 'Gala' })],
    ['marketing_email', (service: MarketingService) => service.sendNextEmailCampaignBatch('campaign-1')],
    ['marketing_push', (service: MarketingService) => service.sendPushCampaign({ title: 'Gala', message: 'Hola' })],
    ['marketing_sms', (service: MarketingService) => service.sendSmsCampaign('Hola')],
    ['marketing_whatsapp', (service: MarketingService) => service.sendWhatsappCampaign('Hola')],
    ['transactional_sms', (service: MarketingService) => service.sendTransactionalSms('+15555550123', 'Entrada')],
  ] as const)('blocks disabled %s before querying recipients or reaching a provider', async (key, call) => {
    const { settings } = fixture([key]);
    const service = Object.create(MarketingService.prototype) as MarketingService;
    Object.assign(service, { notifications: settings });
    await expect(call(service)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('skips welcome WhatsApp before any provider work', async () => {
    const { settings } = fixture(['welcome_whatsapp']);
    const service = Object.create(MarketingService.prototype) as MarketingService;
    Object.assign(service, { notifications: settings });
    await expect(service.sendWelcomeWhatsapp('+15555550123')).resolves.toBeUndefined();
  });

  it('stops the next push batch when administration pauses delivery', async () => {
    const { settings } = fixture([]);
    settings.isEnabled.mockResolvedValue(false);
    const service = Object.create(MarketingService.prototype) as MarketingService;
    Object.assign(service, {
      notifications: settings,
      pushTokenRepo: { find: async () => Array.from({ length: 101 }, (_, i) => ({ token: `ExponentPushToken[local-test-${i}]` })) },
    });
    const send = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: Array.from({ length: 100 }, () => ({ status: 'ok' })) }) } as Response);
    try {
      const result = await service.sendPushCampaign({ title: 'Gala', message: 'Hola' });
      expect(send).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ sent: 100, failed: 0, total: 101, error: 'Envío detenido por administración.' });
    } finally { send.mockRestore(); }
  });

  it('does not query scheduled events or consume their reminder checkpoints while paused', async () => {
    const { settings } = fixture(['attendee_reminder']);
    const service = Object.create(OrdersService.prototype) as OrdersService;
    const eventRepo = { find: jest.fn() };
    Object.assign(service, { notifications: settings, eventRepo });
    await service.handleScheduledReminders();
    expect(eventRepo.find).not.toHaveBeenCalled();
  });
});
