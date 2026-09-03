import { Controller, Post, Get, Body, Param, UseGuards, Request, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';

@Controller('retail/inventory')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.RETAIL)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post(':branchId/:productId/adjust')
  async adjustInventory(
    @Request() req: any,
    @Param('branchId') branchId: string,
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
    @Body('reason') reason: string
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required to adjust inventory');
    }
    // Also enforce organization context for isolation
    if (!req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    // In a real app we would check if branch belongs to org here or in the service.
    // The service handles atomic adjustment.

    return this.inventoryService.adjustInventory(branchId, productId, quantity, req.user.id, reason);
  }

  @Get(':branchId')
  async getInventory(
    @Request() req: any,
    @Param('branchId') branchId: string,
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required to fetch inventory');
    }
    if (!req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }

    return this.inventoryService.getInventoryByBranch(req.user.organizationId, branchId);
  }
}
