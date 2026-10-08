import { IsEnum } from 'class-validator';
import { FoodOrderStatus } from '@prisma/client';

export class UpdateFoodOrderStatusDto {
  @IsEnum(FoodOrderStatus)
  status: FoodOrderStatus;
}
