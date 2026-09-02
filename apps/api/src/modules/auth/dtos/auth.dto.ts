import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import { OrgType } from '@prisma/client';

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
  @MaxLength(100)
  organizationName!: string;

  @IsEnum(OrgType)
  organizationType!: OrgType;
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
  @IsNotEmpty()
  email!: string;
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

