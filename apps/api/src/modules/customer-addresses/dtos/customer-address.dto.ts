import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateCustomerAddressDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  label?: string; // 'Home', 'Work', 'Other'

  @IsString()
  @IsOptional()
  @MaxLength(100)
  recipientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Street address is required' })
  @MinLength(3)
  @MaxLength(200)
  streetAddress: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  unitNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  suburb?: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsString()
  @IsNotEmpty({ message: 'State is required' })
  @MinLength(2)
  @MaxLength(50)
  state: string;

  @IsString()
  @IsNotEmpty({ message: 'Postcode is required' })
  @MinLength(3)
  @MaxLength(12)
  postcode: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  instructions?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

export class UpdateCustomerAddressDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  label?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  recipientName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  streetAddress?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  unitNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  suburb?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(50)
  state?: string;

  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(12)
  postcode?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  instructions?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}
