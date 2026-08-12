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
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
}
