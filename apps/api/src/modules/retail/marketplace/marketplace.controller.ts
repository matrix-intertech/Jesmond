import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('retail/marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('stores')
  async listStores(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
  ) {
    return this.marketplaceService.listStores(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      radius ? parseFloat(radius) : undefined
    );
  }

  @Get('stores/:branchId/catalog')
  async getStoreCatalog(@Param('branchId') branchId: string) {
    return this.marketplaceService.getStoreCatalog(branchId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Request() req: any, @Body() body: any) {
    return this.marketplaceService.checkout(req.user.id, body);
  }
}
