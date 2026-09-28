import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getUserNotifications(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { recipientId: userId } }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async subscribePush(userId: string, payload: any) {
    const { endpoint, keys } = payload;
    
    // Upsert subscription
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
      }
    });
  }

  async unsubscribePush(userId: string, endpoint: string) {
    return this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  async createNotification(payload: { recipientId: string; type: string; title: string; body: string; actionUrl?: string; metadata?: any }) {
    const notification = await this.prisma.notification.create({
      data: payload,
    });
    
    // Async delivery step
    this.sendPushNotification(payload.recipientId, notification).catch(err => {
       console.error('Failed to send push notification', err);
    });

    return notification;
  }

  private async sendPushNotification(userId: string, notification: any) {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
      if (subscriptions.length === 0) return;

      const vapidPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
      const vapidPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
      const vapidSubject = process.env.WEB_PUSH_VAPID_SUBJECT;

      if (!vapidPublic || !vapidPrivate || !vapidSubject) {
        console.warn('VAPID keys not configured, skipping push notification');
        return;
      }

      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        actionUrl: notification.actionUrl,
        notificationId: notification.id,
        type: notification.type
      });

      const sendPromises = subscriptions.map(sub => 
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          payload
        ).catch(async (error) => {
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(`Removing invalid subscription: ${sub.endpoint}`);
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
          } else {
            console.error('Push notification failed:', error);
          }
        })
      );

      await Promise.allSettled(sendPromises);
    } catch (e) {
      console.error('Unexpected error in sendPushNotification', e);
    }
  }
}
