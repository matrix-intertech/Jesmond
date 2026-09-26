import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgencyPermission } from '../auth/agency-permissions.enum';
import { AgencyRole } from '@prisma/client';

export const SYSTEM_ROLE_ADMIN = 'Admin';
export const SYSTEM_ROLE_TEAM_MEMBER = 'Team Member';

export const DEFAULT_ADMIN_PERMISSIONS = Object.values(AgencyPermission);
export const DEFAULT_TEAM_MEMBER_PERMISSIONS = [
  AgencyPermission.PROPERTY_VIEW,
  AgencyPermission.LEAD_VIEW,
  AgencyPermission.ENQUIRY_VIEW,
  AgencyPermission.TEAM_VIEW,
];

@Injectable()
export class AgencyPermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Ensure system roles exist in the database for the given organization.
   * This allows their permissions to be configured via the UI.
   */
  async ensureSystemRoles(organizationId: string) {
    const systemRoles = [
      { name: SYSTEM_ROLE_ADMIN, description: 'Full access to agency settings, team, and all properties.', permissions: DEFAULT_ADMIN_PERMISSIONS, isSystem: true },
      { name: SYSTEM_ROLE_TEAM_MEMBER, description: 'Standard team member with basic access.', permissions: DEFAULT_TEAM_MEMBER_PERMISSIONS, isSystem: true }
    ];

    for (const role of systemRoles) {
      const exists = await this.prisma.agencyCustomRole.findFirst({
        where: { organizationId, name: role.name, isSystem: true }
      });
      if (!exists) {
        await this.prisma.agencyCustomRole.create({
          data: {
            organizationId,
            name: role.name,
            description: role.description,
            permissions: role.permissions,
            isSystem: true
          }
        });
      }
    }
  }

  /**
   * Calculate effective permissions for a user within an organization.
   */
  async getEffectivePermissions(userId: string, organizationId: string): Promise<string[]> {
    const orgStaff = await this.prisma.orgStaff.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { customRole: true }
    });

    if (!orgStaff) return [];

    let effectivePermissions: string[] = [];

    // 1. If assigned to a custom role
    if (orgStaff.customRole) {
      effectivePermissions = [...orgStaff.customRole.permissions];
    }
    // 2. If assigned to a system role (via agencyRole enum)
    else if (orgStaff.agencyRole) {
      const systemRoleName = orgStaff.agencyRole === AgencyRole.AGENCY_ADMIN ? SYSTEM_ROLE_ADMIN : SYSTEM_ROLE_TEAM_MEMBER;

      const systemRole = await this.prisma.agencyCustomRole.findFirst({
        where: { organizationId, name: systemRoleName, isSystem: true }
      });

      if (systemRole) {
        effectivePermissions = [...systemRole.permissions];
      } else {
        // Fallback if not yet created in DB
        const defaultPerms = systemRoleName === SYSTEM_ROLE_ADMIN ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_TEAM_MEMBER_PERMISSIONS;
        effectivePermissions = [...defaultPerms];
      }
    }

    // Merge any legacy OrgStaff.permissions just in case there were direct overrides
    if (orgStaff.permissions && orgStaff.permissions.length > 0) {
      effectivePermissions = [...new Set([...effectivePermissions, ...orgStaff.permissions])];
    }

    // Implicit full access for global Admins is typically handled at the Guard level,
    // but if AGENCY_ADMIN has '*' in their DB role, we respect that.

    return effectivePermissions;
  }
}
