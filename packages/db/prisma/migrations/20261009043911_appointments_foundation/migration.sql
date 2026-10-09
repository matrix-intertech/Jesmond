-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING_APPROVAL', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "BusinessService" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMins" INTEGER NOT NULL,
    "bufferBeforeMins" INTEGER NOT NULL DEFAULT 0,
    "bufferAfterMins" INTEGER NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffServiceAssignment" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffServiceAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffWorkingHours" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffWorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffTimeOff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "staffId" TEXT,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "customerNotes" TEXT,
    "rejectionReason" TEXT,
    "cancellationReason" TEXT,
    "serviceName" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AUD',
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentStatusHistory" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessService_organizationId_idx" ON "BusinessService"("organizationId");

-- CreateIndex
CREATE INDEX "BusinessService_branchId_idx" ON "BusinessService"("branchId");

-- CreateIndex
CREATE INDEX "StaffServiceAssignment_serviceId_idx" ON "StaffServiceAssignment"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffServiceAssignment_staffId_serviceId_key" ON "StaffServiceAssignment"("staffId", "serviceId");

-- CreateIndex
CREATE INDEX "StaffWorkingHours_staffId_idx" ON "StaffWorkingHours"("staffId");

-- CreateIndex
CREATE INDEX "StaffWorkingHours_staffId_dayOfWeek_idx" ON "StaffWorkingHours"("staffId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "StaffTimeOff_staffId_idx" ON "StaffTimeOff"("staffId");

-- CreateIndex
CREATE INDEX "StaffTimeOff_startTime_endTime_idx" ON "StaffTimeOff"("startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_idempotencyKey_key" ON "Appointment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Appointment_organizationId_idx" ON "Appointment"("organizationId");

-- CreateIndex
CREATE INDEX "Appointment_branchId_idx" ON "Appointment"("branchId");

-- CreateIndex
CREATE INDEX "Appointment_customerId_idx" ON "Appointment"("customerId");

-- CreateIndex
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");

-- CreateIndex
CREATE INDEX "Appointment_staffId_idx" ON "Appointment"("staffId");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_startTime_endTime_idx" ON "Appointment"("startTime", "endTime");

-- CreateIndex
CREATE INDEX "AppointmentStatusHistory_appointmentId_idx" ON "AppointmentStatusHistory"("appointmentId");

-- AddForeignKey
ALTER TABLE "BusinessService" ADD CONSTRAINT "BusinessService_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessService" ADD CONSTRAINT "BusinessService_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RetailBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffServiceAssignment" ADD CONSTRAINT "StaffServiceAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "OrgStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffServiceAssignment" ADD CONSTRAINT "StaffServiceAssignment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BusinessService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkingHours" ADD CONSTRAINT "StaffWorkingHours_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "OrgStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTimeOff" ADD CONSTRAINT "StaffTimeOff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "OrgStaff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RetailBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "BusinessService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "OrgStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
