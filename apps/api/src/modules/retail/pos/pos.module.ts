import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosWebhookController, PosWebhookService } from './pos.controller';
import { PosSandboxController } from './pos.sandbox.controller';

@Module({
  providers: [PosService, PosWebhookService],
  controllers: [PosWebhookController, PosSandboxController]
})
export class PosModule {}
