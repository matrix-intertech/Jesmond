-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailOtpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "emailOtpLastSentAt" TIMESTAMP(3);

-- Grandfather existing users securely without overriding disabled statuses
UPDATE "User" 
SET "emailVerified" = true,
    "accountStatus" = CASE 
        WHEN "accountStatus" = 'PENDING_VERIFICATION' THEN 'ACTIVE'::"AccountStatus"
        ELSE "accountStatus"
    END
WHERE "emailVerificationToken" IS NULL;
