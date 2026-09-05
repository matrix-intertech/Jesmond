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
  moveIn?: string;
  amenities?: string[];
  bounds?: string;
  page: number;
  limit: number;
  sort?: string;
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
        listingMode: dto.listingMode || 'MULTI_UNIT',
      },
    });

    if (property.listingMode === 'INDIVIDUAL') {
      await this.prisma.roomType.create({
        data: {
          propertyId: property.id,
          name: 'Entire Property',
          description: property.description,
          pricePerWeek: 0,
          inventory: 1,
        },
      });
    }

    return property;
  }

  async updateProperty(id: string, organizationId: string, dto: any) {
    // getPropertyForProvider already checks ownership and pending status
    await this.getPropertyForProvider(id, organizationId);

    return this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.address && { address: dto.address }),
        ...(dto.postcode && { postcode: dto.postcode }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.description && { description: dto.description }),
      },
    });
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
        buildings: {
          include: {
            floors: {
              orderBy: { level: 'asc' },
              include: {
                roomTypes: {
                  include: {
                    rooms: true,
                    availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
                    pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
                  }
                }
              }
            }
          }
        },
        roomTypes: {
          where: { floorId: null },
          include: {
            rooms: true,
            availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
            pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
          }
        },
        amenities: { select: { amenityId: true, amenity: { select: { name: true, category: true } } } },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (property.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have permission to view this property');
    }

    if (!allowPending && (property.status === 'PENDING_APPROVAL' || property.status === 'PUBLISHED')) {
      throw new ForbiddenException(`Cannot edit property while it is ${property.status}.`);
    }

    return property;
  }

  // --- Media ---
  async addMedia(propertyId: string, organizationId: string, file: Express.Multer.File) {
    await this.getPropertyForProvider(propertyId, organizationId); // Validates ownership & status

    // We upload to R2 first, then try to bind it to the database transactionally.
    const url = await this.storage.uploadPropertyImage(propertyId, file);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the Property row to serialize concurrent uploads and prevent race conditions
        await tx.$executeRaw`SELECT 1 FROM "Property" WHERE id = ${propertyId} FOR UPDATE`;

        // Now safely count existing media
        const currentCount = await tx.media.count({ where: { propertyId } });
        if (currentCount >= 20) {
          throw new BadRequestException('Maximum of 20 images allowed per property.');
        }

        // Find current max order
        const maxOrder = await tx.media.aggregate({
          where: { propertyId },
          _max: { displayOrder: true }
        });

        return await tx.media.create({
          data: {
            propertyId,
            url,
            type: 'IMAGE',
            displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
          }
        });
      });
    } catch (error) {
      // Rollback R2 if the transaction fails (e.g., limit exceeded)
      await this.storage.deleteImage(url).catch(e => console.error('Failed to rollback R2 image:', e));
      throw error;
    }
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

    if (dto.floorId) {
      const floor = await this.prisma.floor.findUnique({ where: { id: dto.floorId }, include: { building: true } });
      if (!floor || floor.building.propertyId !== propertyId) throw new NotFoundException('Floor not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.roomType.create({
        data: {
          propertyId,
          floorId: dto.floorId || null,
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

  async updateRoomType(propertyId: string, organizationId: string, roomId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId);

    const roomExists = await this.prisma.roomType.findUnique({ where: { id: roomId, propertyId } });
    if (!roomExists) throw new NotFoundException('Room not found or does not belong to this property.');

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.roomType.update({
        where: { id: roomId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.inventory !== undefined && { inventory: dto.inventory }),
          ...(dto.pricePerWeek !== undefined && { pricePerWeek: dto.pricePerWeek }),
        }
      });

      if (dto.pricePerWeek !== undefined) {
        // Find current price
        const currentPrice = await tx.pricingHistory.findFirst({
          where: { roomTypeId: roomId },
          orderBy: { effectiveFrom: 'desc' }
        });

        if (!currentPrice || currentPrice.pricePerWeek !== dto.pricePerWeek) {
          await tx.pricingHistory.create({
            data: {
              roomTypeId: roomId,
              pricePerWeek: dto.pricePerWeek,
              effectiveFrom: new Date(),
            }
          });
        }
      }
      return room;
    });
  }

  async deleteRoomType(propertyId: string, organizationId: string, roomId: string) {
    await this.getPropertyForProvider(propertyId, organizationId);

    const roomExists = await this.prisma.roomType.findUnique({ where: { id: roomId, propertyId } });
    if (!roomExists) throw new NotFoundException('Room not found or does not belong to this property.');

    // Hard delete room if no leases/applications exist, otherwise soft delete or reject
    const appsCount = await this.prisma.application.count({ where: { roomTypeId: roomId } });
    if (appsCount > 0) {
      throw new BadRequestException('Cannot delete room type with active applications.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pricingHistory.deleteMany({ where: { roomTypeId: roomId } });
      await tx.availabilityCalendar.deleteMany({ where: { roomTypeId: roomId } });

      return tx.roomType.delete({ where: { id: roomId } });
    });
  }

  // --- Amenities ---
  async updateAmenities(propertyId: string, organizationId: string, amenityIds: string[]) {
    await this.getPropertyForProvider(propertyId, organizationId);

    const uniqueAmenityIds = [...new Set(amenityIds)];

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.propertyAmenity.deleteMany({
          where: { propertyId }
        });

        if (uniqueAmenityIds && uniqueAmenityIds.length > 0) {
          await tx.propertyAmenity.createMany({
            data: uniqueAmenityIds.map(amenityId => ({
              propertyId,
              amenityId
            }))
          });
        }
        return { success: true };
      });
    } catch (error: any) {
      if (error.code === 'P2003') {
        throw new BadRequestException('One or more provided amenity IDs are invalid.');
      }
      throw error;
    }
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

    const today = new Date();
    today.setUTCHours(0,0,0,0);

    if (date < today) {
      throw new BadRequestException('Cannot update availability for past dates.');
    }

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

    if (property.listingMode === 'MULTI_UNIT') {
      const roomTypeCount = await this.prisma.roomType.count({ where: { propertyId: id } });
      if (roomTypeCount === 0) {
        throw new BadRequestException('Property must have at least one room type before submission.');
      }
    }

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL', verificationStatus: 'PENDING' }
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
      const { city, university, minPrice, maxPrice, roomType, moveIn, amenities, bounds, page, limit, sort } = params;

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
      if (university) {
        const uniRecord = await this.prisma.university.findFirst({
          where: {
            OR: [
              { slug: { equals: university, mode: 'insensitive' } },
              { name: { contains: university, mode: 'insensitive' } }
            ]
          },
          include: {
            campuses: {
              select: { suburbId: true }
            }
          }
        });

        if (uniRecord && uniRecord.campuses.length > 0) {
          const suburbIds = uniRecord.campuses.map(c => c.suburbId).filter(Boolean);
          whereClause.suburbId = { in: suburbIds };
        } else {
          whereClause.OR = [
            { name: { contains: university, mode: 'insensitive' } },
            { description: { contains: university, mode: 'insensitive' } },
            { suburb: { name: { contains: university, mode: 'insensitive' } } }
          ];
        }
      }

      // 3. Bounds Filter
      if (bounds) {
        const [swLat, swLng, neLat, neLng] = bounds.split(',').map(parseFloat);
        whereClause.lat = { gte: swLat, lte: neLat };
        whereClause.lng = { gte: swLng, lte: neLng };
      }

      // 4. Room Type & Price Filter
      if (minPrice !== undefined || maxPrice !== undefined || roomType) {
        const roomTypeSome: any = {
          ...(minPrice !== undefined && { pricePerWeek: { gte: minPrice * 100 } }),
          ...(maxPrice !== undefined && { pricePerWeek: { lte: maxPrice * 100 } }),
        };

        if (roomType) {
          const lower = roomType.toLowerCase();
          let keyword = roomType;
          let altKeyword = '';

          if (lower.includes('studio')) {
            keyword = 'studio';
          } else if (lower.includes('ensuite') || lower.includes('en-suite')) {
            keyword = 'ensuite';
            altKeyword = 'en-suite';
          } else if (lower.includes('shared')) {
            keyword = 'shared';
          } else if (lower.includes('apartment') || lower.includes('entire')) {
            keyword = 'apartment';
            altKeyword = 'entire';
          }

          if (altKeyword) {
            roomTypeSome.OR = [
              { name: { contains: keyword, mode: 'insensitive' } },
              { name: { contains: altKeyword, mode: 'insensitive' } },
            ];
          } else {
            roomTypeSome.name = { contains: keyword, mode: 'insensitive' };
          }
        }

        whereClause.roomTypes = {
          some: roomTypeSome
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

      // 6. Handle Move-In / Availability & Sort
      if (sort === 'available_now' || moveIn === 'immediate' || moveIn === 'now' || moveIn === 'available_now') {
        if (!whereClause.roomTypes) whereClause.roomTypes = {};
        if (!whereClause.roomTypes.some) whereClause.roomTypes.some = {};
        whereClause.roomTypes.some.inventory = { gt: 0 };
      }

      let orderBy: any = { createdAt: 'desc' };
      if (sort === 'top_rated') {
        orderBy = { savedBy: { _count: 'desc' } };
      } else if (sort === 'closest_to_campus') {
        // Distance calculation requires geospatial data which is deferred. 
        // Fallback to createdAt or default sorting.
        orderBy = { createdAt: 'desc' };
      }

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
          orderBy
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
        suburb: { select: { name: true, city: { select: { name: true } }, state: { select: { name: true, code: true } } } },
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
      city: property.suburb.city?.name || null,
      state: property.suburb.state?.name || null,
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

  // --- Buildings ---
  async addBuilding(propertyId: string, organizationId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId);
    return this.prisma.building.create({ data: { propertyId, name: dto.name } });
  }

  async updateBuilding(propertyId: string, organizationId: string, buildingId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const b = await this.prisma.building.findUnique({ where: { id: buildingId, propertyId } });
    if (!b) throw new NotFoundException('Building not found');
    return this.prisma.building.update({ where: { id: buildingId }, data: { name: dto.name } });
  }

  async deleteBuilding(propertyId: string, organizationId: string, buildingId: string) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const b = await this.prisma.building.findUnique({ where: { id: buildingId, propertyId } });
    if (!b) throw new NotFoundException('Building not found');
    return this.prisma.building.delete({ where: { id: buildingId } });
  }

  // --- Floors ---
  async addFloor(propertyId: string, organizationId: string, buildingId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const b = await this.prisma.building.findUnique({ where: { id: buildingId, propertyId } });
    if (!b) throw new NotFoundException('Building not found');
    return this.prisma.floor.create({ data: { buildingId, level: dto.level, name: dto.name } });
  }

  async updateFloor(propertyId: string, organizationId: string, buildingId: string, floorId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const f = await this.prisma.floor.findUnique({ where: { id: floorId, buildingId }, include: { building: true } });
    if (!f || f.building.propertyId !== propertyId) throw new NotFoundException('Floor not found');
    return this.prisma.floor.update({ where: { id: floorId }, data: { level: dto.level, name: dto.name } });
  }

  async deleteFloor(propertyId: string, organizationId: string, buildingId: string, floorId: string) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const f = await this.prisma.floor.findUnique({ where: { id: floorId, buildingId }, include: { building: true } });
    if (!f || f.building.propertyId !== propertyId) throw new NotFoundException('Floor not found');
    return this.prisma.floor.delete({ where: { id: floorId } });
  }

  // --- Rooms ---
  async addRoom(propertyId: string, organizationId: string, roomTypeId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const rt = await this.prisma.roomType.findUnique({ where: { id: roomTypeId, propertyId } });
    if (!rt) throw new NotFoundException('RoomType not found');
    try {
      return await this.prisma.room.create({ data: { roomTypeId, identifier: dto.identifier } });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestException('A room with this identifier already exists in this room type.');
      }
      throw error;
    }
  }

  async deleteRoom(propertyId: string, organizationId: string, roomTypeId: string, roomId: string) {
    await this.getPropertyForProvider(propertyId, organizationId);
    const r = await this.prisma.room.findUnique({ where: { id: roomId, roomTypeId }, include: { roomType: true } });
    if (!r || r.roomType.propertyId !== propertyId) throw new NotFoundException('Room not found');
    return this.prisma.room.delete({ where: { id: roomId } });
  }
}
