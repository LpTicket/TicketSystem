import { Module, Global } from '@nestjs/common';
import { MailService } from './services/mail.service';
import { WalletService } from './services/wallet.service';

@Global()
@Module({
  providers: [MailService, WalletService],
  exports: [MailService, WalletService],
})
export class CommonModule {}
