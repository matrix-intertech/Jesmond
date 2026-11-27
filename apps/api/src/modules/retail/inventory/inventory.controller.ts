import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { RetailPermissionGuard } from '../auth/guards/retail-permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RetailPermission } from '../auth/retail-permissions.enum';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { RequireCapability } from '../../auth/decorators/require-capability.decorator';
import { BusinessCapability } from '../../auth/business-capabilities';
import { SubscriptionGuard } from '../../subscriptions/guards/subscription.guard';
import { RequireSubscriptionFeature } from '../../subscriptions/decorators/subscription.decorators';

@Controller('retail/inventory')
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  OrgTypesGuard,
  BusinessCapabilityGuard,
  RetailPermissionGuard,
)
@OrgTypes(OrgType.RETAIL)
@RequireCapability(BusinessCapability.INVENTORY)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post(':branchId/:productId/adjust')
  @UseGuards(SubscriptionGuard)
  @RequirePermissions(RetailPermission.INVENTORY_ADJUST)
  @RequireSubscriptionFeature('RETAIL_INVENTORY')
  async adjustInventory(
    @Request() req: any,
    @Param('branchId') branchId: string,
    @Param('productId') productId: string,
    @Body('quantity') quantity: number,
    @Body('reason') reason: string,
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException(
        'Authenticated user ID is required to adjust inventory',
      );
    }
    // Also enforce organization context for isolation
    if (!req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    // In a real app we would check if branch belongs to org here or in the service.
    // The service handles atomic adjustment.

    return this.inventoryService.adjustInventory(
      req.user.organizationId,
      branchId,
      productId,
      quantity,
      req.user.id,
      reason,
    );
  }

  @Post(':branchId/receive')
  @UseGuards(SubscriptionGuard)
  @RequirePermissions(RetailPermission.INVENTORY_ADJUST)
  @RequireSubscriptionFeature('RETAIL_INVENTORY')
  async receiveStock(
    @Request() req: any,
    @Param('branchId') branchId: string,
    @Body()
    data: {
      productId: string;
      quantity: number;
      referenceNumber?: string;
      notes?: string;
    },
  ) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException('Authenticated user ID is required');
    }
    if (!req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    if (!data.productId) {
      throw new BadRequestException('Product ID is required for stock receiving');
    }
    if (!data.quantity || data.quantity <= 0) {
      throw new BadRequestException('Receiving quantity must be greater than 0');
    }

    const reason = data.referenceNumber
      ? `Stock Receiving [Ref: ${data.referenceNumber}]${data.notes ? ` - ${data.notes}` : ''}`
      : `Stock Receiving${data.notes ? ` - ${data.notes}` : ''}`;

    return this.inventoryService.adjustInventory(
      req.user.organizationId,
      branchId,
      data.productId,
      data.quantity,
      req.user.id,
      reason,
    );
  }

  @Get(':branchId')
  @RequirePermissions(RetailPermission.INVENTORY_VIEW)
  async getInventory(@Request() req: any, @Param('branchId') branchId: string) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException(
        'Authenticated user ID is required to fetch inventory',
      );
    }
    if (!req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }

    return this.inventoryService.getInventoryByBranch(
      req.user.organizationId,
      branchId,
    );
  }

  @Get(':branchId/movements')
  @RequirePermissions(RetailPermission.INVENTORY_VIEW)
  async getMovements(@Request() req: any, @Param('branchId') branchId: string) {
    if (!req.user || !req.user.id) {
      throw new UnauthorizedException(
        'Authenticated user ID is required to fetch movements',
      );
    }
    if (!req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }

    const productId = req.query?.productId as string | undefined;
    return this.inventoryService.getInventoryMovements(
      req.user.organizationId,
      branchId,
      productId,
    );
  }
}
