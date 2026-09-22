import { Injectable, InternalServerErrorException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
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
  propertyType?: string;
  furnishingType?: string;
  offeringType?: string;
  minBedrooms?: number;
  minBathrooms?: number;
  minimumStay?: number;
  maximumStay?: number;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  sortOrder?: 'asc' | 'desc';
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
        listingType: dto.listingType || 'NORMAL',
        propertyType: dto.propertyType,
        offeringType: dto.offeringType,
        furnishingType: dto.furnishingType,
        furnishingFeatures: dto.furnishingFeatures,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : undefined,
        minimumStay: dto.minimumStay,
        minimumStayUnit: dto.minimumStayUnit,
        maximumStay: dto.maximumStay,
        maximumStayUnit: dto.maximumStayUnit,
        maximumOccupancy: dto.maximumOccupancy,
        hasExistingResidents: dto.hasExistingResidents || false,
        configuration: dto.configuration,
        showContactDetails: dto.showContactDetails || false,
      },
    });

    if (property.listingMode === 'INDIVIDUAL' || property.offeringType === 'ENTIRE_PLACE') {
      const room = await this.prisma.roomType.create({
        data: {
          propertyId: property.id,
          name: 'Entire Property',
          description: property.description,
          pricePerWeek: dto.pricePerWeek || 0,
          inventory: 1,
        },
      });
      if (dto.pricePerWeek !== undefined) {
        await this.prisma.pricingHistory.create({
          data: {
            roomTypeId: room.id,
            pricePerWeek: dto.pricePerWeek,
            effectiveFrom: new Date(),
          }
        });
      }
    }

    return property;
  }

  async updateProperty(id: string, organizationId: string, dto: any) {
    // getPropertyForProvider already checks ownership and pending status
    await this.getPropertyForProvider(id, organizationId);

    if (dto.minimumStay !== undefined && dto.maximumStay !== undefined) {
      if (dto.minimumStay > dto.maximumStay) {
        throw new BadRequestException('Minimum stay cannot exceed maximum stay.');
      }
    } else if (dto.minimumStay !== undefined || dto.maximumStay !== undefined) {
      const current = await this.prisma.property.findUnique({ where: { id } });
      const min = dto.minimumStay !== undefined ? dto.minimumStay : current?.minimumStay;
      const max = dto.maximumStay !== undefined ? dto.maximumStay : current?.maximumStay;
      if (min !== null && min !== undefined && max !== null && max !== undefined && min > max) {
        throw new BadRequestException('Minimum stay cannot exceed maximum stay.');
      }
    }

    const updatedProperty = await this.prisma.property.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.address && { address: dto.address }),
        ...(dto.postcode && { postcode: dto.postcode }),
        ...(dto.lat !== undefined && { lat: dto.lat }),
        ...(dto.lng !== undefined && { lng: dto.lng }),
        ...(dto.description && { description: dto.description }),
        ...(dto.listingType && { listingType: dto.listingType }),
        ...(dto.propertyType !== undefined && { propertyType: dto.propertyType }),
        ...(dto.offeringType !== undefined && { offeringType: dto.offeringType }),
        ...(dto.furnishingType !== undefined && { furnishingType: dto.furnishingType }),
        ...(dto.furnishingFeatures !== undefined && { furnishingFeatures: dto.furnishingFeatures }),
        ...(dto.availableFrom !== undefined && { availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null }),
        ...(dto.minimumStay !== undefined && { minimumStay: dto.minimumStay }),
        ...(dto.minimumStayUnit !== undefined && { minimumStayUnit: dto.minimumStayUnit }),
        ...(dto.maximumStay !== undefined && { maximumStay: dto.maximumStay }),
        ...(dto.maximumStayUnit !== undefined && { maximumStayUnit: dto.maximumStayUnit }),
        ...(dto.maximumOccupancy !== undefined && { maximumOccupancy: dto.maximumOccupancy }),
        ...(dto.hasExistingResidents !== undefined && { hasExistingResidents: dto.hasExistingResidents }),
        ...(dto.configuration !== undefined && { configuration: dto.configuration }),
        ...(dto.showContactDetails !== undefined && { showContactDetails: dto.showContactDetails }),
      },
    });

    if (dto.pricePerWeek !== undefined) {
      const roomType = await this.prisma.roomType.findFirst({
        where: { propertyId: id },
        orderBy: { createdAt: 'asc' }
      });
      if (roomType) {
        await this.prisma.roomType.update({
          where: { id: roomType.id },
          data: { pricePerWeek: dto.pricePerWeek }
        });

        const currentPrice = await this.prisma.pricingHistory.findFirst({
          where: { roomTypeId: roomType.id },
          orderBy: { effectiveFrom: 'desc' }
        });

        if (!currentPrice || currentPrice.pricePerWeek !== dto.pricePerWeek) {
          await this.prisma.pricingHistory.create({
            data: {
              roomTypeId: roomType.id,
              pricePerWeek: dto.pricePerWeek,
              effectiveFrom: new Date(),
            }
          });
        }
      }
    }

    return updatedProperty;
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
        suburb: { select: { id: true, name: true, cityId: true, postcode: true, city: { select: { id: true, name: true, stateId: true } } } },
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
        residents: { where: { deletedAt: null } },
        houseRule: true,
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
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
      return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    if (!property.propertyType) throw new BadRequestException('Property type is required.');
    if (!property.offeringType) throw new BadRequestException('Offering type is required.');
    if (!property.furnishingType) throw new BadRequestException('Furnishing type is required.');
    if (!property.availableFrom) throw new BadRequestException('Availability date is required.');
    if (property.minimumStay === null || property.minimumStay === undefined) throw new BadRequestException('Minimum stay is required.');

    if (property.listingType === 'CO_LIVING') {
      if (property.maximumOccupancy === null || property.maximumOccupancy === undefined) {
        throw new BadRequestException('Maximum occupancy is required for Co-Living listings.');
      }
      // Check room information exists
      const roomTypeCount = await this.prisma.roomType.count({ where: { propertyId: id } });
      if (roomTypeCount === 0) throw new BadRequestException('At least one room type/space is required for Co-Living listings.');
    }

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'singleton' } });
    const autoApprove = settings?.propertyAutoApproval ?? false;
    const newStatus = autoApprove ? 'PUBLISHED' : 'PENDING_APPROVAL';
    const newVerificationStatus = autoApprove ? 'VERIFIED' : 'PENDING';

    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: newStatus, verificationStatus: newVerificationStatus }
    });

    // Create property version audit log
    await this.prisma.propertyVersion.create({
      data: {
        propertyId: id,
        versionNum: (await this.prisma.propertyVersion.count({ where: { propertyId: id } })) + 1,
        payload: updated as any,
        changes: { action: 'SUBMIT', previousStatus: 'DRAFT', newStatus },
        authorId: userId,
      }
    });

    return updated;
  }

  async search(params: SearchParams) {
    try {
      const {
        city, university, minPrice, maxPrice, roomType, moveIn, amenities, bounds,
        page = 1, limit = 20, sort, sortOrder, propertyType, furnishingType,
        offeringType, minBedrooms, minBathrooms, minimumStay, maximumStay,
        latitude, longitude, radiusKm
      } = params;

      const skip = (page - 1) * limit;

      const includeQuery = {
        organization: { select: { id: true, name: true, status: true } },
        roomTypes: { select: { id: true, name: true, pricePerWeek: true, inventory: true } },
        media: { take: 5, orderBy: { displayOrder: 'asc' }, select: { url: true, type: true, displayOrder: true } },
        suburb: { select: { name: true, city: { select: { name: true } } } },
        amenities: { select: { amenity: { select: { name: true } } } },
      };

      let data: any[] = [];
      let total = 0;
      let propertyDistances: Record<string, number> = {};

      if (latitude !== undefined && longitude !== undefined && radiusKm !== undefined) {
        // --- DB-LAYER GEOGRAPHIC SEARCH ---
        const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'PUBLISHED'`];

        if (radiusKm <= 0) {
          return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }

        // 1. Haversine Radius & Bounding Box
        const latMin = latitude - (radiusKm / 111);
        const latMax = latitude + (radiusKm / 111);
        const lngMin = longitude - (radiusKm / (111 * Math.cos(latitude * (Math.PI / 180))));
        const lngMax = longitude + (radiusKm / (111 * Math.cos(latitude * (Math.PI / 180))));

        conditions.push(Prisma.sql`p.lat BETWEEN ${latMin} AND ${latMax}`);
        conditions.push(Prisma.sql`p.lng BETWEEN ${lngMin} AND ${lngMax}`);

        // Clamped distance to avoid NaN
        const distanceExpr = Prisma.sql`(6371 * acos(LEAST(1.0, GREATEST(-1.0, cos(radians(${latitude})) * cos(radians(p.lat)) * cos(radians(p.lng) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(p.lat))))))`;
        conditions.push(Prisma.sql`${distanceExpr} <= ${radiusKm}`);

        // 2. City
        if (city) {
          conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Suburb" s JOIN "City" c ON s."cityId" = c.id WHERE s.id = p."suburbId" AND c.name ILIKE ${city})`);
        }

        // 3. University
        if (university) {
          const uniRecord = await this.prisma.university.findFirst({
            where: { OR: [{ slug: { equals: university, mode: 'insensitive' } }, { name: { contains: university, mode: 'insensitive' } }] },
            include: { campuses: { select: { suburbId: true } } }
          });
          if (uniRecord && uniRecord.campuses.length > 0) {
            const suburbIds = uniRecord.campuses.map((c: any) => c.suburbId).filter(Boolean);
            if (suburbIds.length > 0) {
              conditions.push(Prisma.sql`p."suburbId" IN (${Prisma.join(suburbIds)})`);
            }
          } else {
             conditions.push(Prisma.sql`(p.name ILIKE ${'%' + university + '%'} OR p.description ILIKE ${'%' + university + '%'} OR EXISTS (SELECT 1 FROM "Suburb" s WHERE s.id = p."suburbId" AND s.name ILIKE ${'%' + university + '%'}))`);
          }
        }

        // 4. Room Type & Price & Move-in
        if (minPrice !== undefined || maxPrice !== undefined || roomType || sort === 'available_now' || moveIn === 'immediate' || moveIn === 'now' || moveIn === 'available_now') {
          const roomConditions: Prisma.Sql[] = [];
          if (minPrice !== undefined) roomConditions.push(Prisma.sql`rt."pricePerWeek" >= ${minPrice * 100}`);
          if (maxPrice !== undefined) roomConditions.push(Prisma.sql`rt."pricePerWeek" <= ${maxPrice * 100}`);
          if (sort === 'available_now' || moveIn === 'immediate' || moveIn === 'now' || moveIn === 'available_now') {
            roomConditions.push(Prisma.sql`rt.inventory > 0`);
          }
          if (roomType) {
            const lower = roomType.toLowerCase();
            let keyword = roomType;
            let altKeyword = '';
            if (lower.includes('studio')) keyword = 'studio';
            else if (lower.includes('ensuite') || lower.includes('en-suite')) { keyword = 'ensuite'; altKeyword = 'en-suite'; }
            else if (lower.includes('shared')) keyword = 'shared';
            else if (lower.includes('apartment') || lower.includes('entire')) { keyword = 'apartment'; altKeyword = 'entire'; }

            if (altKeyword) roomConditions.push(Prisma.sql`(rt.name ILIKE ${'%' + keyword + '%'} OR rt.name ILIKE ${'%' + altKeyword + '%'})`);
            else roomConditions.push(Prisma.sql`rt.name ILIKE ${'%' + keyword + '%'}`);
          }

          if (roomConditions.length > 0) {
             conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "RoomType" rt WHERE rt."propertyId" = p.id AND ${Prisma.join(roomConditions, ' AND ')})`);
          }
        }

        // 5. Amenities
        if (amenities && amenities.length > 0) {
          for (const amenity of amenities) {
            conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "PropertyAmenity" pa JOIN "Amenity" a ON pa."amenityId" = a.id WHERE pa."propertyId" = p.id AND a.name ILIKE ${amenity})`);
          }
        }

        // 6. Direct Fields
        if (propertyType) conditions.push(Prisma.sql`p."propertyType" = CAST(${propertyType} AS "PropertyType")`);
        if (furnishingType) conditions.push(Prisma.sql`p."furnishingType" = CAST(${furnishingType} AS "FurnishingType")`);
        if (offeringType) conditions.push(Prisma.sql`p."offeringType" = CAST(${offeringType} AS "PropertyOfferingType")`);
        if (minimumStay !== undefined) conditions.push(Prisma.sql`p."minimumStay" <= ${minimumStay}`);
        if (maximumStay !== undefined) conditions.push(Prisma.sql`p."maximumStay" >= ${maximumStay}`);

        // JSON Configuration
        if (minBedrooms !== undefined) conditions.push(Prisma.sql`CAST(p.configuration->>'bedrooms' AS INTEGER) >= ${minBedrooms}`);
        if (minBathrooms !== undefined) conditions.push(Prisma.sql`CAST(p.configuration->>'bathrooms' AS INTEGER) >= ${minBathrooms}`);

        const whereSql = Prisma.join(conditions, ' AND ');

        // Pagination & DB hit
        const countQuery = Prisma.sql`SELECT COUNT(*) as total FROM "Property" p WHERE ${whereSql}`;
        const countRes: any[] = await this.prisma.$queryRaw(countQuery);
        total = Number(countRes[0].total);

        if (total > 0) {
           let orderBySql = Prisma.sql`ORDER BY distance ASC, p.id ASC`;
           if (sort === 'distance' && sortOrder === 'desc') {
             orderBySql = Prisma.sql`ORDER BY distance DESC, p.id ASC`;
           } else if (sort === 'top_rated') {
             orderBySql = Prisma.sql`ORDER BY (SELECT COUNT(*) FROM "SavedProperty" sp WHERE sp."propertyId" = p.id) DESC, p.id ASC`;
           } else if (sort !== 'distance' && sort !== 'closest_to_campus') {
             orderBySql = Prisma.sql`ORDER BY p."createdAt" DESC, p.id ASC`;
           }

           const selectQuery = Prisma.sql`
             SELECT p.id, ${distanceExpr} AS distance
             FROM "Property" p
             WHERE ${whereSql}
             ${orderBySql}
             LIMIT ${limit} OFFSET ${skip}
           `;
           const nearbyProps: any[] = await this.prisma.$queryRaw(selectQuery);
           const paginatedIds = nearbyProps.map((p: any) => p.id);

           nearbyProps.forEach((p: any) => { propertyDistances[p.id] = p.distance; });

           if (paginatedIds.length > 0) {
             data = await this.prisma.property.findMany({
               where: { id: { in: paginatedIds } },
               include: includeQuery as any,
             });
             const idToIndex = new Map(paginatedIds.map((id, idx) => [id, idx]));
             data.sort((a, b) => (idToIndex.get(a.id) ?? 0) - (idToIndex.get(b.id) ?? 0));
           }
        }
      } else {
        // --- STANDARD IN-MEMORY PRISMA SEARCH ---
        const whereClause: any = { status: 'PUBLISHED' };

        if (city) {
          whereClause.suburb = { city: { name: { equals: city, mode: 'insensitive' } } };
        }

        if (university) {
          const uniRecord = await this.prisma.university.findFirst({
            where: { OR: [{ slug: { equals: university, mode: 'insensitive' } }, { name: { contains: university, mode: 'insensitive' } }] },
            include: { campuses: { select: { suburbId: true } } }
          });
          if (uniRecord && uniRecord.campuses.length > 0) {
            const suburbIds = uniRecord.campuses.map((c: any) => c.suburbId).filter(Boolean);
            whereClause.suburbId = { in: suburbIds };
          } else {
            whereClause.OR = [
              { name: { contains: university, mode: 'insensitive' } },
              { description: { contains: university, mode: 'insensitive' } },
              { suburb: { name: { contains: university, mode: 'insensitive' } } }
            ];
          }
        }

        if (bounds) {
          const [swLat, swLng, neLat, neLng] = bounds.split(',').map(parseFloat);
          whereClause.lat = { gte: swLat, lte: neLat };
          whereClause.lng = { gte: swLng, lte: neLng };
        }

        if (minPrice !== undefined || maxPrice !== undefined || roomType) {
          const roomTypeSome: any = {
            ...(minPrice !== undefined && { pricePerWeek: { gte: minPrice * 100 } }),
            ...(maxPrice !== undefined && { pricePerWeek: { lte: maxPrice * 100 } }),
          };
          if (roomType) {
            const lower = roomType.toLowerCase();
            let keyword = roomType;
            let altKeyword = '';
            if (lower.includes('studio')) keyword = 'studio';
            else if (lower.includes('ensuite') || lower.includes('en-suite')) { keyword = 'ensuite'; altKeyword = 'en-suite'; }
            else if (lower.includes('shared')) keyword = 'shared';
            else if (lower.includes('apartment') || lower.includes('entire')) { keyword = 'apartment'; altKeyword = 'entire'; }

            if (altKeyword) {
              roomTypeSome.OR = [
                { name: { contains: keyword, mode: 'insensitive' } },
                { name: { contains: altKeyword, mode: 'insensitive' } },
              ];
            } else {
              roomTypeSome.name = { contains: keyword, mode: 'insensitive' };
            }
          }
          whereClause.roomTypes = { some: roomTypeSome };
        }

        if (amenities && amenities.length > 0) {
          whereClause.AND = amenities.map(amenityName => ({
            amenities: { some: { amenity: { name: { equals: amenityName, mode: 'insensitive' } } } }
          }));
        }

        if (propertyType) whereClause.propertyType = propertyType;
        if (furnishingType) whereClause.furnishingType = furnishingType;
        if (offeringType) whereClause.offeringType = offeringType;
        if (minimumStay !== undefined) whereClause.minimumStay = { lte: minimumStay };
        if (maximumStay !== undefined) whereClause.maximumStay = { gte: maximumStay };

        if (minBedrooms !== undefined || minBathrooms !== undefined) {
          const configConditions: any[] = [];
          if (minBedrooms !== undefined) configConditions.push({ configuration: { path: ['bedrooms'], gte: minBedrooms } });
          if (minBathrooms !== undefined) configConditions.push({ configuration: { path: ['bathrooms'], gte: minBathrooms } });
          if (configConditions.length > 0) {
            if (!whereClause.AND) whereClause.AND = [];
            whereClause.AND = [...whereClause.AND, ...configConditions];
          }
        }

        if (sort === 'available_now' || moveIn === 'immediate' || moveIn === 'now' || moveIn === 'available_now') {
          if (!whereClause.roomTypes) whereClause.roomTypes = {};
          if (!whereClause.roomTypes.some) whereClause.roomTypes.some = {};
          whereClause.roomTypes.some.inventory = { gt: 0 };
        }

        let orderBy: any = { createdAt: 'desc' };
        if (sort === 'top_rated') orderBy = { savedBy: { _count: 'desc' } };

        const result = await Promise.all([
          this.prisma.property.findMany({ where: whereClause, include: includeQuery as any, skip, take: limit, orderBy }),
          this.prisma.property.count({ where: whereClause })
        ]);
        data = result[0];
        total = result[1];
      }

      const totalPages = Math.ceil(total / limit) || 0;

      return {
        data: data.map((p: any) => {
          const mapped = this.mapPropertyResponse(p);
          if (propertyDistances[p.id] !== undefined) {
            (mapped as any).distance = propertyDistances[p.id];
          }
          return mapped;
        }),
        meta: { total, page, limit, totalPages }
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
        organization: {
          select: {
            name: true,
            abn: true,
            settings: true,
            staff: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              select: {
                role: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    countryCode: true,
                  },
                },
              },
            },
          },
        },
        suburb: { select: { name: true, city: { select: { name: true } }, state: { select: { name: true, code: true } } } },
        media: { orderBy: { displayOrder: 'asc' } },
        roomTypes: {
          include: {
            availabilityCalendar: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' } },
            pricingHistory: { orderBy: { effectiveFrom: 'desc' }, take: 1 }
          }
        },
        residents: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            name: true,
            age: true,
            ethnicity: true,
            occupation: true,
            shortBio: true,
            photoUrl: true,
            publicVisibility: true
            // STRICTLY EXCLUDE email, phone, createdAt, updatedAt, etc.
          }
        },
        houseRule: true,
      }
    });

    if (!pubProperty) {
      throw new NotFoundException('Property not found');
    }

    const publicResidents = pubProperty.residents.map((resident: any) => {
      const visibility = (resident.publicVisibility as any) || {};
      return {
        id: resident.id,
        name: resident.name,
        photoUrl: resident.photoUrl,
        age: visibility.age ? resident.age : undefined,
        ethnicity: visibility.ethnicity ? resident.ethnicity : undefined,
        occupation: visibility.occupation ? resident.occupation : undefined,
        shortBio: visibility.shortBio ? resident.shortBio : undefined,
      };
    });

    // Public Contact Enforcement
    let providerContact = null;
    if (pubProperty.showContactDetails) {
      const settings: any = pubProperty.organization.settings || {};
      const contactStaff =
        pubProperty.organization.staff.find((staff: any) => staff.role === 'ADMIN')?.user ??
        pubProperty.organization.staff[0]?.user;
      const profilePhone = contactStaff?.phone
        ? contactStaff.phone.startsWith('+') || !contactStaff.countryCode
          ? contactStaff.phone
          : `${contactStaff.countryCode} ${contactStaff.phone}`
        : undefined;

      providerContact = {
        name: pubProperty.organization.name,
        email: settings.enquiryPreferences?.contactEmail || contactStaff?.email || undefined,
        phone: settings.enquiryPreferences?.contactPhone || profilePhone,
      };
    }

    const { organization, showContactDetails, ...safeProperty } = pubProperty;

    return {
      ...safeProperty,
      provider: {
        name: organization.name,
        abn: organization.abn,
      },
      showContactDetails,
      providerContact,
      residents: publicResidents,
    };
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
      configuration: property.configuration,
      propertyType: property.propertyType,
      offeringType: property.offeringType,
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

  // --- Residents ---
  async addResident(propertyId: string, organizationId: string, dto: any) {
    const property = await this.getPropertyForProvider(propertyId, organizationId, true);

    // Check maximum occupancy limit
    if (property.maximumOccupancy !== null && property.maximumOccupancy !== undefined) {
      const activeResidentsCount = await this.prisma.resident.count({
        where: { propertyId, isActive: true, deletedAt: null }
      });

      if (activeResidentsCount >= property.maximumOccupancy) {
        throw new BadRequestException('Maximum occupancy reached. Cannot add more residents.');
      }
    }

    return this.prisma.resident.create({
      data: {
        propertyId,
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        age: dto.age,
        ethnicity: dto.ethnicity,
        occupation: dto.occupation,
        shortBio: dto.shortBio,
        photoUrl: dto.photoUrl,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        publicVisibility: dto.publicVisibility || {},
      }
    });
  }

  async updateResident(propertyId: string, organizationId: string, residentId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId, true);

    const resident = await this.prisma.resident.findUnique({ where: { id: residentId, propertyId } });
    if (!resident) throw new NotFoundException('Resident not found');

    if (dto.isActive && !resident.isActive) {
       // Check maximum occupancy limit if we are re-activating a resident
       const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
       if (property?.maximumOccupancy !== null && property?.maximumOccupancy !== undefined) {
         const activeResidentsCount = await this.prisma.resident.count({
           where: { propertyId, isActive: true, deletedAt: null }
         });

         if (activeResidentsCount >= property.maximumOccupancy) {
           throw new BadRequestException('Maximum occupancy reached. Cannot activate resident.');
         }
       }
    }

    return this.prisma.resident.update({
      where: { id: residentId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.age !== undefined && { age: dto.age }),
        ...(dto.ethnicity !== undefined && { ethnicity: dto.ethnicity }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.shortBio !== undefined && { shortBio: dto.shortBio }),
        ...(dto.photoUrl !== undefined && { photoUrl: dto.photoUrl }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.publicVisibility !== undefined && { publicVisibility: dto.publicVisibility }),
      }
    });
  }

  async deleteResident(propertyId: string, organizationId: string, residentId: string) {
    await this.getPropertyForProvider(propertyId, organizationId, true);

    const resident = await this.prisma.resident.findUnique({ where: { id: residentId, propertyId } });
    if (!resident) throw new NotFoundException('Resident not found');

    // Soft delete to preserve historical occupancy data
    return this.prisma.resident.update({
      where: { id: residentId },
      data: { deletedAt: new Date(), isActive: false }
    });
  }

  // --- Enquiries ---
  async getProviderEnquiries(organizationId: string) {
    return this.prisma.enquiry.findMany({
      where: {
        property: { organizationId }
      },
      include: {
        property: { select: { name: true, id: true } },
        student: { select: { firstName: true, lastName: true, email: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateEnquiryStatus(enquiryId: string, organizationId: string, status: any) {
    const enquiry = await this.prisma.enquiry.findUnique({
      where: { id: enquiryId },
      include: { property: { select: { organizationId: true } } }
    });

    if (!enquiry || enquiry.property.organizationId !== organizationId) {
      throw new NotFoundException('Enquiry not found');
    }

    return this.prisma.enquiry.update({
      where: { id: enquiryId },
      data: { status }
    });
  }

  async createEnquiry(propertyId: string, data: { message: string; roomTypeId?: string; seekerName?: string; seekerEmail?: string; seekerPhone?: string; studentId?: string }) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || property.status !== 'PUBLISHED') {
      throw new BadRequestException('Cannot enquire about this property. It is not currently published.');
    }

    if (data.roomTypeId) {
      const room = await this.prisma.roomType.findFirst({ where: { id: data.roomTypeId, propertyId } });
      if (!room) throw new BadRequestException('Invalid room type for this property.');
    }

    return this.prisma.enquiry.create({
      data: {
        propertyId,
        message: data.message,
        roomTypeId: data.roomTypeId,
        studentId: data.studentId,
        seekerName: data.seekerName,
        seekerEmail: data.seekerEmail,
        seekerPhone: data.seekerPhone,
      }
    });
  }

  // --- House Rules ---
  async updateHouseRule(propertyId: string, organizationId: string, dto: any) {
    await this.getPropertyForProvider(propertyId, organizationId, true);

    return this.prisma.houseRule.upsert({
      where: { propertyId },
      create: {
        propertyId,
        smoking: dto.smoking,
        pets: dto.pets,
        parties: dto.parties,
        guests: dto.guests,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
        additionalRules: dto.additionalRules,
      },
      update: {
        ...(dto.smoking !== undefined && { smoking: dto.smoking }),
        ...(dto.pets !== undefined && { pets: dto.pets }),
        ...(dto.parties !== undefined && { parties: dto.parties }),
        ...(dto.guests !== undefined && { guests: dto.guests }),
        ...(dto.quietHoursStart !== undefined && { quietHoursStart: dto.quietHoursStart }),
        ...(dto.quietHoursEnd !== undefined && { quietHoursEnd: dto.quietHoursEnd }),
        ...(dto.additionalRules !== undefined && { additionalRules: dto.additionalRules }),
      }
    });
  }
}
