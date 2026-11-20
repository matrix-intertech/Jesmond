import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../properties/core/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateNameChangeRequestDto } from './dto/create-name-change-request.dto';
import {
  BusinessNameChangeStatus,
  ActorType,
  UserRole,
} from '@prisma/client';

@Injectable()
export class BusinessNameRequestsService {
  private readonly logger = new Logger(BusinessNameRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async submitRequest(
    orgId: string,
    userId: string,
    dto: CreateNameChangeRequestDto,
  ) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      throw new NotFoundException(`Organization ${orgId} not found`);
    }

    const proposedName = dto.proposedName.trim();
    if (proposedName.toLowerCase() === org.name.trim().toLowerCase()) {
      throw new BadRequestException(
        'Proposed business name must be different from current approved name.',
      );
    }

    // Guard against active duplicate requests
    const activeRequest = await this.prisma.businessNameChangeRequest.findFirst({
      where: {
        organizationId: orgId,
        status: {
          in: [
            BusinessNameChangeStatus.SUBMITTED,
            BusinessNameChangeStatus.UNDER_REVIEW,
          ],
        },
      },
    });

    if (activeRequest) {
      throw new BadRequestException(
        'An active business name change request is already in progress for this organization.',
      );
    }

    const request = await this.prisma.businessNameChangeRequest.create({
      data: {
        organizationId: orgId,
        requestedByUserId: userId,
        currentName: org.name,
        proposedName,
        reason: dto.reason.trim(),
        status: BusinessNameChangeStatus.SUBMITTED,
      },
      include: {
        documents: true,
      },
    });

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: ActorType.USER,
        action: 'organization.name_change_requested',
        resourceType: 'BusinessNameChangeRequest',
        resourceId: request.id,
        changes: {
          organizationId: orgId,
          currentName: org.name,
          proposedName,
          reason: dto.reason.trim(),
        },
      },
    });

    // In-app notification for the requester
    try {
      await this.notificationsService.createNotification({
        recipientId: userId,
        type: 'BUSINESS_NAME_CHANGE_SUBMITTED',
        title: 'Business Name Change Request Submitted',
        body: `Your request to change business name to "${proposedName}" has been submitted for administrative review.`,
        actionUrl: '/portal/retail/business',
        metadata: { requestId: request.id, organizationId: orgId },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to send submission notification: ${e.message}`);
    }

    // Notify administrators
    try {
      const admins = await this.prisma.user.findMany({
        where: {
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
          accountStatus: 'ACTIVE',
        },
        select: { id: true },
        take: 10,
      });

      for (const admin of admins) {
        await this.notificationsService.createNotification({
          recipientId: admin.id,
          type: 'ADMIN_NAME_CHANGE_SUBMITTED',
          title: 'New Business Name Change Request',
          body: `Organization "${org.name}" requested to change name to "${proposedName}".`,
          actionUrl: `/admin/business-name-requests`,
          metadata: { requestId: request.id, organizationId: orgId },
        });
      }
    } catch (e: any) {
      this.logger.warn(`Failed to notify admins: ${e.message}`);
    }

    return request;
  }

  async getCurrentRequest(orgId: string) {
    const active = await this.prisma.businessNameChangeRequest.findFirst({
      where: {
        organizationId: orgId,
        status: {
          in: [
            BusinessNameChangeStatus.SUBMITTED,
            BusinessNameChangeStatus.UNDER_REVIEW,
          ],
        },
      },
      include: {
        documents: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return active;
  }

  async getRequestHistory(orgId: string) {
    const history = await this.prisma.businessNameChangeRequest.findMany({
      where: { organizationId: orgId },
      include: {
        documents: {
          select: {
            id: true,
            filename: true,
            mimeType: true,
            size: true,
            createdAt: true,
          },
        },
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return history;
  }

  async uploadDocument(
    orgId: string,
    requestId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    const request = await this.prisma.businessNameChangeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Name change request ${requestId} not found`);
    }

    if (request.organizationId !== orgId) {
      throw new ForbiddenException(
        'Cannot upload documents for another organization request.',
      );
    }

    if (
      request.status !== BusinessNameChangeStatus.SUBMITTED &&
      request.status !== BusinessNameChangeStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `Cannot upload documents for a finalized request (${request.status}).`,
      );
    }

    const upload = await this.storageService.uploadNameChangeDocument(
      orgId,
      requestId,
      file,
    );

    const doc = await this.prisma.businessNameChangeDocument.create({
      data: {
        requestId,
        organizationId: orgId,
        key: upload.key,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        uploadedByUserId: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: ActorType.USER,
        action: 'organization.name_change_document_uploaded',
        resourceType: 'BusinessNameChangeDocument',
        resourceId: doc.id,
        changes: {
          requestId,
          filename: doc.filename,
          size: doc.size,
        },
      },
    });

    return {
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      size: doc.size,
      createdAt: doc.createdAt,
    };
  }

  async getSignedDocumentUrl(
    orgId: string,
    requestId: string,
    documentId: string,
    userId: string,
  ) {
    const document = await this.prisma.businessNameChangeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    if (document.organizationId !== orgId || document.requestId !== requestId) {
      throw new ForbiddenException(
        'Access denied to requested name change document.',
      );
    }

    const signedUrl = await this.storageService.getSignedDownloadUrl(
      document.key,
      900,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: ActorType.USER,
        action: 'organization.name_change_document_viewed',
        resourceType: 'BusinessNameChangeDocument',
        resourceId: documentId,
      },
    });

    return {
      signedUrl,
      expiresIn: 900,
    };
  }
}
