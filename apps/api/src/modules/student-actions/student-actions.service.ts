import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StudentActionsService {
  constructor(private readonly prisma: PrismaService) {}

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
    return saved.filter(s => s.property.status === 'PUBLISHED').map(s => s.property);
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

    return this.prisma.enquiry.create({
      data: {
        studentId,
        propertyId,
        message,
        roomTypeId
      }
    });
  }
}
