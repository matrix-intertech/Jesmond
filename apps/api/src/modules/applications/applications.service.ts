import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/services/email.service';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async createApplication(studentId: string, propertyId: string, roomTypeId: string, moveInDate: string, durationMonths: number) {
    // Verify Property is PUBLISHED
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId }
    });
    if (!property || property.status !== 'PUBLISHED') {
      throw new BadRequestException('Property is not available for applications.');
    }

    // Verify Room belongs to Property and has inventory
    const roomType = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId }
    });
    if (!roomType) {
      throw new BadRequestException('Invalid room type for this property.');
    }
    if (roomType.inventory <= 0) {
      throw new BadRequestException('This room is currently out of stock.');
    }

    // Create Application - lockedPrice is derived strictly from the database
    const application = await this.prisma.application.create({
      data: {
        studentId,
        roomTypeId,
        moveInDate: new Date(moveInDate),
        durationMonths,
        lockedPrice: roomType.pricePerWeek,
        status: 'PENDING_REVIEW',
      }
    });

    return application;
  }

  async getMyApplications(studentId: string) {
    return this.prisma.application.findMany({
      where: { studentId },
      include: {
        roomType: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                status: true,
                media: { orderBy: { displayOrder: 'asc' }, take: 1 }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getProviderApplications(organizationId: string) {
    return this.prisma.application.findMany({
      where: {
        roomType: {
          property: {
            organizationId
          }
        }
      },
      include: {
        roomType: {
          include: {
            property: { select: { id: true, name: true } }
          }
        },
        student: { select: { id: true, firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getProviderApplication(organizationId: string, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        lease: true,
        roomType: {
          include: {
            property: {
              include: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                    // Prefer admin-role staff as the primary contact; fall back to any active staff
                    staff: {
                      where: { deletedAt: null },
                      orderBy: { createdAt: 'asc' },
                      select: {
                        role: true,
                        user: {
                          select: {
                            firstName: true,
                            lastName: true,
                            email: true,
                          },
                        },
                      },
                    },
                  },
                },
                suburb: {
                  select: {
                    name: true,
                    city: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    if (!app) throw new NotFoundException('Application not found');
    if (app.roomType.property.organizationId !== organizationId) {
      throw new NotFoundException('Application not found'); // Pretend not found to prevent leaking data
    }

    return app;
  }

  async approveApplication(organizationId: string, applicationId: string) {
    // 1. Fetch application and verify ownership
    const app = await this.getProviderApplication(organizationId, applicationId);

    if (app.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Only PENDING_REVIEW applications can be approved.');
    }

    if (app.roomType.property.status !== 'PUBLISHED') {
      throw new BadRequestException('Cannot approve application for unpublished property.');
    }

    // 2. Atomic Inventory Decrement
    // Uses updateMany to ensure atomic concurrency-safety where inventory > 0
    const updateResult = await this.prisma.roomType.updateMany({
      where: {
        id: app.roomType.id,
        inventory: { gt: 0 }
      },
      data: {
        inventory: { decrement: 1 }
      }
    });

    if (updateResult.count === 0) {
      throw new BadRequestException('This room is currently out of stock. Cannot approve application.');
    }

    // 3. Create Lease and Update Status
    // We use a transaction for the remaining updates since inventory is safely secured
    const result = await this.prisma.$transaction(async (tx) => {
      const endDate = new Date(app.moveInDate);
      endDate.setMonth(endDate.getMonth() + app.durationMonths);

      const lease = await tx.lease.create({
        data: {
          applicationId: app.id,
          studentId: app.studentId,
          startDate: app.moveInDate,
          endDate,
          status: 'DRAFT',
        }
      });

      const updatedApp = await tx.application.update({
        where: { id: app.id },
        data: { status: 'APPROVED' }
      });

      return { application: updatedApp, lease };
    });

    // Send confirmation email AFTER the transaction has committed successfully.
    // The email is fire-and-forget: a failure is logged but does NOT roll back the approval.
    const property = app.roomType.property;
    const org = property.organization;
    const suburb = property.suburb;

    // Prefer the org ADMIN-role staff as the contact; fall back to the earliest active staff member.
    const staffList = org.staff ?? [];
    const contactStaff =
      staffList.find((s) => s.role === 'ADMIN')?.user ??
      staffList[0]?.user;

    // Build a clean address string, omitting blank segments
    const addressParts = [
      property.address,
      suburb?.name,
      suburb?.city?.name,
      property.postcode,
    ].filter((p): p is string => Boolean(p));
    const propertyAddress = addressParts.join(', ');

    this.emailService
      .sendApplicationApprovalEmail({
        studentEmail: app.student.email,
        studentName: `${app.student.firstName} ${app.student.lastName}`,
        propertyName: property.name,
        propertyAddress,
        providerName: org.name,
        contactPersonName: contactStaff
          ? `${contactStaff.firstName} ${contactStaff.lastName}`
          : undefined,
        contactEmail: contactStaff?.email ?? undefined,
        // contactPhone: not populated — no phone field exists on Organization, OrgStaff, or User
      })
      .catch((err) =>
        this.logger.error(`Failed to send approval email for application ${app.id}`, err),
      );

    return result;
  }

  async rejectApplication(organizationId: string, applicationId: string) {
    const app = await this.getProviderApplication(organizationId, applicationId);

    if (app.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Only PENDING_REVIEW applications can be rejected.');
    }

    const updatedApp = await this.prisma.application.update({
      where: { id: app.id },
      data: { status: 'REJECTED' }
    });

    return updatedApp;
  }

  async withdrawApplication(studentId: string, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        lease: true,
        roomType: {
          include: {
            property: {
              include: {
                organization: {
                  include: {
                    staff: {
                      where: { deletedAt: null },
                      include: { user: { select: { email: true, firstName: true, lastName: true } } }
                    }
                  }
                }
              }
            }
          }
        },
        student: { select: { firstName: true, lastName: true, email: true } }
      }
    });

    if (!app || app.studentId !== studentId) {
      throw new NotFoundException('Application not found');
    }

    if (app.status === 'WITHDRAWN' || app.status === 'CANCELLED' || app.status === 'REJECTED') {
      throw new BadRequestException('Application is already closed, withdrawn, or rejected.');
    }

    const updatedApp = await this.prisma.$transaction(async (tx) => {
      if (app.status === 'APPROVED') {
        await tx.roomType.update({
          where: { id: app.roomTypeId },
          data: { inventory: { increment: 1 } }
        });

        if (app.lease) {
          await tx.lease.update({
            where: { id: app.lease.id },
            data: { status: 'TERMINATED' }
          });
        }
      }

      return tx.application.update({
        where: { id: app.id },
        data: { status: 'WITHDRAWN' }
      });
    });

    const staffList = app.roomType.property.organization.staff ?? [];
    const contactStaff = staffList.find((s) => s.role === 'ADMIN')?.user ?? staffList[0]?.user;
    if (contactStaff?.email) {
      this.emailService
        .sendApplicationWithdrawalEmail({
          providerEmail: contactStaff.email,
          providerName: app.roomType.property.organization.name,
          studentName: `${app.student.firstName} ${app.student.lastName}`,
          propertyName: app.roomType.property.name,
        })
        .catch((err) => this.logger.error(`Failed to send withdrawal email for app ${app.id}`, err));
    }

    return updatedApp;
  }

  async removeStudent(organizationId: string, applicationId: string) {
    const app = await this.getProviderApplication(organizationId, applicationId);

    if (app.status === 'WITHDRAWN' || app.status === 'CANCELLED' || app.status === 'REJECTED') {
      throw new BadRequestException('Application is already closed, withdrawn, or rejected.');
    }

    const updatedApp = await this.prisma.$transaction(async (tx) => {
      if (app.status === 'APPROVED') {
        await tx.roomType.update({
          where: { id: app.roomTypeId },
          data: { inventory: { increment: 1 } }
        });

        if (app.lease) {
          await tx.lease.update({
            where: { id: app.lease.id },
            data: { status: 'TERMINATED' }
          });
        }
      }

      return tx.application.update({
        where: { id: app.id },
        data: { status: 'CANCELLED' }
      });
    });

    this.emailService
      .sendApplicationRemovalEmail({
        studentEmail: app.student.email,
        studentName: `${app.student.firstName} ${app.student.lastName}`,
        propertyName: app.roomType.property.name,
      })
      .catch((err) => this.logger.error(`Failed to send removal email for app ${app.id}`, err));

    return updatedApp;
  }

  async cancelPropertyApplications(propertyId: string) {
    const apps = await this.prisma.application.findMany({
      where: {
        roomType: { propertyId },
        status: { in: ['PENDING_REVIEW', 'APPROVED'] }
      },
      include: {
        lease: true,
        student: { select: { firstName: true, lastName: true, email: true } },
        roomType: { include: { property: { select: { name: true } } } }
      }
    });

    for (const app of apps) {
      await this.prisma.$transaction(async (tx) => {
        if (app.status === 'APPROVED') {
          await tx.roomType.update({
            where: { id: app.roomTypeId },
            data: { inventory: { increment: 1 } }
          });

          if (app.lease) {
            await tx.lease.update({
              where: { id: app.lease.id },
              data: { status: 'TERMINATED' }
            });
          }
        }

        await tx.application.update({
          where: { id: app.id },
          data: { status: 'CANCELLED' }
        });
      });

      this.emailService
        .sendApplicationRemovalEmail({
          studentEmail: app.student.email,
          studentName: `${app.student.firstName} ${app.student.lastName}`,
          propertyName: app.roomType.property.name,
          reason: 'Property is no longer available',
        })
        .catch((err) => this.logger.error(`Failed to send property unpublish email for app ${app.id}`, err));
    }
  }

  // Admin: list all applications with necessary relations
  async adminFindAll() {
    return this.prisma.application.findMany({
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        roomType: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                organization: { select: { name: true } },
                suburb: { select: { name: true, city: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Admin: get single application detail with relations
  async adminFindOne(id: string) {
    return this.prisma.application.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, email: true } },
        roomType: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                organization: { select: { name: true } },
                suburb: { select: { name: true, city: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
  }

}
