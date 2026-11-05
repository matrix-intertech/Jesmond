import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { WHATSAPP_QUEUE_NAME } from './constants/whatsapp.constants';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import { WhatsAppTemplateService } from './services/whatsapp-template.service';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppProcessor } from './whatsapp.processor';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: WHATSAPP_QUEUE_NAME,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    }),
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    WhatsAppTemplateService,
    WhatsAppLogService,
    Msg91Provider,
    WhatsAppProcessor,
  ],
  exports: [
    WhatsAppService,
    WhatsAppTemplateService,
    WhatsAppLogService,
    Msg91Provider,
  ],
})
export class WhatsAppModule {}

