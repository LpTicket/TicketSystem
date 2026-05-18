import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// APPLE WALLET — Requirements (from Apple Developer account):
//   APPLE_PASS_TYPE_ID      e.g. "pass.com.yourcompany.lpticket"
//   APPLE_TEAM_ID           e.g. "ABCDE12345"  (from developer.apple.com)
//   APPLE_PASS_CERT_PATH    Absolute path to signerCert.pem
//   APPLE_PASS_KEY_PATH     Absolute path to signerKey.pem
//   APPLE_PASS_KEY_PASS     Passphrase for the signer key (may be empty)
//   APPLE_WWDR_CA_PATH      Absolute path to wwdr.pem (Apple WWDR G4 cert)
//
// GOOGLE WALLET — Requirements (from Google Wallet Console):
//   GOOGLE_WALLET_ISSUER_ID        Numeric issuer ID from Google Wallet Console
//   GOOGLE_WALLET_SERVICE_ACCOUNT  Path to service account JSON file
//   GOOGLE_WALLET_CLASS_ID         e.g. "issuer_id.lpticket_eventticket"
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WalletService {
  constructor(private readonly configService: ConfigService) {}

  // ── APPLE WALLET ────────────────────────────────────────────────────────────
  async generateApplePass(ticket: any): Promise<Buffer> {
    const certPath = this.configService.get<string>('APPLE_PASS_CERT_PATH');
    const keyPath  = this.configService.get<string>('APPLE_PASS_KEY_PATH');
    const wwdrPath = this.configService.get<string>('APPLE_WWDR_CA_PATH');

    const certPem = this.configService.get<string>('APPLE_PASS_CERT_PEM');
    const keyPem  = this.configService.get<string>('APPLE_PASS_KEY_PEM');
    const wwdrPem = this.configService.get<string>('APPLE_WWDR_CA_PEM');

    const hasPemEnv = !!(certPem && keyPem && wwdrPem);
    const hasFiles = !!(certPath && existsSync(certPath) && keyPath && existsSync(keyPath) && wwdrPath && existsSync(wwdrPath));

    // Graceful degradation — credentials not configured yet
    if (!hasPemEnv && !hasFiles) {
      console.warn('[WalletService] Apple Wallet credentials not configured. Set APPLE_PASS_CERT_PATH, APPLE_PASS_KEY_PATH and APPLE_WWDR_CA_PATH, or their PEM equivalents.');
      throw new Error('Apple Wallet not configured');
    }

    try {
      const { PKPass } = require('passkit-generator');

      const appUrl = (this.configService.get<string>('APP_URL') || 'https://lpticket.com').replace(/\/$/, '');

      let wwdrBuffer: Buffer;
      let certBuffer: Buffer;
      let keyBuffer: Buffer;

      if (hasPemEnv) {
        const normalizePem = (pem: string, type: 'CERTIFICATE' | 'PRIVATE KEY') => {
          let clean = pem
            .replace(/\\r/g, '')
            .replace(/\\n/g, '\n')
            .replace(/\r/g, '')
            .trim();

          const header = `-----BEGIN ${type}-----`;
          const footer = `-----END ${type}-----`;

          let body = clean;
          if (body.includes(header)) body = body.replace(header, '');
          if (body.includes(footer)) body = body.replace(footer, '');
          
          body = body.replace(/\s+/g, '');

          const lines: string[] = [];
          lines.push(header);
          for (let i = 0; i < body.length; i += 64) {
            lines.push(body.substring(i, i + 64));
          }
          lines.push(footer);

          return lines.join('\n');
        };

        wwdrBuffer = Buffer.from(normalizePem(wwdrPem, 'CERTIFICATE'), 'utf8');
        certBuffer = Buffer.from(normalizePem(certPem, 'CERTIFICATE'), 'utf8');
        keyBuffer = Buffer.from(normalizePem(keyPem, 'PRIVATE KEY'), 'utf8');
      } else {
        wwdrBuffer = readFileSync(wwdrPath!);
        certBuffer = readFileSync(certPath!);
        keyBuffer = readFileSync(keyPath!);
      }

      const passphrase = this.configService.get<string>('APPLE_PASS_KEY_PASS');
      const pass = new PKPass(
        {},
        {
          wwdr:              wwdrBuffer,
          signerCert:        certBuffer,
          signerKey:         keyBuffer,
          ...(passphrase ? { signerKeyPassphrase: passphrase } : {}),
        },
        {
          formatVersion:      1,
          passTypeIdentifier: this.configService.get<string>('APPLE_PASS_TYPE_ID') || 'pass.com.lpticket.wallet',
          teamIdentifier:     this.configService.get<string>('APPLE_TEAM_ID')       || 'YTL446KYZR',
          organizationName:   'LPTicket',
          serialNumber:       ticket.ticketCode,
          description:        ticket.event?.title || 'LPTicket',
          logoText:           'LPTicket',
          foregroundColor:    'rgb(255,255,255)',
          backgroundColor:    'rgb(239,68,68)',
          labelColor:         'rgb(255,255,255)',
          barcode: {
            message:         `${appUrl}/verify/${ticket.ticketCode}`,
            format:          'PKBarcodeFormatQR',
            messageEncoding: 'iso-8859-1',
          },
        }
      );

      pass.type = 'eventTicket';

      pass.primaryFields.push({
        key:   'event',
        label: 'EVENTO',
        value: ticket.event?.title || '',
      });

      pass.secondaryFields.push(
        {
          key:   'section',
          label: 'SECCIÓN',
          value: ticket.sectionName || '',
        },
        {
          key:          'date',
          label:        'FECHA',
          value:        ticket.event?.eventDate ? new Date(ticket.event.eventDate).toLocaleDateString('es-VE', { dateStyle: 'medium' }) : '',
          dateStyle:    'PKDateStyleMedium',
          timeStyle:    'PKDateStyleShort',
          isRelative:   false,
        },
      );

      if (ticket.rowLabel) {
        pass.auxiliaryFields.push(
          { key: 'row',  label: 'FILA',    value: ticket.rowLabel },
          { key: 'seat', label: 'ASIENTO', value: String(ticket.seatNumber || '') },
        );
      }

      pass.backFields.push(
        { key: 'code',    label: 'Código',          value: ticket.ticketCode },
        { key: 'terms',   label: 'Términos',         value: 'Este ticket es personal e intransferible. Preséntalo en la entrada del evento.' },
        { key: 'support', label: 'Soporte',          value: appUrl },
      );

      return pass.getAsBuffer();
    } catch (err) {
      console.error('[WalletService] Error generating Apple pass:', err);
      throw err;
    }
  }

  // ── GOOGLE WALLET ───────────────────────────────────────────────────────────
  async generateGoogleWalletLink(ticket: any): Promise<string> {
    const issuerId   = this.configService.get<string>('GOOGLE_WALLET_ISSUER_ID');
    const saPath     = this.configService.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT');
    const classId    = this.configService.get<string>('GOOGLE_WALLET_CLASS_ID');
    const saJsonEnv  = this.configService.get<string>('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON');

    // Graceful degradation — credentials not configured yet
    if (!issuerId || (!saJsonEnv && (!saPath || !existsSync(saPath)))) {
      console.warn('[WalletService] Google Wallet credentials not configured. Set GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_SERVICE_ACCOUNT or GOOGLE_WALLET_SERVICE_ACCOUNT_JSON.');
      throw new Error('Google Wallet not configured');
    }

    try {
      const { GoogleAuth } = require('google-auth-library');
      const jwt = require('jsonwebtoken');

      let serviceAccount;
      if (saJsonEnv) {
        serviceAccount = JSON.parse(saJsonEnv);
      } else if (saPath) {
        serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
      } else {
        throw new Error('Google Wallet service account file path is not configured');
      }
      const appUrl = (this.configService.get<string>('APP_URL') || 'https://lpticket.com').replace(/\/$/, '');

      const objectId = `${issuerId}.${ticket.ticketCode}`;
      const fullClassId = classId || `${issuerId}.lpticket_eventticket`;

      // Event ticket object definition
      const ticketObject = {
        id:    objectId,
        classId: fullClassId,
        state: 'ACTIVE',
        ticketHolderName: ticket.user?.firstName
          ? `${ticket.user.firstName} ${ticket.user.lastName || ''}`.trim()
          : 'Asistente',
        ticketNumber: ticket.ticketCode,
        barcode: {
          type:          'QR_CODE',
          value:         `${appUrl}/verify/${ticket.ticketCode}`,
          alternateText: ticket.ticketCode,
        },
        eventName: {
          defaultValue: { language: 'es', value: ticket.event?.title || 'LPTicket Event' },
        },
        logo: {
          sourceUri: { uri: `${appUrl}/logo.png` },
        },
        seatInfo: ticket.rowLabel ? {
          seat:    { defaultValue: { language: 'es', value: String(ticket.seatNumber || '') } },
          row:     { defaultValue: { language: 'es', value: ticket.rowLabel } },
          section: { defaultValue: { language: 'es', value: ticket.sectionName || '' } },
        } : undefined,
        textModulesData: [
          { header: 'Sección', body: ticket.sectionName || 'General' },
          { header: 'Código',  body: ticket.ticketCode },
        ],
        infoModuleData: {
          labelValueRows: [
            {
              columns: [
                { label: 'Evento', value: ticket.event?.title || '' },
                { label: 'Lugar',  value: ticket.event?.venueName || '' },
              ],
            },
          ],
        },
        validTimeInterval: ticket.event?.eventDate ? {
          start: { date: new Date(ticket.event.eventDate).toISOString() },
        } : undefined,
      };

      // Sign JWT
      const claims = {
        iss:     serviceAccount.client_email,
        aud:     'google',
        origins: [appUrl],
        typ:     'savetowallet',
        payload: {
          eventTicketObjects: [ticketObject],
        },
      };

      const token = jwt.sign(claims, serviceAccount.private_key, { algorithm: 'RS256' });
      return `https://pay.google.com/gp/v/save/${token}`;
    } catch (err) {
      console.error('[WalletService] Error generating Google Wallet link:', err);
      throw err;
    }
  }
}
