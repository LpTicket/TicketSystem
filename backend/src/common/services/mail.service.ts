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

  async sendTicketEmail(to: string, userName: string, eventTitle: string, tickets: any[]) {
    const ticketDetails = tickets.map(t => `
      <div style="border: 1px solid #eee; padding: 15px; margin-bottom: 10px; border-radius: 8px;">
        <h3 style="margin-top: 0; color: #6366f1;">${eventTitle}</h3>
        <p><strong>Asiento:</strong> ${t.sectionName} — ${t.rowLabel}${t.seatNumber}</p>
        <p><strong>Código:</strong> ${t.ticketCode}</p>
        <div style="text-align: center;">
          <img src="${t.qrData}" alt="QR Code" width="150" height="150" />
        </div>
      </div>
    `).join('');

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1e1b4b;">¡Hola ${userName}! 👋</h1>
        <p>Gracias por tu compra. Aquí tienes tus tickets para <strong>${eventTitle}</strong>:</p>
        ${ticketDetails}
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Presenta estos códigos QR en la entrada del evento. 
          También puedes ver tus tickets en cualquier momento en tu perfil de LPTicket.
        </p>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: `"LPTicket" <${this.configService.get('SMTP_FROM')}>`,
        to,
        subject: `Tus tickets para ${eventTitle} — LPTicket`,
        html,
      });
    } catch (err) {
      console.error('Error sending email:', err);
    }
  }
}
