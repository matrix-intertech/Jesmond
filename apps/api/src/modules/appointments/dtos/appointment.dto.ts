import { IsString, IsNotEmpty, IsDateString, IsOptional, IsEnum } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class CreateAppointmentDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  @IsString()
  @IsOptional()
  customerNotes?: string;
}

export class ApproveAppointmentDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;
}

export class RejectAppointmentDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus)
  @IsNotEmpty()
  status: AppointmentStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
