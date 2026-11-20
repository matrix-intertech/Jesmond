import { IsEnum, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class ReviewAbnExemptionDto {
  @IsEnum(['APPROVED', 'REJECTED'], {
    message: 'Decision must be either APPROVED or REJECTED',
  })
  decision: 'APPROVED' | 'REJECTED';

  @IsString()
  @MinLength(5, { message: 'Notes must provide at least 5 characters of feedback' })
  @MaxLength(1000)
  notes: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;
}
