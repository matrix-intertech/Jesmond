import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuburbs() {
    return this.prisma.suburb.findMany({
      select: {
        id: true,
        name: true,
        postcode: true,
        city: {
          select: {
            name: true,
            state: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        state: {
          select: {
            name: true,
            code: true,
          }
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
