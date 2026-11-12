import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsDateString,
  IsISO31661Alpha2,
  ValidateIf,
} from 'class-validator';
import { OrgType, BusinessCategory } from '@prisma/client';

export class RegisterProviderDto {
  @IsString()
  @IsOptional()
  turnstileToken?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== undefined && val !== null && val !== '')
  @IsISO31661Alpha2({
    message: 'countryOfOrigin must be a valid ISO 3166-1 alpha-2 country code',
  })
  countryOfOrigin?: string;

  /** @deprecated Use countryOfOrigin instead */
  @IsString()
  @IsOptional()
  ethnicity?: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  organizationName!: string;

  @IsEnum(OrgType)
  organizationType!: OrgType;

  @IsEnum(BusinessCategory)
  @IsOptional()
  businessCategory?: BusinessCategory;
}

export class RegisterStudentDto {
  @IsString()
  @IsOptional()
  turnstileToken?: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  countryCode!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== undefined && val !== null && val !== '')
  @IsISO31661Alpha2({
    message: 'countryOfOrigin must be a valid ISO 3166-1 alpha-2 country code',
  })
  countryOfOrigin?: string;

  /** @deprecated Use countryOfOrigin instead */
  @IsString()
  @IsOptional()
  ethnicity?: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth!: string;
}

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class VerifyEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export class ResendOtpDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  channel?: 'email' | 'whatsapp' | 'both';
}

export class Login2faDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  code!: string;
}

export class RequestLoginOtpDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}

export class VerifyLoginOtpDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  channel?: 'email' | 'whatsapp' | 'both';
}

export class VerifyResetOtpDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;
}

export class ResetPasswordDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(6)
  otp!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword!: string;
}
