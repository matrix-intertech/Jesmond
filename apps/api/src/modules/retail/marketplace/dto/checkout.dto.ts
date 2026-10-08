import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FulfillmentType, PaymentMethod } from '@prisma/client';

export class CheckoutItemDto {
  @IsString()
  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  quantity: number;
}

export class DeliveryAddressDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  addressLine: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(10)
  postalCode: string;
}

export class CheckoutDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsEnum(FulfillmentType)
  fulfillmentType: FulfillmentType;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  deliveryAddress?: DeliveryAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items: CheckoutItemDto[];
}
