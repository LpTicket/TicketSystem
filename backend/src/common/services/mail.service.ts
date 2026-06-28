import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type PostEventReportEmail = {
  organizerName: string;
  eventTitle: string;
  eventDateLabel: string;
  venueLabel: string;
  flyerUrl?: string | null;
  reportUrl: string;
  currency: string;
  totals: {
    grossSales: number;
    ticketRevenue: number;
    lpFees: number;
    processingFees: number;
    netEstimated: number;
    totalOrders: number;
    totalTickets: number;
    blockedTickets: number;
    scannedTickets: number;
    pendingTickets: number;
    scanRate: number;
    averageOrder: number;
  };
  topSections: Array<{ name: string; tickets: number; revenue: number }>;
  salesByDay: Array<{ date: string; orders: number; tickets: number; revenue: number }>;
  specialCodes: Array<{ code: string; orders: number; tickets: number; revenue: number; commission: number }>;
  csv?: { filename: string; content: string };
};

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  private getAppUrl() {
    const rawAppUrl = this.configService.get('APP_URL') || 'https://www.lpticket.com';
    return rawAppUrl.startsWith('http://') || rawAppUrl.startsWith('https://')
      ? rawAppUrl.replace(/\/$/, '')
      : `https://${rawAppUrl.replace(/\/$/, '')}`;
  }

  async sendTicketEmail(
    to: string,
    userName: string,
    eventTitle: string,
    tickets: any[],
    eventInfo?: {
      venueName?: string | null;
      venueAddress?: string | null;
      eventDate?: string;
      eventTimezone?: string;
      currency?: string;
      subtotal?: number;
      lpFee?: number;
      processingFee?: number;
      total?: number;
      organizerEmail?: string | null;
    },
  ) {
    const appUrl = this.getAppUrl();
    const eventAddress = [eventInfo?.venueName, eventInfo?.venueAddress].filter(Boolean).join(' — ');
    const currency = eventInfo?.currency || 'USD';
    const hasPaymentSummary = eventInfo?.total !== undefined;
    const money = (value?: number) => `${Number(value || 0).toFixed(2)} ${currency}`;
    const moneyFromCents = (value: number) => `${(value / 100).toFixed(2)} ${currency}`;

    const eventDateFormatted = eventInfo?.eventDate && eventInfo?.eventTimezone
      ? (() => {
          const date = new Date(eventInfo.eventDate);
          const tz = eventInfo.eventTimezone || 'UTC';
          const dayName = date.toLocaleDateString('es', { weekday: 'long', timeZone: tz });
          const dateStr = date.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz });
          const timeStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz });
          const tzName = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
            .formatToParts(date)
            .find((p: any) => p.type === 'timeZoneName')?.value || '';
          return `${dayName}, ${dateStr} — ${timeStr} ${tzName}`;
        })()
      : '';
    const ticketSubtotalCents = tickets.map((ticket) => Math.round(Number(ticket.price || 0) * 100));
    const orderSubtotalCents = Math.round(Number(eventInfo?.subtotal || 0) * 100);
    const allocateCents = (totalCents: number) => {
      if (tickets.length === 0) return [];
      if (orderSubtotalCents <= 0) {
        const base = Math.floor(totalCents / tickets.length);
        return tickets.map((_, index) => index === tickets.length - 1 ? totalCents - base * (tickets.length - 1) : base);
      }

      let used = 0;
      return ticketSubtotalCents.map((subtotalCents, index) => {
        if (index === ticketSubtotalCents.length - 1) return totalCents - used;
        const value = Math.round((totalCents * subtotalCents) / orderSubtotalCents);
        used += value;
        return value;
      });
    };

    const ticketLpFeeCents = allocateCents(Math.round(Number(eventInfo?.lpFee || 0) * 100));
    const ticketProcessingFeeCents = allocateCents(Math.round(Number(eventInfo?.processingFee || 0) * 100));
    const ticketTotalCents = ticketSubtotalCents.map((subtotalCents, index) =>
      subtotalCents + (ticketLpFeeCents[index] || 0) + (ticketProcessingFeeCents[index] || 0)
    );

    const ticketDetails = tickets.map((t, index) => {
      const row = t.rowLabel || '';
      const num = t.seatNumber;
      const section = t.sectionName || '';
      const sectionType = t.sectionType || '';

      const mesaMatch = row.match(/^(mesa|table)\s*(\d+)$/i);
      const seatMesaMatch = String(num || '').trim().match(/^(mesa|table)\s*(\d+)$/i);
      let details = '';

      // Detect table sections by sectionType
      if (sectionType === 'table' || /^(mesa|table)\b/i.test(String(row).trim())) {
        const hasTableWord = /^(mesa|table)\b/i.test(String(section).trim()) || /^\d+$/.test(String(section).trim()) === false && !section;
        const tableLabel = /^\d+$/.test(String(section).trim())
          ? `Mesa ${section}`
          : /^(mesa|table)\b/i.test(String(section).trim())
            ? section
            : section || 'Mesa';
        details = `${tableLabel} - Silla ${num}`;
      } else if (seatMesaMatch) {
        const tableNum = row;
        const chairNum = seatMesaMatch[2];
        const hasTableWord = /^(mesa|table)\b/i.test(String(tableNum));
        details = `${hasTableWord ? tableNum : `Mesa ${tableNum}`} - Silla ${chairNum}`;
      } else if (mesaMatch) {
        details = `Mesa ${mesaMatch[2]} - Silla ${num}`;
      } else if (row === 'GA') {
        details = `Entrada General`;
      } else {
        details = `Fila ${row}, Asiento ${num}`;
      }

      // For table sections, don't show section separately (it's already in "Ubicación")
      const cleanSection = section.trim();
      const isTableSection = sectionType === 'table' || /^(mesa|table)\b/i.test(String(row).trim());
      const shouldShowSection = !isTableSection && cleanSection &&
        !['general', 'general admission', 'ga', 'default', 'default section', 'null', 'undefined', 'sección única', 'seccion unica'].includes(cleanSection.toLowerCase()) &&
        !/^\d+$/.test(cleanSection); // hide purely numeric section names

      const qrCid = `qr-${t.ticketCode}`;
      const ticketUrl = `${appUrl}/verify/${t.ticketCode}`;
      const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(`Mi entrada para ${eventTitle}: ${ticketUrl}`)}`;
      // Apple Wallet pass (public endpoint). Works on iPhone once Apple Pass
      // certificates are configured on the server.
      const apiBase = (this.configService.get<string>('API_URL') || appUrl).replace(/\/$/, '').replace(/\/api$/, '');
      const appleWalletUrl = `${apiBase}/api/orders/ticket/${t.ticketCode}/apple-wallet`;
      const ticketSubtotal = Number(t.price || 0);
      const orderSubtotal = Number(eventInfo?.subtotal || 0);
      const ticketShare = orderSubtotal > 0 ? ticketSubtotal / orderSubtotal : 1 / Math.max(tickets.length, 1);
      const ticketLpFee = Number(eventInfo?.lpFee || 0) * ticketShare;
      const ticketProcessingFee = Number(eventInfo?.processingFee || 0) * ticketShare;
      const ticketTotal = ticketSubtotal + ticketLpFee + ticketProcessingFee;

      return `
      <div bgcolor="#ffffff" style="background:#ffffff !important; background-color:#ffffff !important; color:#0f172a !important; border:1px solid #e2e8f0; border-radius:20px; padding:25px; margin-bottom:20px; box-shadow:0 4px 12px rgba(0,0,0,0.03); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <!-- Card branding header -->
        <div bgcolor="#ffffff" style="background:#ffffff !important; background-color:#ffffff !important; border-bottom:2px solid #f1f5f9; padding:12px 12px 14px 12px; margin-bottom:18px; display:table; width:100%; box-sizing:border-box;">
          <div bgcolor="#ffffff" style="display:table-cell; vertical-align:middle; background:#ffffff !important; background-color:#ffffff !important;">
            <img src="${appUrl}/logo-email-orange.png" alt="LPTicket" width="220" style="display:block; width:220px; max-width:220px; height:auto; border:0; outline:none; text-decoration:none;" />
          </div>
          <div bgcolor="#ffffff" style="display:table-cell; text-align:right; font-size:9px; font-weight:bold; color:#94a3b8 !important; text-transform:uppercase; letter-spacing:1px; vertical-align:middle; background:#ffffff !important; background-color:#ffffff !important;">
            Digital Ticket
          </div>
        </div>

        <h3 style="margin-top: 0; margin-bottom: 8px; color: #0A375A; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px;">${eventTitle}</h3>

        <!-- Info labels -->
        <div style="margin-bottom: 15px; font-size: 12px; color: #475569; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Comprador:</strong> ${userName}</p>
          ${eventDateFormatted ? `<p style="margin: 4px 0;"><strong>Fecha y Hora:</strong> ${eventDateFormatted}</p>` : ''}
          ${shouldShowSection ? `<p style="margin: 4px 0;"><strong>Sección:</strong> ${t.sectionName}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Ubicación:</strong> ${details}</p>
          <p style="margin: 4px 0; font-family: monospace;"><strong>Código:</strong> <span style="color: #F97316; font-weight: bold;">${t.ticketCode}</span></p>
          ${hasPaymentSummary ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:10px 0 0 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
            <tr>
              <td style="padding:9px 11px 4px 11px;">
                <p style="margin:0;color:#0A375A;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.5px;">Resumen de esta entrada</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 11px 9px 11px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;color:#334155;">
                  <tr>
                    <td style="padding:3px 0;border-bottom:1px solid #f1f5f9;">Subtotal de esta entrada:</td>
                    <td align="right" style="padding:3px 0;border-bottom:1px solid #f1f5f9;font-weight:800;color:#0f172a;">${moneyFromCents(ticketSubtotalCents[index] || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;border-bottom:1px solid #f1f5f9;">Cargo por servicio:</td>
                    <td align="right" style="padding:3px 0;border-bottom:1px solid #f1f5f9;font-weight:800;color:#0f172a;">${moneyFromCents(ticketLpFeeCents[index] || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;border-bottom:1px solid #f1f5f9;">Tarifa de procesamiento:</td>
                    <td align="right" style="padding:3px 0;border-bottom:1px solid #f1f5f9;font-weight:800;color:#0f172a;">${moneyFromCents(ticketProcessingFeeCents[index] || 0)}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0 0 0;font-weight:900;color:#0A375A;">Total de esta entrada:</td>
                    <td align="right" style="padding:6px 0 0 0;font-weight:900;color:#F97316;font-size:14px;">${moneyFromCents(ticketTotalCents[index] || 0)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ` : ''}
        </div>

        <!-- Center QR. Uses the public PNG URL (renders even when a mail client
             blocks inline CID images); CID stays as an attachment fallback. -->
        <div style="text-align: center; margin: 20px 0;">
          <img src="${apiBase}/api/orders/ticket/${t.ticketCode}/qr.png" alt="QR Code" width="160" height="160" style="border: 1px solid #e2e8f0; padding: 8px; border-radius: 12px; background: #ffffff;" />
          <span style="display: block; font-size: 10px; color: #94a3b8; margin-top: 8px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">Presentar este código QR en el acceso</span>
          <span style="display: block; font-size: 11px; color: #475569; margin-top: 6px;">Si no ves el QR, usa el botón <strong>Ver entrada</strong> o tu código <strong style="font-family: monospace; color:#F97316;">${t.ticketCode}</strong>.</span>
        </div>

                <div style="text-align: center; margin: 18px 0 6px 0;">
          <a href="${ticketUrl}" target="_blank" style="display: inline-block; vertical-align: middle; margin: 4px; background: #F97316; color: #ffffff; text-decoration: none; border-radius: 14px; padding: 12px 18px; font-size: 12px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase;">
            Ver entrada
          </a>
          <a href="${whatsappShareUrl}" target="_blank" style="display: inline-block; vertical-align: middle; margin: 4px; background: #ffffff; color: #F97316; text-decoration: none; border: 2px solid #F97316; border-radius: 14px; padding: 10px 18px; font-size: 12px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase;">
            Compartir
          </a>
          <a href="${appleWalletUrl}" target="_blank" style="display: inline-block; vertical-align: middle; margin: 4px; background: #000000; color: #ffffff; text-decoration: none; border-radius: 14px; padding: 12px 18px; font-size: 12px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase;">
            &#63743;&nbsp; Apple Wallet
          </a>
        </div>

<!-- Footer terms info -->    <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 15px; font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.4; text-transform: uppercase; font-weight: bold;">
          LPTICKET.COM — TUS TICKETS. TUS EVENTOS.
        </div>
      </div>
      </body>
      </html>
    `;
    }).join('');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">
        <style>
          :root { color-scheme: light; supported-color-schemes: light; }
          body, table, td, div, p, span { color-scheme: light !important; }
          body { background: #ffffff !important; background-color: #ffffff !important; }
          [data-ogsc] body, [data-ogsc] div, [data-ogsb] body, [data-ogsb] div {
            background-color: #ffffff !important;
            color: #0f172a !important;
          }
        </style>
      </head>
      <body bgcolor="#ffffff" style="margin:0; padding:0; background:#ffffff !important; background-color:#ffffff !important; color:#0f172a !important;">
      <div bgcolor="#ffffff" style="background:#ffffff !important; background-color:#ffffff !important; padding:30px 15px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <div style="max-width: 560px; margin: 0 auto;">
          <div style="margin-bottom: 25px; text-align: center;">
            <h1 style="color: #0A375A; font-size: 24px; font-weight: 850; margin: 0; letter-spacing: -0.5px;">¡Hola, ${userName}! 👋</h1>
            <p style="color: #475569; font-size: 14px; margin-top: 6px; margin-bottom: 0;">Gracias por tu compra. Aquí tienes tus entradas listas para el evento:</p>
          </div>
          
          ${hasPaymentSummary ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:0 0 16px 0;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding:14px 16px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="font-size:13px;font-weight:900;color:#0A375A;text-transform:uppercase;letter-spacing:0.7px;">Total cobrado:</td>
                    <td align="right" style="font-size:17px;font-weight:900;color:#F97316;">${money(eventInfo?.total)}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ` : ''}
          
          ${ticketDetails}
          
          <div style="text-align: center; margin-top: 25px;">
            <p style="color: #64748b; font-size: 11px; margin: 0;">Este correo sirve como comprobante de pago oficial y boleto de acceso.</p>
            <p style="color: #64748b; font-size: 11px; margin: 4px 0 0 0;">Si tienes dudas o inquietudes, por favor contáctanos respondiendo a este email.</p>
          </div>
        </div>
      </div>
    `;

    // Build CID inline attachments from base64 qrData
    const attachments = tickets
      .filter(t => t.qrData)
      .map(t => {
        const base64 = String(t.qrData).replace(/^data:image\/png;base64,/, '');
        return {
          filename: `qr-${t.ticketCode}.png`,
          content: Buffer.from(base64, 'base64'),
          cid: `qr-${t.ticketCode}`,
          contentType: 'image/png',
          contentDisposition: 'inline' as const,
        };
      });

    const bccRecipients = Array.from(new Set([
      this.configService.get('ADMIN_EMAIL'),
      eventInfo?.organizerEmail,
    ]
      .filter((email): email is string => Boolean(email && email.trim()))
      .map((email) => email.trim())))
      .filter((email) => email.toLowerCase() !== String(to || '').trim().toLowerCase());

    try {
      await this.transporter.sendMail({
        from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
        to,
        ...(bccRecipients.length > 0 ? { bcc: bccRecipients } : {}),
        subject: `Tus tickets para ${eventTitle} — LPTicket`,
        html,
        attachments,
      });
    } catch (err) {
      console.error('Error sending email:', err);
    }
  }
  /**
   * Sends a branded event reminder email to a list of attendees.
   * Sent from info@lpticket.com
   */
  async sendReminderEmail(
    to: string,
    userName: string,
    eventTitle: string,
    eventDate: string,
    venueName: string,
    venueAddress: string,
    daysUntilEvent: number,
    customMessage?: string,
  ) {
    const appUrl = this.getAppUrl();

    const isHours = daysUntilEvent < 0;
    let urgencyLabel = '';
    if (isHours) {
      const hours = Math.abs(daysUntilEvent);
      urgencyLabel = `Faltan ${hours} hora${hours !== 1 ? 's' : ''} para el evento`;
    } else if (daysUntilEvent === 0) {
      urgencyLabel = '¡Hoy es el gran día del evento!';
    } else if (daysUntilEvent === 1) {
      urgencyLabel = '¡Mañana es el gran día del evento!';
    } else {
      urgencyLabel = `Faltan ${daysUntilEvent} días para el evento`;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background-color:#f1f5f9;color:#334155;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
        <div style="background-color:#f1f5f9;padding:40px 12px;min-height:100%;">
          <div style="max-width:560px;margin:0 auto;box-shadow:0 10px 25px rgba(0,0,0,0.05);border-radius:16px;overflow:hidden;">

            <!-- Header / Logo -->
            <div style="background-color:#ffffff;padding:24px 28px;text-align:center;">
              <img src="${appUrl}/logo-email-orange.png" alt="LPTicket" width="180" style="display:block;margin:0 auto 8px auto;max-width:180px;height:auto;" />
              <p style="margin:0;font-size:10px;color:#0A375A;text-transform:uppercase;letter-spacing:2px;font-weight:700;">
                Recordatorio de Evento
              </p>
            </div>

            <!-- Urgency Banner -->
            <div style="background-color:#f97316;padding:14px 28px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">
                ⏰ ${urgencyLabel}
              </p>
            </div>

            <!-- Main Card -->
            <div style="background-color:#ffffff;padding:32px 28px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

              <!-- Greeting -->
              <p style="margin:0 0 8px 0;font-size:18px;color:#0A375A;font-weight:800;">
                ¡Hola, ${userName}! 👋
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#475569;line-height:1.6;">
                Te recordamos que tienes una entrada confirmada para el siguiente evento:
              </p>

              <!-- Event Info Box -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:24px;">
                <h3 style="margin:0 0 10px 0;font-size:20px;font-weight:800;color:#0A375A;line-height:1.3;text-transform:uppercase;letter-spacing:-0.5px;">
                  ${eventTitle}
                </h3>
                <div style="width:60px;height:3px;background-color:#f97316;margin-bottom:18px;"></div>
                
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="width:28px;font-size:16px;vertical-align:top;padding:4px 0;">📅</td>
                    <td style="font-size:13px;color:#1e293b;font-weight:600;padding:4px 0;">
                      ${eventDate}
                    </td>
                  </tr>
                  <tr>
                    <td style="width:28px;font-size:16px;vertical-align:top;padding:8px 0 4px 0;">📍</td>
                    <td style="font-size:13px;color:#1e293b;padding:8px 0 4px 0;line-height:1.4;">
                      <strong>${venueName}</strong>
                      ${venueAddress ? `<br/><span style="color:#64748b;font-size:12px;">${venueAddress}</span>` : ''}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Custom message / Greeting Body -->
              ${customMessage ? `
              <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#9a3412;line-height:1.6;font-style:italic;white-space:pre-line;">
                  ${customMessage}
                </p>
              </div>
              ` : ''}

              <!-- Recommendations -->
              <div style="margin-bottom:28px;">
                <p style="margin:0 0 10px 0;font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Recomendaciones para tu ingreso:</p>
                <table style="width:100%;border-collapse:collapse;">
                  <tr>
                    <td style="width:24px;font-size:14px;vertical-align:top;padding:4px 0;">✅</td>
                    <td style="font-size:13px;color:#374151;padding:4px 0;line-height:1.4;">Lleva tu entrada digital (código QR disponible en el dashboard de LPTicket).</td>
                  </tr>
                  <tr>
                    <td style="width:24px;font-size:14px;vertical-align:top;padding:4px 0;">✅</td>
                    <td style="font-size:13px;color:#374151;padding:4px 0;line-height:1.4;">Lleva una identificación oficial con fotografía.</td>
                  </tr>
                  <tr>
                    <td style="width:24px;font-size:14px;vertical-align:top;padding:4px 0;">✅</td>
                    <td style="font-size:13px;color:#374151;padding:4px 0;line-height:1.4;">Te recomendamos llegar 30 minutos antes para agilizar el registro.</td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button inside Event Box -->
              <div style="text-align:center;margin-bottom:8px;">
                <a href="${appUrl}/dashboard" target="_blank"
                  style="display:inline-block;background-color:#f97316;color:#ffffff;text-decoration:none;border-radius:12px;padding:14px 36px;font-size:13px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;box-shadow:0 4px 14px rgba(249,115,22,0.3);">
                  Ver Entrada →
                </a>
              </div>

            </div>

            <!-- Footer -->
            <div style="background-color:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 28px;text-align:center;">
              <p style="margin:0 0 6px 0;font-size:13px;font-weight:800;color:#f97316;letter-spacing:0.5px;">lpticket.com</p>
              <p style="margin:0;font-size:11px;color:#64748b;">Tus tickets. Tus eventos.</p>
              <p style="margin:16px 0 0 0;font-size:10px;color:#94a3b8;line-height:1.4;">
                Este recordatorio fue enviado por info@lpticket.com · LPTicket Platform.<br/>
                Por favor, no respondas directamente a este correo.
              </p>
            </div>

          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from: `"LPTicket" <info@lpticket.com>`,
        to,
        subject: `🎟️ Recordatorio: ${eventTitle} — ${urgencyLabel}`,
        html,
      });
    } catch (err) {
      console.error('Error sending reminder email:', err);
      throw err;
    }
  }

  async sendContactEmail(name: string, email: string, subject: string, message: string) {
    const adminEmail = this.configService.get('ADMIN_EMAIL');
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
        <h2 style="color: #0A375A; margin-top: 0;">Nuevo mensaje de contacto</h2>
        <p style="color: #475569; font-size: 14px;">Has recibido una nueva consulta desde el Centro de Soporte:</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Nombre:</strong> ${name}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0 0 10px 0;"><strong>Asunto:</strong> ${subject}</p>
          <p style="margin: 0; border-top: 1px solid #e2e8f0; pt-10; margin-top: 10px; padding-top: 10px;">
            <strong>Mensaje:</strong><br/>
            ${message}
          </p>
        </div>
        
        <p style="color: #94a3b8; font-size: 11px;">Este correo fue enviado automáticamente por el sistema de LPTicket.</p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"LPTicket Support" <${this.configService.get('SMTP_FROM')}>`,
        to: adminEmail,
        replyTo: email,
        subject: `Soporte: ${subject}`,
        html,
      });
    } catch (err) {
      console.error('Error sending contact email:', err);
    }
  }

  /** Marketing campaign email styled like LPTicket ticket emails. */
  async sendMarketingEmail(
    to: string,
    opts: { subject: string; title?: string; preheader?: string; imageData?: string | null; link?: string },
  ) {
    const appUrl = this.getAppUrl();
    const year = new Date().getFullYear();

    const escapeHtml = (value?: string | null) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const normalizeUrl = (value: string | undefined, fallback: string) => {
      const raw = String(value || '').trim();
      if (!raw) return fallback;
      if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
      if (raw.startsWith('/')) return `${fallback}${raw}`;
      return `https://${raw}`;
    };

    const ctaUrl = normalizeUrl(opts.link, appUrl);
    const safeTitle = escapeHtml(opts.title || '');
    const safePreheader = escapeHtml(opts.preheader || '');
    const safeCtaUrl = escapeHtml(ctaUrl);
    const safeAppUrl = escapeHtml(appUrl);
    const preheaderText = escapeHtml((opts.preheader || opts.title || 'Novedades de LPTicket').replace(/<[^>]+>/g, ''));

    const facebookUrl = 'https://www.facebook.com/profile.php?id=61590380706527';
    const instagramUrl = 'https://www.instagram.com/lpticket';
    const whatsappUrl = 'https://wa.me/12816256383';
    const websiteUrl = 'https://www.lpticket.com';

    const attachments: nodemailer.SendMailOptions['attachments'] = [
    ];

    let artTag = '';
    if (opts.imageData) {
      const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(opts.imageData.trim());
      if (match) {
        const contentType = match[1];
        const ext = (contentType.split('/')[1] || 'png').replace('+xml', '');
        const cid = 'marketing-art';
        attachments.push({
          filename: `art.${ext}`,
          content: Buffer.from(match[2], 'base64'),
          contentType,
          cid,
        });
        artTag = `<img src="cid:${cid}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:16px;" />`;
      } else {
        artTag = `<img src="${escapeHtml(opts.imageData)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:16px;" />`;
      }
    }

    const html = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body bgcolor="#ffffff" style="margin:0;padding:0;background:#ffffff!important;color:#0f172a!important;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${preheaderText}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;background:#ffffff!important;padding:30px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff!important;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;border-bottom:2px solid #f1f5f9;padding:24px 24px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="left" style="vertical-align:middle;">
                    <img src="${safeAppUrl}/logo-email-orange.png" alt="LPTicket" width="220" style="display:block;width:220px;max-width:72%;height:auto;border:0;">
                  </td>
                  <td align="right" style="vertical-align:middle;color:#94a3b8;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">Marketing</td>
                </tr>
              </table>
            </td>
          </tr>
          ${artTag ? `
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;padding:24px 20px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="font-size:0;line-height:0;border-radius:16px;overflow:hidden;background:#f8fafc;border:1px solid #e2e8f0;">${artTag}</td>
                </tr>
              </table>
            </td>
          </tr>` : ''}
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;padding:24px 24px 8px;text-align:center;">
              ${safeTitle ? `<h1 style="margin:0 0 10px;color:#0A375A;font-size:24px;font-weight:850;line-height:1.22;letter-spacing:-0.5px;text-transform:uppercase;">${safeTitle}</h1>` : ''}
              ${safePreheader ? `<p style="margin:0 auto;color:#475569;font-size:14px;line-height:1.6;max-width:460px;">${safePreheader}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" align="center" style="background:#ffffff!important;padding:18px 24px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" bgcolor="#F97316" style="background:#F97316;border-radius:14px;">
                    <a href="${safeCtaUrl}" target="_blank" style="display:inline-block;color:#ffffff;text-decoration:none;border-radius:14px;padding:13px 28px;font-size:12px;font-weight:900;letter-spacing:0.8px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Ver detalles</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;padding:0 20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;">
                <tr>
                  <td align="center" style="padding:18px 16px 10px;">
                    <p style="margin:0;color:#0A375A;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.7px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Sigue a LPTicket</p>
                    <div style="width:54px;height:3px;background:#F97316;margin:10px auto 0;border-radius:3px;"></div>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:10px 16px 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" width="44" height="44" style="width:44px;height:44px;">
                          <a href="${facebookUrl}" target="_blank" style="display:block;width:44px;height:44px;text-decoration:none;"><img src="https://img.icons8.com/ios-filled/96/F97316/facebook-new.png" alt="Facebook" width="30" height="30" style="display:block;width:30px;height:30px;border:0;margin:7px auto;"></a>
                        </td>
                        <td width="14">&nbsp;</td>
                        <td align="center" width="44" height="44" style="width:44px;height:44px;">
                          <a href="${instagramUrl}" target="_blank" style="display:block;width:44px;height:44px;text-decoration:none;"><img src="https://img.icons8.com/ios-filled/96/F97316/instagram-new.png" alt="Instagram" width="30" height="30" style="display:block;width:30px;height:30px;border:0;margin:7px auto;"></a>
                        </td>
                        <td width="14">&nbsp;</td>
                        <td align="center" width="44" height="44" style="width:44px;height:44px;">
                          <a href="${whatsappUrl}" target="_blank" style="display:block;width:44px;height:44px;text-decoration:none;"><img src="https://img.icons8.com/ios-filled/96/F97316/whatsapp.png" alt="WhatsApp" width="30" height="30" style="display:block;width:30px;height:30px;border:0;margin:7px auto;"></a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 16px 20px;">
                    <a href="${websiteUrl}" target="_blank" style="color:#F97316;text-decoration:none;font-size:13px;font-weight:900;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;letter-spacing:0.2px;">www.lpticket.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" align="center" style="background:#ffffff!important;border-top:1px solid #e2e8f0;padding:20px 24px;">
              <p style="margin:0 0 5px;color:#F97316;font-size:12px;font-weight:900;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">lpticket.com</p>
              <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">© ${year} LPTicket · Recibiste este correo porque tienes una cuenta en LPTicket.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    await this.transporter.sendMail({
      from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
      to,
      subject: opts.subject || 'LP Ticket',
      html,
      attachments,
    });
  }

  /** Branded welcome email sent right after a user registers. Never throws. */
  async sendWelcomeEmail(to: string, firstName?: string, lang: 'es' | 'en' = 'es') {
    if (!to) return;
    const appUrl = this.getAppUrl();
    const year = new Date().getFullYear();
    const es = lang !== 'en';
    const name = String(firstName || '').trim();

    const t = es
      ? {
          subject: '¡Bienvenido a LPTicket! 🎟️',
          preheader: 'Tu cuenta fue creada con éxito.',
          hi: name ? `¡Hola ${name}! 👋` : '¡Hola! 👋',
          title: 'Bienvenido a LPTicket',
          body: 'Tu cuenta fue creada con éxito. Ya puedes descubrir eventos, comprar entradas y recibir tus tickets digitales directo en tu correo y celular.',
          cta: 'Descubrir eventos',
          help: '¿Necesitas ayuda? Escríbenos a',
          footer: 'Recibiste este correo porque creaste una cuenta en LPTicket.',
        }
      : {
          subject: 'Welcome to LPTicket! 🎟️',
          preheader: 'Your account was created successfully.',
          hi: name ? `Hi ${name}! 👋` : 'Hi there! 👋',
          title: 'Welcome to LPTicket',
          body: 'Your account was created successfully. You can now discover events, buy tickets and get your digital tickets right in your inbox and on your phone.',
          cta: 'Discover events',
          help: 'Need help? Reach us at',
          footer: 'You received this email because you created an account on LPTicket.',
        };

    const html = `
<!DOCTYPE html>
<html lang="${es ? 'es' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
</head>
<body style="margin:0;padding:0;background:#0a1420;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${t.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1420;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#0b1622;border-radius:16px;overflow:hidden;border:1px solid rgba(246,198,95,0.16);">
          <tr>
            <td align="center" style="background:#0A375A;padding:24px;">
              <img src="${appUrl}/logo-email-orange.png" alt="LPTicket" width="190" style="display:block;width:190px;max-width:190px;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:34px 28px 6px;">
              <p style="margin:0 0 6px;color:#9fb2c6;font-size:15px;font-family:'Helvetica Neue',Arial,sans-serif;">${t.hi}</p>
              <h1 style="margin:0 0 14px;color:#ffffff;font-size:24px;font-weight:800;font-family:'Helvetica Neue',Arial,sans-serif;">${t.title}</h1>
              <p style="margin:0 auto 26px;color:#9fb2c6;font-size:15px;line-height:1.6;max-width:460px;font-family:'Helvetica Neue',Arial,sans-serif;">${t.body}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 34px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(180deg,#ff8a18,#f46c00);box-shadow:0 8px 22px rgba(249,115,22,0.35);">
                    <a href="${appUrl}/events" target="_blank" style="display:inline-block;padding:14px 38px;color:#ffffff;font-size:16px;font-weight:800;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:0.3px;">${t.cta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#08111c;padding:20px 28px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-family:'Helvetica Neue',Arial,sans-serif;">${t.help} <a href="mailto:info@lpticket.com" style="color:#9fb2c6;text-decoration:none;">info@lpticket.com</a></p>
              <p style="margin:0;color:#475569;font-size:11px;font-family:'Helvetica Neue',Arial,sans-serif;">© ${year} LPTicket · ${t.footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
        to,
        subject: t.subject,
        html,
      });
    } catch (e: any) {
      console.error('Welcome email failed:', e?.message || e);
    }
  }

  /** Branded password reset email. Never throws. */
  async sendPasswordResetEmail(to: string, firstName?: string, resetUrl?: string) {
    if (!to || !resetUrl) return;
    const appUrl = this.getAppUrl();
    const year = new Date().getFullYear();
    const name = String(firstName || '').trim();

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark light" />
</head>
<body style="margin:0;padding:0;background:#0a1420;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a1420;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#0b1622;border-radius:16px;overflow:hidden;border:1px solid rgba(249,115,22,0.20);">
          <tr>
            <td align="center" style="background:#0A375A;padding:24px;">
              <img src="${appUrl}/logo-email-orange.png" alt="LPTicket" width="190" style="display:block;width:190px;max-width:190px;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:34px 28px 10px;">
              <p style="margin:0 0 6px;color:#9fb2c6;font-size:15px;font-family:'Helvetica Neue',Arial,sans-serif;">${name ? `Hola ${name}, ` : 'Hola, '}recibimos tu solicitud.</p>
              <h1 style="margin:0 0 14px;color:#ffffff;font-size:22px;font-weight:800;font-family:'Helvetica Neue',Arial,sans-serif;">Recuperar contraseña</h1>
              <p style="margin:0 auto 26px;color:#9fb2c6;font-size:14px;line-height:1.6;max-width:460px;font-family:'Helvetica Neue',Arial,sans-serif;">
                Haz clic en el botón de abajo para establecer una nueva contraseña. Este enlace expira en <strong style="color:#f97316;">1 hora</strong>.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(180deg,#ff8a18,#f46c00);box-shadow:0 8px 22px rgba(249,115,22,0.35);">
                    <a href="${resetUrl}" target="_blank" style="display:inline-block;padding:14px 38px;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;font-family:'Helvetica Neue',Arial,sans-serif;letter-spacing:0.3px;">Restablecer contraseña</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px 30px;">
              <p style="margin:0;color:#64748b;font-size:12px;font-family:'Helvetica Neue',Arial,sans-serif;line-height:1.5;">
                Si no solicitaste este cambio, ignora este correo. Tu contraseña no cambiará.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background:#08111c;padding:20px 28px;border-top:1px solid rgba(255,255,255,0.05);">
              <p style="margin:0 0 4px;color:#f97316;font-size:12px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">lpticket.com</p>
              <p style="margin:0;color:#475569;font-size:11px;font-family:'Helvetica Neue',Arial,sans-serif;">© ${year} LPTicket · Tus tickets. Tus eventos.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    try {
      await this.transporter.sendMail({
        from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
        to,
        subject: '🔐 Recupera tu contraseña — LPTicket',
        html,
      });
    } catch (e: any) {
      console.error('Password reset email failed:', e?.message || e);
    }
  }

  async sendPostEventReportEmail(to: string, report: PostEventReportEmail) {
    if (!to) return false;
    const appUrl = this.getAppUrl();
    const year = new Date().getFullYear();
    const adminEmail = String(this.configService.get('ADMIN_EMAIL') || '').trim();
    const money = (value: number) => `${Number(value || 0).toFixed(2)} ${report.currency || 'USD'}`;
    const safe = (value: any) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const metric = (label: string, value: string, accent = false) => `
      <td style="width:50%;padding:8px;">
        <div style="background:#0f1d2b;border:1px solid rgba(246,198,95,0.14);border-radius:16px;padding:16px;">
          <p style="margin:0 0 6px;color:#8ea3b8;font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;font-family:'Helvetica Neue',Arial,sans-serif;">${label}</p>
          <p style="margin:0;color:${accent ? '#F97316' : '#ffffff'};font-size:24px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">${value}</p>
        </div>
      </td>`;
    const sectionRows = report.topSections.slice(0, 8).map((item) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:13px;font-weight:800;">${safe(item.name)}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9fb2c6;font-size:12px;">${item.tickets}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#F97316;font-size:12px;font-weight:900;">${money(item.revenue)}</td>
      </tr>`).join('');
    const dayRows = report.salesByDay.slice(-7).map((item) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:12px;font-weight:800;">${safe(item.date)}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9fb2c6;font-size:12px;">${item.orders}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9fb2c6;font-size:12px;">${item.tickets}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#F97316;font-size:12px;font-weight:900;">${money(item.revenue)}</td>
      </tr>`).join('');
    const codeRows = report.specialCodes.slice(0, 8).map((item) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#e2e8f0;font-size:12px;font-weight:900;">${safe(item.code)}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#9fb2c6;font-size:12px;">${item.tickets}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.06);color:#F97316;font-size:12px;font-weight:900;">${money(item.revenue)}</td>
      </tr>`).join('');
    const flyerUrl = report.flyerUrl
      ? (String(report.flyerUrl).startsWith('http') ? report.flyerUrl : `${appUrl}${String(report.flyerUrl).startsWith('/') ? '' : '/'}${report.flyerUrl}`)
      : null;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#f4f7fb;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Resumen final de ventas, asistencia y base de datos de ${safe(report.eventTitle)}.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:26px 12px;">
    <tr><td align="center">
      <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:680px;max-width:680px;background:#0b1622;border:1px solid rgba(10,55,90,0.10);border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(10,20,32,0.26),0 8px 24px rgba(10,20,32,0.14);">
        <tr>
          <td style="background:#0A375A;padding:24px 28px;">
            <img src="${appUrl}/logo-email-orange.png" alt="LPTicket" width="190" style="display:block;width:190px;max-width:190px;height:auto;border:0;" />
          </td>
        </tr>
        ${flyerUrl ? `<tr><td><img src="${flyerUrl}" alt="${safe(report.eventTitle)}" width="680" style="display:block;width:100%;max-height:330px;object-fit:cover;border:0;" /></td></tr>` : ''}
        <tr>
          <td style="padding:30px 30px 10px;">
            <p style="margin:0 0 8px;color:#F97316;font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;font-family:'Helvetica Neue',Arial,sans-serif;">Resumen final del evento</p>
            <h1 style="margin:0 0 10px;color:#ffffff;font-size:28px;line-height:1.12;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">${safe(report.eventTitle)}</h1>
            <p style="margin:0;color:#9fb2c6;font-size:14px;line-height:1.6;font-family:'Helvetica Neue',Arial,sans-serif;">Hola ${safe(report.organizerName || 'organizador')}, aquí tienes el cierre completo de tu evento.</p>
            <p style="margin:12px 0 0;color:#cbd5e1;font-size:13px;line-height:1.55;font-family:'Helvetica Neue',Arial,sans-serif;"><strong style="color:#ffffff;">Fecha:</strong> ${safe(report.eventDateLabel)}<br /><strong style="color:#ffffff;">Lugar:</strong> ${safe(report.venueLabel)}</p>
          </td>
        </tr>
        <tr><td style="padding:12px 22px 4px;"><table role="presentation" width="100%"><tr>${metric('Ventas cobradas', money(report.totals.grossSales), true)}${metric('Entradas pagadas', String(report.totals.totalTickets))}</tr><tr>${metric('Bloqueadas', String(report.totals.blockedTickets))}${metric('Asistentes escaneados', `${report.totals.scannedTickets} / ${report.totals.totalTickets}`)}</tr><tr>${metric('Asistencia', `${report.totals.scanRate}%`, true)}${metric('Órdenes', String(report.totals.totalOrders))}</tr><tr>${metric('Orden promedio', money(report.totals.averageOrder))}</tr></table></td></tr>
        <tr>
          <td style="padding:8px 30px 6px;">
            <div style="background:#08111c;border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:18px;">
              <p style="margin:0 0 12px;color:#ffffff;font-size:15px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">Resumen financiero</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Helvetica Neue',Arial,sans-serif;">
                <tr><td style="padding:6px 0;color:#9fb2c6;font-size:13px;">Venta de tickets</td><td align="right" style="color:#ffffff;font-weight:900;">${money(report.totals.ticketRevenue)}</td></tr>
                <tr><td style="padding:6px 0;color:#9fb2c6;font-size:13px;">Cargos de servicio LPTicket</td><td align="right" style="color:#ffffff;font-weight:900;">${money(report.totals.lpFees)}</td></tr>
                <tr><td style="padding:6px 0;color:#9fb2c6;font-size:13px;">Procesamiento</td><td align="right" style="color:#ffffff;font-weight:900;">${money(report.totals.processingFees)}</td></tr>
                <tr><td style="padding:10px 0 0;color:#F97316;font-size:14px;font-weight:900;border-top:1px solid rgba(255,255,255,0.08);">Neto estimado organizador</td><td align="right" style="padding-top:10px;color:#F97316;font-size:18px;font-weight:900;border-top:1px solid rgba(255,255,255,0.08);">${money(report.totals.netEstimated)}</td></tr>
              </table>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 30px;">
            <div style="background:#0f1d2b;border:1px solid rgba(246,198,95,0.14);border-radius:18px;padding:18px;">
              <p style="margin:0 0 12px;color:#ffffff;font-size:15px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">Ventas por sección / mesa</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Helvetica Neue',Arial,sans-serif;">${sectionRows || `<tr><td style="color:#9fb2c6;font-size:13px;">No hubo ventas registradas.</td></tr>`}</table>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 30px 12px;">
            <div style="background:#0f1d2b;border:1px solid rgba(246,198,95,0.14);border-radius:18px;padding:18px;">
              <p style="margin:0 0 12px;color:#ffffff;font-size:15px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">Ventas por día</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Helvetica Neue',Arial,sans-serif;">${dayRows || `<tr><td style="color:#9fb2c6;font-size:13px;">No hubo ventas registradas.</td></tr>`}</table>
            </div>
          </td>
        </tr>
        ${report.specialCodes.length ? `<tr><td style="padding:0 30px 12px;"><div style="background:#0f1d2b;border:1px solid rgba(246,198,95,0.14);border-radius:18px;padding:18px;"><p style="margin:0 0 12px;color:#ffffff;font-size:15px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">Códigos especiales</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:'Helvetica Neue',Arial,sans-serif;">${codeRows}</table></div></td></tr>` : ''}
        <tr>
          <td align="center" style="padding:18px 30px 34px;">
            <a href="${report.reportUrl}" target="_blank" style="display:inline-block;background:#F97316;color:#ffffff;text-decoration:none;border-radius:14px;padding:14px 28px;font-size:14px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">Ver reporte completo</a>
            <p style="margin:14px 0 0;color:#8ea3b8;font-size:12px;line-height:1.5;font-family:'Helvetica Neue',Arial,sans-serif;">La administración de LPTicket recibe una copia con el CSV de asistentes para mantener el respaldo completo del evento.</p>
          </td>
        </tr>
        <tr><td align="center" style="background:#08111c;padding:20px 28px;border-top:1px solid rgba(255,255,255,0.05);"><p style="margin:0 0 4px;color:#F97316;font-size:12px;font-weight:900;font-family:'Helvetica Neue',Arial,sans-serif;">LPTicket</p><p style="margin:0;color:#64748b;font-size:11px;font-family:'Helvetica Neue',Arial,sans-serif;">© ${year} LPTicket · Tus tickets. Tus eventos.</p></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      const adminAttachments = report.csv ? [{
        filename: report.csv.filename,
        content: Buffer.from(report.csv.content, 'utf8'),
        contentType: 'text/csv; charset=utf-8',
      }] : undefined;
      const text = [
        `Resumen final del evento: ${report.eventTitle}`,
        `Fecha: ${report.eventDateLabel}`,
        `Lugar: ${report.venueLabel}`,
        `Ventas cobradas: ${money(report.totals.grossSales)}`,
        `Entradas pagadas: ${report.totals.totalTickets}`,
        `Bloqueadas / sin ingreso: ${report.totals.blockedTickets}`,
        `Asistentes escaneados: ${report.totals.scannedTickets} / ${report.totals.totalTickets}`,
        `Ordenes: ${report.totals.totalOrders}`,
        `Neto estimado organizador: ${money(report.totals.netEstimated)}`,
        `Reporte completo: ${report.reportUrl}`,
      ].join('\n');
      const organizerHtml = `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body bgcolor="#ffffff" style="margin:0;padding:0;background:#ffffff!important;color:#0f172a!important;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">Resumen final de ${safe(report.eventTitle)}.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;background:#ffffff!important;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background:#ffffff!important;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.03);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;border-bottom:2px solid #f1f5f9;padding:24px;">
              <img src="${appUrl}/logo-email-orange.png" alt="LPTicket" width="190" style="display:block;width:190px;max-width:70%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;padding:26px 24px 8px;">
              <p style="margin:0 0 8px;color:#F97316;font-size:11px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;">Resumen final del evento</p>
              <h1 style="margin:0 0 10px;color:#0A375A;font-size:25px;line-height:1.22;font-weight:900;">${safe(report.eventTitle)}</h1>
              <p style="margin:0;color:#475569;font-size:14px;line-height:1.6;">Hola ${safe(report.organizerName || 'organizador')}, aquí tienes el cierre completo de tu evento.</p>
              <p style="margin:12px 0 0;color:#334155;font-size:13px;line-height:1.55;"><strong>Fecha:</strong> ${safe(report.eventDateLabel)}<br><strong>Lugar:</strong> ${safe(report.venueLabel)}</p>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;padding:14px 18px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:6px;"><div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#f8fafc;"><p style="margin:0 0 5px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;">Ventas cobradas</p><p style="margin:0;color:#F97316;font-size:22px;font-weight:900;">${money(report.totals.grossSales)}</p></div></td>
                  <td width="50%" style="padding:6px;"><div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#f8fafc;"><p style="margin:0 0 5px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;">Entradas pagadas</p><p style="margin:0;color:#0f172a;font-size:22px;font-weight:900;">${report.totals.totalTickets}</p></div></td>
                </tr>
                <tr>
                  <td width="50%" style="padding:6px;"><div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#ffffff;"><p style="margin:0 0 5px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;">Bloqueadas / sin ingreso</p><p style="margin:0;color:#0f172a;font-size:22px;font-weight:900;">${report.totals.blockedTickets}</p></div></td>
                  <td width="50%" style="padding:6px;"><div style="border:1px solid #e2e8f0;border-radius:16px;padding:14px;background:#ffffff;"><p style="margin:0 0 5px;color:#64748b;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.8px;">Asistencia</p><p style="margin:0;color:#F97316;font-size:22px;font-weight:900;">${report.totals.scanRate}%</p></div></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff!important;padding:12px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;">
                <tr><td colspan="2" style="padding:16px 16px 8px;color:#0A375A;font-size:15px;font-weight:900;">Resumen financiero</td></tr>
                <tr><td style="padding:6px 16px;color:#64748b;font-size:13px;">Venta de tickets</td><td align="right" style="padding:6px 16px;color:#0f172a;font-size:13px;font-weight:900;">${money(report.totals.ticketRevenue)}</td></tr>
                <tr><td style="padding:6px 16px;color:#64748b;font-size:13px;">Cargos de servicio LPTicket</td><td align="right" style="padding:6px 16px;color:#0f172a;font-size:13px;font-weight:900;">${money(report.totals.lpFees)}</td></tr>
                <tr><td style="padding:6px 16px;color:#64748b;font-size:13px;">Procesamiento</td><td align="right" style="padding:6px 16px;color:#0f172a;font-size:13px;font-weight:900;">${money(report.totals.processingFees)}</td></tr>
                <tr><td style="padding:12px 16px 16px;color:#F97316;font-size:14px;font-weight:900;border-top:1px solid #e2e8f0;">Neto estimado organizador</td><td align="right" style="padding:12px 16px 16px;color:#F97316;font-size:17px;font-weight:900;border-top:1px solid #e2e8f0;">${money(report.totals.netEstimated)}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#ffffff" style="background:#ffffff!important;padding:18px 24px 30px;">
              <a href="${report.reportUrl}" target="_blank" style="display:inline-block;background:#F97316;color:#ffffff;text-decoration:none;border-radius:14px;padding:13px 26px;font-size:13px;font-weight:900;">Ver reporte completo</a>
              <p style="margin:14px 0 0;color:#64748b;font-size:12px;line-height:1.5;">LPTicket conserva el respaldo administrativo con el CSV completo de asistentes.</p>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="#f8fafc" style="background:#f8fafc!important;border-top:1px solid #e2e8f0;padding:18px 24px;">
              <p style="margin:0 0 4px;color:#F97316;font-size:12px;font-weight:900;">lpticket.com</p>
              <p style="margin:0;color:#64748b;font-size:11px;line-height:1.5;">© ${year} LPTicket · Tus tickets. Tus eventos.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      const info = await this.transporter.sendMail({
        from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
        to,
        subject: `Resumen final de tu evento: ${report.eventTitle}`,
        text,
        html: organizerHtml,
      });
      const accepted = Array.isArray((info as any)?.accepted) ? (info as any).accepted : [];
      const rejected = Array.isArray((info as any)?.rejected) ? (info as any).rejected : [];
      console.log('[Mail] Post-event report accepted:', accepted, 'rejected:', rejected, 'messageId:', (info as any)?.messageId);
      const target = String(to || '').trim().toLowerCase();
      const targetRejected = rejected.some((email: string) => String(email || '').trim().toLowerCase() === target);
      const targetAccepted = accepted.some((email: string) => String(email || '').trim().toLowerCase() === target);
      if (targetRejected || (accepted.length > 0 && !targetAccepted)) {
        console.error('[Mail] Post-event report target was not accepted:', to, 'accepted:', accepted, 'rejected:', rejected);
        return false;
      }
      if (accepted.length === 0 && rejected.length > 0) return false;
      let adminCopy: { accepted: string[]; rejected: string[]; messageId: string | null } | null = null;
      if (adminEmail && adminEmail.toLowerCase() !== target) {
        try {
          const adminInfo = await this.transporter.sendMail({
            from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
            to: adminEmail,
            subject: `[Copia admin] Resumen final de evento — ${report.eventTitle}`,
            text,
            html,
            attachments: adminAttachments,
          });
          adminCopy = {
            accepted: Array.isArray((adminInfo as any)?.accepted) ? (adminInfo as any).accepted : [],
            rejected: Array.isArray((adminInfo as any)?.rejected) ? (adminInfo as any).rejected : [],
            messageId: (adminInfo as any)?.messageId || null,
          };
          console.log('[Mail] Post-event admin copy accepted:', adminCopy.accepted, 'rejected:', adminCopy.rejected, 'messageId:', adminCopy.messageId);
        } catch (adminError: any) {
          console.error('Post-event report admin copy failed:', adminError?.message || adminError);
        }
      }
      return { accepted, rejected, messageId: (info as any)?.messageId || null, adminCopy };
    } catch (e: any) {
      console.error('Post-event report email failed:', e?.message || e);
      return false;
    }
  }

}
