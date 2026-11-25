import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotificationChannel,
  NotificationCategory,
  DeliveryStatus,
  Prisma,
} from '@prisma/client';
import * as webpush from 'web-push';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  async getUserNotifications(
    userId: string,
    organizationId?: string,
    page: number = 1,
    limit: number = 20,
    unreadOnly: boolean = false,
  ) {
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(50, Math.max(1, limit));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      deletedAt: null,
      ...(unreadOnly ? { isRead: false } : {}),
      ...(organizationId ? { organizationId } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          deliveries: {
            select: {
              channel: true,
              status: true,
              deliveredAt: true,
            },
          },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async getUnreadCount(userId: string, organizationId?: string) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      isRead: false,
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    };

    const count = await this.prisma.notification.count({ where });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId, deletedAt: null },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, organizationId?: string) {
    const where: Prisma.NotificationWhereInput = {
      recipientId: userId,
      isRead: false,
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    };

    const result = await this.prisma.notification.updateMany({
      where,
      data: { isRead: true, readAt: new Date() },
    });

    return { success: true, markedCount: result.count };
  }

  /**
   * Retrieves granular user notification preferences.
   * If none exist, seeds and returns defaults (enabled: true across all channels and categories).
   */
  async getPreferences(userId: string) {
    const existing = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    const allCategories: NotificationCategory[] = [
      NotificationCategory.APPOINTMENT_TRANSACTIONAL,
      NotificationCategory.APPOINTMENT_REMINDERS,
      NotificationCategory.SYSTEM_SECURITY,
    ];
    const allChannels: NotificationChannel[] = [
      NotificationChannel.IN_APP,
      NotificationChannel.EMAIL,
    ];

    const preferences = [...existing];
    const missing: Array<{
      userId: string;
      category: NotificationCategory;
      channel: NotificationChannel;
      enabled: boolean;
    }> = [];

    for (const cat of allCategories) {
      for (const ch of allChannels) {
        const found = preferences.find(
          (p) => p.category === cat && p.channel === ch,
        );
        if (!found) {
          missing.push({
            userId,
            category: cat,
            channel: ch,
            enabled: true,
          });
        }
      }
    }

    if (missing.length > 0) {
      for (const m of missing) {
        const created = await this.prisma.notificationPreference.create({
          data: m,
        });
        preferences.push(created);
      }
    }

    return {
      preferences: preferences.map((p) => ({
        category: p.category,
        channel: p.channel,
        enabled: p.enabled,
      })),
    };
  }

  /**
   * Updates granular user notification preferences.
   * Rejects any attempt to disable SYSTEM_SECURITY.
   */
  async updatePreferences(
    userId: string,
    updates: Array<{
      category: NotificationCategory;
      channel: NotificationChannel;
      enabled: boolean;
    }>,
  ) {
    if (!Array.isArray(updates)) {
      throw new BadRequestException('Preferences payload must be an array');
    }

    // Validate that SYSTEM_SECURITY cannot be opted out
    for (const item of updates) {
      if (
        item.category === NotificationCategory.SYSTEM_SECURITY &&
        item.enabled === false
      ) {
        throw new BadRequestException(
          'System security notifications cannot be disabled',
        );
      }
    }

    for (const item of updates) {
      await this.prisma.notificationPreference.upsert({
        where: {
          userId_category_channel: {
            userId,
            category: item.category,
            channel: item.channel,
          },
        },
        create: {
          userId,
          category: item.category,
          channel: item.channel,
          enabled: item.enabled,
        },
        update: {
          enabled: item.enabled,
        },
      });
    }

    return this.getPreferences(userId);
  }

  async subscribePush(userId: string, payload: any) {
    const { endpoint, keys } = payload;

    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    });
  }

  async unsubscribePush(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async createNotification(payload: {
    recipientId: string;
    organizationId?: string;
    type: string;
    title: string;
    body: string;
    actionUrl?: string;
    metadata?: any;
    idempotencyKey?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: payload.recipientId,
        organizationId: payload.organizationId || null,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        actionUrl: payload.actionUrl,
        metadata: payload.metadata,
        idempotencyKey: payload.idempotencyKey,
        deliveries: {
          create: {
            channel: NotificationChannel.IN_APP,
            status: DeliveryStatus.DELIVERED,
            recipientAddress: payload.recipientId,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
        },
      },
    });

    this.sendPushNotification(payload.recipientId, notification).catch(
      (err) => this.logger.warn(`Failed sending push: ${err.message}`),
    );

    return notification;
  }

  private async sendPushNotification(userId: string, notification: any) {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });
      if (subscriptions.length === 0) return;

      const vapidPublic = process.env.VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.VAPID_SUBJECT;

      if (!vapidPublic || !vapidPrivate || !vapidSubject) {
        return;
      }

      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        notificationId: notification.id,
        type: notification.type,
      });

      const sendPromises = subscriptions.map((sub) =>
        webpush
          .sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload,
          )
          .catch(async (error) => {
            if (error.statusCode === 410 || error.statusCode === 404) {
              await this.prisma.pushSubscription.delete({
                where: { id: sub.id },
              });
            } else {
              this.logger.warn(`Push notification failed: ${error.message}`);
            }
          }),
      );

      await Promise.allSettled(sendPromises);
    } catch (e: any) {
      this.logger.warn(`Unexpected error in sendPushNotification: ${e.message}`);
    }
  }
}
