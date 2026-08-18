import { Injectable, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProviderSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getBusinessProfile(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, type: true, abn: true, timezone: true, branding: true }
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateBusinessProfile(organizationId: string, data: any) {
    try {
      return await this.prisma.organization.update({
        where: { id: organizationId },
        data: {
          name: data.name,
          abn: data.abn,
          timezone: data.timezone,
          branding: data.branding,
        },
        select: { id: true, name: true, type: true, abn: true, timezone: true, branding: true }
      });
    } catch (e) {
      throw new InternalServerErrorException('Failed to update business profile');
    }
  }

  async getPropertyDefaults(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true }
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org.settings || {};
  }

  async updatePropertyDefaults(orgId: string, data: any) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const currentSettings = (org.settings as object) || {};
    const updatedSettings = {
      ...currentSettings,
      propertyDefaults: {
        ...(currentSettings as any).propertyDefaults,
        ...data,
      }
    };

    return await this.prisma.organization.update({
      where: { id: orgId },
      data: { settings: updatedSettings as any }
    });
  }

  async getEnquiryPreferences(orgId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { settings: true } });
    if (!org) throw new NotFoundException('Organization not found');

    const settings = (org.settings as any) || {};
    return settings.enquiryPreferences || { emailNotifications: true, summaryEmails: false };
  }

  async updateEnquiryPreferences(orgId: string, data: any) {
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const currentSettings = (org.settings as object) || {};
    const updatedSettings = {
      ...currentSettings,
      enquiryPreferences: {
        ...(currentSettings as any).enquiryPreferences,
        ...data,
      }
    };

    return await this.prisma.organization.update({
      where: { id: orgId },
      data: { settings: updatedSettings as any },
      select: { settings: true }
    });
  }
}
