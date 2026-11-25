import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrganizationsService } from '../services/organizations.service';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { BusinessCategory, OrgType } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(OrgType)
  @IsOptional()
  type?: OrgType;

  @IsEnum(BusinessCategory)
  @IsOptional()
  businessCategory?: BusinessCategory;

  @IsString()
  @IsOptional()
  onboardingToken?: string;

  @IsString()
  @IsOptional()
  abn?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsOptional()
  settings?: Record<string, any>;
}

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  /**
   * Initiates the server-verified business onboarding flow.
   * Generates a single-use cryptographically signed onboarding ticket.
   */
  @UseGuards(JwtAuthGuard)
  @Post('onboard/initiate')
  @HttpCode(HttpStatus.OK)
  async initiateOnboarding(@Request() req: any) {
    return this.organizationsService.initiateBusinessOnboarding(req.user.id);
  }

  /**
   * Creates an organization.
   * Requires a valid server-verified onboardingToken for ordinary users.
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrganization(
    @Request() req: any,
    @Body() dto: CreateOrganizationDto,
  ) {
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('Organization name is required');
    }

    // Accept onboarding token either from DTO or X-Onboarding-Token header
    const token =
      dto.onboardingToken ||
      (req.headers?.['x-onboarding-token'] as string) ||
      undefined;

    return this.organizationsService.createOrganizationForUser(
      req.user.id,
      { ...dto, onboardingToken: token },
      req.user?.role,
    );
  }
}
