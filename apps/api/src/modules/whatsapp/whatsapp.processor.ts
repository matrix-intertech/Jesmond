import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WHATSAPP_QUEUE_NAME } from './constants/whatsapp.constants';
import { WhatsAppJobData } from './interfaces/whatsapp.interface';
import { WhatsAppService } from './whatsapp.service';

@Processor(WHATSAPP_QUEUE_NAME)
export class WhatsAppProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsAppProcessor.name);

  constructor(private readonly whatsappService: WhatsAppService) {
    super();
  }

  async process(job: Job<WhatsAppJobData, any, string>): Promise<any> {
    const attempt = job.attemptsMade + 1;
    this.logger.log(
      `BullMQ: Processing WhatsApp notification job ${job.id} (attempt ${attempt}) for event "${job.data.event}"`,
    );

    return this.whatsappService.executeDelivery(job.data, attempt);
  }
}

