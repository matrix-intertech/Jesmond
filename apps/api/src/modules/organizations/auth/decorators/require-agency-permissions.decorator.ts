import { SetMetadata } from '@nestjs/common';
import { AgencyPermission } from '../agency-permissions.enum';

export const AGENCY_PERMISSIONS_KEY = 'agency_permissions';
export const RequireAgencyPermissions = (...permissions: AgencyPermission[]) => SetMetadata(AGENCY_PERMISSIONS_KEY, permissions);
