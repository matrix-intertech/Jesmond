import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CheckoutDto } from './dto/checkout.dto';
import { ValidationPipe } from '@nestjs/common';
@Controller('retail/marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('stores')
  async listStores(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('radius') radius?: string,
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('suburb') suburb?: string,
    @Query('verifiedOnly') verifiedOnly?: string,
    @Query('openNow') openNow?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Input validation at API boundary:
    // Non-integer, zero, negative, NaN fallback safely (page -> 1, limit -> 20, max limit -> 100)
    let parsedPage: number | undefined = undefined;
    if (page !== undefined) {
      const p = Number(page);
      parsedPage = Number.isInteger(p) && p >= 1 ? p : 1;
    }

    let parsedLimit: number | undefined = undefined;
    if (limit !== undefined) {
      const l = Number(limit);
      parsedLimit = Number.isInteger(l) && l >= 1 ? Math.min(100, l) : 20;
    }

    return this.marketplaceService.listStores(
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      radius ? parseFloat(radius) : undefined,
      category,
      q ? q.trim() : undefined,
      suburb ? suburb.trim() : undefined,
      verifiedOnly === 'true' ? true : verifiedOnly === 'false' ? false : undefined,
      openNow === 'true' ? true : openNow === 'false' ? false : undefined,
      parsedPage,
      parsedLimit,
    );
  }

  @Get('stores/:branchId/catalog')
  async getStoreCatalog(@Param('branchId') branchId: string) {
    return this.marketplaceService.getStoreCatalog(branchId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(
    @Request() req: any,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    body: CheckoutDto,
  ) {
    return this.marketplaceService.checkout(req.user.id, body);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOrder(@Request() req: any, @Param('id') id: string) {
    return this.marketplaceService.getOrder(req.user.id, id);
  }
}
