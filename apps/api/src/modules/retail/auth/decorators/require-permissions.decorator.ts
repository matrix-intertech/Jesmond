import { SetMetadata } from '@nestjs/common';
import { RetailPermission } from '../retail-permissions.enum';

export const PERMISSIONS_KEY = 'retail_permissions';
export const RequirePermissions = (...permissions: RetailPermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
