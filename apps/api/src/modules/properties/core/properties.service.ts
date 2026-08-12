import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePropertyDto, CreateRoomTypeDto, UpdateAvailabilityDto } from '../dtos/property.dto';
import { StorageService } from './storage.service';

interface SearchParams {
  city?: string;
  university?: string;
  minPrice?: number;
  maxPrice?: number;
  roomType?: string;
  amenities?: string[];
  bounds?: string;
  page: number;
  limit: number;
}

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  async createProperty(dto: CreatePropertyDto, organizationId: string) {
    // Basic verification of suburb exists
    const suburb = await this.prisma.suburb.findUnique({ where: { id: dto.suburbId } });
    if (!suburb) {
      throw new NotFoundException('Suburb not found');
    }

    const property = await this.prisma.property.create({
      data: {
        name: dto.name,
        address: dto.address,
        postcode: dto.postcode,
        lat: dto.lat,
        lng: dto.lng,
        description: dto.description,
        status: 'DRAFT',
        suburbId: dto.suburbId,
        organizationId,
      },
    });

    return property;
  }

  async getMyProperties(organizationId: string) {
    return this.prisma.property.findMany({
      where: { organizationId },
      include: {
        suburb: { select: { name: true, city: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPropertyForProvider(id: string, organizationId: string, allowPending = false) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        suburb: { select: { name: true, city: { select: { name: true } } } },
        media: { orderBy: { displayOrder: 'asc' } },
        roomTypes: {
          include: {
            availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
            pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
          }
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have permission to view this property');
    }
    
    if (!allowPending && property.status === 'PENDING_APPROVAL') {
      throw new ForbiddenException('Cannot edit property while it is pending approval.');
    }

    return property;
  }

  // --- Media ---
  async addMedia(propertyId: string, organizationId: string, file: Express.Multer.File) {
    await this.getPropertyForProvider(propertyId, organizationId); // Validates ownership
    
    const url = await this.storage.uploadPropertyImage(propertyId, file);
    
    // Find current max order
    const maxOrder = await this.prisma.media.aggregate({
      where: { propertyId },
      _max: { displayOrder: true }
    });
    
    return this.prisma.media.create({
      data: {
        propertyId,
        url,
        type: 'IMAGE',
        displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
      }
    });
  }

  async deleteMedia(propertyId: string, organizationId: string, mediaId: string) {
    await this.getPropertyForProvider(propertyId, organizationId); // Validates ownership

    const media = await this.prisma.media.findUnique({ where: { id: mediaId, propertyId } });
    if (!media) throw new NotFoundException('Media not found');

    await this.storage.deleteImage(media.url);
    await this.prisma.media.delete({ where: { id: mediaId } });
    return { success: true };
  }

  // --- Rooms ---
  async createRoomType(propertyId: string, organizationId: string, dto: CreateRoomTypeDto) {
    await this.getPropertyForProvider(propertyId, organizationId);

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.roomType.create({
        data: {
          propertyId,
          name: dto.name,
          description: dto.description,
          pricePerWeek: dto.pricePerWeek,
          inventory: dto.inventory,
        }
      });

      await tx.pricingHistory.create({
        data: {
          roomTypeId: room.id,
          pricePerWeek: dto.pricePerWeek,
          effectiveFrom: new Date(),
        }
      });

      return room;
    });
  }

  // --- Availability ---
  async updateAvailability(propertyId: string, organizationId: string, roomId: string, dto: UpdateAvailabilityDto) {
    await this.getPropertyForProvider(propertyId, organizationId);

    const room = await this.prisma.roomType.findUnique({ where: { id: roomId, propertyId } });
    if (!room) throw new NotFoundException('Room not found');

    if (dto.available > room.inventory) {
      throw new BadRequestException(`Available count cannot exceed total inventory (${room.inventory})`);
    }

    const date = new Date(dto.date);
    date.setUTCHours(0,0,0,0); // normalize date

    return this.prisma.availabilityCalendar.upsert({
      where: { roomTypeId_date: { roomTypeId: roomId, date } },
      update: { available: dto.available },
      create: { roomTypeId: roomId, date, available: dto.available }
    });
  }

  async submitProperty(id: string, organizationId: string, userId: string) {
    const property = await this.getPropertyForProvider(id, organizationId, true);

    if (property.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT properties can be submitted for review.');
    }

    if (property.media.length === 0) {
      throw new BadRequestException('Property must have at least one image before submission.');
    }

    if (property.roomTypes.length === 0) {
      throw new BadRequestException('Property must have at least one room type before submission.');
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' }
    });

    // Create property version audit log
    await this.prisma.propertyVersion.create({
      data: {
        propertyId: id,
        versionNum: (await this.prisma.propertyVersion.count({ where: { propertyId: id } })) + 1,
        payload: updated as any,
        changes: { action: 'SUBMIT', previousStatus: 'DRAFT', newStatus: 'PENDING_APPROVAL' },
        authorId: userId,
      }
    });

    return updated;
  }

  async search(params: SearchParams) {
    try {
      const { city, university, minPrice, maxPrice, roomType, amenities, bounds, page, limit } = params;

      const whereClause: any = {
        status: 'PUBLISHED'
      };

      // 1. City Filter
      if (city) {
        whereClause.suburb = {
          city: { name: { equals: city, mode: 'insensitive' } }
        };
      }

      // 2. University Filter
      // Note: The current Prisma schema lacks a direct Property -> University/Campus relation.
      // Computing straight-line distance dynamically requires PostGIS or Haversine formula via raw SQL,
      // and matching purely by Suburb ID misses adjacent suburbs.
      // As instructed ("if it cannot be implemented correctly... leave the parameter safely unsupported"),
      // this filter is explicitly deferred until a proper geospatial mapping exists.

      // 3. Bounds Filter
      if (bounds) {
        const [swLat, swLng, neLat, neLng] = bounds.split(',').map(parseFloat);
        whereClause.lat = { gte: swLat, lte: neLat };
        whereClause.lng = { gte: swLng, lte: neLng };
      }

      // 4. Room Type & Price Filter (MUST satisfy the SAME room type)
      if (minPrice !== undefined || maxPrice !== undefined || roomType) {
        whereClause.roomTypes = {
          some: {
            ...(roomType && { name: { contains: roomType, mode: 'insensitive' } }),
            ...(minPrice !== undefined && { pricePerWeek: { gte: minPrice * 100 } }),
            ...(maxPrice !== undefined && { pricePerWeek: { lte: maxPrice * 100 } }),
          }
        };
      }

      // 5. Amenities Filter (Must contain ALL requested amenities)
      if (amenities && amenities.length > 0) {
        whereClause.AND = amenities.map(amenityName => ({
          amenities: {
            some: {
              amenity: { name: { equals: amenityName, mode: 'insensitive' } }
            }
          }
        }));
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        this.prisma.property.findMany({
          where: whereClause,
          include: {
            organization: {
              select: { id: true, name: true, status: true }
            },
            roomTypes: {
              select: { id: true, name: true, pricePerWeek: true, inventory: true }
            },
            media: { 
              take: 5, 
              orderBy: { displayOrder: 'asc' },
              select: { url: true, type: true, displayOrder: true }
            },
            suburb: { 
              select: { name: true, city: { select: { name: true } } } 
            },
            amenities: { 
              select: { amenity: { select: { name: true } } } 
            },
          },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        this.prisma.property.count({ where: whereClause })
      ]);

      const totalPages = Math.ceil(total / limit) || 0;

      return {
        data: data.map(this.mapPropertyResponse),
        meta: {
          total,
          page,
          limit,
          totalPages
        }
      };
    } catch (error) {
      console.error('Search error:', error);
      throw new InternalServerErrorException('An error occurred during search');
    }
  }

  async getPublicProperty(id: string) {
    const pubProperty = await this.prisma.property.findUnique({
      where: { id, status: 'PUBLISHED' },
      include: {
        organization: { select: { name: true, abn: true } },
        suburb: { select: { name: true, city: { select: { name: true } } } },
        media: { orderBy: { displayOrder: 'asc' } },
        roomTypes: {
          include: {
            availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
            pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
          }
        },
      }
    });

    if (!pubProperty) {
      throw new NotFoundException('Property not found');
    }
    return pubProperty;
  }

  private mapPropertyResponse(property: any) {
    // Calculate lowest price in dollars (DB stores cents)
    const lowestPricePerWeek = property.roomTypes.length > 0
      ? Math.min(...property.roomTypes.map((rt: any) => rt.pricePerWeek)) / 100
      : 0;

    return {
      id: property.id,
      name: property.name,
      address: property.address,
      suburb: property.suburb.name,
      city: property.suburb.city.name,
      lat: property.lat,
      lng: property.lng,
      provider: {
        name: property.organization.name,
        verified: property.organization.status === 'VERIFIED',
      },
      lowestPricePerWeek,
      roomTypes: property.roomTypes.map((rt: any) => ({
        id: rt.id,
        name: rt.name,
        pricePerWeek: rt.pricePerWeek / 100, // Expose dollars
        inventory: rt.inventory,
      })),
      media: property.media,
      amenities: property.amenities.map((pa: any) => pa.amenity.name),
      // Mocks intentionally removed as per Phase 4.2 instructions
    };
  }
}
