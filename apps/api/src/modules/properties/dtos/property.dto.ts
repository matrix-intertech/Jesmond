import { IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max, IsUUID, IsOptional, IsInt } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address!: string;

  @IsUUID()
  @IsNotEmpty()
  suburbId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  postcode!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @IsString()
  @IsNotEmpty()
  description!: string;
}

export class UpdatePropertyDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postcode?: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  lng?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(5000)
  pricePerWeek!: number; // In cents

  @IsNumber()
  @Min(0)
  inventory!: number;

  @IsUUID()
  @IsOptional()
  floorId?: string;
}

export class UpdateRoomTypeDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(5000)
  pricePerWeek?: number; // In cents, enforcing reasonable min

  @IsNumber()
  @IsOptional()
  @Min(0)
  inventory?: number;
}

export class UpdateAmenitiesDto {
  @IsString({ each: true })
  amenities!: string[];
}

export class UpdateAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  date!: string; // ISO String or YYYY-MM-DD

  @IsNumber()
  @Min(0)
  available!: number;
}

export class CreateBuildingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}

export class CreateFloorDto {
  @IsInt()
  @IsNotEmpty()
  level!: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;
}

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  identifier!: string;
}
