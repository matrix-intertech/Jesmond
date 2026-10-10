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
import {
  ApproveAppointmentDto,
  RejectAppointmentDto,
  UpdateAppointmentStatusDto,
  CreateBusinessServiceDto,
  UpdateBusinessServiceDto,
  CreateServiceCategoryDto,
  UpdateServiceCategoryDto,
  AssignServiceCategoryDto,
  CreateTimeOffDto,
  UpdateTimeOffDto,
  CreateOfflineAppointmentDto,
} from '../dtos/appointment.dto';
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

  // Services Management
  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get('services')
  async getServices(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getBusinessServices(req.user.organizationId, branchId, categoryId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('services')
  async createService(
    @Request() req: any,
    @Body() dto: CreateBusinessServiceDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.createBusinessService(req.user.organizationId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Put('services/:id')
  async updateService(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateBusinessServiceDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.updateBusinessService(req.user.organizationId, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('services/:id/delete')
  async deleteService(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.deleteBusinessService(req.user.organizationId, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Put('services/:id/category')
  async assignCategory(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: AssignServiceCategoryDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.assignServiceCategory(
      req.user.organizationId,
      id,
      dto.categoryId ?? null,
    );
  }

  // Category Management
  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get('categories')
  async getCategories(
    @Request() req: any,
    @Query('includeInactive') includeInactive?: string,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getServiceCategories(
      req.user.organizationId,
      includeInactive === 'true',
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('categories')
  async createCategory(
    @Request() req: any,
    @Body() dto: CreateServiceCategoryDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.createServiceCategory(req.user.organizationId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateServiceCategoryDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.updateServiceCategory(req.user.organizationId, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('categories/:id/delete')
  async deleteCategory(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.deleteServiceCategory(req.user.organizationId, id);
  }

  // Staff and Professionals
  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get('staff')
  async getStaff(@Request() req: any) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getBusinessStaff(req.user.organizationId);
  }

  // Customers
  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get('customers')
  async getCustomers(@Request() req: any) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getBusinessCustomers(req.user.organizationId);
  }

  // Time Off & Availability Blocks (Phase 5)
  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Get('time-off')
  async getTimeOffBlocks(
    @Request() req: any,
    @Query('staffId') staffId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.getTimeOffBlocks(req.user.organizationId, {
      staffId,
      startDate,
      endDate,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('time-off')
  async createTimeOffBlock(
    @Request() req: any,
    @Body() dto: CreateTimeOffDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.createTimeOffBlock(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Put('time-off/:id')
  async updateTimeOffBlock(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateTimeOffDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.updateTimeOffBlock(
      req.user.organizationId,
      id,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('time-off/:id/delete')
  async deleteTimeOffBlock(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.deleteTimeOffBlock(req.user.organizationId, id);
  }

  // Offline / Walk-in Appointment Creation (Phase 5 Workflow B)
  @UseGuards(JwtAuthGuard, RolesGuard, BusinessCapabilityGuard)
  @Roles(UserRole.ORG_STAFF, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @RequireCapability(BusinessCapability.APPOINTMENTS)
  @Post('offline')
  async createOfflineAppointment(
    @Request() req: any,
    @Body() dto: CreateOfflineAppointmentDto,
  ) {
    if (!req.user.organizationId) {
      throw new ForbiddenException('User is not associated with an organization');
    }
    return this.appointmentsService.createOfflineAppointment(
      req.user.organizationId,
      req.user.id,
      dto,
    );
  }
}
