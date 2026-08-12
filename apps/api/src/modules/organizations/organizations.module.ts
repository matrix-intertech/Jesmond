import { Module } from '@nestjs/common';
import { OrganizationsController } from './controllers/organizations.controller';
import { OfficesController } from './controllers/offices.controller';
import { OrgStaffController } from './controllers/org-staff.controller';
import { ProviderVerificationController } from './controllers/provider-verification.controller';

import { OrganizationsService } from './services/organizations.service';
import { OfficesService } from './services/offices.service';
import { OrgStaffService } from './services/org-staff.service';
import { ProviderVerificationService } from './services/provider-verification.service';

@Module({
  imports: [],
  controllers: [
    OrganizationsController,
    OfficesController,
    OrgStaffController,
    ProviderVerificationController,
  ],
  providers: [
    OrganizationsService,
    OfficesService,
    OrgStaffService,
    ProviderVerificationService,
  ],
  exports: [OrganizationsService, OrgStaffService],
})
export class OrganizationsModule {}
