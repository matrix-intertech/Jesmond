import { Controller, Get } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('suburbs')
  async getSuburbs() {
    return this.locationsService.getSuburbs();
  }

  @Get('amenities')
  async getAmenities() {
    return this.locationsService.getAmenities();
  }
}
