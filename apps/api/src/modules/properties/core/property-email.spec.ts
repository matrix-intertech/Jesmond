import { Test, TestingModule } from '@nestjs/testing';
import { PropertyEmailService } from './property-email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';

describe('PropertyEmailService', () => {
  let service: PropertyEmailService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      property: {
        findUnique: jest.fn(),
      },
      orgStaff: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn(),
      },
      conversation: {
        findUnique: jest.fn(),
      },
    };

    emailService = {
      sendEmailAsync: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyEmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<PropertyEmailService>(PropertyEmailService);
  });

  describe('notifyListingConfirmed', () => {
    it('should dispatch PROPERTY_LISTING_CONFIRMED to managers and admins', async () => {
      prisma.property.findUnique.mockResolvedValue({
        id: 'prop-1',
        name: 'Jesmond Student Lodge',
        organizationId: 'org-1',
        managers: [
          {
            orgStaff: {
              user: { id: 'mgr-1', email: 'manager@example.com' },
            },
          },
        ],
      });

      prisma.orgStaff.findMany.mockResolvedValue([
        {
          user: { id: 'admin-1', email: 'admin@example.com' },
        },
      ]);

      const result = await service.notifyListingConfirmed({
        propertyId: 'prop-1',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.PROPERTY_LISTING_CONFIRMED);
      expect(result.recipientCount).toBe(2);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
          recipient: 'manager@example.com',
          variables: { property_title: 'Jesmond Student Lodge' },
          idempotencyKey: 'email_prop_publish_prop-1_mgr-1',
        }),
      );
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
          recipient: 'admin@example.com',
          variables: { property_title: 'Jesmond Student Lodge' },
          idempotencyKey: 'email_prop_publish_prop-1_admin-1',
        }),
      );
    });
  });

  describe('notifyQueryReceived', () => {
    it('should dispatch PROPERTY_QUERY_RECEIVED with property_title and sender_name', async () => {
      prisma.property.findUnique.mockResolvedValue({
        id: 'prop-2',
        name: 'Jesmond Garden Villa',
        organizationId: 'org-1',
        managers: [
          {
            orgStaff: {
              user: { id: 'mgr-2', email: 'manager2@example.com' },
            },
          },
        ],
      });

      const result = await service.notifyQueryReceived({
        enquiryId: 'enq-101',
        propertyId: 'prop-2',
        senderName: 'David Lee',
        senderEmail: 'david@example.com',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.PROPERTY_QUERY_RECEIVED);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.PROPERTY_QUERY_RECEIVED,
          recipient: 'manager2@example.com',
          variables: {
            property_title: 'Jesmond Garden Villa',
            sender_name: 'David Lee',
          },
          idempotencyKey: 'email_prop_query_enq-101_mgr-2',
        }),
      );
    });
  });

  describe('notifyMessageReceived', () => {
    it('should dispatch PROPERTY_MESSAGE_RECEIVED only to other participants and never leak chat content', async () => {
      prisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        propertyId: 'prop-1',
        property: { name: 'Jesmond Luxury Studios' },
        participants: [
          {
            userId: 'sender-1',
            user: { id: 'sender-1', firstName: 'Alice', lastName: 'Sender', email: 'alice@example.com' },
          },
          {
            userId: 'recipient-1',
            user: { id: 'recipient-1', firstName: 'Bob', lastName: 'Receiver', email: 'bob@example.com' },
          },
        ],
      });

      const result = await service.notifyMessageReceived({
        messageId: 'msg-999',
        conversationId: 'conv-1',
        senderId: 'sender-1',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.PROPERTY_MESSAGE_RECEIVED);
      expect(result.recipientCount).toBe(1);

      // Verify recipient received notice with sender name and title, but zero message body
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.PROPERTY_MESSAGE_RECEIVED,
          recipient: 'bob@example.com',
          variables: {
            property_title: 'Jesmond Luxury Studios',
            sender_name: 'Alice Sender',
          },
          idempotencyKey: 'email_prop_msg_msg-999_recipient-1',
        }),
      );
    });
  });
});

