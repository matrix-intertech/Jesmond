import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AppointmentsService } from '../services/appointments.service';
import { AvailabilityService } from '../services/availability.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateAppointmentDto } from '../dtos/appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  // 1. List active services for an eligible business/branch
  @Get('services')
  async getServices(@Query('branchId') branchId: string) {
    if (!branchId) throw new BadRequestException('branchId is required');
    return this.appointmentsService.getServicesForBranch(branchId);
  }

  // 2. Retrieve available appointment slots for a service and date
  @Get('availability')
  async getAvailability(
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
    @Query('timezone') timezone: string,
  ) {
    if (!serviceId || !date) {
      throw new BadRequestException('serviceId and date are required');
    }
    // timezone can be passed or we resolve it inside
    return this.availabilityService.getAvailability(serviceId, date, timezone || 'UTC');
  }

  // 3. Submit an appointment request (Customer)
  @UseGuards(JwtAuthGuard)
  @Post('request')
  async createRequest(
    @Body() dto: CreateAppointmentDto,
    @Request() req: any,
  ) {
    const customerId = req.user.id;
    return this.appointmentsService.createPendingAppointment({
      customerId,
      branchId: dto.branchId,
      serviceId: dto.serviceId,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      timezone: dto.timezone,
      customerNotes: dto.customerNotes,
    });
  }

  // 4. List the authenticated customer's own appointments
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyAppointments(@Request() req: any) {
    return this.appointmentsService.getCustomerAppointments(req.user.id);
  }

  // 5. Retrieve an appointment belonging to that customer
  @UseGuards(JwtAuthGuard)
  @Get('my/:id')
  async getMyAppointment(@Param('id') id: string, @Request() req: any) {
    const appointment = await this.appointmentsService.getAppointment(id);
    if (!appointment || appointment.customerId !== req.user.id) {
      throw new ForbiddenException('You do not have access to this appointment');
    }
    return appointment;
  }

  // 6. Request cancellation
  @UseGuards(JwtAuthGuard)
  @Post('my/:id/cancel')
  async cancelAppointment(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.cancelCustomerAppointment(id, req.user.id, reason);
  }
}
