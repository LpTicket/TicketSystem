import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

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
    eventInfo?: { venueName?: string | null; venueAddress?: string | null; eventDate?: string; eventTimezone?: string },
  ) {
    const appUrl = this.getAppUrl();
    const eventAddress = [eventInfo?.venueName, eventInfo?.venueAddress].filter(Boolean).join(' — ');

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
    const ticketDetails = tickets.map(t => {
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

      return `
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 25px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Card branding header -->
        <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; margin-bottom: 18px; display: table; width: 100%;">
          <div style="display: table-cell; font-size: 20px; font-weight: 900; color: #ff6b1a; font-family: monospace; letter-spacing: -1px;">LPTICKET</div>
          <div style="display: table-cell; text-align: right; font-size: 9px; font-weight: bold; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; vertical-align: middle;">Digital Ticket</div>
        </div>

        <h3 style="margin-top: 0; margin-bottom: 8px; color: #0a375a; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px;">${eventTitle}</h3>

        <!-- Info labels -->
        <div style="margin-bottom: 15px; font-size: 12px; color: #475569; line-height: 1.6;">
          <p style="margin: 4px 0;"><strong>Comprador:</strong> ${userName}</p>
          ${eventDateFormatted ? `<p style="margin: 4px 0;"><strong>Fecha y Hora:</strong> ${eventDateFormatted}</p>` : ''}
          ${shouldShowSection ? `<p style="margin: 4px 0;"><strong>Sección:</strong> ${t.sectionName}</p>` : ''}
          <p style="margin: 4px 0;"><strong>Ubicación:</strong> ${details}</p>
          <p style="margin: 4px 0; font-family: monospace;"><strong>Código:</strong> <span style="color: #ff6b1a; font-weight: bold;">${t.ticketCode}</span></p>
        </div>

        <!-- Center QR (CID inline image) -->
        <div style="text-align: center; margin: 20px 0;">
          <img src="cid:${qrCid}" alt="QR Code" width="160" height="160" style="border: 1px solid #e2e8f0; padding: 8px; border-radius: 12px; background: #ffffff;" />
          <span style="display: block; font-size: 10px; color: #94a3b8; margin-top: 8px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">Presentar este código QR en el acceso</span>
        </div>

                <div style="text-align: center; margin: 18px 0 6px 0;">
          <a href="${ticketUrl}" target="_blank" style="display: inline-block; background: #ff6b1a; color: #ffffff; text-decoration: none; border-radius: 14px; padding: 12px 18px; font-size: 12px; font-weight: 900; letter-spacing: 0.8px; text-transform: uppercase;">
            Compartir
          </a>
        </div>

<!-- Footer terms info -->    <div style="border-top: 1px dashed #cbd5e1; padding-top: 15px; margin-top: 15px; font-size: 9px; color: #94a3b8; text-align: center; line-height: 1.4; text-transform: uppercase; font-weight: bold;">
          LPTICKET.COM — TUS TICKETS. TUS EVENTOS.
        </div>
      </div>
    `;
    }).join('');

    const html = `
      <div style="background-color: #f8fafc; padding: 30px 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 560px; margin: 0 auto;">
          <div style="margin-bottom: 25px; text-align: center;">
            <h1 style="color: #0a375a; font-size: 24px; font-weight: 850; margin: 0; letter-spacing: -0.5px;">¡Hola, ${userName}! 👋</h1>
            <p style="color: #475569; font-size: 14px; margin-top: 6px; margin-bottom: 0;">Gracias por tu compra. Aquí tienes tus entradas listas para el evento:</p>
          </div>
          
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

    try {
      await this.transporter.sendMail({
        from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
        to,
        bcc: this.configService.get('ADMIN_EMAIL'),
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
            <div style="background-color:#0a375a;padding:24px 28px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="font-size:24px;font-weight:900;color:#f97316;letter-spacing:-1px;">LP</span>
                <span style="font-size:24px;font-weight:900;color:#ffffff;letter-spacing:-1px;">Ticket</span>
              </div>
              <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:2px;font-weight:700;">
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
              <p style="margin:0 0 8px 0;font-size:18px;color:#0a375a;font-weight:800;">
                ¡Hola, ${userName}! 👋
              </p>
              <p style="margin:0 0 24px 0;font-size:14px;color:#475569;line-height:1.6;">
                Te recordamos que tienes una entrada confirmada para el siguiente evento:
              </p>

              <!-- Event Info Box -->
              <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:24px;">
                <h3 style="margin:0 0 10px 0;font-size:20px;font-weight:800;color:#0a375a;line-height:1.3;text-transform:uppercase;letter-spacing:-0.5px;">
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
        <h2 style="color: #0a375a; margin-top: 0;">Nuevo mensaje de contacto</h2>
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
}
