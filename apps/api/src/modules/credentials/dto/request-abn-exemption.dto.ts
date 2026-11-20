import { IsString, MinLength, MaxLength } from 'class-validator';

export class RequestAbnExemptionDto {
  @IsString()
  @MinLength(20, {
    message: 'Exemption reason must provide at least 20 characters of explanation',
  })
  @MaxLength(1000)
  reason: string;
}
