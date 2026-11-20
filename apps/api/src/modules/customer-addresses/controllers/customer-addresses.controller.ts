import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerAddressesService } from '../services/customer-addresses.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
} from '../dtos/customer-address.dto';

@Controller('customer/addresses')
@UseGuards(JwtAuthGuard)
export class CustomerAddressesController {
  constructor(
    private readonly customerAddressesService: CustomerAddressesService,
  ) {}

  @Get()
  async getAddresses(@Request() req: any) {
    return this.customerAddressesService.getCustomerAddresses(req.user.id);
  }

  @Post()
  async createAddress(
    @Request() req: any,
    @Body() dto: CreateCustomerAddressDto,
  ) {
    return this.customerAddressesService.createAddress(req.user.id, dto);
  }

  @Get(':id')
  async getAddress(@Request() req: any, @Param('id') id: string) {
    return this.customerAddressesService.getAddressById(req.user.id, id);
  }

  @Put(':id')
  async updateAddress(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerAddressDto,
  ) {
    return this.customerAddressesService.updateAddress(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteAddress(@Request() req: any, @Param('id') id: string) {
    return this.customerAddressesService.deleteAddress(req.user.id, id);
  }

  @Post(':id/default')
  @HttpCode(HttpStatus.OK)
  async setDefaultAddress(@Request() req: any, @Param('id') id: string) {
    return this.customerAddressesService.setDefaultAddress(req.user.id, id);
  }
}
