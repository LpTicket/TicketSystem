import { MailService } from './mail.service';

describe('MailService event support reminders', () => {
  const data = {
    eventTitle: 'Gala & Música <en vivo>', eventDate: new Date('2026-10-24T14:00:00Z'),
    eventTimezone: 'America/Chicago', venueName: 'Salón Principal', venueAddress: '123 Main St',
    organizerName: 'Ana <Pérez>', organizerEmail: 'owner@example.com', organizerPhone: '+15555550123',
  };
  function setup() {
    const values: Record<string, string> = {
      APP_URL: 'https://www.lpticket.com', SMTP_FROM: 'info@lpticket.com', CONTACT_EMAIL: 'support@lpticket.com',
    };
    const service = new MailService({ get: (key: string) => values[key] } as any);
    const sendMail = jest.fn().mockImplementation(async ({ to }) => ({ accepted: [to], rejected: [] }));
    (service as any).transporter = { sendMail };
    return { service, sendMail };
  }

  it('sends the organizer a branded, dark reminder with a direct support reply and local event time', async () => {
    const { service, sendMail } = setup();
    await expect(service.sendEventSupportReminder('owner@example.com', data, 'organizer')).resolves.toBe(true);
    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe('owner@example.com');
    expect(message.replyTo).toBe('support@lpticket.com');
    expect(message.text).toContain('09:00');
    expect(message.text).toContain('America/Chicago');
    expect(message.text).toContain('capacitación');
    expect(message.text).toContain('comunícate con nosotros hoy');
    expect(message.html).toContain('Gala &amp; Música &lt;en vivo&gt;');
    expect(message.html).toContain('Ana &lt;Pérez&gt;');
    expect(message.html).toContain('logo-email-orange.png');
    expect(message.html).toContain('Solicitar acompañamiento');
    expect(message.html).toContain('background:#0a1420');
    expect(message.html).not.toMatch(/background(?:-color)?:\s*(?:#fff(?:fff)?|white)\b/i);
    expect(message.html).toMatch(/<h1[^>]*color:#ffffff/);
    expect(message).not.toHaveProperty('cc');
    expect(message).not.toHaveProperty('bcc');
    expect(message.html).not.toContain('+15555550123');
  });

  it('sends administration the organizer full name, email and phone with a contact action', async () => {
    const { service, sendMail } = setup();
    await service.sendEventSupportReminder('admin@example.com', data, 'admin');
    const message = sendMail.mock.calls[0][0];
    expect(message.replyTo).toBe('owner@example.com');
    expect(message.text).toContain('Organizador: Ana <Pérez>');
    expect(message.text).toContain('Correo electrónico: owner@example.com');
    expect(message.text).toContain('Teléfono: +15555550123');
    expect(message.html).toContain('Contactar al organizador');
    expect(message.html).toContain('mailto:owner%40example.com');
    expect(message).not.toHaveProperty('cc');
    expect(message).not.toHaveProperty('bcc');
  });

  it('shows missing phone information and uses UTC if a legacy event has an invalid timezone', async () => {
    const { service, sendMail } = setup();
    await service.sendEventSupportReminder('admin@example.com', {
      ...data, organizerPhone: null, eventTimezone: 'Invalid/Timezone',
    }, 'admin');
    expect(sendMail.mock.calls[0][0].text).toContain('Teléfono: No registrado');
    expect(sendMail.mock.calls[0][0].text).toContain('02:00 p.m. UTC');
    expect(sendMail.mock.calls[0][0].text).toContain('(UTC)');
  });

  it.each([
    { accepted: [], rejected: ['owner@example.com'] },
    { accepted: ['other@example.com'], rejected: [] },
    { accepted: ['owner@example.com'], rejected: ['owner@example.com'] },
    {},
  ])('does not mark delivery successful unless SMTP accepted the recipient (%j)', async (response) => {
    const { service, sendMail } = setup();
    sendMail.mockResolvedValue(response);
    await expect(service.sendEventSupportReminder('owner@example.com', data, 'organizer')).resolves.toBe(false);
  });

  it('returns a pending delivery when SMTP is unavailable', async () => {
    const { service, sendMail } = setup();
    sendMail.mockRejectedValue(new Error('SMTP unavailable'));
    await expect(service.sendEventSupportReminder('owner@example.com', data, 'organizer')).resolves.toBe(false);
  });
});

describe('MailService ticket email', () => {
  const buildService = () => {
    const values: Record<string, string> = {
      APP_URL: 'https://www.lpticket.com',
      API_URL: 'https://api.lpticket.com',
      SMTP_FROM: 'tickets@lpticket.com',
    };
    const service = new MailService({
      get: jest.fn((key: string) => values[key]),
    } as any);
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-1' });
    (service as any).transporter = { sendMail };
    return { service, sendMail };
  };

  it('keeps a multi-ticket email inside one valid HTML document', async () => {
    const { service, sendMail } = buildService();

    await service.sendTicketEmail(
      'guest@example.com',
      'María Invitada',
      'Evento Premium',
      [
        { ticketCode: 'TICKET-ONE', rowLabel: 'GA', sectionName: 'General', price: 0, qrData: 'data:image/png;base64,AAAA' },
        { ticketCode: 'TICKET-TWO', rowLabel: 'GA', sectionName: 'General', price: 0, qrData: 'data:image/png;base64,BBBB' },
      ],
      {
        currency: 'USD',
        subtotal: 0,
        lpFee: 0,
        processingFee: 0,
        total: 0,
        courtesyType: 'press',
        attendeeName: 'María Invitada',
      },
      { includeOperationalCopies: false },
    );

    const message = sendMail.mock.calls[0][0];
    expect((message.html.match(/<\/body>/g) || [])).toHaveLength(1);
    expect((message.html.match(/<\/html>/g) || [])).toHaveLength(1);
    expect(message.html).toContain('TICKET-ONE');
    expect(message.html).toContain('TICKET-TWO');
    expect(message.html).toContain('<strong>Invitado:</strong> María Invitada');
    expect(message.html).toContain('Prensa');
    expect((message.html.match(/box-shadow:0 10px 28px/g) || [])).toHaveLength(2);
    expect((message.html.match(/border-right:7px solid #cbd5e1/g) || [])).toHaveLength(2);
    expect((message.html.match(/border-bottom:9px solid #cbd5e1/g) || [])).toHaveLength(2);
    expect((message.html.match(/height="28"/g) || [])).toHaveLength(2);
    expect((message.html.match(/Resumen de esta entrada/g) || [])).toHaveLength(2);
    expect(message.html).not.toContain('Total cobrado:');
    expect(message.html).toContain('Entrada de Prensa:');
    expect(message.html).toContain('SIN COSTO');
    expect(message.html).toContain('Este correo contiene tu entrada de cortesía y boleto de acceso.');
    expect(message.html).not.toContain('comprobante de pago oficial');
    expect(message).not.toHaveProperty('attachments');
    expect(message.subject).toBe('Tus entradas de Prensa para Evento Premium — LPTicket');
  });

  it('escapes attendee and event text in the email body', async () => {
    const { service, sendMail } = buildService();

    await service.sendTicketEmail(
      'guest@example.com',
      'Ana <Invitada>',
      'Evento & Gala',
      [{ ticketCode: 'SAFE-ONE', rowLabel: 'GA', sectionName: 'General', price: 0 }],
      { courtesyType: 'staff', attendeeName: 'Ana <Invitada>' },
      { includeOperationalCopies: false },
    );

    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain('Ana &lt;Invitada&gt;');
    expect(html).toContain('Evento &amp; Gala');
    expect(html).not.toContain('Ana <Invitada>');
  });
});
