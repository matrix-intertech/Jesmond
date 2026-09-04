import { Controller, Get, Query } from '@nestjs/common';
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

  @Get('states')
  async getStates(@Query('search') search?: string) {
    return this.locationsService.getStates(search);
  }

  @Get('universities')
  async getUniversities(@Query('search') search?: string) {
    return this.locationsService.getUniversities(search);
  }
}
