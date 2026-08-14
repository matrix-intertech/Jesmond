import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

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
        roomType: {
          include: {
            property: true
          }
        },
        student: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
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
