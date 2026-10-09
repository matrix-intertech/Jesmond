import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentStatus, Prisma } from '@prisma/client';

import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  // 1. List active services for an eligible business/branch
  async getServicesForBranch(branchId: string) {
    return this.prisma.businessService.findMany({
      where: { branchId, isActive: true },
    });
  }

  // 2. Customer lists own appointments
  async getCustomerAppointments(customerId: string) {
    return this.prisma.appointment.findMany({
      where: { customerId },
      orderBy: { startTime: 'desc' },
      include: { service: true, branch: true },
    });
  }

  // 3. Customer gets specific appointment
  async getAppointment(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: { service: true, branch: true },
    });
  }

  // 4. Create Pending Appointment (Concurrency-safe)
  async createPendingAppointment(data: {
    customerId: string;
    branchId: string;
    serviceId: string;
    startTime: Date;
    endTime: Date;
    timezone: string;
    customerNotes?: string;
  }) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock the branch level or service level to serialize concurrent requests for the same time slot
      // We use PostgreSQL advisory locks to guarantee that no two transactions calculate capacity for the same service concurrently.
      // 100 is just an arbitrary prefix to avoid collision. We hash serviceId or use its raw integer if it was int, but it's uuid.
      // For uuid, we can lock based on a hash of the UUID.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.serviceId}))`;

      // Now we have exclusive access to this service's schedule in this transaction

      // 2. Fetch the service
      const service = await tx.businessService.findUnique({
        where: { id: data.serviceId },
      });
      if (!service) throw new BadRequestException('Service not found');
      if (!service.isActive) throw new BadRequestException('Service is not active');
      if (service.branchId !== data.branchId) throw new BadRequestException('Service does not belong to this branch');

      const branch = await tx.retailBranch.findUnique({ where: { id: data.branchId } });
      if (!branch) throw new BadRequestException('Branch not found');
      if (branch.organizationId !== service.organizationId) throw new BadRequestException('Branch organization mismatch');

      const org = await tx.organization.findUnique({ where: { id: branch.organizationId } });
      if (!org || (org.businessCategory !== 'MECHANICS' && org.businessCategory !== 'SERVICES')) {
        throw new BadRequestException('Business is not eligible for appointments');
      }

      if (data.startTime < new Date()) {
        throw new BadRequestException('Appointment cannot be in the past');
      }

      const durationDiffMins = Math.round((data.endTime.getTime() - data.startTime.getTime()) / 60000);
      if (durationDiffMins !== service.durationMins) {
        throw new BadRequestException(`Invalid appointment duration. Expected ${service.durationMins} mins, got ${durationDiffMins} mins`);
      }

      // 3. Validate capacity for requested time by checking existing appointments
      const overlappingAppointments = await tx.appointment.count({
        where: {
          serviceId: data.serviceId,
          status: { in: ['PENDING_APPROVAL', 'CONFIRMED', 'IN_PROGRESS'] },
          startTime: { lt: data.endTime },
          endTime: { gt: data.startTime }
        }
      });
      
      // We need at least one qualified staff for this service
      const qualifiedStaffCount = await tx.staffServiceAssignment.count({
        where: { serviceId: data.serviceId }
      });

      if (qualifiedStaffCount === 0) {
        throw new BadRequestException('No staff qualified for this service');
      }

      if (overlappingAppointments >= qualifiedStaffCount) {
        throw new BadRequestException('Time slot is no longer available (overbooked)');
      }

      // 4. Create appointment atomically
      const appointment = await tx.appointment.create({
        data: {
          customerId: data.customerId,
          organizationId: service.organizationId, // Derive from service to prevent mismatch
          branchId: data.branchId,
          serviceId: data.serviceId,
          startTime: data.startTime,
          endTime: data.endTime,
          timezone: data.timezone,
          customerNotes: data.customerNotes,
          status: AppointmentStatus.PENDING_APPROVAL,
          serviceName: service.name,
          durationMins: service.durationMins,
          price: service.price,
          currency: service.currency,
          statusHistory: {
            create: {
              status: AppointmentStatus.PENDING_APPROVAL,
              changedById: data.customerId
            }
          }
        }
      });

      return appointment;
    });

    // Async Notification (Non-blocking) after successful commit
    this.notificationsService.createNotification({
      recipientId: result.customerId,
      type: 'APPOINTMENT_REQUESTED',
      title: 'Appointment Request Submitted',
      body: `Your appointment request for ${result.serviceName} has been received and is pending approval.`,
      actionUrl: `/my-appointments/${result.id}`,
    }).catch(console.error);

    return result;
  }

  // 5. Customer Cancel
  async cancelCustomerAppointment(appointmentId: string, customerId: string, reason: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      
      if (!appointment || appointment.customerId !== customerId) {
        throw new ForbiddenException('Cannot cancel this appointment');
      }
      if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.COMPLETED) {
        throw new BadRequestException('Invalid status transition');
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: reason,
          statusHistory: {
            create: {
              status: AppointmentStatus.CANCELLED,
              changedById: customerId,
              reason,
            }
          }
        }
      });
    });

    // Async Notification
    this.notificationsService.createNotification({
      recipientId: customerId,
      type: 'APPOINTMENT_CANCELLED',
      title: 'Appointment Cancelled',
      body: `Your appointment has been cancelled.`,
    }).catch(console.error);

    return result;
  }

  // 6. Business List Appointments
  async getBusinessAppointments(organizationId: string, branchId?: string) {
    const where: Prisma.AppointmentWhereInput = { organizationId };
    if (branchId) where.branchId = branchId;
    
    return this.prisma.appointment.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: { customer: { select: { id: true, firstName: true, lastName: true } }, staff: true, service: true },
    });
  }

  // 7. Business List Pending
  async getPendingRequests(organizationId: string, branchId?: string) {
    const where: Prisma.AppointmentWhereInput = { organizationId, status: AppointmentStatus.PENDING_APPROVAL };
    if (branchId) where.branchId = branchId;
    
    return this.prisma.appointment.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: { customer: { select: { id: true, firstName: true, lastName: true } }, service: true },
    });
  }

  // 8. Business Approve (Concurrency-safe)
  async approveAppointment(appointmentId: string, organizationId: string, staffId: string, managerId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Lock the staff member to prevent double booking the same professional concurrently
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${staffId}))`;

      // 2. Get and lock appointment
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      
      if (!appointment || appointment.organizationId !== organizationId) {
        throw new ForbiddenException('Cannot manage this appointment');
      }
      
      if (appointment.status !== AppointmentStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Appointment is not in PENDING_APPROVAL state');
      }

      // Verify staff qualification
      const assignment = await tx.staffServiceAssignment.findUnique({
        where: { staffId_serviceId: { staffId, serviceId: appointment.serviceId } }
      });
      if (!assignment) {
        throw new BadRequestException('Staff member is not qualified for this service');
      }

      // Verify staff member belongs to the organization and branch
      const staff = await tx.orgStaff.findUnique({
        where: { id: staffId },
        include: { branches: true }
      });
      if (!staff || staff.organizationId !== organizationId) {
        throw new ForbiddenException('Staff member does not belong to this organization');
      }
      const isAssigned = staff.retailBranchId === appointment.branchId || staff.branches.some(b => b.branchId === appointment.branchId);
      if (!isAssigned) {
        throw new ForbiddenException('Staff member is not assigned to this branch');
      }

      // 3. Re-check working hours, time off, and conflicts
      const dayOfWeek = appointment.startTime.getUTCDay();
      const startMins = appointment.startTime.getUTCHours() * 60 + appointment.startTime.getUTCMinutes();
      const endMins = appointment.endTime.getUTCHours() * 60 + appointment.endTime.getUTCMinutes();

      const workingHours = await tx.staffWorkingHours.findMany({
        where: { staffId, dayOfWeek }
      });
      let isWorking = false;
      for (const w of workingHours) {
        const [sH, sM] = w.startTime.split(':').map(Number);
        const [eH, eM] = w.endTime.split(':').map(Number);
        if (startMins >= sH * 60 + sM && endMins <= eH * 60 + eM) {
          isWorking = true;
          break;
        }
      }
      if (!isWorking) throw new BadRequestException('Staff member is outside working hours');

      const timeOff = await tx.staffTimeOff.findFirst({
        where: {
          staffId,
          startTime: { lt: appointment.endTime },
          endTime: { gt: appointment.startTime }
        }
      });
      if (timeOff) throw new BadRequestException('Staff member is on time off');

      const staffConflict = await tx.appointment.findFirst({
        where: {
          staffId,
          status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
          startTime: { lt: appointment.endTime },
          endTime: { gt: appointment.startTime }
        }
      });

      if (staffConflict) {
        throw new BadRequestException('Staff member is not available for this time');
      }

      // 4. Assign and confirm atomically
      const confirmed = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          staffId,
          status: AppointmentStatus.CONFIRMED,
          statusHistory: {
            create: {
              status: AppointmentStatus.CONFIRMED,
              changedById: managerId
            }
          }
        }
      });

      return confirmed;
    });

    // Async Notification
    this.notificationsService.createNotification({
      recipientId: result.customerId,
      type: 'APPOINTMENT_APPROVED',
      title: 'Appointment Confirmed',
      body: `Your appointment for ${result.serviceName} has been confirmed.`,
      actionUrl: `/my-appointments/${result.id}`,
    }).catch(console.error);

    return result;
  }

  // 9. Business Reject
  async rejectAppointment(appointmentId: string, organizationId: string, managerId: string, reason?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      
      if (!appointment || appointment.organizationId !== organizationId) {
        throw new ForbiddenException('Cannot manage this appointment');
      }
      if (appointment.status !== AppointmentStatus.PENDING_APPROVAL) {
        throw new BadRequestException('Appointment is not in PENDING_APPROVAL state');
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: AppointmentStatus.REJECTED,
          rejectionReason: reason,
          statusHistory: {
            create: {
              status: AppointmentStatus.REJECTED,
              changedById: managerId,
              reason,
            }
          }
        }
      });
    });

    // Async Notification
    this.notificationsService.createNotification({
      recipientId: result.customerId,
      type: 'APPOINTMENT_REJECTED',
      title: 'Appointment Request Declined',
      body: `Your appointment request for ${result.serviceName} could not be approved.`,
    }).catch(console.error);

    return result;
  }

  // 10. General status update (with transition matrix enforcement)
  async updateAppointmentStatus(appointmentId: string, organizationId: string, status: AppointmentStatus, managerId: string, reason?: string) {
    // Formal transition matrix: only permit logically valid state changes
    const ALLOWED_TRANSITIONS: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
      [AppointmentStatus.PENDING_APPROVAL]: [
        AppointmentStatus.CONFIRMED,
        AppointmentStatus.REJECTED,
        AppointmentStatus.CANCELLED,
      ],
      [AppointmentStatus.CONFIRMED]: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
      ],
      [AppointmentStatus.IN_PROGRESS]: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
      ],
      // Terminal states — no further transitions permitted
      [AppointmentStatus.COMPLETED]: [],
      [AppointmentStatus.REJECTED]: [],
      [AppointmentStatus.CANCELLED]: [],
      [AppointmentStatus.NO_SHOW]: [],
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      
      if (!appointment || appointment.organizationId !== organizationId) {
        throw new ForbiddenException('Cannot manage this appointment');
      }

      const allowedNext = ALLOWED_TRANSITIONS[appointment.status] ?? [];
      if (!allowedNext.includes(status)) {
        throw new BadRequestException(
          `Invalid status transition: ${appointment.status} → ${status}. Allowed next states: [${allowedNext.join(', ') || 'none'}]`
        );
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status,
          ...(status === AppointmentStatus.CANCELLED ? { cancellationReason: reason } : {}),
          ...(status === AppointmentStatus.REJECTED ? { rejectionReason: reason } : {}),
          statusHistory: {
            create: {
              status,
              changedById: managerId,
              reason,
            }
          }
        }
      });
    });

    // Async Notification
    this.notificationsService.createNotification({
      recipientId: result.customerId,
      type: 'APPOINTMENT_STATUS_CHANGED',
      title: 'Appointment Status Updated',
      body: `Your appointment status is now ${status}.`,
      actionUrl: `/my-appointments/${result.id}`,
    }).catch(console.error);

    return result;
  }

  // 11. Get Eligible Staff for Appointment
  async getEligibleStaffForAppointment(appointmentId: string, organizationId: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { service: true }
    });

    if (!appointment || appointment.organizationId !== organizationId) {
      throw new ForbiddenException('Cannot access this appointment');
    }

    // 1. Get staff assigned to this service
    const assignments = await this.prisma.staffServiceAssignment.findMany({
      where: { serviceId: appointment.serviceId },
      include: { staff: { include: { user: { select: { id: true, firstName: true, lastName: true } } } } }
    });

    const staffIds = assignments.map(a => a.staffId);
    if (staffIds.length === 0) return [];

    const startTime = appointment.startTime;
    const endTime = appointment.endTime;
    const dayOfWeek = startTime.getUTCDay(); // Approximation, actual should use timezone if strictly required
    const startMins = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const endMins = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();

    // 2. Fetch Working Hours
    const workingHours = await this.prisma.staffWorkingHours.findMany({
      where: { staffId: { in: staffIds }, dayOfWeek }
    });

    // 3. Fetch Time Off
    const timeOffs = await this.prisma.staffTimeOff.findMany({
      where: {
        staffId: { in: staffIds },
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    });

    // 4. Fetch Conflicts
    const conflicts = await this.prisma.appointment.findMany({
      where: {
        id: { not: appointmentId },
        staffId: { in: staffIds },
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
        startTime: { lt: endTime },
        endTime: { gt: startTime }
      }
    });

    const results: any[] = [];
    for (const assignment of assignments) {
      const staff = assignment.staff;
      const wh = workingHours.filter(w => w.staffId === staff.id);
      
      let isWorking = false;
      for (const w of wh) {
        const [sH, sM] = w.startTime.split(':').map(Number);
        const [eH, eM] = w.endTime.split(':').map(Number);
        if (startMins >= sH * 60 + sM && endMins <= eH * 60 + eM) {
          isWorking = true;
          break;
        }
      }

      const hasTimeOff = timeOffs.some(t => t.staffId === staff.id);
      const hasConflict = conflicts.some(c => c.staffId === staff.id);

      results.push({
        staffId: staff.id,
        user: staff.user,
        isAvailable: isWorking && !hasTimeOff && !hasConflict,
        reason: !isWorking ? 'Outside working hours' : hasTimeOff ? 'On time off' : hasConflict ? 'Has conflicting appointment' : null
      });
    }

    return results;
  }
}
