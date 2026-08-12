import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsNotEmpty } from 'class-validator';
import { OrgType } from '@prisma/client';

export class RegisterProviderDto {
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

