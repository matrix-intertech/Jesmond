import { IsString, IsNotEmpty, MaxLength, IsNumber, Min, Max, IsUUID, IsOptional } from 'class-validator';

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

export class CreateRoomTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  pricePerWeek!: number; // In cents

  @IsNumber()
  @Min(0)
  inventory!: number;
}

export class UpdateAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  date!: string; // ISO String or YYYY-MM-DD

  @IsNumber()
  @Min(0)
  available!: number;
}
