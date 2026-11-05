-- CreateEnum
CREATE TYPE "EmailNotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "EmailNotificationLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "userId" TEXT,
    "templateId" TEXT,
    "subject" TEXT NOT NULL,
    "relatedEntityId" TEXT,
    "status" "EmailNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "failureReason" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailNotificationLog_idempotencyKey_key" ON "EmailNotificationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_recipient_idx" ON "EmailNotificationLog"("recipient");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_eventType_idx" ON "EmailNotificationLog"("eventType");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_status_idx" ON "EmailNotificationLog"("status");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_relatedEntityId_idx" ON "EmailNotificationLog"("relatedEntityId");

-- CreateIndex
CREATE INDEX "EmailNotificationLog_createdAt_idx" ON "EmailNotificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "EmailNotificationLog" ADD CONSTRAINT "EmailNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

