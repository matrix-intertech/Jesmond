import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Msg91Provider } from './msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../constants/whatsapp.constants';
import { WhatsAppTemplateDefinition } from '../interfaces/whatsapp.interface';

describe('Msg91Provider', () => {
  let provider: Msg91Provider;
  let configService: ConfigService;
  let originalFetch: typeof global.fetch;

  const mockApprovedTemplate: WhatsAppTemplateDefinition = {
    event: WhatsAppEvent.AUTH_REGISTER_OTP,
    templateName: 'jesmond_auth_register_otp',
    status: WhatsAppTemplateStatus.APPROVED,
    language: 'en',
    requiredVariables: ['otp'],
    description: 'Registration OTP',
  };

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const createProvider = async (configValues: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Msg91Provider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => configValues[key]),
          },
        },
      ],
    }).compile();

    return module.get<Msg91Provider>(Msg91Provider);
  };

  describe('Configuration & Credentials', () => {
    it('should report unconfigured when MSG91_AUTH_KEY is missing', async () => {
      provider = await createProvider({
        MSG91_WHATSAPP_SENDER: '61412345678',
        MSG91_WHATSAPP_ENABLED: 'true',
      });
      expect(provider.isConfigured()).toBe(false);
      expect(provider.getAuthKey()).toBeUndefined();
    });

    it('should report unconfigured when MSG91_WHATSAPP_SENDER is missing', async () => {
      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-auth-key-1234',
        MSG91_WHATSAPP_ENABLED: 'true',
      });
      expect(provider.isConfigured()).toBe(false);
    });

    it('should report configured when both key and sender are present', async () => {
      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-auth-key-1234',
        MSG91_WHATSAPP_SENDER: '+61412345678',
        MSG91_WHATSAPP_ENABLED: 'true',
      });
      expect(provider.isConfigured()).toBe(true);
      expect(provider.getSenderNumber()).toBe('61412345678');
    });

    it('should return error if sendTemplateMessage is called without configuration', async () => {
      provider = await createProvider({});
      const result = await provider.sendTemplateMessage({
        recipient: '0412345678',
        template: mockApprovedTemplate,
        components: { body_1: { type: 'text', value: '123456' } },
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });
  });

  describe('Disabled WhatsApp Configuration', () => {
    it('should mock successful send without HTTP request when MSG91_WHATSAPP_ENABLED=false', async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch;

      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-auth-key',
        MSG91_WHATSAPP_SENDER: '61412345678',
        MSG91_WHATSAPP_ENABLED: 'false',
      });

      const result = await provider.sendTemplateMessage({
        recipient: '0412345678',
        template: mockApprovedTemplate,
        components: { body_1: { type: 'text', value: '123456' } },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('MOCK_DISABLED_');
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Phone Number Normalization & Validation', () => {
    beforeEach(async () => {
      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-key',
        MSG91_WHATSAPP_SENDER: '61400000000',
        MSG91_WHATSAPP_ENABLED: 'true',
      });
    });

    it('should normalize Australian mobile from 04XXXXXXXX to 614XXXXXXXX', () => {
      const res = provider.normalizePhoneNumber('0412345678');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('61412345678');
    });

    it('should normalize Australian mobile from formatted (0412) 345-678 to 61412345678', () => {
      const res = provider.normalizePhoneNumber('(0412) 345-678');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('61412345678');
    });

    it('should normalize Australian mobile from +614XXXXXXXX to 614XXXXXXXX', () => {
      const res = provider.normalizePhoneNumber('+61412345678');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('61412345678');
    });

    it('should normalize international E.164 numbers without +', () => {
      const res = provider.normalizePhoneNumber('+14155552671');
      expect(res.isValid).toBe(true);
      expect(res.normalized).toBe('14155552671');
    });

    it('should reject invalid non-numeric phone strings', () => {
      const res = provider.normalizePhoneNumber('not-a-number');
      expect(res.isValid).toBe(false);
      expect(res.reason).toBeDefined();
    });

    it('should reject numbers that are too short', () => {
      const res = provider.normalizePhoneNumber('12345');
      expect(res.isValid).toBe(false);
    });
  });

  describe('MSG91 WhatsApp API Dispatch & Responses', () => {
    it('should construct correct MSG91 v5 payload and handle successful response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            status: 'success',
            message_id: 'msg_req_998877',
            message: 'Template sent',
          }),
      });
      global.fetch = mockFetch;

      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-auth-key-secret',
        MSG91_WHATSAPP_SENDER: '0400000000',
        MSG91_WHATSAPP_ENABLED: 'true',
        MSG91_WHATSAPP_BASE_URL: 'https://control.msg91.com/api/v5/whatsapp/test/',
      });

      const result = await provider.sendTemplateMessage({
        recipient: '0412345678',
        template: mockApprovedTemplate,
        components: { body_1: { type: 'text', value: '456789' } },
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg_req_998877');

      // Verify payload sent to fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://control.msg91.com/api/v5/whatsapp/test/');
      expect(options.headers.authkey).toBe('test-auth-key-secret');
      expect(options.headers['Content-Type']).toBe('application/json');

      const parsedBody = JSON.parse(options.body);
      expect(parsedBody.integrated_number).toBe('61400000000');
      expect(parsedBody.content_type).toBe('template');
      expect(parsedBody.payload.template.name).toBe('jesmond_auth_register_otp');
      expect(parsedBody.payload.template.to_and_components[0].to).toEqual([
        '61412345678',
      ]);
      expect(
        parsedBody.payload.template.to_and_components[0].components.body_1.value,
      ).toBe('456789');
    });

    it('should handle MSG91 API error responses (400 / 500)', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () =>
          JSON.stringify({
            status: 'error',
            message: 'Template not approved on Meta',
          }),
      });
      global.fetch = mockFetch;

      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-auth-key',
        MSG91_WHATSAPP_SENDER: '61400000000',
        MSG91_WHATSAPP_ENABLED: 'true',
      });

      const result = await provider.sendTemplateMessage({
        recipient: '0412345678',
        template: mockApprovedTemplate,
        components: { body_1: { type: 'text', value: '123456' } },
      });

      expect(result.success).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Template not approved on Meta');
    });

    it('should handle request timeout gracefully', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'AbortError';

      const mockFetch = jest.fn().mockRejectedValue(timeoutError);
      global.fetch = mockFetch;

      provider = await createProvider({
        MSG91_AUTH_KEY: 'test-auth-key',
        MSG91_WHATSAPP_SENDER: '61400000000',
        MSG91_WHATSAPP_ENABLED: 'true',
        MSG91_TIMEOUT_MS: '100',
      });

      const result = await provider.sendTemplateMessage({
        recipient: '0412345678',
        template: mockApprovedTemplate,
        components: { body_1: { type: 'text', value: '123456' } },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out after 100ms');
    });
  });
});

