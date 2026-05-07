import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync, existsSync } from 'fs';

@Injectable()
export class WalletService {
  constructor(private readonly configService: ConfigService) {}

  async generateApplePass(ticket: any): Promise<Buffer> {
    const certPath = this.configService.get('APPLE_PASS_CERT_PATH');
    
    // Check if we have the environment to actually generate passes
    // If not, we return a mock to not block the rest of the application
    if (!certPath || !existsSync(certPath)) {
      console.warn('Apple Wallet certificates missing. Returning mock pass.');
      return Buffer.from('MOCK_PASS_CONTENT');
    }

    try {
      // Dynamic import to avoid compilation issues if types are mismatched
      const { PKPass } = require('passkit-generator');
      
      const wwdrPath = this.configService.get('APPLE_WWDR_CA_PATH');
      const keyPath = this.configService.get('APPLE_PASS_KEY_PATH');

      const pass = new PKPass(
        {
          wwdr: readFileSync(wwdrPath!),
          signerCert: readFileSync(certPath),
          signerKey: readFileSync(keyPath!),
          signerKeyPassphrase: this.configService.get('APPLE_PASS_KEY_PASS') || '',
        },
        {
          formatVersion: 1,
          passTypeIdentifier: this.configService.get('APPLE_PASS_TYPE_ID') || 'pass.com.lpticket',
          teamIdentifier: this.configService.get('APPLE_TEAM_ID') || 'TEAMID123',
          organizationName: 'LPTicket',
          serialNumber: ticket.ticketCode,
          description: ticket.event.title,
        }
      );

      pass.type = 'eventTicket';
      pass.primaryFields.push({ key: 'event', label: 'Evento', value: ticket.event.title });
      
      return await pass.export();
    } catch (err) {
      console.error('Error generating pass:', err);
      return Buffer.from('ERROR_GENERATING_PASS');
    }
  }

  async generateGoogleWalletLink(ticket: any) {
    const issuerId = this.configService.get('GOOGLE_WALLET_ISSUER_ID');
    if (!issuerId) return '#';
    return `https://pay.google.com/gp/v/save/ticket/${ticket.ticketCode}`;
  }
}
