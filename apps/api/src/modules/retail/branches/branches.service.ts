import { Injectable, ForbiddenException, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { UsageCounterService } from '../../subscriptions/services/usage-counter.service';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    @Optional() private usageCounterService?: UsageCounterService,
  ) {}

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
    const createPayload = {
      data: {
        organizationId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        isActive: data.isActive !== undefined ? data.isActive : true,
        deliveryEnabled:
          data.deliveryEnabled !== undefined ? data.deliveryEnabled : false,
        takeawayEnabled:
          data.takeawayEnabled !== undefined ? data.takeawayEnabled : true,
      },
    };

    const branch =
      this.usageCounterService && typeof this.prisma.$transaction === 'function'
        ? await this.prisma.$transaction(async (tx) => {
            await this.usageCounterService!.enforceAndIncrementInTransaction(
              tx,
              organizationId,
              'RETAIL_BRANCHES',
              1,
            );
            return tx.retailBranch.create(createPayload);
          })
        : await this.prisma.retailBranch.create(createPayload);

    await this.redisService.delByPattern('retail:marketplace:stores:*');
    return branch;
  }

  async updateBranch(organizationId: string, branchId: string, data: any) {
    const branch = await this.getBranch(organizationId, branchId);

    const updatePayload = {
      where: { id: branch.id },
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone,
        isActive: data.isActive,
        deliveryEnabled: data.deliveryEnabled,
        takeawayEnabled: data.takeawayEnabled,
      },
    };

    const updated =
      data.isActive !== undefined &&
      this.usageCounterService &&
      typeof this.prisma.$transaction === 'function'
        ? await this.prisma.$transaction(async (tx) => {
            let currentActive = branch.isActive;
            if (typeof (tx as any).$queryRaw === 'function') {
              const rows = await (tx as any).$queryRaw<
                Array<{ isActive: boolean }>
              >`SELECT "isActive" FROM "RetailBranch" WHERE id = ${branch.id} FOR UPDATE`;
              if (rows[0]) {
                currentActive = rows[0].isActive;
              }
            }
            const activating = !currentActive && data.isActive === true;
            const deactivating = currentActive && data.isActive === false;

            if (activating) {
              await this.usageCounterService!.enforceAndIncrementInTransaction(
                tx,
                organizationId,
                'RETAIL_BRANCHES',
                1,
              );
            }
            const res = await tx.retailBranch.update(updatePayload);
            if (deactivating) {
              await this.usageCounterService!.decrementCounterInTransaction(
                tx,
                organizationId,
                'RETAIL_BRANCHES',
                1,
              );
            }
            return res;
          })
        : await this.prisma.retailBranch.update(updatePayload);

    await this.redisService.delByPattern('retail:marketplace:stores:*');
    return updated;
  }

  async deleteBranch(organizationId: string, branchId: string) {
    const branch = await this.getBranch(organizationId, branchId);

    // Deactivate instead of physical delete to preserve history
    const updated =
      this.usageCounterService && typeof this.prisma.$transaction === 'function'
        ? await this.prisma.$transaction(async (tx) => {
            let currentActive = branch.isActive;
            if (typeof (tx as any).$queryRaw === 'function') {
              const rows = await (tx as any).$queryRaw<
                Array<{ isActive: boolean }>
              >`SELECT "isActive" FROM "RetailBranch" WHERE id = ${branch.id} FOR UPDATE`;
              if (rows[0]) {
                currentActive = rows[0].isActive;
              }
            }
            const res = await tx.retailBranch.update({
              where: { id: branch.id },
              data: { isActive: false },
            });
            if (currentActive) {
              await this.usageCounterService!.decrementCounterInTransaction(
                tx,
                organizationId,
                'RETAIL_BRANCHES',
                1,
              );
            }
            return res;
          })
        : await this.prisma.retailBranch.update({
            where: { id: branch.id },
            data: { isActive: false },
          });
    await this.redisService.delByPattern('retail:marketplace:stores:*');
    return updated;
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
