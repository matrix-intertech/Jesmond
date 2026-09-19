import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PropertyStatus, PropertyVerificationStatus, AccountStatus, UserRole } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  // Initialize or fetch conversation for a property
  async initConversation(propertyId: string, studentUserId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) throw new NotFoundException('Property not found');

    // Reject disabled properties for new conversations
    if (
      property.status !== PropertyStatus.PUBLISHED ||
      property.verificationStatus !== PropertyVerificationStatus.VERIFIED
    ) {
      throw new ForbiddenException('Property is not eligible for new enquiries');
    }

    // Find explicitly assigned active property managers
    const assignedManagers = await this.prisma.propertyManager.findMany({
      where: {
        propertyId,
        orgStaff: {
          user: {
            accountStatus: AccountStatus.ACTIVE,
            deletedAt: null
          }
        }
      },
      include: { orgStaff: { select: { userId: true } } }
    });

    let hostUserIds = assignedManagers.map(pm => pm.orgStaff.userId);

    // Fallback: If no explicit assignment exists, route to organization ADMINs (primary hosts)
    if (hostUserIds.length === 0) {
      const fallbackAdmins = await this.prisma.orgStaff.findMany({
        where: {
          organizationId: property.organizationId,
          role: UserRole.ADMIN,
          user: {
            accountStatus: AccountStatus.ACTIVE,
            deletedAt: null
          }
        },
        select: { userId: true }
      });
      hostUserIds = fallbackAdmins.map(admin => admin.userId);
    }

    // Avoid duplicates if student is somehow also a host
    const uniqueParticipantIds = new Set([studentUserId, ...hostUserIds]);
    const participantsToCreate = Array.from(uniqueParticipantIds).map(userId => ({ userId }));

    const conversationKey = `prop_${propertyId}_user_${studentUserId}`;

    // Upsert conversation to prevent race conditions
    const conversation = await this.prisma.conversation.upsert({
      where: { conversationKey },
      update: {},
      create: {
        conversationKey,
        propertyId,
        participants: {
          create: participantsToCreate
        }
      },
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    return conversation;
  }

  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId }
        }
      },
      include: {
        property: { select: { id: true, name: true, media: { take: 1 } } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } }
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 } // Get latest message
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        property: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'asc' } }
      }
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(p => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Access denied');

    // Update lastReadAt
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() }
    });

    return conversation;
  }

  async sendMessage(conversationId: string, senderId: string, encryptedPayload: string, iv?: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true }
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some(p => p.userId === senderId);
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        encryptedPayload,
        iv
      }
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() }
      }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: new Date() }
      })
    ]);

    return message;
  }
}
