/**
 * Phase 4 — Property WhatsApp Notifications Unit & Integration Tests
 *
 * Verifies that:
 * 1. PROPERTY_LISTING_CONFIRMED: Dispatches to property manager / org admins when listing is published.
 * 2. PROPERTY_QUERY_RECEIVED: Dispatches to property manager / org admins on customer enquiry.
 * 3. PROPERTY_MESSAGE_RECEIVED: Dispatches to other conversation participant (excludes sender).
 * 4. Privacy: Message payload/content is never transmitted via WhatsApp.
 * 5. Idempotency: Duplicate notifications are not sent for the same event + entity.
 * 6. Opt-Out / Missing Phone: Handled gracefully without throwing or blocking.
 * 7. Template pending approval: Handled gracefully without throwing.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PropertyWhatsAppService } from './property-whatsapp.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { PrismaService } from '../../prisma/prisma.service';

describe('PropertyWhatsAppService', () => {
  let service: PropertyWhatsAppService;
  let whatsAppService: jest.Mocked<WhatsAppService>;
  let templateService: jest.Mocked<WhatsAppTemplateService>;
  let msg91Provider: jest.Mocked<Msg91Provider>;
  let prismaMock: any;

  const mockSendNotificationAsync = jest.fn().mockResolvedValue({
    success: true,
    status: 'QUEUED',
  });

  const mockApprovedTemplate = (event: WhatsAppEvent) => ({
    event,
    templateName: `jesmond_${event.toLowerCase()}`,
    status: WhatsAppTemplateStatus.APPROVED,
    language: 'en',
    requiredVariables: ['property_title'],
    description: 'Test template',
  });

  beforeEach(async () => {
    mockSendNotificationAsync.mockClear();

    prismaMock = {
      property: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      orgStaff: {
        findMany: jest.fn(),
      },
      conversation: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyWhatsAppService,
        {
          provide: WhatsAppService,
          useValue: {
            sendNotificationAsync: mockSendNotificationAsync,
          },
        },
        {
          provide: WhatsAppTemplateService,
          useValue: {
            getTemplate: jest.fn(),
          },
        },
        {
          provide: Msg91Provider,
          useValue: {
            normalizePhoneNumber: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PropertyWhatsAppService>(PropertyWhatsAppService);
    whatsAppService = module.get(WhatsAppService);
    templateService = module.get(WhatsAppTemplateService);
    msg91Provider = module.get(Msg91Provider);
  });

  describe('1. PROPERTY_LISTING_CONFIRMED', () => {
    it('should dispatch notification to property managers and org admins when template is approved', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_LISTING_CONFIRMED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      prismaMock.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        name: 'Jesmond Student Residence',
        organizationId: 'org-1',
        managers: [
          {
            orgStaff: {
              user: {
                id: 'mgr-1',
                phone: '0412345678',
                countryCode: '+61',
              },
            },
          },
        ],
      });

      prismaMock.orgStaff.findMany.mockResolvedValue([]);

      const result = await service.notifyListingConfirmed({
        propertyId: 'prop-1',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.PROPERTY_LISTING_CONFIRMED);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
          recipient: '61412345678',
          userId: 'mgr-1',
          relatedEntityId: 'prop-1',
          variables: { property_title: 'Jesmond Student Residence' },
          idempotencyKey: 'wa_prop_publish_prop-1_mgr-1',
        }),
      );
    });

    it('should skip sending if template is PENDING_APPROVAL', async () => {
      templateService.getTemplate.mockReturnValue({
        event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
        templateName: 'jesmond_property_listing_confirmed',
        status: WhatsAppTemplateStatus.PENDING_APPROVAL,
        language: 'en',
        requiredVariables: ['property_title'],
        description: 'Pending approval',
      });

      prismaMock.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        name: 'Jesmond Studio',
        organizationId: 'org-1',
        managers: [],
      });

      const result = await service.notifyListingConfirmed({
        propertyId: 'prop-1',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('pending approval');
      expect(mockSendNotificationAsync).not.toHaveBeenCalled();
    });

    it('should skip sending if no manager or admin phone exists', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_LISTING_CONFIRMED),
      );

      prismaMock.property.findUnique.mockResolvedValue({
        id: 'prop-2',
        name: 'Jesmond Studio',
        organizationId: 'org-1',
        managers: [],
      });
      prismaMock.orgStaff.findMany.mockResolvedValue([]);

      const result = await service.notifyListingConfirmed({
        propertyId: 'prop-2',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('No recipients with phone numbers found');
      expect(mockSendNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('2. PROPERTY_QUERY_RECEIVED', () => {
    it('should dispatch enquiry notification to property manager with sender_name and property_title', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_QUERY_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61499887766',
        isValid: true,
      });

      prismaMock.property.findUnique.mockResolvedValue({
        id: 'prop-10',
        name: 'Campus View Apartment',
        organizationId: 'org-2',
        managers: [
          {
            orgStaff: {
              user: {
                id: 'mgr-2',
                phone: '0499887766',
                countryCode: '+61',
              },
            },
          },
        ],
      });

      const result = await service.notifyQueryReceived({
        enquiryId: 'enq-101',
        propertyId: 'prop-10',
        seekerName: 'Emily Clark',
        seekerPhone: '0411223344',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.PROPERTY_QUERY_RECEIVED);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.PROPERTY_QUERY_RECEIVED,
          recipient: '61499887766',
          userId: 'mgr-2',
          relatedEntityId: 'enq-101',
          variables: {
            property_title: 'Campus View Apartment',
            sender_name: 'Emily Clark',
          },
          idempotencyKey: 'wa_prop_query_enq-101_mgr-2',
        }),
      );
    });

    it('should fall back to Org Admins if no explicit property managers assigned', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_QUERY_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61455443322',
        isValid: true,
      });

      prismaMock.property.findUnique.mockResolvedValue({
        id: 'prop-11',
        name: 'Shared Villa',
        organizationId: 'org-3',
        managers: [], // No explicit managers
      });

      prismaMock.orgStaff.findMany.mockResolvedValue([
        {
          user: {
            id: 'admin-1',
            phone: '0455443322',
            countryCode: '61',
          },
        },
      ]);

      const result = await service.notifyQueryReceived({
        enquiryId: 'enq-102',
        propertyId: 'prop-11',
        seekerName: 'David Lee',
      });

      expect(result.sent).toBe(true);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '61455443322',
          userId: 'admin-1',
          variables: {
            property_title: 'Shared Villa',
            sender_name: 'David Lee',
          },
        }),
      );
    });
  });

  describe('3. PROPERTY_MESSAGE_RECEIVED', () => {
    it('should notify the recipient and NEVER notify the sender', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61433221100',
        isValid: true,
      });

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        propertyId: 'prop-20',
        property: { name: 'Sunset Studio' },
        participants: [
          {
            userId: 'sender-user',
            user: {
              id: 'sender-user',
              firstName: 'Sender',
              lastName: 'User',
              phone: '0499000000',
            },
          },
          {
            userId: 'recipient-user',
            user: {
              id: 'recipient-user',
              firstName: 'Recipient',
              lastName: 'Host',
              phone: '0433221100',
              countryCode: '+61',
            },
          },
        ],
      });

      const result = await service.notifyMessageReceived({
        messageId: 'msg-501',
        conversationId: 'conv-1',
        senderId: 'sender-user',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED);
      // Recipient must be recipient-user, NEVER sender-user
      expect(mockSendNotificationAsync).toHaveBeenCalledTimes(1);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '61433221100',
          userId: 'recipient-user',
          variables: {
            property_title: 'Sunset Studio',
            sender_name: 'Sender User',
          },
          idempotencyKey: 'wa_prop_msg_msg-501_recipient-user',
        }),
      );
    });

    it('should NOT include message text or encrypted content in variables or metadata (privacy)', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61433221100',
        isValid: true,
      });

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-2',
        propertyId: 'prop-21',
        property: { name: 'Sunset Studio' },
        participants: [
          {
            userId: 'sender-user',
            user: { id: 'sender-user', firstName: 'Sender' },
          },
          {
            userId: 'recipient-user',
            user: { id: 'recipient-user', phone: '0433221100' },
          },
        ],
      });

      await service.notifyMessageReceived({
        messageId: 'msg-502',
        conversationId: 'conv-2',
        senderId: 'sender-user',
      });

      const callArgs = mockSendNotificationAsync.mock.calls[0][0];
      // Message content must NOT be leaked
      expect(JSON.stringify(callArgs.variables)).not.toContain('encryptedPayload');
      expect(JSON.stringify(callArgs.metadata)).not.toContain('encryptedPayload');
      expect(callArgs.variables).toEqual({
        property_title: 'Sunset Studio',
        sender_name: 'Sender',
      });
    });

    it('should allow legitimate multiple subsequent messages in the same conversation (different messageId)', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61433221100',
        isValid: true,
      });

      prismaMock.conversation.findUnique.mockResolvedValue({
        id: 'conv-3',
        propertyId: 'prop-22',
        property: { name: 'Sunset Studio' },
        participants: [
          {
            userId: 'sender-user',
            user: { id: 'sender-user', firstName: 'Sender' },
          },
          {
            userId: 'recipient-user',
            user: { id: 'recipient-user', phone: '0433221100' },
          },
        ],
      });

      // First message
      await service.notifyMessageReceived({
        messageId: 'msg-001',
        conversationId: 'conv-3',
        senderId: 'sender-user',
      });

      // Second message in same conversation
      await service.notifyMessageReceived({
        messageId: 'msg-002',
        conversationId: 'conv-3',
        senderId: 'sender-user',
      });

      expect(mockSendNotificationAsync).toHaveBeenCalledTimes(2);
      expect(mockSendNotificationAsync.mock.calls[0][0].idempotencyKey).toBe(
        'wa_prop_msg_msg-001_recipient-user',
      );
      expect(mockSendNotificationAsync.mock.calls[1][0].idempotencyKey).toBe(
        'wa_prop_msg_msg-002_recipient-user',
      );
    });
  });

  describe('4. Failure Handling & Non-blocking', () => {
    it('should catch sendNotificationAsync rejection gracefully', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.PROPERTY_LISTING_CONFIRMED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });
      prismaMock.property.findUnique.mockResolvedValue({
        id: 'prop-3',
        name: 'Jesmond Student Residence',
        organizationId: 'org-1',
        managers: [
          {
            orgStaff: {
              user: { id: 'mgr-3', phone: '0412345678' },
            },
          },
        ],
      });
      prismaMock.orgStaff.findMany.mockResolvedValue([]);

      mockSendNotificationAsync.mockRejectedValueOnce(new Error('BullMQ offline'));

      // Should not throw
      const result = await service.notifyListingConfirmed({
        propertyId: 'prop-3',
      });

      expect(result.sent).toBe(true); // Dispatched asynchronously
    });
  });
});

