-- CreateEnum
CREATE TYPE "WhatsAppNotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SENT', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "whatsappNotifications" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "WhatsAppNotificationLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "userId" TEXT,
    "templateId" TEXT NOT NULL,
    "relatedEntityId" TEXT,
    "providerMessageId" TEXT,
    "status" "WhatsAppNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "failureReason" TEXT,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppNotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppNotificationLog_idempotencyKey_key" ON "WhatsAppNotificationLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "WhatsAppNotificationLog_recipient_idx" ON "WhatsAppNotificationLog"("recipient");

-- CreateIndex
CREATE INDEX "WhatsAppNotificationLog_eventType_idx" ON "WhatsAppNotificationLog"("eventType");

-- CreateIndex
CREATE INDEX "WhatsAppNotificationLog_status_idx" ON "WhatsAppNotificationLog"("status");

-- CreateIndex
CREATE INDEX "WhatsAppNotificationLog_relatedEntityId_idx" ON "WhatsAppNotificationLog"("relatedEntityId");

-- CreateIndex
CREATE INDEX "WhatsAppNotificationLog_createdAt_idx" ON "WhatsAppNotificationLog"("createdAt");

-- AddForeignKey
ALTER TABLE "WhatsAppNotificationLog" ADD CONSTRAINT "WhatsAppNotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

