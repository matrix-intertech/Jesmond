import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, PropertyStatus, PropertyVerificationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let prisma: any;

  const activeUser = { id: 'student-a' };
  const publishedVerifiedProperty = {
    id: 'property-a',
    organizationId: 'org-a',
    status: PropertyStatus.PUBLISHED,
    verificationStatus: PropertyVerificationStatus.VERIFIED,
    deletedAt: null,
  };
  const conversation = {
    id: 'conversation-a',
    participants: [
      { userId: 'student-a' },
      { userId: 'host-a' },
    ],
    messages: [],
    property: { id: 'property-a', name: 'Property A' },
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(activeUser),
      },
      property: {
        findFirst: jest.fn().mockResolvedValue(publishedVerifiedProperty),
      },
      propertyManager: {
        findMany: jest.fn().mockResolvedValue([{ orgStaff: { userId: 'host-a' } }]),
      },
      orgStaff: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'admin-a' }]),
      },
      conversation: {
        upsert: jest.fn().mockResolvedValue({ ...conversation, conversationKey: 'prop_property-a_user_student-a' }),
        findMany: jest.fn().mockResolvedValue([conversation]),
        findUnique: jest.fn().mockResolvedValue(conversation),
        update: jest.fn().mockResolvedValue(conversation),
      },
      conversationParticipant: {
        findUnique: jest.fn().mockResolvedValue({ id: 'participant-a' }),
        update: jest.fn().mockResolvedValue({ id: 'participant-a', lastReadAt: new Date() }),
      },
      message: {
        create: jest.fn().mockResolvedValue({ id: 'message-a', senderId: 'student-a', encryptedPayload: 'hello' }),
      },
      $transaction: jest.fn().mockImplementation(async (ops: any[]) => Promise.all(ops)),
    };

    service = new ChatService(prisma as PrismaService);
  });

  it('lets an active student initialize chat for a published verified property', async () => {
    const result = await service.initConversation('property-a', 'student-a');

    expect(result.id).toBe('conversation-a');
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { conversationKey: 'prop_property-a_user_student-a' },
      create: expect.objectContaining({
        propertyId: 'property-a',
        participants: { create: [{ userId: 'student-a' }, { userId: 'host-a' }] },
      }),
    }));
  });

  it('uses the same property + student conversation key for repeated initialization', async () => {
    await service.initConversation('property-a', 'student-a');
    await service.initConversation('property-a', 'student-a');

    expect(prisma.conversation.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.conversation.upsert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: { conversationKey: 'prop_property-a_user_student-a' },
    }));
    expect(prisma.conversation.upsert).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: { conversationKey: 'prop_property-a_user_student-a' },
    }));
  });

  it('rejects missing authenticated user identity for init', async () => {
    await expect(service.initConversation('property-a', undefined as unknown as string)).rejects.toThrow(UnauthorizedException);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
  });

  it('does not allow Student A to access Student B conversation', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...conversation,
      participants: [{ userId: 'student-b' }, { userId: 'host-a' }],
    });

    await expect(service.getConversation('conversation-b', 'student-a')).rejects.toThrow(ForbiddenException);
  });

  it('does not allow Host A to access an unrelated Host B conversation', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      ...conversation,
      participants: [{ userId: 'student-b' }, { userId: 'host-b' }],
    });

    await expect(service.getConversation('conversation-b', 'host-a')).rejects.toThrow(ForbiddenException);
  });

  it('fails chat init for an invalid property', async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(service.initConversation('missing-property', 'student-a')).rejects.toThrow(NotFoundException);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
  });

  it('fails chat init for an unpublished property', async () => {
    prisma.property.findFirst.mockResolvedValue({ ...publishedVerifiedProperty, status: PropertyStatus.DRAFT });

    await expect(service.initConversation('property-a', 'student-a')).rejects.toThrow(ForbiddenException);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
  });

  it('fails chat init for an unverified property', async () => {
    prisma.property.findFirst.mockResolvedValue({
      ...publishedVerifiedProperty,
      verificationStatus: PropertyVerificationStatus.PENDING,
    });

    await expect(service.initConversation('property-a', 'student-a')).rejects.toThrow(ForbiddenException);
    expect(prisma.conversation.upsert).not.toHaveBeenCalled();
  });

  it('fails chat init for a deleted property', async () => {
    prisma.property.findFirst.mockResolvedValue(null);

    await expect(service.initConversation('deleted-property', 'student-a')).rejects.toThrow(NotFoundException);
    expect(prisma.property.findFirst).toHaveBeenCalledWith({ where: { id: 'deleted-property', deletedAt: null } });
  });

  it('filters deleted or inactive property managers and falls back to active admins', async () => {
    prisma.propertyManager.findMany.mockResolvedValue([]);

    await service.initConversation('property-a', 'student-a');

    expect(prisma.propertyManager.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        propertyId: 'property-a',
        orgStaff: expect.objectContaining({
          deletedAt: null,
          user: { accountStatus: AccountStatus.ACTIVE, deletedAt: null },
        }),
      }),
    }));
    expect(prisma.orgStaff.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: 'org-a',
        role: UserRole.ADMIN,
        deletedAt: null,
        user: { accountStatus: AccountStatus.ACTIVE, deletedAt: null },
      }),
    }));
    expect(prisma.conversation.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ participants: { create: [{ userId: 'student-a' }, { userId: 'admin-a' }] } }),
    }));
  });

  it('lets a participant send a message', async () => {
    const result = await service.sendMessage('conversation-a', 'student-a', 'hello');

    expect(result.id).toBe('message-a');
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: 'conversation-a', senderId: 'student-a', encryptedPayload: 'hello', iv: undefined },
    });
  });

  it('does not let a non-participant send a message', async () => {
    prisma.conversation.findUnique.mockResolvedValue({ ...conversation, participants: [{ userId: 'host-b' }] });

    await expect(service.sendMessage('conversation-a', 'student-a', 'hello')).rejects.toThrow(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('lets a participant mark a conversation read', async () => {
    await service.markConversationRead('conversation-a', 'student-a');

    expect(prisma.conversationParticipant.update).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: 'conversation-a', userId: 'student-a' } },
      data: { lastReadAt: expect.any(Date) },
    });
  });

  it('does not let a non-participant mark a conversation read', async () => {
    prisma.conversationParticipant.findUnique.mockResolvedValue(null);

    await expect(service.markConversationRead('conversation-a', 'student-b')).rejects.toThrow(ForbiddenException);
    expect(prisma.conversationParticipant.update).not.toHaveBeenCalled();
  });

  it('rejects deleted or inactive accounts for chat access', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getUserConversations('deleted-user')).rejects.toThrow(UnauthorizedException);
    await expect(service.sendMessage('conversation-a', 'deleted-user', 'hello')).rejects.toThrow(UnauthorizedException);
  });
});
