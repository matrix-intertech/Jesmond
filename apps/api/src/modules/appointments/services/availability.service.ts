import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentStatus, Prisma } from '@prisma/client';

export interface SlotInfo {
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  isAvailable: boolean;
  reason?: string;
  availableStaffCount?: number;
}

export interface BranchOperatingHoursDay {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isOpen: boolean;
  openTime?: string; // "09:00"
  closeTime?: string; // "17:00"
  periods?: Array<{ openTime: string; closeTime: string }>;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(serviceId: string, date: string, timezone: string) {
    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const dayOfWeek = queryDate.getUTCDay();

    // 1. Fetch the service with branch, organization and qualified staff assignments
    const businessService = await this.prisma.businessService.findUnique({
      where: { id: serviceId, isActive: true },
      include: {
        organization: {
          select: { id: true, isPubliclyVisible: true, deletedAt: true },
        },
        branch: {
          select: { id: true, operatingHours: true },
        },
        staffAssignments: {
          include: { staff: true },
        },
      },
    });

    if (
      !businessService ||
      (businessService.organization &&
        (businessService.organization.deletedAt ||
          businessService.organization.isPubliclyVisible === false))
    ) {
      throw new BadRequestException('Service not found or inactive');
    }

    const staffIds = businessService.staffAssignments.map((a) => a.staffId);
    if (staffIds.length === 0) {
      return { serviceId, date, isBranchOpen: false, availableSlots: [], slots: [] };
    }

    // 2. Resolve Branch Operating Hours for this weekday
    const branchHoursConfig = this.resolveBranchHoursForDay(
      businessService.branch?.operatingHours as any,
      dayOfWeek,
    );

    // If branch is explicitly marked closed on this day, no slots available
    if (branchHoursConfig && !branchHoursConfig.isOpen) {
      return {
        serviceId,
        date,
        isBranchOpen: false,
        availableSlots: [],
        slots: [],
      };
    }

    // 3. Fetch Working Hours for qualified staff for this day
    const workingHours = await this.prisma.staffWorkingHours.findMany({
      where: {
        staffId: { in: staffIds },
        dayOfWeek: dayOfWeek,
      },
    });

    // 4. Determine schedule window: from branch hours or union of staff working hours
    let scheduleOpenMins: number;
    let scheduleCloseMins: number;

    if (branchHoursConfig && branchHoursConfig.isOpen && branchHoursConfig.openTime && branchHoursConfig.closeTime) {
      const [oH, oM] = branchHoursConfig.openTime.split(':').map(Number);
      const [cH, cM] = branchHoursConfig.closeTime.split(':').map(Number);
      scheduleOpenMins = oH * 60 + oM;
      scheduleCloseMins = cH * 60 + cM;
    } else if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Default business hours Mon-Fri 09:00 - 17:00, or union with staff working hours if wider
      let minStart = 9 * 60;
      let maxEnd = 17 * 60;
      for (const wh of workingHours) {
        const [sH, sM] = wh.startTime.split(':').map(Number);
        const [eH, eM] = wh.endTime.split(':').map(Number);
        const sMins = sH * 60 + sM;
        const eMins = eH * 60 + eM;
        if (sMins < minStart) minStart = sMins;
        if (eMins > maxEnd) maxEnd = eMins;
      }
      scheduleOpenMins = minStart;
      scheduleCloseMins = maxEnd;
    } else {
      // Weekend: open only if staff have working hours scheduled
      if (workingHours.length === 0) {
        return {
          serviceId,
          date,
          isBranchOpen: false,
          availableSlots: [],
          slots: [],
        };
      }
      let minStart = 24 * 60;
      let maxEnd = 0;
      for (const wh of workingHours) {
        const [sH, sM] = wh.startTime.split(':').map(Number);
        const [eH, eM] = wh.endTime.split(':').map(Number);
        const sMins = sH * 60 + sM;
        const eMins = eH * 60 + eM;
        if (sMins < minStart) minStart = sMins;
        if (eMins > maxEnd) maxEnd = eMins;
      }
      scheduleOpenMins = minStart;
      scheduleCloseMins = maxEnd;
    }

    // 5. Fetch Time Off for qualified staff on this date
    const startOfDay = new Date(queryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const timeOffs = await this.prisma.staffTimeOff.findMany({
      where: {
        staffId: { in: staffIds },
        deletedAt: null,
        OR: [
          {
            recurrence: 'NONE',
            startTime: { lt: endOfDay },
            endTime: { gt: startOfDay },
          },
          {
            recurrence: { in: ['DAILY', 'WEEKLY', 'CUSTOM'] },
            startTime: { lt: endOfDay },
            OR: [
              { recurrenceEnd: null },
              { recurrenceEnd: { gte: startOfDay } },
            ],
          },
        ],
      },
    });

    // 6. Fetch existing appointments for the service OR the staff OR the branch
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: {
          in: [
            AppointmentStatus.PENDING_APPROVAL,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
          ],
        },
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay },
        OR: [
          { serviceId: serviceId },
          { staffId: { in: staffIds } },
          { branchId: businessService.branchId },
        ],
      },
    });

    // 7. Generate slots within the schedule window
    const totalSlotMins =
      businessService.durationMins +
      businessService.bufferBeforeMins +
      businessService.bufferAfterMins;

    const allSlots: SlotInfo[] = [];
    const availableSlots: { startTime: string; endTime: string }[] = [];

    let currentMins = scheduleOpenMins;

    while (currentMins + totalSlotMins <= scheduleCloseMins) {
      const slotStartMins = currentMins;
      const slotEndMins = currentMins + totalSlotMins;

      const slotStart = new Date(startOfDay);
      slotStart.setUTCMinutes(slotStartMins);

      const slotEnd = new Date(startOfDay);
      slotEnd.setUTCMinutes(slotEndMins);

      const startStr = `${String(Math.floor(slotStartMins / 60)).padStart(2, '0')}:${String(slotStartMins % 60).padStart(2, '0')}`;
      const endStr = `${String(Math.floor(slotEndMins / 60)).padStart(2, '0')}:${String(slotEndMins % 60).padStart(2, '0')}`;

      // Check if slot falls within branch operating hours
      const isWithinBranchHours = this.checkWithinBranchHours(
        branchHoursConfig,
        slotStartMins,
        slotEndMins,
      );

      if (!isWithinBranchHours) {
        allSlots.push({
          startTime: startStr,
          endTime: endStr,
          isAvailable: false,
          reason: 'OUTSIDE_BRANCH_HOURS',
        });
        currentMins += totalSlotMins;
        continue;
      }

      // Check each qualified staff member
      const freeStaffForSlot: string[] = [];

      for (const staffId of staffIds) {
        // A. Staff Working Hours covering the complete slot duration
        const staffHours = workingHours.filter((wh) => wh.staffId === staffId);
        const isStaffScheduled = staffHours.some((wh) => {
          const [sH, sM] = wh.startTime.split(':').map(Number);
          const [eH, eM] = wh.endTime.split(':').map(Number);
          const whStart = sH * 60 + sM;
          const whEnd = eH * 60 + eM;
          return slotStartMins >= whStart && slotEndMins <= whEnd;
        });

        if (!isStaffScheduled) {
          continue; // Staff not working or shift does not cover entire slot
        }

        // B. Staff Time Off / Offline Work / Break
        const hasTimeOff = timeOffs.some((to) => {
          if (to.staffId !== staffId) return false;
          return this.checkTimeOffConflict(to, slotStart, slotEnd, totalSlotMins, timezone);
        });

        if (hasTimeOff) {
          continue; // Staff is on time off
        }

        // C. Staff Conflicting Assigned Appointment
        const hasAssignedConflict = appointments.some(
          (a) =>
            a.staffId === staffId &&
            a.startTime < slotEnd &&
            a.endTime > slotStart,
        );

        if (hasAssignedConflict) {
          continue; // Staff has an existing assigned appointment
        }

        // Staff is free and eligible
        freeStaffForSlot.push(staffId);
      }

      // D. Pending Generic (unassigned) appointments consuming capacity
      const overlappingAppointments = appointments.filter(
        (a) => a.startTime < slotEnd && a.endTime > slotStart,
      );
      const pendingGeneric = overlappingAppointments.filter(
        (a) => !a.staffId,
      ).length;

      const effectiveCapacity = Math.max(0, freeStaffForSlot.length - pendingGeneric);

      if (effectiveCapacity >= 1) {
        availableSlots.push({ startTime: startStr, endTime: endStr });
        allSlots.push({
          startTime: startStr,
          endTime: endStr,
          isAvailable: true,
          availableStaffCount: effectiveCapacity,
        });
      } else {
        const reason =
          freeStaffForSlot.length === 0
            ? 'ALL_STAFF_UNAVAILABLE'
            : 'OVERBOOKED_PENDING_REQUESTS';
        allSlots.push({
          startTime: startStr,
          endTime: endStr,
          isAvailable: false,
          reason,
          availableStaffCount: 0,
        });
      }

      currentMins += totalSlotMins;
    }

    return {
      serviceId,
      date,
      isBranchOpen: true,
      availableSlots,
      slots: allSlots,
    };
  }

  /**
   * Reusable validation method executed within booking transactions.
   * Ensures at least one eligible staff member is available for the complete duration.
   */
  async validateBookingSlot(
    tx: Prisma.TransactionClient,
    params: {
      branchId: string;
      serviceId: string;
      startTime: Date;
      endTime: Date;
      timezone: string;
    },
  ): Promise<{ isAvailable: boolean; reason?: string; effectiveCapacity?: number }> {
    const { branchId, serviceId, startTime, endTime, timezone } = params;

    // 1. Fetch Service & Branch with operating hours
    const service = await tx.businessService.findUnique({
      where: { id: serviceId },
      include: {
        branch: {
          select: { id: true, operatingHours: true },
        },
        staffAssignments: {
          include: { staff: true },
        },
      },
    });

    if (!service || !service.isActive) {
      return { isAvailable: false, reason: 'Service is not active or found' };
    }

    const dayOfWeek = startTime.getUTCDay();
    const startMins = startTime.getUTCHours() * 60 + startTime.getUTCMinutes();
    const endMins = endTime.getUTCHours() * 60 + endTime.getUTCMinutes();
    const durationMins = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    // 2. Check Branch Operating Hours
    const branchHoursConfig = this.resolveBranchHoursForDay(
      service.branch?.operatingHours as any,
      dayOfWeek,
    );

    if (branchHoursConfig) {
      if (!branchHoursConfig.isOpen) {
        return { isAvailable: false, reason: 'Business is closed on this day' };
      }
      const isWithinBranch = this.checkWithinBranchHours(branchHoursConfig, startMins, endMins);
      if (!isWithinBranch) {
        return {
          isAvailable: false,
          reason: 'Requested time is outside business operating hours',
        };
      }
    }

    // 3. Resolve Qualified Staff
    const staffIds = service.staffAssignments.map((a) => a.staffId);
    if (staffIds.length === 0) {
      return { isAvailable: false, reason: 'No staff qualified for this service' };
    }

    // 4. Fetch Staff Working Hours for this weekday
    const workingHours = await tx.staffWorkingHours.findMany({
      where: {
        staffId: { in: staffIds },
        dayOfWeek,
      },
    });

    // 5. Fetch Time Off for qualified staff overlapping this window
    const timeOffs = await tx.staffTimeOff.findMany({
      where: {
        staffId: { in: staffIds },
        deletedAt: null,
        OR: [
          {
            recurrence: 'NONE',
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          {
            recurrence: { in: ['DAILY', 'WEEKLY', 'CUSTOM'] },
            startTime: { lt: endTime },
            OR: [
              { recurrenceEnd: null },
              { recurrenceEnd: { gte: startTime } },
            ],
          },
        ],
      },
    });

    // 6. Fetch Existing Overlapping Appointments
    const appointments = await tx.appointment.findMany({
      where: {
        status: {
          in: [
            AppointmentStatus.PENDING_APPROVAL,
            AppointmentStatus.CONFIRMED,
            AppointmentStatus.IN_PROGRESS,
          ],
        },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        OR: [
          { serviceId },
          { staffId: { in: staffIds } },
          { branchId },
        ],
      },
    });

    // 7. Evaluate each qualified staff member
    const freeStaff: string[] = [];

    for (const staffId of staffIds) {
      // Must have working hours covering the complete requested duration
      const staffHours = workingHours.filter((wh) => wh.staffId === staffId);
      const coversDuration = staffHours.some((wh) => {
        const [sH, sM] = wh.startTime.split(':').map(Number);
        const [eH, eM] = wh.endTime.split(':').map(Number);
        const whStart = sH * 60 + sM;
        const whEnd = eH * 60 + eM;
        return startMins >= whStart && endMins <= whEnd;
      });

      if (!coversDuration) {
        continue; // Not working or requested time extends beyond availability
      }

      // Check conflicting time off
      const hasTimeOff = timeOffs.some((to) => {
        if (to.staffId !== staffId) return false;
        return this.checkTimeOffConflict(to, startTime, endTime, durationMins, timezone);
      });

      if (hasTimeOff) {
        continue;
      }

      // Check conflicting assigned appointment
      const hasAssignedConflict = appointments.some(
        (a) => a.staffId === staffId && a.startTime < endTime && a.endTime > startTime,
      );

      if (hasAssignedConflict) {
        continue;
      }

      freeStaff.push(staffId);
    }

    // 8. Subtract unassigned pending appointments
    const pendingGeneric = appointments.filter((a) => !a.staffId).length;
    const effectiveCapacity = Math.max(0, freeStaff.length - pendingGeneric);

    if (effectiveCapacity < 1) {
      const reason =
        freeStaff.length === 0
          ? 'Time slot is no longer available (all eligible staff are occupied or on leave/offline)'
          : 'Time slot is no longer available (overbooked by pending requests)';
      return { isAvailable: false, reason, effectiveCapacity: 0 };
    }

    return { isAvailable: true, effectiveCapacity };
  }

  // ─── Internal Helper Methods ───────────────────────────────────────────────

  private resolveBranchHoursForDay(
    rawHours: any,
    dayOfWeek: number,
  ): BranchOperatingHoursDay | null {
    if (!rawHours || !Array.isArray(rawHours)) return null;
    const dayConfig = rawHours.find((d: any) => d.dayOfWeek === dayOfWeek);
    return dayConfig || null;
  }

  private checkWithinBranchHours(
    config: BranchOperatingHoursDay | null,
    startMins: number,
    endMins: number,
  ): boolean {
    if (!config) return true; // No explicit branch restriction
    if (!config.isOpen) return false;

    // Check split shift periods if defined
    if (config.periods && config.periods.length > 0) {
      return config.periods.some((p) => {
        const [oH, oM] = p.openTime.split(':').map(Number);
        const [cH, cM] = p.closeTime.split(':').map(Number);
        return startMins >= oH * 60 + oM && endMins <= cH * 60 + cM;
      });
    }

    if (!config.openTime || !config.closeTime) return true;

    const [oH, oM] = config.openTime.split(':').map(Number);
    const [cH, cM] = config.closeTime.split(':').map(Number);
    const openMins = oH * 60 + oM;
    let closeMins = cH * 60 + cM;

    // Handle overnight shifts (e.g. 20:00 to 02:00)
    if (closeMins <= openMins) {
      closeMins += 1440;
    }

    return startMins >= openMins && endMins <= closeMins;
  }

  private checkTimeOffConflict(
    to: any,
    slotStart: Date,
    slotEnd: Date,
    slotDurationMins: number,
    timezone: string,
  ): boolean {
    if (to.recurrence === 'NONE') {
      return to.startTime < slotEnd && to.endTime > slotStart;
    }

    // Recurring blocks (DAILY, WEEKLY, CUSTOM)
    if (slotEnd <= to.startTime) return false;
    if (to.recurrenceEnd && slotStart >= to.recurrenceEnd) return false;

    const blockTz = to.timezone || timezone || 'Australia/Sydney';
    const blockLocal = this.getLocalDayAndMins(to.startTime, blockTz);
    const blockLocalEnd = this.getLocalDayAndMins(to.endTime, blockTz);
    const slotLocal = this.getLocalDayAndMins(slotStart, blockTz);

    if (to.recurrence === 'WEEKLY') {
      if (blockLocal.dayOfWeek !== slotLocal.dayOfWeek) return false;
    }

    const bStartMins = blockLocal.mins;
    let bEndMins = blockLocalEnd.mins;
    if (bEndMins <= bStartMins && to.endTime.getTime() > to.startTime.getTime()) {
      bEndMins += 1440;
    }

    const sStartMins = slotLocal.mins;
    const sEndMins = sStartMins + slotDurationMins;

    return sStartMins < bEndMins && sEndMins > bStartMins;
  }

  private getLocalDayAndMins(
    date: Date,
    tz: string,
  ): { dayOfWeek: number; mins: number } {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hourCycle: 'h23',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
      }).formatToParts(date);
      const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
      const dayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      const dayOfWeek = dayMap[map.weekday] ?? date.getUTCDay();
      const mins = parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10);
      return { dayOfWeek, mins };
    } catch {
      return {
        dayOfWeek: date.getUTCDay(),
        mins: date.getUTCHours() * 60 + date.getUTCMinutes(),
      };
    }
  }
}
