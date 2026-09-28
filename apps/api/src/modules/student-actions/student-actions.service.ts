import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StudentActionsService {
  private readonly logger = new Logger(StudentActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  async saveProperty(studentId: string, propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.status !== 'PUBLISHED') {
      throw new NotFoundException('Property not found or not published.');
    }

    try {
      return await this.prisma.savedProperty.create({
        data: { studentId, propertyId }
      });
    } catch (error: any) {
      // Ignore unique constraint violation if already saved
      if (error.code === 'P2002') return { message: 'Already saved' };
      throw error;
    }
  }

  async unsaveProperty(studentId: string, propertyId: string) {
    const saved = await this.prisma.savedProperty.findUnique({
      where: { studentId_propertyId: { studentId, propertyId } }
    });
    if (!saved) return { message: 'Not saved' };

    await this.prisma.savedProperty.delete({
      where: { studentId_propertyId: { studentId, propertyId } }
    });
    return { success: true };
  }

  async getSavedProperties(studentId: string) {
    const saved = await this.prisma.savedProperty.findMany({
      where: { studentId },
      include: {
        property: {
          include: {
            organization: { select: { name: true } },
            suburb: { select: { name: true, city: { select: { name: true } } } },
            media: { orderBy: { displayOrder: 'asc' }, take: 1 },
            roomTypes: { orderBy: { pricePerWeek: 'asc' }, take: 1 }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Only return published properties
    return saved.filter((s: any) => s.property.status === 'PUBLISHED').map((s: any) => s.property);
  }

  async createEnquiry(studentId: string, propertyId: string, message: string, roomTypeId?: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.status !== 'PUBLISHED') {
      throw new BadRequestException('Cannot enquire about this property. It is not currently published.');
    }

    if (roomTypeId) {
      const room = await this.prisma.roomType.findFirst({ where: { id: roomTypeId, propertyId } });
      if (!room) throw new BadRequestException('Invalid room type for this property.');
    }

    const enquiry = await this.prisma.enquiry.create({
      data: {
        studentId,
        propertyId,
        message,
        roomTypeId
      }
    });

    // Notify organization admins
    this.prisma.orgStaff.findMany({
      where: { organizationId: property.organizationId, role: 'ADMIN' },
      select: { userId: true }
    }).then((admins: any[]) => {
      admins.forEach((admin: any) => {
        this.notificationsService.createNotification({
          recipientId: admin.userId,
          type: 'ENQUIRY_CREATED',
          title: 'New Enquiry',
          body: `A new enquiry has been submitted for ${property.name}`,
          actionUrl: `/dashboard/enquiries/${enquiry.id}`, // Example URL
        }).catch((err: any) => this.logger.error('Failed to notify admin of new enquiry', err));
      });
    }).catch((err: any) => this.logger.error('Failed to fetch admins for enquiry notification', err));

    return enquiry;
  }
}
