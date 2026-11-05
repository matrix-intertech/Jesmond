import { Module } from '@nestjs/common';
import { PropertiesController } from './core/properties.controller';
import { PropertiesService } from './core/properties.service';
import { StorageService } from './core/storage.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { EmailModule } from '../email/email.module';
import { PropertyWhatsAppService } from './core/property-whatsapp.service';
import { PropertyEmailService } from './core/property-email.service';

@Module({
  imports: [WhatsAppModule, EmailModule],
  controllers: [PropertiesController],
  providers: [
    PropertiesService,
    StorageService,
    PropertyWhatsAppService,
    PropertyEmailService,
  ],
  exports: [
    PropertiesService,
    StorageService,
    PropertyWhatsAppService,
    PropertyEmailService,
  ],
})
export class PropertiesModule {}
