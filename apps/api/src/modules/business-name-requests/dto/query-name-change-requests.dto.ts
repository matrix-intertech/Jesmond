import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessNameChangeStatus } from '@prisma/client';

export class QueryNameChangeRequestsDto {
  @IsOptional()
  @IsEnum(BusinessNameChangeStatus)
  status?: BusinessNameChangeStatus;

  @IsOptional()
  @IsString()
  search?: string;

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
