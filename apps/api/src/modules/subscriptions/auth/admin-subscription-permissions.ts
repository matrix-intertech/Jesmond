import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export enum AdminSubscriptionPermission {
  SUBSCRIPTION_SWITCHES_MANAGE = 'SUBSCRIPTION_SWITCHES_MANAGE',
  SUBSCRIPTION_PLANS_MANAGE = 'SUBSCRIPTION_PLANS_MANAGE',
  SUBSCRIPTION_FEATURES_MANAGE = 'SUBSCRIPTION_FEATURES_MANAGE',
  SUBSCRIPTION_ORG_ASSIGN = 'SUBSCRIPTION_ORG_ASSIGN',
  SUBSCRIPTION_ENTERPRISE_MANAGE = 'SUBSCRIPTION_ENTERPRISE_MANAGE',
  SUBSCRIPTION_STATUS_MANAGE = 'SUBSCRIPTION_STATUS_MANAGE',
  SUBSCRIPTION_BILLING_VIEW = 'SUBSCRIPTION_BILLING_VIEW',
}

export const ADMIN_SUBSCRIPTION_PERMISSIONS_KEY =
  'admin_subscription_permissions';

export const RequireAdminSubscriptionPermissions = (
  ...permissions: AdminSubscriptionPermission[]
) => SetMetadata(ADMIN_SUBSCRIPTION_PERMISSIONS_KEY, permissions);

export async function assertAdminSubscriptionPermissions(
  user: any,
  required: AdminSubscriptionPermission[],
  prisma?: PrismaService,
): Promise<boolean> {
  if (!required || required.length === 0) {
    return true;
  }

  if (!user) {
    throw new ForbiddenException('Authentication required');
  }

  if (user.role === UserRole.SUPER_ADMIN) {
    return true;
  }

  if (user.role !== UserRole.ADMIN) {
    throw new ForbiddenException('Administrative role required');
  }

  let permissions: string[] = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  if (permissions.length === 0 && user.id && prisma) {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { permissions: true },
    });
    permissions = dbUser?.permissions ?? [];
  }

  if (permissions.includes('*')) {
    return true;
  }

  const hasAll = required.every((perm) => permissions.includes(perm));
  if (!hasAll) {
    throw new ForbiddenException(
      `Missing required admin subscription permission: ${required.join(', ')}`,
    );
  }

  return true;
}

@Injectable()
export class AdminSubscriptionPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<
      AdminSubscriptionPermission[]
    >(ADMIN_SUBSCRIPTION_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    return assertAdminSubscriptionPermissions(
      request.user,
      required,
      this.prisma,
    );
  }
}
