import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  async getCities(
    @Query('stateId') stateId?: string,
    @Query('search') search?: string,
  ) {
    return this.locationsService.getCities(stateId, search);
  }

  @Get('suburbs')
  async getSuburbs(
    @Query('cityId') cityId?: string,
    @Query('stateId') stateId?: string,
    @Query('search') search?: string,
  ) {
    return this.locationsService.getSuburbs(cityId, stateId, search);
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
