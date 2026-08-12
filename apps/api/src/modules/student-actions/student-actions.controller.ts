import { Controller, Get, Post, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { StudentActionsService } from './student-actions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('properties')
export class StudentActionsController {
  constructor(private readonly studentActionsService: StudentActionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @Get('saved')
  async getSavedProperties(@Request() req: any) {
    return this.studentActionsService.getSavedProperties(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @Post(':id/save')
  async saveProperty(@Param('id') id: string, @Request() req: any) {
    return this.studentActionsService.saveProperty(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @Delete(':id/save')
  async unsaveProperty(@Param('id') id: string, @Request() req: any) {
    return this.studentActionsService.unsaveProperty(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @Post(':id/enquiries')
  async createEnquiry(
    @Param('id') id: string,
    @Body() body: { message: string; roomTypeId?: string },
    @Request() req: any
  ) {
    if (!body.message || typeof body.message !== 'string') {
      throw new Error('Message is required and must be a string');
    }
    return this.studentActionsService.createEnquiry(req.user.id, id, body.message, body.roomTypeId);
  }
}
