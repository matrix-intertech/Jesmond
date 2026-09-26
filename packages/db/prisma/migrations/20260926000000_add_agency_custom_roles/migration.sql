-- CreateTable
CREATE TABLE "AgencyCustomRole" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyCustomRole_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "OrgStaff" ADD COLUMN "customRoleId" TEXT;

-- CreateIndex
CREATE INDEX "AgencyCustomRole_organizationId_idx" ON "AgencyCustomRole"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyCustomRole_organizationId_name_key" ON "AgencyCustomRole"("organizationId", "name");

-- CreateIndex
CREATE INDEX "OrgStaff_customRoleId_idx" ON "OrgStaff"("customRoleId");

-- AddForeignKey
ALTER TABLE "AgencyCustomRole" ADD CONSTRAINT "AgencyCustomRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgStaff" ADD CONSTRAINT "OrgStaff_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "AgencyCustomRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;
