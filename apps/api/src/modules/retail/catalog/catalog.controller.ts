import { Controller, Post, Get, Body, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

@Controller('retail/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post('products')
  async createProduct(@Request() req: any, @Body() data: { sku: string; name: string; sellingPrice: number }) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to manage retail catalog');
    }
    return this.catalogService.createProduct(req.user.organizationId, req.user.id || 'SYSTEM', data);
  }

  @Get()
  async getCatalog(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('active') active?: string,
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to query retail catalog');
    }

    const isActive = active === undefined ? undefined : active === 'true';

    return this.catalogService.getCatalog(req.user.organizationId, {
      branchId,
      search,
      category,
      active: isActive,
    });
  }
}
