import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TerminalStatus } from '@prisma/client';
import { UsageCounterService } from '../../subscriptions/services/usage-counter.service';

@Injectable()
export class TerminalsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly usageCounterService?: UsageCounterService,
  ) {}

  private async validateBranchOwnership(
    organizationId: string,
    branchId: string,
  ) {
    const branch = await this.prisma.retailBranch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (branch.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Branch does not belong to your organization',
      );
    }
    return branch;
  }

  async createTerminal(
    organizationId: string,
    userId: string,
    data: {
      branchId: string;
      name: string;
      externalId?: string;
      metadata?: any;
    },
  ) {
    await this.validateBranchOwnership(organizationId, data.branchId);

    const useTx =
      this.usageCounterService &&
      typeof this.prisma.$transaction === 'function';

    const terminal = useTx
      ? await this.prisma.$transaction(async (tx) => {
          await this.usageCounterService!.enforceAndIncrementInTransaction(
            tx,
            organizationId,
            'RETAIL_POS_TERMINALS',
            1,
          );
          const created = await tx.posTerminal.create({
            data: {
              branchId: data.branchId,
              name: data.name,
              externalId: data.externalId,
              metadata: data.metadata,
              status: TerminalStatus.OFFLINE,
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: userId,
              actorType: 'USER',
              action: 'terminal.create',
              resourceType: 'PosTerminal',
              resourceId: created.id,
              changes: { new: created as any },
            },
          });
          return created;
        })
      : await (async () => {
          const created = await this.prisma.posTerminal.create({
            data: {
              branchId: data.branchId,
              name: data.name,
              externalId: data.externalId,
              metadata: data.metadata,
              status: TerminalStatus.OFFLINE,
            },
          });
          await this.prisma.auditLog.create({
            data: {
              actorId: userId,
              actorType: 'USER',
              action: 'terminal.create',
              resourceType: 'PosTerminal',
              resourceId: created.id,
              changes: { new: created as any },
            },
          });
          return created;
        })();

    return terminal;
  }

  async listTerminals(organizationId: string) {
    return this.prisma.posTerminal.findMany({
      where: {
        branch: {
          organizationId: organizationId,
        },
      },
      include: {
        branch: true,
      },
    });
  }

  async getTerminal(organizationId: string, terminalId: string) {
    const terminal = await this.prisma.posTerminal.findUnique({
      where: { id: terminalId },
      include: { branch: true },
    });
    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }
    if (terminal.branch.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Terminal does not belong to your organization',
      );
    }
    return terminal;
  }

  async updateTerminal(
    organizationId: string,
    userId: string,
    terminalId: string,
    data: {
      name?: string;
      externalId?: string;
      status?: TerminalStatus;
      metadata?: any;
    },
  ) {
    const current = await this.getTerminal(organizationId, terminalId);

    const updated = await this.prisma.posTerminal.update({
      where: { id: terminalId },
      data: {
        name: data.name !== undefined ? data.name : current.name,
        externalId:
          data.externalId !== undefined ? data.externalId : current.externalId,
        status: data.status !== undefined ? data.status : current.status,
        metadata:
          data.metadata !== undefined
            ? data.metadata
            : (current.metadata as any),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        actorType: 'USER',
        action: 'terminal.update',
        resourceType: 'PosTerminal',
        resourceId: terminalId,
        changes: { old: current as any, new: updated as any },
      },
    });

    return updated;
  }
}
