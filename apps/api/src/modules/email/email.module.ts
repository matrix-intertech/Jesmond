import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { EMAIL_QUEUE_NAME } from './constants/email.constants';
import { EmailService } from './email.service';
import { EmailTemplateService } from './services/email-template.service';
import { EmailLogService } from './services/email-log.service';
import { NodemailerProvider } from './providers/nodemailer.provider';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: EMAIL_QUEUE_NAME,
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
  providers: [
    EmailService,
    EmailTemplateService,
    EmailLogService,
    NodemailerProvider,
    EmailProcessor,
  ],
  exports: [
    EmailService,
    EmailTemplateService,
    EmailLogService,
    NodemailerProvider,
  ],
})
export class EmailModule {}

