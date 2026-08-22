import { Controller, Post, Body, Param, UseGuards, Request, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('retail/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
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
}
