import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  async listBranches(organizationId: string) {
    return this.prisma.retailBranch.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }

  async getBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have access to this branch');
    }

    return branch;
  }

  async createBranch(organizationId: string, data: any) {
    return this.prisma.retailBranch.create({
      data: {
        organizationId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async updateBranch(organizationId: string, branchId: string, data: any) {
    const branch = await this.getBranch(organizationId, branchId);
    
    return this.prisma.retailBranch.update({
      where: { id: branch.id },
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        isActive: data.isActive,
      },
    });
  }

  async deleteBranch(organizationId: string, branchId: string) {
    const branch = await this.getBranch(organizationId, branchId);
    
    // Deactivate instead of physical delete to preserve history
    return this.prisma.retailBranch.update({
      where: { id: branch.id },
      data: { isActive: false },
    });
  }

  async getBranchEmployees(organizationId: string, branchId: string) {
    const branch = await this.getBranch(organizationId, branchId);

    return this.prisma.orgStaff.findMany({
      where: {
        retailBranchId: branch.id,
        user: { deletedAt: null },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            accountStatus: true,
          },
        },
      },
    });
  }
}
