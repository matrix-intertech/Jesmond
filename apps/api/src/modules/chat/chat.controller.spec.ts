import { UnauthorizedException } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chatService: jest.Mocked<Pick<ChatService, 'initConversation'>>;

  beforeEach(() => {
    chatService = {
      initConversation: jest.fn().mockResolvedValue({ id: 'conversation-a' }),
    };

    controller = new ChatController(chatService as unknown as ChatService);
  });

  it('uses req.user.id when initializing chat', async () => {
    await controller.initConversation({ user: { id: 'student-a' } } as any, { propertyId: 'property-a' });

    expect(chatService.initConversation).toHaveBeenCalledWith('property-a', 'student-a');
  });

  it('rejects chat init when authenticated identity is missing', async () => {
    await expect(controller.initConversation({ user: {} } as any, { propertyId: 'property-a' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(chatService.initConversation).not.toHaveBeenCalled();
  });
});
