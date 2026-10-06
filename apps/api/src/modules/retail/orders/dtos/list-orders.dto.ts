import { IsOptional, IsEnum, IsString } from 'class-validator';
import { FulfillmentType } from '@prisma/client';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(FulfillmentType)
  fulfillmentType?: FulfillmentType;
}
