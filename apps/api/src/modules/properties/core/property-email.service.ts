import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';
import { EmailEvent } from '../../email/constants/email.constants';

export interface PropertyEmailResult {
  sent: boolean;
  event: EmailEvent;
  recipientCount?: number;
  reason?: string;
}

@Injectable()
export class PropertyEmailService {
  private readonly logger = new Logger(PropertyEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * 1. PROPERTY_LISTING_CONFIRMED
   * Triggered when property listing is published/approved.
   * Recipients: Property managers and Org Admin(s).
   */
  async notifyListingConfirmed(params: {
    propertyId: string;
    propertyName?: string;
    authorId?: string;
  }): Promise<PropertyEmailResult> {
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
        event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
        reason: 'Property not found',
      };
    }

    const propertyTitle = property.name || params.propertyName || 'Property';

    // Collect recipient users
    const recipientUserMap = new Map<string, { email: string }>();

    // A. Explicit property managers
    for (const manager of property.managers) {
      const u = manager.orgStaff?.user;
      if (u && u.email) {
        recipientUserMap.set(u.id, { email: u.email });
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
      if (u && u.email) {
        recipientUserMap.set(u.id, { email: u.email });
      }
    }

    // C. Specific author who submitted the property (if provided)
    if (params.authorId && !recipientUserMap.has(params.authorId)) {
      const author = await this.prisma.user.findUnique({
        where: { id: params.authorId },
        select: { id: true, email: true },
      });
      if (author && author.email) {
        recipientUserMap.set(author.id, { email: author.email });
      }
    }

    if (recipientUserMap.size === 0) {
      return {
        sent: false,
        event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
        reason: 'No recipients with email addresses found',
      };
    }

    let dispatched = 0;
    for (const [userId, userInfo] of recipientUserMap.entries()) {
      const idempotencyKey = `email_prop_publish_${propertyId}_${userId}`;
      this.emailService
        .sendEmailAsync({
          event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
          recipient: userInfo.email,
          userId,
          relatedEntityId: propertyId,
          variables: {
            property_title: propertyTitle,
          },
          idempotencyKey,
          metadata: {
            propertyId,
            propertyTitle,
            organizationId: property.organizationId,
          },
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to queue listing confirmed email for user ${userId}: ${err.message}`,
          ),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: EmailEvent.PROPERTY_LISTING_CONFIRMED,
      recipientCount: dispatched,
    };
  }

  /**
   * 2. PROPERTY_QUERY_RECEIVED
   * Triggered when customer submits an enquiry.
   * Recipient: Property managers / organisation admins.
   */
  async notifyQueryReceived(params: {
    enquiryId: string;
    propertyId: string;
    senderName?: string;
    senderEmail?: string;
  }): Promise<PropertyEmailResult> {
    const { enquiryId, propertyId } = params;

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
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
        event: EmailEvent.PROPERTY_QUERY_RECEIVED,
        reason: 'Property not found',
      };
    }

    const propertyTitle = property.name || 'Property';
    const senderName = (params.senderName || '').trim() || 'A prospective resident';

    // Candidate manager/admin recipients
    const recipientUserMap = new Map<string, { email: string }>();

    for (const manager of property.managers) {
      const u = manager.orgStaff?.user;
      if (u && u.email) {
        recipientUserMap.set(u.id, { email: u.email });
      }
    }

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
      if (u && u.email) {
        recipientUserMap.set(u.id, { email: u.email });
      }
    }

    if (recipientUserMap.size === 0) {
      return {
        sent: false,
        event: EmailEvent.PROPERTY_QUERY_RECEIVED,
        reason: 'No managers or admins with email found',
      };
    }

    let dispatched = 0;
    for (const [userId, userInfo] of recipientUserMap.entries()) {
      const idempotencyKey = `email_prop_query_${enquiryId}_${userId}`;
      this.emailService
        .sendEmailAsync({
          event: EmailEvent.PROPERTY_QUERY_RECEIVED,
          recipient: userInfo.email,
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
            `Failed to queue property query email for user ${userId}: ${err.message}`,
          ),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: EmailEvent.PROPERTY_QUERY_RECEIVED,
      recipientCount: dispatched,
    };
  }

  /**
   * 3. PROPERTY_MESSAGE_RECEIVED
   * Triggered when a new chat message is created in a property conversation.
   * Recipient: The other conversation participant(s) (excludes sender).
   * Note: NEVER includes message content to preserve confidentiality.
   */
  async notifyMessageReceived(params: {
    messageId: string;
    conversationId: string;
    senderId: string;
  }): Promise<PropertyEmailResult> {
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
                email: true,
                emailNotifications: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return {
        sent: false,
        event: EmailEvent.PROPERTY_MESSAGE_RECEIVED,
        reason: 'Conversation not found',
      };
    }

    const sender = conversation.participants.find((p) => p.userId === senderId)?.user;
    const senderName = sender
      ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'A user'
      : 'A user';

    const propertyTitle = conversation.property?.name || 'Jesmond Accommodation';

    // Recipient list: all other participants
    const otherParticipants = conversation.participants.filter(
      (p) => p.userId !== senderId && p.user?.email,
    );

    if (otherParticipants.length === 0) {
      return {
        sent: false,
        event: EmailEvent.PROPERTY_MESSAGE_RECEIVED,
        reason: 'No other participants with email found',
      };
    }

    let dispatched = 0;
    for (const participant of otherParticipants) {
      const user = participant.user;
      if (!user?.email) continue;

      const idempotencyKey = `email_prop_msg_${messageId}_${user.id}`;
      this.emailService
        .sendEmailAsync({
          event: EmailEvent.PROPERTY_MESSAGE_RECEIVED,
          recipient: user.email,
          userId: user.id,
          relatedEntityId: messageId,
          variables: {
            property_title: propertyTitle,
            sender_name: senderName,
          },
          idempotencyKey,
          metadata: {
            conversationId,
            messageId,
            propertyId: conversation.propertyId,
          },
        })
        .catch((err) =>
          this.logger.warn(
            `Failed to queue property message email for user ${user.id}: ${err.message}`,
          ),
        );

      dispatched++;
    }

    return {
      sent: dispatched > 0,
      event: EmailEvent.PROPERTY_MESSAGE_RECEIVED,
      recipientCount: dispatched,
    };
  }
}

