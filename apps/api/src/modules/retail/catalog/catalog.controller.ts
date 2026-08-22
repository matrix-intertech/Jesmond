import { Controller, Post, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
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
    return this.catalogService.createProduct(req.user.organizationId, data);
  }
}
