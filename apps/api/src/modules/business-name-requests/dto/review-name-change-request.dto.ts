import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class ReviewNameChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Reviewer notes cannot exceed 1000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  reviewerNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Internal notes cannot exceed 1000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  internalNotes?: string;
}
