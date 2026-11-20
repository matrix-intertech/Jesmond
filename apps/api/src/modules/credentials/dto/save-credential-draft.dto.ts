import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class SaveCredentialDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  credentialNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  holderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  state?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isDraft?: boolean;
}
