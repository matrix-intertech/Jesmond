import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from '../dtos/customer-address.dto';

@Injectable()
export class CustomerAddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerAddresses(userId: string) {
    return this.prisma.customerAddress.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getAddressById(userId: string, id: string) {
    const address = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (!address || address.deletedAt !== null) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('You do not have access to this address');
    }
    return address;
  }

  async createAddress(userId: string, dto: CreateCustomerAddressDto) {
    // Check existing addresses for this user
    const existingCount = await this.prisma.customerAddress.count({
      where: { userId, deletedAt: null },
    });

    const isDefault = dto.isDefault || existingCount === 0;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: {
          userId,
          label: dto.label?.trim() || 'Home',
          recipientName: dto.recipientName?.trim() || null,
          phone: dto.phone?.trim() || null,
          streetAddress: dto.streetAddress.trim(),
          unitNumber: dto.unitNumber?.trim() || null,
          suburb: dto.suburb?.trim() || null,
          city: dto.city.trim(),
          state: dto.state.trim().toUpperCase(),
          postcode: dto.postcode.trim(),
          country: dto.country?.trim() || 'Australia',
          instructions: dto.instructions?.trim() || null,
          isDefault,
        },
      });
    });
  }

  async updateAddress(
    userId: string,
    id: string,
    dto: UpdateCustomerAddressDto,
  ) {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException('Address not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this address');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.update({
        where: { id },
        data: {
          label: dto.label !== undefined ? dto.label.trim() : existing.label,
          recipientName:
            dto.recipientName !== undefined
              ? dto.recipientName?.trim() || null
              : existing.recipientName,
          phone:
            dto.phone !== undefined
              ? dto.phone?.trim() || null
              : existing.phone,
          streetAddress:
            dto.streetAddress !== undefined
              ? dto.streetAddress.trim()
              : existing.streetAddress,
          unitNumber:
            dto.unitNumber !== undefined
              ? dto.unitNumber?.trim() || null
              : existing.unitNumber,
          suburb:
            dto.suburb !== undefined
              ? dto.suburb?.trim() || null
              : existing.suburb,
          city: dto.city !== undefined ? dto.city.trim() : existing.city,
          state:
            dto.state !== undefined
              ? dto.state.trim().toUpperCase()
              : existing.state,
          postcode:
            dto.postcode !== undefined
              ? dto.postcode.trim()
              : existing.postcode,
          country:
            dto.country !== undefined
              ? dto.country.trim()
              : existing.country,
          instructions:
            dto.instructions !== undefined
              ? dto.instructions?.trim() || null
              : existing.instructions,
          isDefault:
            dto.isDefault !== undefined ? dto.isDefault : existing.isDefault,
        },
      });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException('Address not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this address');
    }

    await this.prisma.customerAddress.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isDefault: false,
      },
    });

    return { success: true, message: 'Address removed successfully' };
  }

  async setDefaultAddress(userId: string, id: string) {
    const existing = await this.prisma.customerAddress.findUnique({
      where: { id },
    });
    if (!existing || existing.deletedAt !== null) {
      throw new NotFoundException('Address not found');
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this address');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.customerAddress.updateMany({
        where: { userId },
        data: { isDefault: false },
      });

      return tx.customerAddress.update({
        where: { id },
        data: { isDefault: true },
      });
    });
  }
}
