import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateIf,
} from 'class-validator';
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

export class CreateBusinessServiceDto {
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty()
  durationMins: number;

  @IsNumber()
  @IsOptional()
  price?: number; // in cents AUD

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  bufferBeforeMins?: number;

  @IsNumber()
  @IsOptional()
  bufferAfterMins?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  staffIds?: string[];
}

export class UpdateBusinessServiceDto {
  @IsString()
  @IsOptional()
  categoryId?: string | null;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  durationMins?: number;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @IsOptional()
  bufferBeforeMins?: number;

  @IsNumber()
  @IsOptional()
  bufferAfterMins?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  staffIds?: string[];
}

export class CreateServiceCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateServiceCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignServiceCategoryDto {
  @ValidateIf((o) => o.categoryId !== null && o.categoryId !== undefined)
  @IsString()
  @IsNotEmpty()
  categoryId?: string | null;
}

export class CreateTimeOffDto {
  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsEnum(['LEAVE', 'BREAK', 'OFFLINE_WORK', 'COMMITMENT', 'OTHER'])
  @IsOptional()
  type?: 'LEAVE' | 'BREAK' | 'OFFLINE_WORK' | 'COMMITMENT' | 'OTHER';

  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(['NONE', 'DAILY', 'WEEKLY'], {
    message: 'recurrence must be one of: NONE, DAILY, WEEKLY (CUSTOM recurrence is not supported in Phase 5)',
  })
  @IsOptional()
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY';

  @IsDateString()
  @IsOptional()
  recurrenceEnd?: string;
}

export class UpdateTimeOffDto {
  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsDateString()
  @IsOptional()
  endTime?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsEnum(['LEAVE', 'BREAK', 'OFFLINE_WORK', 'COMMITMENT', 'OTHER'])
  @IsOptional()
  type?: 'LEAVE' | 'BREAK' | 'OFFLINE_WORK' | 'COMMITMENT' | 'OTHER';

  @IsString()
  @IsOptional()
  reason?: string;

  @IsEnum(['NONE', 'DAILY', 'WEEKLY'], {
    message: 'recurrence must be one of: NONE, DAILY, WEEKLY (CUSTOM recurrence is not supported in Phase 5)',
  })
  @IsOptional()
  recurrence?: 'NONE' | 'DAILY' | 'WEEKLY';

  @IsDateString()
  @IsOptional()
  recurrenceEnd?: string;
}

export class CreateOfflineAppointmentDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  staffId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
