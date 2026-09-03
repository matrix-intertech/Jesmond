import { Controller, Get, Query, BadRequestException, Post, Body, Param, UseGuards, Request, Delete, Put, UseInterceptors, UploadedFile, NotFoundException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PropertiesService } from './properties.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrgTypesGuard } from '../../auth/guards/org-types.guard';
import { OrgTypes } from '../../auth/decorators/org-types.decorator';
import { OrgType } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreatePropertyDto, CreateRoomTypeDto, UpdateAvailabilityDto, UpdatePropertyDto, UpdateRoomTypeDto, UpdateAmenitiesDto, CreateBuildingDto, CreateFloorDto, CreateRoomDto } from '../dtos/property.dto';

@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post()
  async createProperty(@Body() dto: CreatePropertyDto, @Request() req: any) {
    if (!req.user.organizationId) {
      throw new BadRequestException('User is not associated with an organization.');
    }
    return this.propertiesService.createProperty(dto, req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('my')
  async getMyProperties(@Request() req: any) {
    if (!req.user.organizationId) {
      throw new BadRequestException('User is not associated with an organization.');
    }
    return this.propertiesService.getMyProperties(req.user.organizationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/:id')
  async updateProperty(@Param('id') id: string, @Body() dto: UpdatePropertyDto, @Request() req: any) {
    if (!req.user.organizationId) {
      throw new BadRequestException('User is not associated with an organization.');
    }
    return this.propertiesService.updateProperty(id, req.user.organizationId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('my/:id')
  async getMyProperty(@Param('id') id: string, @Request() req: any) {
    if (!req.user.organizationId) {
      throw new BadRequestException('User is not associated with an organization.');
    }
    return this.propertiesService.getPropertyForProvider(id, req.user.organizationId, true);
  }

  // --- Media Endpoints ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/media')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    if (!file) throw new BadRequestException('No file provided');
    
    // Quick validate image
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Only image files are allowed');
    }
    
    return this.propertiesService.addMedia(id, req.user.organizationId, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('my/:id/media/:mediaId')
  async deleteMedia(@Param('id') id: string, @Param('mediaId') mediaId: string, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.deleteMedia(id, req.user.organizationId, mediaId);
  }

  // --- Room Endpoints ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/rooms')
  async createRoomType(@Param('id') id: string, @Body() dto: CreateRoomTypeDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.createRoomType(id, req.user.organizationId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/:id/rooms/:roomId')
  async updateRoomType(@Param('id') id: string, @Param('roomId') roomId: string, @Body() dto: UpdateRoomTypeDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.updateRoomType(id, req.user.organizationId, roomId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('my/:id/rooms/:roomId')
  async deleteRoomType(@Param('id') id: string, @Param('roomId') roomId: string, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.deleteRoomType(id, req.user.organizationId, roomId);
  }

  // --- Buildings ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/buildings')
  async createBuilding(@Param('id') id: string, @Body() dto: CreateBuildingDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.addBuilding(id, req.user.organizationId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/:id/buildings/:buildingId')
  async updateBuilding(@Param('id') id: string, @Param('buildingId') buildingId: string, @Body() dto: CreateBuildingDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.updateBuilding(id, req.user.organizationId, buildingId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('my/:id/buildings/:buildingId')
  async deleteBuilding(@Param('id') id: string, @Param('buildingId') buildingId: string, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.deleteBuilding(id, req.user.organizationId, buildingId);
  }

  // --- Floors ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/buildings/:buildingId/floors')
  async createFloor(@Param('id') id: string, @Param('buildingId') buildingId: string, @Body() dto: CreateFloorDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.addFloor(id, req.user.organizationId, buildingId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/:id/buildings/:buildingId/floors/:floorId')
  async updateFloor(@Param('id') id: string, @Param('buildingId') buildingId: string, @Param('floorId') floorId: string, @Body() dto: CreateFloorDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.updateFloor(id, req.user.organizationId, buildingId, floorId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('my/:id/buildings/:buildingId/floors/:floorId')
  async deleteFloor(@Param('id') id: string, @Param('buildingId') buildingId: string, @Param('floorId') floorId: string, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.deleteFloor(id, req.user.organizationId, buildingId, floorId);
  }

  // --- Actual Rooms ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/room-types/:roomTypeId/rooms')
  async createRoom(@Param('id') id: string, @Param('roomTypeId') roomTypeId: string, @Body() dto: CreateRoomDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.addRoom(id, req.user.organizationId, roomTypeId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('my/:id/room-types/:roomTypeId/rooms/:roomId')
  async deleteRoom(@Param('id') id: string, @Param('roomTypeId') roomTypeId: string, @Param('roomId') roomId: string, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.deleteRoom(id, req.user.organizationId, roomTypeId, roomId);
  }

  // --- Amenities ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/:id/amenities')
  async updateAmenities(@Param('id') id: string, @Body() dto: UpdateAmenitiesDto, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.updateAmenities(id, req.user.organizationId, dto.amenities);
  }

  // --- Availability Endpoints ---
  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Put('my/:id/rooms/:roomId/availability')
  async updateAvailability(
    @Param('id') id: string,
    @Param('roomId') roomId: string,
    @Body() dto: UpdateAvailabilityDto,
    @Request() req: any
  ) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.updateAvailability(id, req.user.organizationId, roomId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, OrgTypesGuard)
@OrgTypes(OrgType.PROVIDER)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Post('my/:id/submit')
  async submitProperty(@Param('id') id: string, @Request() req: any) {
    if (!req.user.organizationId) throw new BadRequestException('User is not associated with an organization.');
    return this.propertiesService.submitProperty(id, req.user.organizationId, req.user.id);
  }

  @Get('search')
  async searchProperties(
    @Query('city') city?: string,
    @Query('university') university?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('roomType') roomType?: string,
    @Query('amenities') amenities?: string, // comma separated
    @Query('bounds') bounds?: string, // sw_lat,sw_lng,ne_lat,ne_lng
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    // 1. Pagination Validation
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;

    if (isNaN(parsedPage) || parsedPage < 1) {
      throw new BadRequestException('Invalid page parameter. Must be >= 1');
    }
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw new BadRequestException('Invalid limit parameter. Must be between 1 and 100');
    }

    // 2. Price Validation
    let parsedMinPrice: number | undefined;
    let parsedMaxPrice: number | undefined;

    if (minPrice !== undefined) {
      parsedMinPrice = parseFloat(minPrice);
      if (isNaN(parsedMinPrice) || parsedMinPrice < 0) {
        throw new BadRequestException('Invalid minPrice parameter.');
      }
    }
    if (maxPrice !== undefined) {
      parsedMaxPrice = parseFloat(maxPrice);
      if (isNaN(parsedMaxPrice) || parsedMaxPrice < 0) {
        throw new BadRequestException('Invalid maxPrice parameter.');
      }
    }
    if (parsedMinPrice !== undefined && parsedMaxPrice !== undefined && parsedMinPrice > parsedMaxPrice) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice.');
    }

    // 3. Bounds Validation
    if (bounds) {
      const parts = bounds.split(',').map(p => parseFloat(p.trim()));
      if (parts.length !== 4 || parts.some(isNaN)) {
        throw new BadRequestException('Bounds must contain exactly 4 valid numbers: sw_lat,sw_lng,ne_lat,ne_lng');
      }
      const [swLat, swLng, neLat, neLng] = parts;
      if (swLat > neLat) {
        throw new BadRequestException('sw_lat cannot be greater than ne_lat');
      }
      if (swLng > neLng && (swLng > 180 || neLng < -180)) {
        // Allow date-line crossing if valid, but otherwise enforce standard ordering.
        // For Australia, standard ordering is fine.
        throw new BadRequestException('sw_lng cannot be greater than ne_lng for this region');
      }
    }

    return this.propertiesService.search({
      city,
      university,
      minPrice: parsedMinPrice,
      maxPrice: parsedMaxPrice,
      roomType,
      amenities: amenities ? amenities.split(',').map(a => a.trim()).filter(Boolean) : undefined,
      bounds,
      page: parsedPage,
      limit: parsedLimit,
      sort,
    });
  }

  @Get('public/:id')
  async getPublicProperty(@Param('id') id: string) {
    return this.propertiesService.getPublicProperty(id);
  }
}
