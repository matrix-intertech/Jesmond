-- CreateEnum
CREATE TYPE "AgencyRole" AS ENUM ('AGENCY_ADMIN', 'TEAM_MEMBER');

-- AlterTable
ALTER TABLE "OrgStaff" ADD COLUMN     "agencyRole" "AgencyRole";
