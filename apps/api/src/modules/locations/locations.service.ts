import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCities(stateId?: string, search?: string) {
    const where: any = {};
    if (stateId) {
      where.stateId = stateId;
    }
    if (search) {
      where.name = { contains: search, mode: 'insensitive' as const };
    }

    return this.prisma.city.findMany({
      where,
      include: {
        _count: {
          select: { suburbs: true },
        },
        state: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getSuburbs(cityId?: string, stateId?: string, search?: string) {
    const where: any = {};
    if (cityId) {
      where.cityId = cityId;
    }
    if (stateId) {
      where.stateId = stateId;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { postcode: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    return this.prisma.suburb.findMany({
      where,
      select: {
        id: true,
        name: true,
        postcode: true,
        lat: true,
        lng: true,
        cityId: true,
        stateId: true,
        city: {
          select: {
            id: true,
            name: true,
            state: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        state: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getAmenities() {
    return this.prisma.amenity.findMany({
      orderBy: {
        category: 'asc',
      },
    });
  }

  async getStates(search?: string) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { code: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return this.prisma.state.findMany({
      where,
      include: {
        _count: {
          select: { cities: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getUniversities(search?: string) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    return this.prisma.university.findMany({
      where,
      include: {
        campuses: {
          include: {
            suburb: {
              include: {
                city: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
