import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, PropertyStatus, PropertyVerificationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  private assertId(value: string | undefined | null, label: string): string {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new UnauthorizedException(`${label} is missing`);
    }

    return value;
  }

  private async assertActiveChatUser(userId: string) {
    const id = this.assertId(userId, 'Authenticated user id');
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        accountStatus: AccountStatus.ACTIVE,
      },
      select: { id: true },
    });

    if (!user) {
      throw new UnauthorizedException('User is not allowed to use chat');
    }
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { id: true },
    });

    if (!participant) {
      throw new ForbiddenException('Access denied');
    }
  }
  private assertMessagePayload(encryptedPayload: string, iv?: string) {
    if (!encryptedPayload || typeof encryptedPayload !== 'string' || encryptedPayload.trim().length === 0) {
      throw new BadRequestException('Message payload is required');
    }

    if (encryptedPayload.length > 20000) {
      throw new BadRequestException('Message payload is too large');
    }

    if (iv && iv.length > 512) {
      throw new BadRequestException('Message metadata is too large');
    }
  }

  // Initialize or fetch conversation for a property
  async initConversation(propertyId: string, studentUserId: string) {
    const userId = this.assertId(studentUserId, 'Authenticated user id');
    await this.assertActiveChatUser(userId);

    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        deletedAt: null,
      },
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
          deletedAt: null,
          user: {
            accountStatus: AccountStatus.ACTIVE,
            deletedAt: null,
          },
        },
      },
      include: { orgStaff: { select: { userId: true } } },
    });

    let hostUserIds = assignedManagers.map((pm) => pm.orgStaff.userId);

    // Fallback: If no explicit assignment exists, route to organization ADMINs (primary hosts)
    if (hostUserIds.length === 0) {
      const fallbackAdmins = await this.prisma.orgStaff.findMany({
        where: {
          organizationId: property.organizationId,
          role: UserRole.ADMIN,
          deletedAt: null,
          user: {
            accountStatus: AccountStatus.ACTIVE,
            deletedAt: null,
          },
        },
        select: { userId: true },
      });
      hostUserIds = fallbackAdmins.map((admin) => admin.userId);
    }

    if (hostUserIds.length === 0) {
      throw new ForbiddenException('No active property host is available for chat');
    }

    // Avoid duplicates if student is somehow also a host
    const uniqueParticipantIds = new Set([userId, ...hostUserIds]);
    const participantsToCreate = Array.from(uniqueParticipantIds).map((userId) => ({ userId }));

    const conversationKey = `prop_${propertyId}_user_${userId}`;

    // Upsert conversation to prevent race conditions; conversationKey has a database unique constraint.
    return this.prisma.conversation.upsert({
      where: { conversationKey },
      update: {},
      create: {
        conversationKey,
        propertyId,
        participants: {
          create: participantsToCreate,
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async initDirectConversation(studentUserId: string, recipientUserId: string) {
    const userId = this.assertId(studentUserId, 'Authenticated user id');
    const targetUserId = this.assertId(recipientUserId, 'Recipient user id');
    
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot start a conversation with yourself');
    }
    
    await this.assertActiveChatUser(userId);

    const recipientStaff = await this.prisma.orgStaff.findFirst({
      where: {
        userId: targetUserId,
        deletedAt: null,
        user: {
          accountStatus: AccountStatus.ACTIVE,
          deletedAt: null,
        },
        organization: {
          type: 'PROVIDER',
          status: 'VERIFIED',
        }
      },
      include: { organization: true }
    });

    if (!recipientStaff) {
      throw new ForbiddenException('Recipient is not eligible for direct messaging');
    }

    const sortedIds = [userId, targetUserId].sort();
    const conversationKey = `direct_user_${sortedIds[0]}_user_${sortedIds[1]}`;

    return this.prisma.conversation.upsert({
      where: { conversationKey },
      update: {},
      create: {
        conversationKey,
        participants: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async getUserConversations(userId: string) {
    const id = this.assertId(userId, 'Authenticated user id');
    await this.assertActiveChatUser(id);

    return this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: id },
        },
      },
      include: {
        property: { select: { id: true, name: true, media: { take: 1 } } },
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getConversation(conversationId: string, userId: string) {
    const id = this.assertId(userId, 'Authenticated user id');
    await this.assertActiveChatUser(id);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        property: { select: { id: true, name: true } },
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some((p) => p.userId === id);
    if (!isParticipant) throw new ForbiddenException('Access denied');

    return conversation;
  }

  async sendMessage(conversationId: string, senderId: string, encryptedPayload: string, iv?: string) {
    const userId = this.assertId(senderId, 'Authenticated user id');
    await this.assertActiveChatUser(userId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: true },
    });

    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participants.some((p) => p.userId === userId);
    if (!isParticipant) throw new ForbiddenException('Access denied');

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        encryptedPayload,
        iv,
      },
    });

    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
      }),
    ]);

    return message;
  }

  async markConversationRead(conversationId: string, userId: string) {
    const id = this.assertId(userId, 'Authenticated user id');
    await this.assertActiveChatUser(id);
    await this.assertParticipant(conversationId, id);

    return this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: id } },
      data: { lastReadAt: new Date() },
    });
  }
}