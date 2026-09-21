import { Body, Controller, Get, Param, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InitConversationDto, SendMessageDto } from './dtos/chat.dto';

interface AuthenticatedRequest {
  user?: AuthenticatedUser;
}

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private getAuthenticatedUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new UnauthorizedException('Authenticated user identity is missing');
    }

    return req.user.id;
  }

  @Post('init')
  async initConversation(@Req() req: AuthenticatedRequest, @Body() body: InitConversationDto) {
    return this.chatService.initConversation(body.propertyId, this.getAuthenticatedUserId(req));
  }

  @Get('conversations')
  async getUserConversations(@Req() req: AuthenticatedRequest) {
    return this.chatService.getUserConversations(this.getAuthenticatedUserId(req));
  }

  @Get('conversations/:id')
  async getConversation(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.chatService.getConversation(id, this.getAuthenticatedUserId(req));
  }

  @Patch('conversations/:id/read')
  async markConversationRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.chatService.markConversationRead(id, this.getAuthenticatedUserId(req));
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: SendMessageDto,
  ) {
    return this.chatService.sendMessage(id, this.getAuthenticatedUserId(req), body.encryptedPayload, body.iv);
  }
}
