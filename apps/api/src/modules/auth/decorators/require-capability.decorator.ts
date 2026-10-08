import { SetMetadata } from '@nestjs/common';
import { BusinessCapability } from '../business-capabilities';

export const CAPABILITIES_KEY = 'business_capabilities';
export const RequireCapability = (...capabilities: BusinessCapability[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
