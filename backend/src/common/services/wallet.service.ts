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

  private readAppleCredential(valueKeys: string[], pathKey: string): Buffer | null {
    const rawValue = valueKeys
      .map((key) => this.configService.get<string>(key))
      .find(Boolean);

    if (rawValue) {
      const normalized = rawValue.replace(/\\n/g, '\n').trim();

      if (normalized.includes('-----BEGIN')) {
        return Buffer.from(normalized);
      }

      return Buffer.from(normalized, 'base64');
    }

    const filePath = this.configService.get<string>(pathKey);
    if (filePath && existsSync(filePath)) {
      return readFileSync(filePath);
    }

    return null;
  }

  // ── APPLE WALLET ────────────────────────────────────────────────────────────
  async generateApplePass(ticket: any): Promise<Buffer> {
    const passTypeIdentifier = this.configService.get<string>('APPLE_PASS_TYPE_ID');
    const teamIdentifier = this.configService.get<string>('APPLE_TEAM_ID');
    const signerCert = this.readAppleCredential(['APPLE_PASS_CERT', 'APPLE_PASS_CERT_PEM'], 'APPLE_PASS_CERT_PATH');
    const signerKey = this.readAppleCredential(['APPLE_PASS_KEY', 'APPLE_PASS_KEY_PEM'], 'APPLE_PASS_KEY_PATH');
    const wwdr = this.readAppleCredential(['APPLE_WWDR_CA', 'APPLE_WWDR_CA_PEM'], 'APPLE_WWDR_CA_PATH');

    if (!passTypeIdentifier || !teamIdentifier || !signerCert || !signerKey || !wwdr) {
      console.warn('[WalletService] Apple Wallet credentials not configured.');
      throw new Error('Apple Wallet no está configurado. Faltan credenciales o certificados Apple Pass en el servidor.');
    }

    try {
      const { PKPass } = require('passkit-generator');

      const appUrl = (this.configService.get<string>('APP_URL') || 'https://lpticket.com').replace(/\/$/, '');
      const eventDate = ticket.event?.eventDate ? new Date(ticket.event.eventDate) : null;
      const eventTime = ticket.event?.doorsOpen
        ? new Date(ticket.event.doorsOpen)
        : eventDate;

      const formattedDate = eventDate
        ? eventDate.toLocaleDateString('en-US', {
            timeZone: 'America/Chicago',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'To be confirmed';

      const formattedTime = eventTime
        ? eventTime.toLocaleTimeString('en-US', {
            timeZone: 'America/Chicago',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'To be confirmed';

      const venueName = ticket.event?.venueName || 'LP Ticket';
      const venueAddress = ticket.event?.venueAddress || venueName;
      const buyerName = [
        ticket.user?.firstName,
        ticket.user?.lastName,
      ].filter(Boolean).join(' ').trim() || ticket.user?.username || ticket.user?.email || 'Guest';
      const verifyUrl = `${appUrl}/verify/${ticket.ticketCode}`;

      const barcodePayload = {
        message: verifyUrl,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
        altText: ticket.ticketCode,
      };

      const pass = new PKPass(
        {},
        {
          wwdr,
          signerCert,
          signerKey,
        },
        {
          formatVersion: 1,
          passTypeIdentifier,
          teamIdentifier,
          organizationName: 'LPTicket',
          serialNumber: ticket.ticketCode,
          description: ticket.event?.title || 'LPTicket',
          logoText: 'LPTicket',
          foregroundColor: 'rgb(5,33,82)',
          backgroundColor: 'rgb(255,255,255)',
          labelColor: 'rgb(255,138,38)',
          barcode: barcodePayload,
          barcodes: [barcodePayload],
        }
      );

      pass.type = 'eventTicket';
      pass.setBarcodes(barcodePayload);

      const walletAssetDir = join(__dirname, '../assets/apple-wallet');
      pass.addBuffer('icon.png', readFileSync(join(walletAssetDir, 'icon.png')));
      pass.addBuffer('icon@2x.png', readFileSync(join(walletAssetDir, 'icon@2x.png')));
      pass.addBuffer('logo.png', readFileSync(join(walletAssetDir, 'logo.png')));
      pass.addBuffer('logo@2x.png', readFileSync(join(walletAssetDir, 'logo@2x.png')));

      pass.primaryFields.push({
        key: 'buyer',
        label: 'BUYER',
        value: buyerName,
      });

      pass.secondaryFields.push(
        {
          key: 'date',
          label: 'DATE',
          value: formattedDate,
        },
        {
          key: 'time',
          label: 'TIME',
          value: formattedTime,
        },
      );

      pass.auxiliaryFields.push(
        {
          key: 'section',
          label: 'ZONE',
          value: ticket.sectionName || 'General',
        },
        {
          key: 'venue',
          label: 'VENUE',
          value: [venueName, venueAddress].filter(Boolean).join(' - '),
        },
      );

      if (ticket.rowLabel || ticket.seatNumber) {
        let rowVal = ticket.rowLabel || '-';
        let seatVal = String(ticket.seatNumber || '-');
        let rowLabelText = 'ROW';
        let seatLabelText = 'SEAT';

        const seatMesaMatch = String(ticket.seatNumber || '').trim().match(/^(mesa|table)\s*(\d+)$/i);
        const mesaMatch = String(ticket.rowLabel || '').trim().match(/^(mesa|table)\s*(\d+)$/i);

        if (seatMesaMatch) {
          rowLabelText = 'MESA';
          seatLabelText = 'SILLA';
          rowVal = ticket.rowLabel || '-';
          seatVal = seatMesaMatch[2];
        } else if (mesaMatch) {
          rowLabelText = 'MESA';
          seatLabelText = 'SILLA';
          rowVal = mesaMatch[2];
          seatVal = String(ticket.seatNumber || '-');
        } else if (/^(mesa|table)\b/i.test(String(ticket.rowLabel || '').trim())) {
          rowLabelText = 'MESA';
          seatLabelText = 'SILLA';
          rowVal = ticket.sectionName || '-';
          seatVal = String(ticket.seatNumber || '-');
        }

        pass.headerFields.push(
          {
            key: 'row',
            label: rowLabelText,
            value: rowVal,
          },
          {
            key: 'seat',
            label: seatLabelText,
            value: seatVal,
          },
        );
      }

      pass.backFields.push(
        {
          key: 'ticketCode',
          label: 'Ticket Code',
          value: ticket.ticketCode,
        },
        {
          key: 'eventDateTime',
          label: 'Date and Time',
          value: `${formattedDate} - ${formattedTime}`,
        },
        {
          key: 'eventAddress',
          label: 'Address',
          value: venueAddress,
        },
        {
          key: 'verifyUrl',
          label: 'Verification',
          value: verifyUrl,
        },
        {
          key: 'terms',
          label: 'Terms',
          value: 'Present this QR code at the event entrance. This ticket is personal and must be validated by LP Ticket.',
        },
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

      // Event ticket class definition (auto-creates if it doesn't exist)
      const ticketClass = {
        id: fullClassId,
        issuerName: 'LPTicket',
        reviewStatus: 'UNDER_REVIEW',
        eventId: ticket.event?.id || 'lpticket-event',
        eventName: {
          defaultValue: { language: 'es', value: ticket.event?.title || 'LPTicket Event' },
        },
        logo: {
          sourceUri: { uri: `${appUrl}/logo.png` },
        },
      };

      // Event ticket object definition
      const ticketObject = {
        id:    objectId,
        classId: fullClassId,
        state: 'ACTIVE',
        ticketHolderName: ticket.user?.firstName
          ? `${ticket.user.firstName} ${ticket.user.lastName || ''}`.trim()
          : 'Guest',
        ticketNumber: ticket.ticketCode,
        barcode: {
          type:          'QR_CODE',
          value:         `${appUrl}/verify/${ticket.ticketCode}`,
          alternateText: ticket.ticketCode,
        },
        seatInfo: ticket.rowLabel ? (() => {
          let rowVal = ticket.rowLabel;
          let seatVal = String(ticket.seatNumber || '');

          const seatMesaMatch = String(ticket.seatNumber || '').trim().match(/^(mesa|table)\s*(\d+)$/i);
          const mesaMatch = String(ticket.rowLabel || '').trim().match(/^(mesa|table)\s*(\d+)$/i);

          if (seatMesaMatch) {
            rowVal = ticket.rowLabel;
            seatVal = seatMesaMatch[2];
          } else if (mesaMatch) {
            rowVal = mesaMatch[2];
            seatVal = String(ticket.seatNumber || '');
          } else if (/^(mesa|table)\b/i.test(String(ticket.rowLabel || '').trim())) {
            rowVal = ticket.sectionName || '';
            seatVal = String(ticket.seatNumber || '');
          }

          return {
            seat:    { defaultValue: { language: 'es', value: seatVal } },
            row:     { defaultValue: { language: 'es', value: rowVal } },
            section: { defaultValue: { language: 'es', value: ticket.sectionName || '' } },
          };
        })() : undefined,
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
        origins: [appUrl, 'http://localhost:3000'],
        typ:     'savetowallet',
        payload: {
          eventTicketClasses: [ticketClass],
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
