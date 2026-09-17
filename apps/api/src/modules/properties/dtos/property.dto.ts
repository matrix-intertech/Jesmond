import { IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max, IsUUID, IsOptional, IsInt, IsEnum } from 'class-validator';
import { PropertyListingMode, PropertyListingType, PropertyType, PropertyOfferingType, FurnishingType } from '@prisma/client';

export class CreatePropertyDto {
  @IsEnum(PropertyListingMode)
  @IsOptional()
  listingMode?: PropertyListingMode;

  @IsEnum(PropertyListingType)
  @IsOptional()
  listingType?: PropertyListingType;

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

  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @IsEnum(PropertyOfferingType)
  @IsOptional()
  offeringType?: PropertyOfferingType;

  @IsEnum(FurnishingType)
  @IsOptional()
  furnishingType?: FurnishingType;

  @IsOptional()
  furnishingFeatures?: any;

  @IsString()
  @IsOptional()
  availableFrom?: string;

  @IsInt()
  @IsOptional()
  minimumStay?: number;

  @IsString()
  @IsOptional()
  minimumStayUnit?: string;

  @IsInt()
  @IsOptional()
  maximumStay?: number;

  @IsString()
  @IsOptional()
  maximumStayUnit?: string;

  @IsInt()
  @IsOptional()
  maximumOccupancy?: number;

  @IsOptional()
  hasExistingResidents?: boolean;

  @IsOptional()
  configuration?: any;

  @IsNumber()
  @IsOptional()
  @Min(5000)
  pricePerWeek?: number; // In cents

  @IsOptional()
  showContactDetails?: boolean;
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

  @IsEnum(PropertyListingType)
  @IsOptional()
  listingType?: PropertyListingType;

  @IsEnum(PropertyType)
  @IsOptional()
  propertyType?: PropertyType;

  @IsEnum(PropertyOfferingType)
  @IsOptional()
  offeringType?: PropertyOfferingType;

  @IsEnum(FurnishingType)
  @IsOptional()
  furnishingType?: FurnishingType;

  @IsOptional()
  furnishingFeatures?: any;

  @IsString()
  @IsOptional()
  availableFrom?: string;

  @IsInt()
  @IsOptional()
  minimumStay?: number;

  @IsString()
  @IsOptional()
  minimumStayUnit?: string;

  @IsInt()
  @IsOptional()
  maximumStay?: number;

  @IsString()
  @IsOptional()
  maximumStayUnit?: string;

  @IsInt()
  @IsOptional()
  maximumOccupancy?: number;

  @IsOptional()
  hasExistingResidents?: boolean;

  @IsOptional()
  configuration?: any;

  @IsNumber()
  @IsOptional()
  @Min(5000)
  pricePerWeek?: number; // In cents

  @IsOptional()
  showContactDetails?: boolean;
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

  @IsInt()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  furnishing?: string;

  @IsString()
  @IsOptional()
  bathroomConfig?: string;
}

export class CreateResidentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsInt()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  ethnicity?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  shortBio?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  publicVisibility?: any;
}

export class UpdateResidentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsInt()
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  ethnicity?: string;

  @IsString()
  @IsOptional()
  occupation?: string;

  @IsString()
  @IsOptional()
  shortBio?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  publicVisibility?: any;
}

export class UpdateHouseRuleDto {
  @IsString()
  @IsOptional()
  smoking?: string;

  @IsString()
  @IsOptional()
  pets?: string;

  @IsString()
  @IsOptional()
  parties?: string;

  @IsString()
  @IsOptional()
  guests?: string;

  @IsString()
  @IsOptional()
  quietHoursStart?: string;

  @IsString()
  @IsOptional()
  quietHoursEnd?: string;

  @IsString()
  @IsOptional()
  additionalRules?: string;
}
