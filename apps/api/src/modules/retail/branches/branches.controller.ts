import { Controller, Get, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';

@Controller('retail/branches')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.RETAIL)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  async listBranches(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to access retail branches');
    }
    return this.branchesService.listBranches(req.user.organizationId);
  }

  @Get(':id')
  async getBranch(@Request() req: any, @Param('id') id: string) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to access retail branches');
    }
    return this.branchesService.getBranch(req.user.organizationId, id);
  }
}
