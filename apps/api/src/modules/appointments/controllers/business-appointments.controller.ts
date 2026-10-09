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
  Put,
} from '@nestjs/common';
import { AppointmentsService } from '../services/appointments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApproveAppointmentDto, RejectAppointmentDto, UpdateAppointmentStatusDto } from '../dtos/appointment.dto';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { RequireCapability } from '../../auth/decorators/require-capability.decorator';
import { BusinessCapability } from '../../auth/business-capabilities';
import { OrgType } from '@prisma/client';

@Controller('business-appointments')
export class BusinessAppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get()
  async getBusinessAppointments(
    @Request() req: any,
    @Query('branchId') branchId?: string,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getBusinessAppointments(req.user.organizationId, branchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get('pending')
  async getPendingRequests(
    @Request() req: any,
    @Query('branchId') branchId?: string,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getPendingRequests(req.user.organizationId, branchId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post(':id/approve')
  async approveAppointment(
    @Param('id') id: string,
    @Body() dto: ApproveAppointmentDto,
    @Request() req: any,
  ) {
    return this.appointmentsService.approveAppointment(
      id,
      req.user.organizationId,
      dto.staffId,
      req.user.id,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post(':id/reject')
  async rejectAppointment(
    @Param('id') id: string,
    @Body() dto: RejectAppointmentDto,
    @Request() req: any,
  ) {
    return this.appointmentsService.rejectAppointment(
      id,
      req.user.organizationId,
      req.user.id,
      dto.reason,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Put(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
    @Request() req: any,
  ) {
    return this.appointmentsService.updateAppointmentStatus(
      id,
      req.user.organizationId,
      dto.status,
      req.user.id,
      dto.reason,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get(':id/eligible-staff')
  async getEligibleStaff(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.appointmentsService.getEligibleStaffForAppointment(
      id,
      req.user.organizationId,
    );
  }
}
