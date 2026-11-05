import { Test, TestingModule } from '@nestjs/testing';
import { RetailOrderEmailService } from './retail-order-email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';

describe('RetailOrderEmailService', () => {
  let service: RetailOrderEmailService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      retailCustomer: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    emailService = {
      sendEmailAsync: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetailOrderEmailService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<RetailOrderEmailService>(RetailOrderEmailService);
  });

  describe('notifyOrderConfirmed', () => {
    it('should dispatch ORDER_CONFIRMED with customer_name and order_number', async () => {
      const result = await service.notifyOrderConfirmed({
        orderId: 'order-1',
        orderNumber: 'ORD-1001',
        organizationId: 'org-1',
        customerName: 'Sam Smith',
        customerEmail: 'sam@example.com',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.ORDER_CONFIRMED);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.ORDER_CONFIRMED,
          recipient: 'sam@example.com',
          variables: {
            order_number: 'ORD-1001',
            customer_name: 'Sam Smith',
          },
          idempotencyKey: 'email_order_confirmed_order-1',
        }),
      );
    });

    it('should resolve recipient email from RetailCustomer if customerEmail is missing', async () => {
      prisma.retailCustomer.findUnique.mockResolvedValue({
        id: 'cust-1',
        email: 'customer-db@example.com',
        firstName: 'Alice',
        lastName: 'Walker',
      });

      const result = await service.notifyOrderConfirmed({
        orderId: 'order-2',
        orderNumber: 'ORD-1002',
        organizationId: 'org-1',
        customerId: 'cust-1',
      });

      expect(result.sent).toBe(true);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: 'customer-db@example.com',
          variables: {
            order_number: 'ORD-1002',
            customer_name: 'Alice Walker',
          },
        }),
      );
    });
  });

  describe('notifyOrderPacked', () => {
    it('should dispatch ORDER_PACKED with order_number', async () => {
      const result = await service.notifyOrderPacked({
        orderId: 'order-3',
        orderNumber: 'ORD-1003',
        organizationId: 'org-1',
        customerEmail: 'sam@example.com',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.ORDER_PACKED);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.ORDER_PACKED,
          recipient: 'sam@example.com',
          variables: {
            order_number: 'ORD-1003',
          },
          idempotencyKey: 'email_order_packed_order-3',
        }),
      );
    });
  });

  describe('notifyOrderDelivered', () => {
    it('should dispatch ORDER_DELIVERED with order_number', async () => {
      const result = await service.notifyOrderDelivered({
        orderId: 'order-4',
        orderNumber: 'ORD-1004',
        organizationId: 'org-1',
        customerEmail: 'sam@example.com',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.ORDER_DELIVERED);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.ORDER_DELIVERED,
          recipient: 'sam@example.com',
          variables: {
            order_number: 'ORD-1004',
          },
          idempotencyKey: 'email_order_delivered_order-4',
        }),
      );
    });
  });

  describe('notifyOrderTakenAway', () => {
    it('should dispatch ORDER_TAKEN_AWAY with order_number', async () => {
      const result = await service.notifyOrderTakenAway({
        orderId: 'order-5',
        orderNumber: 'ORD-1005',
        organizationId: 'org-1',
        customerEmail: 'sam@example.com',
      });

      expect(result.sent).toBe(true);
      expect(result.event).toBe(EmailEvent.ORDER_TAKEN_AWAY);
      expect(emailService.sendEmailAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: EmailEvent.ORDER_TAKEN_AWAY,
          recipient: 'sam@example.com',
          variables: {
            order_number: 'ORD-1005',
          },
          idempotencyKey: 'email_order_taken_away_order-5',
        }),
      );
    });
  });
});

