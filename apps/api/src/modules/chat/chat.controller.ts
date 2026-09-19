import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('v1/chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('init')
  async initConversation(@Req() req: any, @Body() body: { propertyId: string }) {
    // Only logged in users can initiate chat
    return this.chatService.initConversation(body.propertyId, req.user.userId);
  }

  @Get('conversations')
  async getUserConversations(@Req() req: any) {
    return this.chatService.getUserConversations(req.user.userId);
  }

  @Get('conversations/:id')
  async getConversation(@Req() req: any, @Param('id') id: string) {
    return this.chatService.getConversation(id, req.user.userId);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { encryptedPayload: string; iv?: string }
  ) {
    return this.chatService.sendMessage(id, req.user.userId, body.encryptedPayload, body.iv);
  }
}
