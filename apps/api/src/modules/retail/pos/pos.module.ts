import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosWebhookController, PosWebhookService } from './pos.controller';

@Module({
  providers: [PosService, PosWebhookService],
  controllers: [PosWebhookController]
})
export class PosModule {}
