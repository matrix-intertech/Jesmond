-- CreateTable
CREATE TABLE "PropertyManager" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "orgStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyManager_propertyId_idx" ON "PropertyManager"("propertyId");

-- CreateIndex
CREATE INDEX "PropertyManager_orgStaffId_idx" ON "PropertyManager"("orgStaffId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyManager_propertyId_orgStaffId_key" ON "PropertyManager"("propertyId", "orgStaffId");

-- AddForeignKey
ALTER TABLE "PropertyManager" ADD CONSTRAINT "PropertyManager_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyManager" ADD CONSTRAINT "PropertyManager_orgStaffId_fkey" FOREIGN KEY ("orgStaffId") REFERENCES "OrgStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
