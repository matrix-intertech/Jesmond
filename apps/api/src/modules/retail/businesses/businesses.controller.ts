import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';

@Controller('retail/businesses')
@UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.RETAIL)
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to access retail business profile',
      );
    }
    return this.businessesService.getProfile(req.user.organizationId);
  }

  @Get('location')
  async getLocation(@Request() req: any) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to access business location',
      );
    }
    return this.businessesService.getLocation(req.user.organizationId);
  }

  @Patch('location')
  async updateLocation(
    @Request() req: any,
    @Body() data: { address: string; lat: number; lng: number },
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to modify business location',
      );
    }
    if (
      !data.address ||
      typeof data.lat !== 'number' ||
      typeof data.lng !== 'number'
    ) {
      throw new UnauthorizedException('Invalid location data');
    }
    try {
      return await this.businessesService.updateLocation(
        req.user.organizationId,
        data,
      );
    } catch (e: any) {
      throw new UnauthorizedException(e.message);
    }
  }

  @Patch('profile')
  async updateProfile(
    @Request() req: any,
    @Body() data: { timezone?: string; branding?: any; settings?: any },
  ) {
    if (!req.user || !req.user.organizationId) {
      throw new ForbiddenException(
        'Organization context is required to modify retail business profile',
      );
    }
    if (!req.user.id) {
      throw new UnauthorizedException(
        'Authenticated user ID is required to perform updates',
      );
    }
    return this.businessesService.updateProfile(
      req.user.organizationId,
      data,
      req.user.id,
    );
  }
}
