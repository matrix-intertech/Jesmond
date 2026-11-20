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
import { AdminCredentialsService } from './admin-credentials.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole, CredentialStatus, BusinessCategory } from '@prisma/client';
import { ReviewCredentialDto } from './dto/review-credential.dto';
import { ReviewAbnExemptionDto } from './dto/review-abn-exemption.dto';

@Controller('admin/credentials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminCredentialsController {
  constructor(
    private readonly adminCredentialsService: AdminCredentialsService,
  ) {}

  private getAdminUserId(req: any): string {
    return req.user?.userId || req.user?.id || req.user?.sub || 'ADMIN';
  }

  @Get('queue')
  async getQueue(
    @Query('status') status?: CredentialStatus,
    @Query('category') category?: BusinessCategory,
    @Query('state') state?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminCredentialsService.getQueue({
      status,
      category,
      state,
      page,
      limit,
    });
  }

  @Get('abn-exemptions')
  async getAbnExemptionQueue(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminCredentialsService.getAbnExemptionQueue({
      page,
      limit,
    });
  }

  @Post('abn-exemptions/:orgId/review')
  async reviewAbnExemption(
    @Request() req: any,
    @Param('orgId') orgId: string,
    @Body() dto: ReviewAbnExemptionDto,
  ) {
    const adminUserId = this.getAdminUserId(req);
    return this.adminCredentialsService.reviewAbnExemption(
      orgId,
      adminUserId,
      dto,
    );
  }

  @Post(':id/review')
  async reviewCredential(
    @Request() req: any,
    @Param('id') credentialId: string,
    @Body() dto: ReviewCredentialDto,
  ) {
    const adminUserId = this.getAdminUserId(req);
    return this.adminCredentialsService.reviewCredential(
      credentialId,
      adminUserId,
      dto,
    );
  }

  @Get(':id/documents/:docId/signed-url')
  async getAdminSignedDocumentUrl(
    @Request() req: any,
    @Param('id') credentialId: string,
    @Param('docId') documentId: string,
  ) {
    const adminUserId = this.getAdminUserId(req);
    return this.adminCredentialsService.getAdminSignedDocumentUrl(
      credentialId,
      documentId,
      adminUserId,
    );
  }
}
