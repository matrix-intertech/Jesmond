import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdminNameRequestsService } from './admin-name-requests.service';
import { QueryNameChangeRequestsDto } from './dto/query-name-change-requests.dto';
import { ReviewNameChangeRequestDto } from './dto/review-name-change-request.dto';

@Controller('admin/name-change-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminNameRequestsController {
  constructor(
    private readonly adminNameRequestsService: AdminNameRequestsService,
  ) {}

  private getAdminId(req: any): string {
    return req.user?.userId || req.user?.id || req.user?.sub;
  }

  @Get()
  async getQueue(@Query() query: QueryNameChangeRequestsDto) {
    return this.adminNameRequestsService.getQueue(query);
  }

  @Get('stats')
  async getStats() {
    return this.adminNameRequestsService.getStats();
  }

  @Get(':id')
  async getRequestDetails(@Param('id') requestId: string) {
    return this.adminNameRequestsService.getRequestDetails(requestId);
  }

  @Post(':id/start-review')
  async startReview(@Request() req: any, @Param('id') requestId: string) {
    const adminId = this.getAdminId(req);
    return this.adminNameRequestsService.startReview(requestId, adminId);
  }

  @Post(':id/approve')
  async approveRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body() dto: ReviewNameChangeRequestDto,
  ) {
    const adminId = this.getAdminId(req);
    return this.adminNameRequestsService.approveRequest(requestId, adminId, dto);
  }

  @Post(':id/reject')
  async rejectRequest(
    @Request() req: any,
    @Param('id') requestId: string,
    @Body() dto: ReviewNameChangeRequestDto,
  ) {
    const adminId = this.getAdminId(req);
    return this.adminNameRequestsService.rejectRequest(requestId, adminId, dto);
  }

  @Get(':id/documents/:docId/signed-url')
  async getAdminSignedDocumentUrl(
    @Request() req: any,
    @Param('id') requestId: string,
    @Param('docId') documentId: string,
  ) {
    const adminId = this.getAdminId(req);
    return this.adminNameRequestsService.getAdminSignedDocumentUrl(
      requestId,
      documentId,
      adminId,
    );
  }
}
