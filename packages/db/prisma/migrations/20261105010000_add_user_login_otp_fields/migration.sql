-- AlterTable
ALTER TABLE "User" ADD COLUMN "loginOtpToken" TEXT,
ADD COLUMN "loginOtpExpiresAt" TIMESTAMP(3),
ADD COLUMN "loginOtpAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loginOtpLastSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_loginOtpToken_key" ON "User"("loginOtpToken");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

