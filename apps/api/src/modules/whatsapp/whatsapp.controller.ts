import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppTemplateService } from './services/whatsapp-template.service';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import { Msg91Provider } from './providers/msg91.provider';
import { QueryWhatsAppLogsDto } from './dto/query-whatsapp-logs.dto';
import { SendWhatsAppDto } from './dto/send-whatsapp.dto';

@Controller('admin/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class WhatsAppController {
  constructor(
    private readonly whatsappService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly logService: WhatsAppLogService,
    private readonly msg91Provider: Msg91Provider,
  ) {}

  @Get('status')
  async getStatus() {
    return {
      enabled: this.msg91Provider.isEnabled(),
      configured: this.msg91Provider.isConfigured(),
      senderConfigured: Boolean(this.msg91Provider.getSenderNumber()),
      baseUrl: this.msg91Provider.getBaseUrl(),
      timeoutMs: this.msg91Provider.getTimeoutMs(),
    };
  }

  @Get('templates')
  async getTemplates() {
    return this.templateService.getAllTemplates();
  }

  @Get('logs')
  async getLogs(@Query() query: QueryWhatsAppLogsDto) {
    return this.logService.queryLogs({
      eventType: query.event,
      status: query.status,
      recipient: query.recipient,
      relatedEntityId: query.relatedEntityId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('test-send')
  @Roles(UserRole.SUPER_ADMIN)
  async testSend(@Body() dto: SendWhatsAppDto, @Request() req: any) {
    return this.whatsappService.sendNotification({
      event: dto.event,
      recipient: dto.recipient,
      variables: dto.variables,
      userId: dto.userId || req.user?.id,
      relatedEntityId: dto.relatedEntityId,
      idempotencyKey: dto.idempotencyKey,
      metadata: {
        ...(dto.metadata || {}),
        initiatedBy: req.user?.id,
        isTestSend: true,
      },
    });
  }
}

