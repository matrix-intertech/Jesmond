import {
  Controller,
  Get,
  Post,
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
import { BusinessNameRequestsService } from './business-name-requests.service';
import { CreateNameChangeRequestDto } from './dto/create-name-change-request.dto';

@Controller('business/name-change-requests')
@UseGuards(JwtAuthGuard)
export class BusinessNameRequestsController {
  constructor(
    private readonly nameRequestsService: BusinessNameRequestsService,
  ) {}

  private getOrgId(req: any): string {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      throw new ForbiddenException(
        'Organization context is required for business name change operations',
      );
    }
    return orgId;
  }

  private getUserId(req: any): string {
    return req.user?.userId || req.user?.id || req.user?.sub || 'SYSTEM';
  }

  @Post()
  async submitRequest(
    @Request() req: any,
    @Body() dto: CreateNameChangeRequestDto,
  ) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.nameRequestsService.submitRequest(orgId, userId, dto);
  }

  @Get('current')
  async getCurrentRequest(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.nameRequestsService.getCurrentRequest(orgId);
  }

  @Get('history')
  async getRequestHistory(@Request() req: any) {
    const orgId = this.getOrgId(req);
    return this.nameRequestsService.getRequestHistory(orgId);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Request() req: any,
    @Param('id') requestId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.nameRequestsService.uploadDocument(
      orgId,
      requestId,
      userId,
      file,
    );
  }

  @Get(':id/documents/:docId/signed-url')
  async getSignedDocumentUrl(
    @Request() req: any,
    @Param('id') requestId: string,
    @Param('docId') documentId: string,
  ) {
    const orgId = this.getOrgId(req);
    const userId = this.getUserId(req);
    return this.nameRequestsService.getSignedDocumentUrl(
      orgId,
      requestId,
      documentId,
      userId,
    );
  }
}
