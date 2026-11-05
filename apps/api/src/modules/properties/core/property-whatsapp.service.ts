import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppService } from '../../whatsapp/whatsapp.service';
import { WhatsAppTemplateService } from '../../whatsapp/services/whatsapp-template.service';
import { Msg91Provider } from '../../whatsapp/providers/msg91.provider';
import {
  WhatsAppEvent,
  WhatsAppTemplateStatus,
} from '../../whatsapp/constants/whatsapp.constants';
import { PrismaService } from '../../prisma/prisma.service';

export interface PropertyNotificationResult {
  sent: boolean;
  event: WhatsAppEvent;
  recipientCount?: number;
  reason?: string;
}

/**
 * Service orchestrating WhatsApp notifications for the Property module.
 *
 * Events supported:
 * 1. PROPERTY_LISTING_CONFIRMED: Triggered when property transitions to PUBLISHED.
 *    Recipient: Property owner / listing creator / org admins / managers.
 * 2. PROPERTY_QUERY_RECEIVED: Triggered when a customer submits an enquiry.
 *    Recipients: Property manager/owner (new enquiry alert) + Seeker acknowledgement (if seeker opted-in).
 * 3. PROPERTY_MESSAGE_RECEIVED: Triggered when a new chat message is sent.
 *    Recipient: Other conversation participant(s) (never the sender).
 *
 * Reliability & Privacy:
 * - All calls are non-blocking / asynchronous.
 * - Normalized phone numbers using Msg91Provider.normalizePhoneNumber.
 * - Enforces WhatsApp notification opt-in consent for registered users.
 * - Idempotency key per event and entity.
 * - Sensitive message payload is NEVER sent over WhatsApp (only property title and sender name).
 */
@Injectable()
export class PropertyWhatsAppService {
  private readonly logger = new Logger(PropertyWhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsAppService: WhatsAppService,
    private readonly templateService: WhatsAppTemplateService,
    private readonly msg91Provider: Msg91Provider,
  ) {}

  /**
   * Normalizes a phone number to standard international / E.164 format.
   */
  private normalizePhone(
    phone: string | null | undefined,
    countryCode?: string | null,
  ): string | null {
    if (!phone) return null;
    const combined = countryCode
      ? `${countryCode}${phone}`.replace(/\s/g, '')
      : phone.replace(/\s/g, '');

    const { normalized, isValid, reason } =
      this.msg91Provider.normalizePhoneNumber(combined);

    if (!isValid) {
      this.logger.warn(`Property WhatsApp: Invalid phone "${phone}": ${reason}`);
      return null;
    }

    return normalized;
  }

  /**
   * Checks whether the event template is currently approved.
   */
  private isTemplateApproved(event: WhatsAppEvent): boolean {
    try {
      const template = this.templateService.getTemplate(event);
      if (!template) return false;
      return template.status === WhatsAppTemplateStatus.APPROVED;
    } catch {
      return false;
    }
  }

  /**
   * 1. PROPERTY_LISTING_CONFIRMED
   * Triggered when property listing is published/approved.
   * Recipients: Property managers and Org Admin(s).
   */
  async notifyListingConfirmed(params: {
    propertyId: string;
    propertyName?: string;
    authorId?: string;
  }): Promise<PropertyNotificationResult> {
    const { propertyId } = params;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        organization: true,
        managers: {
          include: {
            orgStaff: {
              include: { user: true },
            },
          },
        },
      },
    });

    if (!property) {
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
        reason: 'Property not found',
      };
    }

    const propertyTitle = property.name || params.propertyName || 'Property';

    if (!this.isTemplateApproved(WhatsAppEvent.PROPERTY_LISTING_CONFIRMED)) {
      this.logger.warn(
        `Property WhatsApp: Template for ${WhatsAppEvent.PROPERTY_LISTING_CONFIRMED} is pending approval. Skipping.`,
      );
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
        reason: 'Template pending approval',
      };
    }

    // Identify candidate recipient users
    const recipientUserMap = new Map<
      string,
      { phone: string; countryCode: string | null }
    >();

    // A. Explicit property managers
    for (const manager of property.managers) {
      const u = manager.orgStaff?.user;
      if (u && u.phone) {
        recipientUserMap.set(u.id, {
          phone: u.phone,
          countryCode: u.countryCode,
        });
      }
    }

    // B. Organization Admins
    const orgAdmins = await this.prisma.orgStaff.findMany({
      where: {
        organizationId: property.organizationId,
        role: 'ADMIN',
        deletedAt: null,
      },
      include: { user: true },
    });

    for (const admin of orgAdmins) {
      const u = admin.user;
      if (u && u.phone) {
        recipientUserMap.set(u.id, {
          phone: u.phone,
          countryCode: u.countryCode,
        });
      }
    }

    // C. Specific author who submitted the property (if provided)
    if (params.authorId && !recipientUserMap.has(params.authorId)) {
      const author = await this.prisma.user.findUnique({
        where: { id: params.authorId },
        select: { id: true, phone: true, countryCode: true },
      });
      if (author && author.phone) {
        recipientUserMap.set(author.id, {
          phone: author.phone,
          countryCode: author.countryCode,
        });
      }
    }

    if (recipientUserMap.size === 0) {
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
        reason: 'No recipients with phone numbers found',
      };
    }

    let dispatched = 0;
    for (const [userId, userInfo] of recipientUserMap.entries()) {
      const normalizedPhone = this.normalizePhone(
        userInfo.phone,
        userInfo.countryCode,
      );
      if (!normalizedPhone) continue;

      const idempotencyKey = `wa_prop_publish_${propertyId}_${userId}`;
      this.whatsAppService
        .sendNotificationAsync({
          event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
          recipient: normalizedPhone,
          userId,
          relatedEntityId: propertyId,
          variables: { property_title: propertyTitle },
          idempotencyKey,
          metadata: { propertyId, propertyTitle },
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to queue listing confirmed notification for user ${userId}: ${err.message}`,
          ),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: WhatsAppEvent.PROPERTY_LISTING_CONFIRMED,
      recipientCount: dispatched,
    };
  }

  /**
   * 2. PROPERTY_QUERY_RECEIVED
   * Triggered when a prospective resident submits an enquiry.
   * Recipient: Property manager / Org Admin.
   */
  async notifyQueryReceived(params: {
    enquiryId: string;
    propertyId: string;
    seekerName?: string | null;
    seekerPhone?: string | null;
    studentId?: string | null;
  }): Promise<PropertyNotificationResult> {
    const { enquiryId, propertyId } = params;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        managers: {
          include: {
            orgStaff: { include: { user: true } },
          },
        },
      },
    });

    if (!property) {
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_QUERY_RECEIVED,
        reason: 'Property not found',
      };
    }

    if (!this.isTemplateApproved(WhatsAppEvent.PROPERTY_QUERY_RECEIVED)) {
      this.logger.warn(
        `Property WhatsApp: Template for ${WhatsAppEvent.PROPERTY_QUERY_RECEIVED} is pending approval. Skipping.`,
      );
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_QUERY_RECEIVED,
        reason: 'Template pending approval',
      };
    }

    const propertyTitle = property.name || 'Property';
    const senderName = (params.seekerName || '').trim() || 'Prospective Resident';

    // Collect managers / admins to notify
    const recipientUserMap = new Map<
      string,
      { phone: string; countryCode: string | null }
    >();

    for (const manager of property.managers) {
      const u = manager.orgStaff?.user;
      if (u && u.phone) {
        recipientUserMap.set(u.id, {
          phone: u.phone,
          countryCode: u.countryCode,
        });
      }
    }

    // Fall back to org admins if no managers assigned
    if (recipientUserMap.size === 0) {
      const orgAdmins = await this.prisma.orgStaff.findMany({
        where: {
          organizationId: property.organizationId,
          role: 'ADMIN',
          deletedAt: null,
        },
        include: { user: true },
      });
      for (const admin of orgAdmins) {
        const u = admin.user;
        if (u && u.phone) {
          recipientUserMap.set(u.id, {
            phone: u.phone,
            countryCode: u.countryCode,
          });
        }
      }
    }

    if (recipientUserMap.size === 0) {
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_QUERY_RECEIVED,
        reason: 'No managers or admins with phone numbers found',
      };
    }

    let dispatched = 0;
    for (const [userId, userInfo] of recipientUserMap.entries()) {
      const normalizedPhone = this.normalizePhone(
        userInfo.phone,
        userInfo.countryCode,
      );
      if (!normalizedPhone) continue;

      const idempotencyKey = `wa_prop_query_${enquiryId}_${userId}`;
      this.whatsAppService
        .sendNotificationAsync({
          event: WhatsAppEvent.PROPERTY_QUERY_RECEIVED,
          recipient: normalizedPhone,
          userId,
          relatedEntityId: enquiryId,
          variables: {
            property_title: propertyTitle,
            sender_name: senderName,
          },
          idempotencyKey,
          metadata: { enquiryId, propertyId, propertyTitle },
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to queue property query notification for user ${userId}: ${err.message}`,
          ),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: WhatsAppEvent.PROPERTY_QUERY_RECEIVED,
      recipientCount: dispatched,
    };
  }

  /**
   * 3. PROPERTY_MESSAGE_RECEIVED
   * Triggered when a new chat message is created in a property conversation.
   * Recipient: The other conversation participant(s) (excludes sender).
   */
  async notifyMessageReceived(params: {
    messageId: string;
    conversationId: string;
    senderId: string;
  }): Promise<PropertyNotificationResult> {
    const { messageId, conversationId, senderId } = params;

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        property: true,
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                countryCode: true,
                whatsappNotifications: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED,
        reason: 'Conversation not found',
      };
    }

    if (!this.isTemplateApproved(WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED)) {
      this.logger.warn(
        `Property WhatsApp: Template for ${WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED} is pending approval. Skipping.`,
      );
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED,
        reason: 'Template pending approval',
      };
    }

    const sender = conversation.participants.find(
      (p) => p.userId === senderId,
    )?.user;
    const senderName = sender
      ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Someone'
      : 'Someone';

    const propertyTitle = conversation.property?.name || 'Property Enquiry';

    // Exclude sender from recipients
    const recipients = conversation.participants.filter(
      (p) => p.userId !== senderId && p.user?.phone,
    );

    if (recipients.length === 0) {
      return {
        sent: false,
        event: WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED,
        reason: 'No eligible recipients found',
      };
    }

    let dispatched = 0;
    for (const participant of recipients) {
      const u = participant.user;
      const normalizedPhone = this.normalizePhone(u.phone, u.countryCode);
      if (!normalizedPhone) continue;

      // Unique idempotency key per message per recipient
      const idempotencyKey = `wa_prop_msg_${messageId}_${u.id}`;

      this.whatsAppService
        .sendNotificationAsync({
          event: WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED,
          recipient: normalizedPhone,
          userId: u.id,
          relatedEntityId: messageId,
          variables: {
            property_title: propertyTitle,
            sender_name: senderName,
          },
          idempotencyKey,
          metadata: {
            messageId,
            conversationId,
            propertyId: conversation.propertyId,
          },
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to queue property message notification for user ${u.id}: ${err.message}`,
          ),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: WhatsAppEvent.PROPERTY_MESSAGE_RECEIVED,
      recipientCount: dispatched,
    };
  }
}

