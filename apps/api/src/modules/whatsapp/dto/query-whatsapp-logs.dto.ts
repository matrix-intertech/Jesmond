import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { WhatsAppEvent } from '../constants/whatsapp.constants';
import { WhatsAppNotificationStatus } from '@prisma/client';

export class QueryWhatsAppLogsDto {
  @IsOptional()
  @IsEnum(WhatsAppEvent)
  event?: WhatsAppEvent;

  @IsOptional()
  @IsEnum(WhatsAppNotificationStatus)
  status?: WhatsAppNotificationStatus;

  @IsOptional()
  @IsString()
  recipient?: string;

  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

