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
import { QueryNameChangeRequestsDto } from './dto/query-name-change-requests.dto';
import { ReviewNameChangeRequestDto } from './dto/review-name-change-request.dto';
import {
  BusinessNameChangeStatus,
  ActorType,
  UserRole,
} from '@prisma/client';

@Injectable()
export class AdminNameRequestsService {
  private readonly logger = new Logger(AdminNameRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async validateReviewerEligibility(
    reviewerId: string,
    organizationId: string,
  ) {
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerId },
      include: { orgStaffRoles: true },
    });

    if (!reviewer) {
      throw new NotFoundException(`Reviewer user ${reviewerId} not found`);
    }

    if (
      reviewer.role !== UserRole.ADMIN &&
      reviewer.role !== UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException(
        'Reviewer must hold an administrative role (ADMIN or SUPER_ADMIN).',
      );
    }

    // Prohibit self-approval: reviewer cannot review requests for their own organization
    const isAssociatedWithOrg = reviewer.orgStaffRoles.some(
      (staff) => staff.organizationId === organizationId,
    );

    if (isAssociatedWithOrg) {
      this.logger.warn(
        `Reviewer ${reviewerId} attempted self-review for organization ${organizationId}`,
      );

      await this.prisma.auditLog.create({
        data: {
          actorId: reviewerId,
          actorType: ActorType.USER,
          action: 'organization.name_change_review_attempt_rejected',
          resourceType: 'Organization',
          resourceId: organizationId,
          changes: {
            reason:
              'Administrative self-approval prohibited: reviewer associated with target organization',
          },
        },
      });

      throw new ForbiddenException(
        'Administrative self-approval prohibited: reviewers cannot approve or reject requests for an organization they are associated with.',
      );
    }
  }

  async getQueue(query: QueryNameChangeRequestsDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { currentName: { contains: term, mode: 'insensitive' } },
        { proposedName: { contains: term, mode: 'insensitive' } },
        { organization: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [items, total, stats] = await Promise.all([
      this.prisma.businessNameChangeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              type: true,
              businessCategory: true,
              abn: true,
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
          documents: {
            select: {
              id: true,
              filename: true,
              size: true,
              mimeType: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.businessNameChangeRequest.count({ where }),
      this.getStats(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats,
    };
  }

  async getStats() {
    const [total, submitted, underReview, approved, rejected] =
      await Promise.all([
        this.prisma.businessNameChangeRequest.count(),
        this.prisma.businessNameChangeRequest.count({
          where: { status: BusinessNameChangeStatus.SUBMITTED },
        }),
        this.prisma.businessNameChangeRequest.count({
          where: { status: BusinessNameChangeStatus.UNDER_REVIEW },
        }),
        this.prisma.businessNameChangeRequest.count({
          where: { status: BusinessNameChangeStatus.APPROVED },
        }),
        this.prisma.businessNameChangeRequest.count({
          where: { status: BusinessNameChangeStatus.REJECTED },
        }),
      ]);

    return {
      total,
      submitted,
      underReview,
      approved,
      rejected,
      pending: submitted + underReview,
    };
  }

  async getRequestDetails(requestId: string) {
    const request = await this.prisma.businessNameChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        organization: true,
        requestedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
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
        documents: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Name change request ${requestId} not found`);
    }

    return request;
  }

  async startReview(requestId: string, reviewerId: string) {
    const request = await this.prisma.businessNameChangeRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException(`Name change request ${requestId} not found`);
    }

    await this.validateReviewerEligibility(reviewerId, request.organizationId);

    if (request.status !== BusinessNameChangeStatus.SUBMITTED) {
      throw new BadRequestException(
        `Cannot start review for a request with status ${request.status}. Only SUBMITTED requests can be moved to UNDER_REVIEW.`,
      );
    }

    const updated = await this.prisma.businessNameChangeRequest.update({
      where: { id: requestId },
      data: {
        status: BusinessNameChangeStatus.UNDER_REVIEW,
      },
      include: {
        documents: true,
        organization: true,
        requestedByUser: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: reviewerId,
        actorType: ActorType.USER,
        action: 'organization.name_change_review_started',
        resourceType: 'BusinessNameChangeRequest',
        resourceId: requestId,
        changes: {
          organizationId: request.organizationId,
          previousStatus: BusinessNameChangeStatus.SUBMITTED,
          newStatus: BusinessNameChangeStatus.UNDER_REVIEW,
        },
      },
    });

    try {
      await this.notificationsService.createNotification({
        recipientId: request.requestedByUserId,
        type: 'BUSINESS_NAME_CHANGE_UNDER_REVIEW',
        title: 'Business Name Change Under Review',
        body: `Your request to change business name to "${request.proposedName}" is now actively under review by an administrator.`,
        actionUrl: '/portal/retail/business',
        metadata: { requestId, organizationId: request.organizationId },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to send under_review notification: ${e.message}`);
    }

    return updated;
  }

  async approveRequest(
    requestId: string,
    reviewerId: string,
    dto: ReviewNameChangeRequestDto,
  ) {
    const request = await this.prisma.businessNameChangeRequest.findUnique({
      where: { id: requestId },
      include: { organization: true },
    });

    if (!request) {
      throw new NotFoundException(`Name change request ${requestId} not found`);
    }

    await this.validateReviewerEligibility(reviewerId, request.organizationId);

    if (
      request.status !== BusinessNameChangeStatus.SUBMITTED &&
      request.status !== BusinessNameChangeStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `Cannot approve request with status ${request.status}. Finalized requests cannot be approved.`,
      );
    }

    const previousName = request.currentName;
    const newName = request.proposedName;

    // Transactional approval: update organization name + request status + audit log
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Double check request is still active within transaction to prevent race conditions
      const currentTxRequest = await tx.businessNameChangeRequest.findUnique({
        where: { id: requestId },
      });

      if (
        !currentTxRequest ||
        (currentTxRequest.status !== BusinessNameChangeStatus.SUBMITTED &&
          currentTxRequest.status !== BusinessNameChangeStatus.UNDER_REVIEW)
      ) {
        throw new BadRequestException(
          'Request status changed concurrently. Approval cancelled.',
        );
      }

      // 2. Update Organization Name
      const updatedOrg = await tx.organization.update({
        where: { id: request.organizationId },
        data: { name: newName },
      });

      // 3. Update Request Status
      const updatedRequest = await tx.businessNameChangeRequest.update({
        where: { id: requestId },
        data: {
          status: BusinessNameChangeStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedByUserId: reviewerId,
          reviewerNotes: dto.reviewerNotes?.trim() || null,
          internalNotes: dto.internalNotes?.trim() || null,
        },
        include: {
          documents: true,
          organization: true,
          requestedByUser: true,
          reviewedByUser: true,
        },
      });

      // 4. Create Audit Log
      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          actorType: ActorType.USER,
          action: 'organization.name_change_approved',
          resourceType: 'Organization',
          resourceId: request.organizationId,
          changes: {
            requestId,
            previousName,
            newName,
            reviewerNotes: dto.reviewerNotes?.trim() || null,
          },
        },
      });

      return updatedRequest;
    });

    // Send Notification to Business User
    try {
      await this.notificationsService.createNotification({
        recipientId: request.requestedByUserId,
        type: 'BUSINESS_NAME_CHANGE_APPROVED',
        title: 'Business Name Change Approved 🎉',
        body: `Your request to change business name to "${newName}" has been approved! Your business profile is now updated.`,
        actionUrl: '/portal/retail/business',
        metadata: {
          requestId,
          organizationId: request.organizationId,
          newName,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to send approval notification: ${e.message}`);
    }

    return result;
  }

  async rejectRequest(
    requestId: string,
    reviewerId: string,
    dto: ReviewNameChangeRequestDto,
  ) {
    const reviewerNotes = dto.reviewerNotes?.trim();
    if (!reviewerNotes) {
      throw new BadRequestException(
        'Reviewer notes are mandatory when rejecting a business name change request.',
      );
    }

    const request = await this.prisma.businessNameChangeRequest.findUnique({
      where: { id: requestId },
      include: { organization: true },
    });

    if (!request) {
      throw new NotFoundException(`Name change request ${requestId} not found`);
    }

    await this.validateReviewerEligibility(reviewerId, request.organizationId);

    if (
      request.status !== BusinessNameChangeStatus.SUBMITTED &&
      request.status !== BusinessNameChangeStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `Cannot reject request with status ${request.status}. Finalized requests cannot be rejected.`,
      );
    }

    // Transactional rejection
    const result = await this.prisma.$transaction(async (tx) => {
      const currentTxRequest = await tx.businessNameChangeRequest.findUnique({
        where: { id: requestId },
      });

      if (
        !currentTxRequest ||
        (currentTxRequest.status !== BusinessNameChangeStatus.SUBMITTED &&
          currentTxRequest.status !== BusinessNameChangeStatus.UNDER_REVIEW)
      ) {
        throw new BadRequestException(
          'Request status changed concurrently. Rejection cancelled.',
        );
      }

      // Update Request Status (Organization name remains strictly untouched)
      const updatedRequest = await tx.businessNameChangeRequest.update({
        where: { id: requestId },
        data: {
          status: BusinessNameChangeStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedByUserId: reviewerId,
          reviewerNotes,
          internalNotes: dto.internalNotes?.trim() || null,
        },
        include: {
          documents: true,
          organization: true,
          requestedByUser: true,
          reviewedByUser: true,
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: reviewerId,
          actorType: ActorType.USER,
          action: 'organization.name_change_rejected',
          resourceType: 'Organization',
          resourceId: request.organizationId,
          changes: {
            requestId,
            currentName: request.currentName,
            rejectedProposedName: request.proposedName,
            rejectionNotes: reviewerNotes,
          },
        },
      });

      return updatedRequest;
    });

    // Send Notification to Business User
    try {
      await this.notificationsService.createNotification({
        recipientId: request.requestedByUserId,
        type: 'BUSINESS_NAME_CHANGE_REJECTED',
        title: 'Business Name Change Request Rejected',
        body: `Your request to change business name to "${request.proposedName}" was not approved. Notes: ${reviewerNotes}`,
        actionUrl: '/portal/retail/business',
        metadata: {
          requestId,
          organizationId: request.organizationId,
          rejectionNotes: reviewerNotes,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Failed to send rejection notification: ${e.message}`);
    }

    return result;
  }

  async getAdminSignedDocumentUrl(
    requestId: string,
    documentId: string,
    adminUserId: string,
  ) {
    const document = await this.prisma.businessNameChangeDocument.findUnique({
      where: { id: documentId },
    });

    if (!document || document.requestId !== requestId) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const signedUrl = await this.storageService.getSignedDownloadUrl(
      document.key,
      900,
    );

    await this.prisma.auditLog.create({
      data: {
        actorId: adminUserId,
        actorType: ActorType.USER,
        action: 'organization.name_change_admin_document_viewed',
        resourceType: 'BusinessNameChangeDocument',
        resourceId: documentId,
        changes: { requestId, organizationId: document.organizationId },
      },
    });

    return {
      signedUrl,
      expiresIn: 900,
    };
  }
}
