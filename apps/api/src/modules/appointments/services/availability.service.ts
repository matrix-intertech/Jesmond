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
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay }
      }
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

        // Check against time-off
        const hasTimeOff = timeOffs.some(to => 
          to.staffId === wh.staffId && 
          to.startTime < slotEnd && 
          to.endTime > slotStart
        );

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
}
