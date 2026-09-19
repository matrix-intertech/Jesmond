import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AccountStatus } from '@prisma/client';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/chat'
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private prisma: PrismaService
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers['authorization']?.split(' ')[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);

      // DB-backed user validation
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub }
      });

      if (!user || user.deletedAt !== null || user.accountStatus !== AccountStatus.ACTIVE) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;

      // Join a room for the specific user so we can send them events directly
      client.join(`user_${user.id}`);
    } catch (error) {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    // cleanup if needed
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; encryptedPayload: string; iv: string }
  ) {
    const userId = client.data.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    try {
      // Re-verify user status during active websocket operations to prevent disconnected sessions
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user || user.deletedAt !== null || user.accountStatus !== AccountStatus.ACTIVE) {
        client.disconnect();
        return { status: 'error', message: 'Unauthorized' };
      }

      const message = await this.chatService.sendMessage(
        data.conversationId,
        userId,
        data.encryptedPayload,
        data.iv
      );

      // We need to notify all participants of the conversation
      const conversation = await this.chatService.getConversation(data.conversationId, userId);

      conversation.participants.forEach(p => {
        this.server.to(`user_${p.userId}`).emit('newMessage', message);
      });

      return { status: 'success', message };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('readConversation')
  async handleReadConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string }
  ) {
    const userId = client.data.userId;
    if (!userId) return { status: 'error', message: 'Unauthorized' };

    try {
      await this.chatService.getConversation(data.conversationId, userId);
      // getConversation updates lastReadAt automatically
      return { status: 'success' };
    } catch (error) {
      return { status: 'error' };
    }
  }
}
