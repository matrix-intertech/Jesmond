import { Controller, Post, Get, Body, Query, UseGuards, Request, ForbiddenException, Param } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { StorageService } from '../../properties/core/storage.service';

@Controller('retail/catalog')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.RETAIL)
export class CatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly storageService: StorageService
  ) {}

  @Post('products')
  async createProduct(@Request() req: any, @Body() data: { sku: string; name: string; sellingPrice: number; imageUrl?: string }) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to manage retail catalog');
    }
    return this.catalogService.createProduct(req.user.organizationId, req.user.id || 'SYSTEM', data);
  }

  @Post('products/media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadProductMedia(@UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required');
    }
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only image files are allowed');
    
    const url = await this.storageService.uploadRetailProductImage(req.user.organizationId, file);
    return { url };
  }

  @Post('products/:id')
  async updateProduct(
    @Request() req: any,
    @Body() data: { sku?: string; name?: string; sellingPrice?: number; imageUrl?: string },
    @Param('id') id: string
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException('Organization context is required to manage retail catalog');
    }
    return this.catalogService.updateProduct(req.user.organizationId, req.user.id || 'SYSTEM', id, data);
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
