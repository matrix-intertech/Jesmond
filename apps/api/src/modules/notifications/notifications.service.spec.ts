import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationCategory, NotificationChannel } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'pref-mock', ...args?.data })),
        upsert: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'pref-mock', ...args?.create })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('getUserNotifications', () => {
    it('should query paginated notifications for recipient with optional org filter', async () => {
      const mockNotifications = [
        { id: 'notif-1', recipientId: 'user-1', isRead: false },
        { id: 'notif-2', recipientId: 'user-1', isRead: true },
      ];
      prisma.notification.findMany.mockResolvedValue(mockNotifications);
      prisma.notification.count.mockResolvedValue(10);

      const result = await service.getUserNotifications('user-1', 'org-123', 1, 5, false);

      expect(result.data).toEqual(mockNotifications);
      expect(result.meta.total).toBe(10);
      expect(prisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recipientId: 'user-1',
            organizationId: 'org-123',
            deletedAt: null,
          }),
          take: 5,
          skip: 0,
        }),
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count scoped to user and optional org', async () => {
      prisma.notification.count.mockResolvedValue(3);

      const res = await service.getUnreadCount('user-1', 'org-123');

      expect(res.count).toBe(3);
      expect(prisma.notification.count).toHaveBeenCalledWith({
        where: {
          recipientId: 'user-1',
          isRead: false,
          deletedAt: null,
          organizationId: 'org-123',
        },
      });
    });
  });

  describe('markAsRead & markAllAsRead', () => {
    it('should mark single notification as read if owned by user', async () => {
      prisma.notification.findFirst.mockResolvedValue({ id: 'notif-1', recipientId: 'user-1' });
      prisma.notification.update.mockResolvedValue({ id: 'notif-1', isRead: true });

      const result = await service.markAsRead('user-1', 'notif-1');
      expect(result.isRead).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ isRead: true }),
      });
    });

    it('should throw NotFoundException if notification does not exist or belongs to another user', async () => {
      prisma.notification.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'notif-999')).rejects.toThrow(NotFoundException);
    });

    it('should mark all unread notifications as read', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 4 });

      const result = await service.markAllAsRead('user-1');
      expect(result.success).toBe(true);
      expect(result.markedCount).toBe(4);
    });
  });

  describe('Notification Preferences & Security Constraints', () => {
    it('should seed default preferences when none exist', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([]);
      prisma.notificationPreference.create.mockImplementation((args) =>
        Promise.resolve({ id: 'pref-new', ...args.data }),
      );

      const result = await service.getPreferences('user-1');

      expect(result.preferences.length).toBe(6); // 3 categories x 2 channels
      expect(result.preferences.every((p) => p.enabled === true)).toBe(true);
      expect(prisma.notificationPreference.create).toHaveBeenCalledTimes(6);
    });

    it('should reject update attempting to disable SYSTEM_SECURITY', async () => {
      await expect(
        service.updatePreferences('user-1', [
          {
            category: NotificationCategory.SYSTEM_SECURITY,
            channel: NotificationChannel.EMAIL,
            enabled: false,
          },
        ]),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully update appointment notification preferences', async () => {
      prisma.notificationPreference.findMany.mockResolvedValue([
        {
          userId: 'user-1',
          category: NotificationCategory.APPOINTMENT_REMINDERS,
          channel: NotificationChannel.EMAIL,
          enabled: false,
        },
      ]);
      prisma.notificationPreference.upsert.mockResolvedValue({
        category: NotificationCategory.APPOINTMENT_REMINDERS,
        channel: NotificationChannel.EMAIL,
        enabled: false,
      });

      const result = await service.updatePreferences('user-1', [
        {
          category: NotificationCategory.APPOINTMENT_REMINDERS,
          channel: NotificationChannel.EMAIL,
          enabled: false,
        },
      ]);

      expect(result.preferences).toBeDefined();
      expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_category_channel: {
              userId: 'user-1',
              category: NotificationCategory.APPOINTMENT_REMINDERS,
              channel: NotificationChannel.EMAIL,
            },
          },
          update: { enabled: false },
          create: expect.objectContaining({ enabled: false }),
        }),
      );
    });
  });
});
