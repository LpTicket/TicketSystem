import { Module, Global } from '@nestjs/common';
import { MailService } from './services/mail.service';
import { WalletService } from './services/wallet.service';
import { StorageService } from './services/storage.service';

import { ContactController } from './controllers/contact.controller';

@Global()
@Module({
  providers: [MailService, WalletService, StorageService],
  controllers: [ContactController],
  exports: [MailService, WalletService, StorageService],
})
export class CommonModule {}
