import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../constants/whatsapp.constants';

describe('WhatsAppTemplateService', () => {
  let service: WhatsAppTemplateService;

  const createService = async (configValues: Record<string, string> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppTemplateService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    return module.get<WhatsAppTemplateService>(WhatsAppTemplateService);
  };

  describe('Registry Coverage', () => {
    it('should register all 19 defined Jesmond events with metadata', async () => {
      service = await createService();
      const allTemplates = service.getAllTemplates();

      expect(allTemplates.length).toBe(19);

      // Verify key events exist in registry
      const eventNames = allTemplates.map((t) => t.event);
      expect(eventNames).toContain(WhatsAppEvent.AUTH_REGISTER_OTP);
      expect(eventNames).toContain(WhatsAppEvent.AUTH_LOGIN_OTP);
      expect(eventNames).toContain(WhatsAppEvent.AUTH_PASSWORD_RESET_OTP);
      expect(eventNames).toContain(WhatsAppEvent.ORDER_CONFIRMED);
      expect(eventNames).toContain(WhatsAppEvent.ORDER_PACKED);
      expect(eventNames).toContain(WhatsAppEvent.ORDER_DELIVERED);
      expect(eventNames).toContain(WhatsAppEvent.ORDER_TAKEN_AWAY);
      expect(eventNames).toContain(WhatsAppEvent.PROPERTY_LISTING_CONFIRMED);
      expect(eventNames).toContain(WhatsAppEvent.PROPERTY_QUERY_RECEIVED);
      expect(eventNames).toContain(WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED);
      expect(eventNames).toContain(WhatsAppEvent.APPOINTMENT_REQUEST_RECEIVED);
      expect(eventNames).toContain(WhatsAppEvent.APPOINTMENT_CONFIRMED);
      expect(eventNames).toContain(WhatsAppEvent.APPOINTMENT_REMINDER);
      expect(eventNames).toContain(WhatsAppEvent.APPOINTMENT_CANCELLED);
      expect(eventNames).toContain(WhatsAppEvent.APPOINTMENT_RESCHEDULED);
      expect(eventNames).toContain(WhatsAppEvent.SERVICE_PROVIDER_NEW_APPOINTMENT);
      expect(eventNames).toContain(WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CONFIRMED);
      expect(eventNames).toContain(WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_REMINDER);
      expect(eventNames).toContain(WhatsAppEvent.SERVICE_PROVIDER_APPOINTMENT_CANCELLED);
    });
  });

  describe('Approved vs Pending Status', () => {
    it('should default every template to PENDING_APPROVAL when not configured in env', async () => {
      service = await createService();
      const template = service.getTemplate(WhatsAppEvent.AUTH_REGISTER_OTP);

      expect(template).not.toBeNull();
      expect(template?.status).toBe(WhatsAppTemplateStatus.PENDING_APPROVAL);
      expect(service.isApproved(WhatsAppEvent.AUTH_REGISTER_OTP)).toBe(false);
    });

    it('should mark template as APPROVED when configured via MSG91_TPL_<EVENT>_STATUS=APPROVED', async () => {
      service = await createService({
        MSG91_TPL_AUTH_REGISTER_OTP_STATUS: 'APPROVED',
      });
      const template = service.getTemplate(WhatsAppEvent.AUTH_REGISTER_OTP);

      expect(template?.status).toBe(WhatsAppTemplateStatus.APPROVED);
      expect(service.isApproved(WhatsAppEvent.AUTH_REGISTER_OTP)).toBe(true);
    });

    it('should mark template as APPROVED when configured via MSG91_TPL_<EVENT>_APPROVED=true', async () => {
      service = await createService({
        MSG91_TPL_ORDER_CONFIRMED_APPROVED: 'true',
      });
      const template = service.getTemplate(WhatsAppEvent.ORDER_CONFIRMED);

      expect(template?.status).toBe(WhatsAppTemplateStatus.APPROVED);
      expect(service.isApproved(WhatsAppEvent.ORDER_CONFIRMED)).toBe(true);
    });

    it('should use customized template name from environment when configured', async () => {
      service = await createService({
        MSG91_TPL_ORDER_CONFIRMED: 'custom_jesmond_order_confirmed_v2',
      });
      const template = service.getTemplate(WhatsAppEvent.ORDER_CONFIRMED);

      expect(template?.templateName).toBe('custom_jesmond_order_confirmed_v2');
    });
  });

  describe('Variable Validation', () => {
    beforeEach(async () => {
      service = await createService();
    });

    it('should pass validation when all required variables are present', () => {
      const res = service.validateVariables(WhatsAppEvent.AUTH_REGISTER_OTP, {
        otp: '123456',
      });
      expect(res.isValid).toBe(true);
      expect(res.missing).toHaveLength(0);
    });

    it('should fail validation when required variable is missing', () => {
      const res = service.validateVariables(WhatsAppEvent.AUTH_REGISTER_OTP, {});
      expect(res.isValid).toBe(false);
      expect(res.missing).toContain('otp');
    });

    it('should fail validation when multiple required variables are missing', () => {
      const res = service.validateVariables(WhatsAppEvent.ORDER_CONFIRMED, {
        order_number: 'ORD-100',
      });
      expect(res.isValid).toBe(false);
      expect(res.missing).toContain('customer_name');
    });
  });

  describe('Component Formatting for MSG91', () => {
    beforeEach(async () => {
      service = await createService();
    });

    it('should format named variables into MSG91 body_1, body_2 components', () => {
      const components = service.formatComponents(WhatsAppEvent.ORDER_CONFIRMED, {
        order_number: 'ORD-999',
        customer_name: 'Sarah Connor',
      });

      expect(components).toEqual({
        body_1: { type: 'text', value: 'ORD-999' },
        body_2: { type: 'text', value: 'Sarah Connor' },
      });
    });

    it('should support explicit body_1, body_2 dictionary directly', () => {
      const components = service.formatComponents(WhatsAppEvent.AUTH_REGISTER_OTP, {
        body_1: '987654',
      });

      expect(components).toEqual({
        body_1: { type: 'text', value: '987654' },
      });
    });

    it('should return empty object when no variables provided', () => {
      const components = service.formatComponents(
        WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
        undefined,
      );
      expect(components).toEqual({});
    });
  });
});

