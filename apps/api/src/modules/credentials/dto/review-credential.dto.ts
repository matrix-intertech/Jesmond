import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewCredentialDto {
  @IsEnum(['VERIFIED', 'REJECTED', 'NEEDS_INFORMATION'], {
    message: 'Decision must be one of: VERIFIED, REJECTED, NEEDS_INFORMATION',
  })
  decision: 'VERIFIED' | 'REJECTED' | 'NEEDS_INFORMATION';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  internalNotes?: string;
}
