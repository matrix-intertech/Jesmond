/**
 * Phase 3 — Retail WhatsApp Order Notifications Integration Tests
 *
 * Verifies that:
 * 1. ORDER_CONFIRMED, ORDER_PACKED, ORDER_DELIVERED, and ORDER_TAKEN_AWAY
 *    dispatch through RetailOrderWhatsAppService and WhatsAppService.
 * 2. Idempotency keys are tied to (event + orderId).
 * 3. Notifications are non-blocking and do not fire before database persistence.
 * 4. Recipient phone number normalization (Australian E.164) works correctly.
 * 5. Missing phone, opt-out, unapproved template, and provider failures are handled gracefully.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { RetailOrderWhatsAppService } from './retail-order-whatsapp.service';
import { RetailOrderEmailService } from './retail-order-email.service';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrderStatus, PaymentMethod } from '@prisma/client';

describe('RetailOrderWhatsAppService', () => {
  let service: RetailOrderWhatsAppService;
  let whatsAppService: jest.Mocked<WhatsAppService>;
  let templateService: jest.Mocked<WhatsAppTemplateService>;
  let msg91Provider: jest.Mocked<Msg91Provider>;
  let prisma: any;

  const mockSendNotificationAsync = jest.fn().mockResolvedValue({
    success: true,
    status: 'QUEUED',
  });

  beforeEach(async () => {
    mockSendNotificationAsync.mockClear();

    prisma = {
      retailCustomer: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetailOrderWhatsAppService,
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
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<RetailOrderWhatsAppService>(RetailOrderWhatsAppService);
    whatsAppService = module.get(WhatsAppService);
    templateService = module.get(WhatsAppTemplateService);
    msg91Provider = module.get(Msg91Provider);
  });

  const mockApprovedTemplate = (event: WhatsAppEvent) => ({
    event,
    templateName: `jesmond_${event.toLowerCase()}`,
    status: WhatsAppTemplateStatus.APPROVED,
    language: 'en',
    requiredVariables: ['order_number'],
    description: 'Test template',
  });

  describe('1. ORDER_CONFIRMED event', () => {
    it('should dispatch WhatsApp notification with order_number and customer_name when template is approved', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_CONFIRMED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const payload = {
        orderId: 'order-101',
        orderNumber: 'ORD-1001',
        organizationId: 'org-1',
        customerPhone: '0412345678',
        customerName: 'John Citizen',
      };

      const result = await service.notifyOrderConfirmed(payload);

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.ORDER_CONFIRMED);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.ORDER_CONFIRMED,
          recipient: '61412345678',
          relatedEntityId: 'order-101',
          variables: {
            order_number: 'ORD-1001',
            customer_name: 'John Citizen',
          },
          idempotencyKey: 'wa_retail_ORDER_CONFIRMED_order-101',
        }),
      );
    });
  });

  describe('2. ORDER_PACKED event', () => {
    it('should dispatch WhatsApp notification when order transitions to PACKED', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_PACKED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const payload = {
        orderId: 'order-102',
        orderNumber: 'ORD-1002',
        organizationId: 'org-1',
        customerPhone: '0412345678',
      };

      const result = await service.notifyOrderPacked(payload);

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.ORDER_PACKED);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.ORDER_PACKED,
          recipient: '61412345678',
          variables: { order_number: 'ORD-1002' },
          idempotencyKey: 'wa_retail_ORDER_PACKED_order-102',
        }),
      );
    });
  });

  describe('3. ORDER_DELIVERED event', () => {
    it('should dispatch WhatsApp notification when order transitions to DELIVERED', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_DELIVERED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const payload = {
        orderId: 'order-103',
        orderNumber: 'ORD-1003',
        organizationId: 'org-1',
        customerPhone: '0412345678',
      };

      const result = await service.notifyOrderDelivered(payload);

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.ORDER_DELIVERED);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.ORDER_DELIVERED,
          recipient: '61412345678',
          variables: { order_number: 'ORD-1003' },
          idempotencyKey: 'wa_retail_ORDER_DELIVERED_order-103',
        }),
      );
    });
  });

  describe('4. ORDER_TAKEN_AWAY event', () => {
    it('should dispatch WhatsApp notification when order transitions to TAKEN', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_TAKEN_AWAY),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const payload = {
        orderId: 'order-104',
        orderNumber: 'ORD-1004',
        organizationId: 'org-1',
        customerPhone: '0412345678',
      };

      const result = await service.notifyOrderTakenAway(payload);

      expect(result.sent).toBe(true);
      expect(result.event).toBe(WhatsAppEvent.ORDER_TAKEN_AWAY);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          event: WhatsAppEvent.ORDER_TAKEN_AWAY,
          recipient: '61412345678',
          variables: { order_number: 'ORD-1004' },
          idempotencyKey: 'wa_retail_ORDER_TAKEN_AWAY_order-104',
        }),
      );
    });
  });

  describe('5. Recipient Resolution & Validation', () => {
    it('should look up customer in DB if customerPhone not passed directly', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_CONFIRMED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61487654321',
        isValid: true,
      });
      prisma.retailCustomer.findUnique.mockResolvedValue({
        id: 'cust-1',
        firstName: 'Alice',
        lastName: 'Smith',
        phone: '0487654321',
        email: 'alice@example.com',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'usr-alice',
        phone: '487654321',
        countryCode: '61',
        whatsappNotifications: true,
      });

      const payload = {
        orderId: 'order-201',
        orderNumber: 'ORD-2001',
        organizationId: 'org-1',
        customerId: 'cust-1',
      };

      const result = await service.notifyOrderConfirmed(payload);

      expect(result.sent).toBe(true);
      expect(mockSendNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          recipient: '61487654321',
          userId: 'usr-alice',
          variables: {
            order_number: 'ORD-2001',
            customer_name: 'Alice Smith',
          },
        }),
      );
    });

    it('should skip sending if recipient phone is missing', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_CONFIRMED),
      );
      prisma.retailCustomer.findUnique.mockResolvedValue({
        id: 'cust-nophone',
        firstName: 'No',
        lastName: 'Phone',
        phone: null,
        email: null,
      });

      const result = await service.notifyOrderConfirmed({
        orderId: 'order-202',
        orderNumber: 'ORD-2002',
        organizationId: 'org-1',
        customerId: 'cust-nophone',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Missing or invalid recipient phone');
      expect(mockSendNotificationAsync).not.toHaveBeenCalled();
    });

    it('should skip sending if recipient phone fails E.164 normalization', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_CONFIRMED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: 'invalid',
        isValid: false,
        reason: 'Too short',
      });

      const result = await service.notifyOrderConfirmed({
        orderId: 'order-203',
        orderNumber: 'ORD-2003',
        organizationId: 'org-1',
        customerPhone: '123',
      });

      expect(result.sent).toBe(false);
      expect(mockSendNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('6. Template Approval & Error Handling', () => {
    it('should skip notification when template is PENDING_APPROVAL', async () => {
      templateService.getTemplate.mockReturnValue({
        event: WhatsAppEvent.ORDER_CONFIRMED,
        templateName: 'jesmond_order_confirmed',
        status: WhatsAppTemplateStatus.PENDING_APPROVAL,
        language: 'en',
        requiredVariables: ['order_number', 'customer_name'],
        description: 'Pending approval template',
      });
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });

      const result = await service.notifyOrderConfirmed({
        orderId: 'order-301',
        orderNumber: 'ORD-3001',
        organizationId: 'org-1',
        customerPhone: '0412345678',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('pending approval');
      expect(mockSendNotificationAsync).not.toHaveBeenCalled();
    });

    it('should not throw if WhatsAppService.sendNotificationAsync rejects', async () => {
      templateService.getTemplate.mockReturnValue(
        mockApprovedTemplate(WhatsAppEvent.ORDER_CONFIRMED),
      );
      msg91Provider.normalizePhoneNumber.mockReturnValue({
        normalized: '61412345678',
        isValid: true,
      });
      mockSendNotificationAsync.mockRejectedValueOnce(
        new Error('Redis connection failed'),
      );

      const result = await service.notifyOrderConfirmed({
        orderId: 'order-302',
        orderNumber: 'ORD-3002',
        organizationId: 'org-1',
        customerPhone: '0412345678',
      });

      expect(result.sent).toBe(false);
      expect(result.reason).toContain('Redis connection failed');
    });
  });
});

describe('OrdersService — WhatsApp Integration in Status Transitions', () => {
  let ordersService: OrdersService;
  let whatsAppOrderService: jest.Mocked<RetailOrderWhatsAppService>;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((cb) => cb(prismaMock)),
      salesOrder: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: InventoryService, useValue: {} },
        { provide: NotificationsService, useValue: { createNotification: jest.fn().mockResolvedValue({}) } },
        {
          provide: RetailOrderWhatsAppService,
          useValue: {
            notifyOrderConfirmed: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_CONFIRMED' }),
            notifyOrderPacked: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_PACKED' }),
            notifyOrderDelivered: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_DELIVERED' }),
            notifyOrderTakenAway: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_TAKEN_AWAY' }),
          },
        },
        {
          provide: RetailOrderEmailService,
          useValue: {
            notifyOrderConfirmed: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_CONFIRMED' }),
            notifyOrderPacked: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_PACKED' }),
            notifyOrderDelivered: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_DELIVERED' }),
            notifyOrderTakenAway: jest.fn().mockResolvedValue({ sent: true, event: 'ORDER_TAKEN_AWAY' }),
          },
        },
      ],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    whatsAppOrderService = module.get(RetailOrderWhatsAppService);
  });

  it('should trigger notifyOrderPacked when transition to PACKED succeeds', async () => {
    prismaMock.salesOrder.findUnique.mockResolvedValue({
      id: 'ord-packed-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-PACK-1',
      status: OrderStatus.ACCEPTED,
      fulfillmentType: 'DELIVERY',
    });
    prismaMock.salesOrder.update.mockResolvedValue({
      id: 'ord-packed-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-PACK-1',
      status: OrderStatus.PACKED,
      customerId: 'cust-1',
      customer: { firstName: 'Bob', lastName: 'Builder', phone: '0411223344' },
      branch: { name: 'Main Branch' },
    });

    const result = await ordersService.updateOrderStatus('org-1', 'ord-packed-1', OrderStatus.PACKED);

    expect(result.status).toBe(OrderStatus.PACKED);
    expect(whatsAppOrderService.notifyOrderPacked).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord-packed-1',
        orderNumber: 'ORD-PACK-1',
        customerId: 'cust-1',
        customerPhone: '0411223344',
      }),
    );
  });

  it('should trigger notifyOrderDelivered when transition to DELIVERED succeeds', async () => {
    prismaMock.salesOrder.findUnique.mockResolvedValue({
      id: 'ord-deliv-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-DEL-1',
      status: OrderStatus.PACKED,
      fulfillmentType: 'DELIVERY',
    });
    prismaMock.salesOrder.update.mockResolvedValue({
      id: 'ord-deliv-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-DEL-1',
      status: OrderStatus.DELIVERED,
      customerId: 'cust-2',
      customer: { firstName: 'Sam', phone: '0422334455' },
      branch: { name: 'North Branch' },
    });

    const result = await ordersService.updateOrderStatus('org-1', 'ord-deliv-1', OrderStatus.DELIVERED);

    expect(result.status).toBe(OrderStatus.DELIVERED);
    expect(whatsAppOrderService.notifyOrderDelivered).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord-deliv-1',
        orderNumber: 'ORD-DEL-1',
        customerId: 'cust-2',
        customerPhone: '0422334455',
      }),
    );
  });

  it('should trigger notifyOrderTakenAway when transition to TAKEN succeeds', async () => {
    prismaMock.salesOrder.findUnique.mockResolvedValue({
      id: 'ord-taken-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-TAKE-1',
      status: OrderStatus.PACKED,
      fulfillmentType: 'TAKEAWAY',
    });
    prismaMock.salesOrder.update.mockResolvedValue({
      id: 'ord-taken-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-TAKE-1',
      status: OrderStatus.TAKEN,
      customerId: 'cust-3',
      customer: { firstName: 'Tom', phone: '0433445566' },
      branch: { name: 'South Branch' },
    });

    const result = await ordersService.updateOrderStatus('org-1', 'ord-taken-1', OrderStatus.TAKEN);

    expect(result.status).toBe(OrderStatus.TAKEN);
    expect(whatsAppOrderService.notifyOrderTakenAway).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'ord-taken-1',
        orderNumber: 'ORD-TAKE-1',
        customerId: 'cust-3',
        customerPhone: '0433445566',
      }),
    );
  });

  it('should NOT trigger WhatsApp notifications if database update throws', async () => {
    prismaMock.salesOrder.findUnique.mockResolvedValue({
      id: 'ord-fail-1',
      organizationId: 'org-1',
      orderNumber: 'ORD-FAIL-1',
      status: OrderStatus.ACCEPTED,
      fulfillmentType: 'DELIVERY',
    });
    prismaMock.salesOrder.update.mockRejectedValue(new Error('DB failure'));

    await expect(
      ordersService.updateOrderStatus('org-1', 'ord-fail-1', OrderStatus.PACKED),
    ).rejects.toThrow('DB failure');

    expect(whatsAppOrderService.notifyOrderPacked).not.toHaveBeenCalled();
  });
});

