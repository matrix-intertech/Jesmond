import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async createCustomer(organizationId: string, userId: string, data: { firstName: string; lastName?: string; email?: string; phone?: string; address?: string; externalId?: string }) {
    const customer = await this.prisma.retailCustomer.create({
      data: {
        organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        externalId: data.externalId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: 'USER',
        action: 'customer.create',
        resourceType: 'RetailCustomer',
        resourceId: customer.id,
        changes: { new: customer as any }
      }
    });

    return customer;
  }

  async listCustomers(organizationId: string) {
    return this.prisma.retailCustomer.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCustomer(organizationId: string, customerId: string) {
    const customer = await this.prisma.retailCustomer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    if (customer.organizationId !== organizationId) {
      throw new ForbiddenException('Customer does not belong to your organization');
    }
    return customer;
  }

  async updateCustomer(organizationId: string, userId: string, customerId: string, data: { firstName?: string; lastName?: string; email?: string; phone?: string; address?: string; externalId?: string }) {
    const current = await this.getCustomer(organizationId, customerId);

    const updated = await this.prisma.retailCustomer.update({
      where: { id: customerId },
      data: {
        firstName: data.firstName !== undefined ? data.firstName : current.firstName,
        lastName: data.lastName !== undefined ? data.lastName : current.lastName,
        email: data.email !== undefined ? data.email : current.email,
        phone: data.phone !== undefined ? data.phone : current.phone,
        address: data.address !== undefined ? data.address : current.address,
        externalId: data.externalId !== undefined ? data.externalId : current.externalId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: 'USER',
        action: 'customer.update',
        resourceType: 'RetailCustomer',
        resourceId: customerId,
        changes: { old: current as any, new: updated as any }
      }
    });

    return updated;
  }
}
