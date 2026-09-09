-- AlterTable
ALTER TABLE "OrgStaff" ADD COLUMN "retailBranchId" TEXT;

-- CreateIndex
CREATE INDEX "OrgStaff_retailBranchId_idx" ON "OrgStaff"("retailBranchId");

-- AddForeignKey
ALTER TABLE "OrgStaff" ADD CONSTRAINT "OrgStaff_retailBranchId_fkey" FOREIGN KEY ("retailBranchId") REFERENCES "RetailBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
