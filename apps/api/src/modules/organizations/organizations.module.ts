import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OrganizationsController } from './controllers/organizations.controller';
import { OfficesController } from './controllers/offices.controller';
import { OrgStaffController } from './controllers/org-staff.controller';
import { ProviderVerificationController } from './controllers/provider-verification.controller';
import { AgencyController } from './controllers/agency.controller';

import { OrganizationsService } from './services/organizations.service';
import { OfficesService } from './services/offices.service';
import { OrgStaffService } from './services/org-staff.service';
import { ProviderVerificationService } from './services/provider-verification.service';
import { AgencyService } from './services/agency.service';
import { AgencyPermissionsService } from './services/agency-permissions.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (process.env.NODE_ENV === 'production' && !secret) {
          throw new Error(
            'JWT_SECRET must be explicitly configured in production environment.',
          );
        }
        return {
          secret: secret || 'fallback-secret-for-dev',
          signOptions: { expiresIn: '15m' },
        };
      },
    }),
  ],
  controllers: [
    OrganizationsController,
    OfficesController,
    OrgStaffController,
    ProviderVerificationController,
    AgencyController,
  ],
  providers: [
    OrganizationsService,
    OfficesService,
    OrgStaffService,
    ProviderVerificationService,
    AgencyService,
    AgencyPermissionsService,
  ],
  exports: [
    OrganizationsService,
    OrgStaffService,
    AgencyService,
    AgencyPermissionsService,
  ],
})
export class OrganizationsModule {}
