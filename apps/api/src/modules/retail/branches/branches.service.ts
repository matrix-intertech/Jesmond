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
}
