import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: number
  ) {
    if (!query || query.length < 3) {
      throw new BadRequestException('Search query must be at least 3 characters long');
    }
    const maxLimit = limit ? Math.min(Math.max(limit, 1), 20) : 5;
    return this.locationService.search(query, maxLimit);
  }

  @Get('reverse')
  async reverseGeocode(
    @Query('lat') latStr: string,
    @Query('lng') lngStr: string
  ) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      throw new BadRequestException('Valid lat and lng are required');
    }

    const result = await this.locationService.reverseGeocode(lat, lng);
    if (!result) {
      return null;
    }
    return result;
  }

  @Get('match')
  async matchLocation(
    @Query('suburb') suburb: string,
    @Query('city') city?: string
  ) {
    if (!suburb) {
      throw new BadRequestException('suburb is required for matching');
    }
    const match = await this.locationService.matchLocation(suburb, city);
    if (!match) {
      throw new BadRequestException('No matching location found in the database');
    }
    return match;
  }
}
