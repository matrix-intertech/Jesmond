import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EMAIL_JOB_NAME, EMAIL_QUEUE_NAME } from './constants/email.constants';
import { EmailJobData } from './interfaces/email.interface';
import { EmailService } from './email.service';

@Processor(EMAIL_QUEUE_NAME)
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }

  async process(job: Job<EmailJobData, any, string>): Promise<any> {
    if (job.name === EMAIL_JOB_NAME) {
      this.logger.debug(
        `Processing queued email notification: job ${job.id}, event: ${job.data.options.event}`,
      );
      return this.emailService.executeQueuedEmail(job.data);
    }
    this.logger.warn(`Unknown job name on email queue: ${job.name}`);
  }
}

