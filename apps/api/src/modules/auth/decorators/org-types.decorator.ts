import { SetMetadata } from '@nestjs/common';
import { OrgType } from '@prisma/client';

export const ORG_TYPES_KEY = 'orgTypes';
export const OrgTypes = (...types: OrgType[]) => SetMetadata(ORG_TYPES_KEY, types);
