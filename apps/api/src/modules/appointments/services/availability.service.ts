import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailability(serviceId: string, date: string, timezone: string) {
    // Basic date parsing (assuming YYYY-MM-DD input)
    const queryDate = new Date(date);
    if (isNaN(queryDate.getTime())) {
      throw new BadRequestException('Invalid date format. Expected YYYY-MM-DD');
    }
    const dayOfWeek = queryDate.getUTCDay();

    // 1. Fetch the service with buffer and duration
    const businessService = await this.prisma.businessService.findUnique({
      where: { id: serviceId, isActive: true },
      include: {
        staffAssignments: {
          include: { staff: true }
        }
      }
    });

    if (!businessService) {
      throw new BadRequestException('Service not found or inactive');
    }

    const staffIds = businessService.staffAssignments.map(a => a.staffId);
    if (staffIds.length === 0) {
      return { serviceId, date, availableSlots: [] };
    }

    // 2. Fetch Working Hours for qualified staff for this day
    const workingHours = await this.prisma.staffWorkingHours.findMany({
      where: {
        staffId: { in: staffIds },
        dayOfWeek: dayOfWeek,
      }
    });

    // 3. Fetch Time Off for these staff on this date
    // (Start of day to end of day in UTC roughly)
    const startOfDay = new Date(queryDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(queryDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const timeOffs = await this.prisma.staffTimeOff.findMany({
      where: {
        staffId: { in: staffIds },
        deletedAt: null,
        OR: [
          // Non-recurring blocks overlapping the day
          {
            recurrence: 'NONE',
            startTime: { lt: endOfDay },
            endTime: { gt: startOfDay },
          },
          // Recurring blocks starting on or before this day, and either no recurrenceEnd or recurrenceEnd >= startOfDay
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

    // 4. Fetch existing appointments for the service OR the staff
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: [AppointmentStatus.PENDING_APPROVAL, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay },
        OR: [
          { serviceId: serviceId },
          { staffId: { in: staffIds } }
        ]
      }
    });

    // 5. Generate possible slots for the day (Simplified: 00:00 to 23:59 based on working hours)
    // Here we'll build a map of available slots. 
    // In a production system we'd step through the day by `durationMins + bufferAfterMins`.
    const availableSlots: { key: string; startTime: string; endTime: string }[] = [];
    const totalSlotMins = businessService.durationMins + businessService.bufferBeforeMins + businessService.bufferAfterMins;

    // For each working hour block of each staff, check if a slot can fit
    for (const wh of workingHours) {
      // Parse HH:mm to minutes from midnight
      const [startH, startM] = wh.startTime.split(':').map(Number);
      const [endH, endM] = wh.endTime.split(':').map(Number);
      let currentMins = startH * 60 + startM;
      const endMins = endH * 60 + endM;

      while (currentMins + totalSlotMins <= endMins) {
        const slotStartMins = currentMins;
        const slotEndMins = currentMins + totalSlotMins;

        // Convert to UTC Dates for comparison
        const slotStart = new Date(startOfDay);
        slotStart.setUTCMinutes(slotStartMins);

        const slotEnd = new Date(startOfDay);
        slotEnd.setUTCMinutes(slotEndMins);

        // Check against time-off (including recurring blocks)
        const hasTimeOff = timeOffs.some(to => {
          if (to.staffId !== wh.staffId) return false;

          if (to.recurrence === 'NONE') {
            return to.startTime < slotEnd && to.endTime > slotStart;
          }

          // Recurring block (DAILY, WEEKLY)
          // 1. Must be on or after original start date, and on or before recurrenceEnd if defined
          if (slotEnd <= to.startTime) return false;
          if (to.recurrenceEnd && slotStart >= to.recurrenceEnd) return false;

          const blockTz = to.timezone || timezone || 'Australia/Sydney';
          const blockLocal = this.getLocalDayAndMins(to.startTime, blockTz);
          const blockLocalEnd = this.getLocalDayAndMins(to.endTime, blockTz);
          const slotLocal = this.getLocalDayAndMins(slotStart, blockTz);

          if (to.recurrence === 'WEEKLY') {
            // Must occur on the same local weekday in the business timezone
            if (blockLocal.dayOfWeek !== slotLocal.dayOfWeek) return false;
          }

          // Compare local time-of-day window (minutes from local midnight)
          const bStartMins = blockLocal.mins;
          let bEndMins = blockLocalEnd.mins;
          if (bEndMins <= bStartMins && to.endTime.getTime() > to.startTime.getTime()) {
            // Crossed midnight locally
            bEndMins += 1440;
          }

          let sStartMins = slotLocal.mins;
          let sEndMins = sStartMins + totalSlotMins;

          return sStartMins < bEndMins && sEndMins > bStartMins;
        });

        // Check against appointments (whether specific to this staff or general service capacity limit)
        // If appointment doesn't have staffId yet (PENDING), it consumes 1 generic capacity
        // If it does have staffId, it consumes THIS staff's capacity
        const overlappingAppointments = appointments.filter(a => 
          a.startTime < slotEnd && a.endTime > slotStart
        );

        const staffConflict = overlappingAppointments.some(a => a.staffId === wh.staffId);
        
        // PENDING appointments without staffId consume generic capacity. 
        // If generic overlapping >= total staff, we are full.
        const pendingGeneric = overlappingAppointments.filter(a => !a.staffId).length;
        const totalAvailableStaff = staffIds.length;
        const genericFull = pendingGeneric >= totalAvailableStaff;

        if (!hasTimeOff && !staffConflict && !genericFull) {
          // Add this slot to the Set (format HH:mm)
          const startStr = `${String(Math.floor(slotStartMins / 60)).padStart(2, '0')}:${String(slotStartMins % 60).padStart(2, '0')}`;
          const endStr = `${String(Math.floor(slotEndMins / 60)).padStart(2, '0')}:${String(slotEndMins % 60).padStart(2, '0')}`;
          
          // Ensure uniqueness of slots returned to customer
          const slotKey = `${startStr}-${endStr}`;
          if (!availableSlots.some(s => s.key === slotKey)) {
            availableSlots.push({
              key: slotKey,
              startTime: startStr,
              endTime: endStr
            });
          }
        }
        
        // Step forward by the slot duration
        currentMins += totalSlotMins;
      }
    }

    return {
      serviceId,
      date,
      availableSlots: availableSlots.map(s => ({ startTime: s.startTime, endTime: s.endTime })).sort((a, b) => a.startTime.localeCompare(b.startTime)),
    };
  }

  private getLocalDayAndMins(date: Date, tz: string): { dayOfWeek: number; mins: number } {
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
      // Fallback to UTC if timezone is invalid
      return {
        dayOfWeek: date.getUTCDay(),
        mins: date.getUTCHours() * 60 + date.getUTCMinutes(),
      };
    }
  }
}
