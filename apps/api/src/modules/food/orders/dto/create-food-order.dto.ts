import { IsString, IsArray, ValidateNested, IsInt, Min, ArrayMinSize, IsEnum, IsOptional, ValidateIf, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { FoodOrderFulfillmentType } from '@prisma/client';

export class CreateFoodOrderItemDto {
  @IsString()
  foodMenuItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class FoodDeliveryAddressDto {
  @IsString()
  name: string;
  @IsString()
  phone: string;
  @IsString()
  addressLine1: string;
  @IsString()
  @IsOptional()
  addressLine2?: string;
  @IsString()
  city: string;
  @IsString()
  @IsOptional()
  state?: string;
  @IsString()
  postalCode: string;
}

export class CreateFoodOrderDto {
  @IsString()
  branchId: string;

  @IsEnum(FoodOrderFulfillmentType)
  fulfillmentType: FoodOrderFulfillmentType;

  @ValidateIf(o => o.fulfillmentType === FoodOrderFulfillmentType.DELIVERY)
  @IsObject()
  @ValidateNested()
  @Type(() => FoodDeliveryAddressDto)
  deliveryAddress?: FoodDeliveryAddressDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateFoodOrderItemDto)
  items: CreateFoodOrderItemDto[];
}
