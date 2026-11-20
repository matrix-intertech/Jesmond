import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BusinessCredentialsService } from './business-credentials.service';
import { VerifyAbnDto } from './dto/verify-abn.dto';
import { RequestAbnExemptionDto } from './dto/request-abn-exemption.dto';
import { SaveCredentialDraftDto } from './dto/save-credential-draft.dto';

@Controller('business/credentials')
@UseGuards(JwtAuthGuard)
export class BusinessCredentialsController {
  constructor(
    private readonly credentialsService: BusinessCredentialsService,
  ) {}

  private getOrgId(req: any): string {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      throw new ForbiddenException(
        'Organization context is required for business credential operations',
      );
    }
    return orgId;
  }

  private getUserId(req: any): string {
    return req.user?.userId || req.user?.id || req.user?.sub || 'SYSTEM';
  }

  @Get('requirements')
  async getRequirements(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.credentialsService.getRequirements(orgId);
  }

  @Post('verify-abn')
  async verifyAbn(@Request() req: any, @Body() dto: VerifyAbnDto) {
    const orgId = this.getOrgId(req);
    return this.credentialsService.verifyAbn(orgId, dto);
  }

  @Post('abn-exemption/request')
  async requestAbnExemption(
    @Request() req: any,
    @Body() dto: RequestAbnExemptionDto,
  ) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.credentialsService.requestAbnExemption(orgId, userId, dto);
  }

  @Get()
  async getAllCredentials(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.credentialsService.getAllCredentials(orgId);
  }

  @Put(':code')
  async saveDraft(
    @Request() req: any,
    @Param('code') code: string,
    @Body() dto: SaveCredentialDraftDto,
  ) {
    const orgId = this.getOrgId(req);
    return this.credentialsService.saveDraft(orgId, code, dto);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req: any,
    @Param('id') credentialId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.credentialsService.uploadDocument(
      orgId,
      credentialId,
      userId,
      file,
    );
  }

  @Get(':id/documents/:docId/signed-url')
  async getSignedDocumentUrl(
    @Request() req: any,
    @Param('id') credentialId: string,
    @Param('docId') documentId: string,
  ) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.credentialsService.getSignedDocumentUrl(
      orgId,
      credentialId,
      documentId,
      userId,
    );
  }

  @Post('submit')
  async submitCredentials(@Request() req: any) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.credentialsService.submitCredentials(orgId, userId);
  }

  @Post('completion/dismiss')
  async dismissCompletionReminder(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.credentialsService.dismissCompletionReminder(orgId);
  }
}
