import { MailService } from './mail.service';

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
    expect((message.html.match(/height="28"/g) || [])).toHaveLength(2);
    expect((message.html.match(/Resumen de esta entrada/g) || [])).toHaveLength(2);
    expect(message.html).not.toContain('Total cobrado:');
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
