import { IsEnum, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';
import { WhatsAppEvent } from '../constants/whatsapp.constants';

export class SendWhatsAppDto {
  @IsEnum(WhatsAppEvent)
  @IsNotEmpty()
  event!: WhatsAppEvent;

  @IsString()
  @IsNotEmpty()
  recipient!: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string | number>;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

