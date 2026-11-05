import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppTemplateService } from './services/whatsapp-template.service';
import { WhatsAppLogService } from './services/whatsapp-log.service';
import { Msg91Provider } from './providers/msg91.provider';
import { WhatsAppEvent } from './constants/whatsapp.constants';
import { WhatsAppNotificationStatus } from '@prisma/client';

describe('WhatsAppController', () => {
  let controller: WhatsAppController;
  let whatsappService: WhatsAppService;
  let templateService: WhatsAppTemplateService;
  let logService: WhatsAppLogService;
  let msg91Provider: Msg91Provider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsAppController],
      providers: [
        {
          provide: WhatsAppService,
          useValue: {
            sendNotification: jest.fn(),
          },
        },
        {
          provide: WhatsAppTemplateService,
          useValue: {
            getAllTemplates: jest.fn(),
          },
        },
        {
          provide: WhatsAppLogService,
          useValue: {
            queryLogs: jest.fn(),
          },
        },
        {
          provide: Msg91Provider,
          useValue: {
            isEnabled: jest.fn().mockReturnValue(false),
            isConfigured: jest.fn().mockReturnValue(true),
            getSenderNumber: jest.fn().mockReturnValue('61400000000'),
            getBaseUrl: jest.fn().mockReturnValue('https://control.msg91.com/api/v5/'),
            getTimeoutMs: jest.fn().mockReturnValue(10000),
          },
        },
      ],
    }).compile();

    controller = module.get<WhatsAppController>(WhatsAppController);
    whatsappService = module.get<WhatsAppService>(WhatsAppService);
    templateService = module.get<WhatsAppTemplateService>(WhatsAppTemplateService);
    logService = module.get<WhatsAppLogService>(WhatsAppLogService);
    msg91Provider = module.get<Msg91Provider>(Msg91Provider);
  });

  it('should return operational status', async () => {
    const status = await controller.getStatus();
    expect(status).toEqual({
      enabled: false,
      configured: true,
      senderConfigured: true,
      baseUrl: 'https://control.msg91.com/api/v5/',
      timeoutMs: 10000,
    });
  });

  it('should list all registered templates', async () => {
    (templateService.getAllTemplates as jest.Mock).mockReturnValue([
      { event: WhatsAppEvent.AUTH_REGISTER_OTP },
    ]);
    const templates = await controller.getTemplates();
    expect(templates).toHaveLength(1);
  });

  it('should query logs via logService', async () => {
    (logService.queryLogs as jest.Mock).mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });
    const result = await controller.getLogs({
      event: WhatsAppEvent.AUTH_REGISTER_OTP,
      status: WhatsAppNotificationStatus.SENT,
    });
    expect(result.data).toEqual([]);
    expect(logService.queryLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: WhatsAppEvent.AUTH_REGISTER_OTP,
        status: WhatsAppNotificationStatus.SENT,
      }),
    );
  });

  it('should process testSend via whatsappService', async () => {
    (whatsappService.sendNotification as jest.Mock).mockResolvedValue({
      success: true,
      status: WhatsAppNotificationStatus.SENT,
    });

    const result = await controller.testSend(
      {
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        variables: { otp: '999999' },
      },
      { user: { id: 'admin-1' } },
    );

    expect(result.success).toBe(true);
    expect(whatsappService.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: WhatsAppEvent.AUTH_REGISTER_OTP,
        recipient: '0412345678',
        metadata: expect.objectContaining({
          initiatedBy: 'admin-1',
          isTestSend: true,
        }),
      }),
    );
  });
});

