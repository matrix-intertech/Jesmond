import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateNameChangeRequestDto {
  @IsNotEmpty({ message: 'Proposed business name is required' })
  @IsString()
  @MinLength(2, { message: 'Proposed business name must be at least 2 characters' })
  @MaxLength(200, { message: 'Proposed business name cannot exceed 200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  proposedName: string;

  @IsNotEmpty({ message: 'Reason for business name change is required' })
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(1000, { message: 'Reason cannot exceed 1000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reason: string;
}
